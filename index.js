var DATA_URL = "http://www.retrosheet.org/gamelogs/gl$year.zip",
	FILENAME = "data/GL$year.TXT";

var AdmZip = require("adm-zip"),
	fs = require("fs"),
	mkdirp = require("mkdirp"),
	log = require("npmlog"),
	http = require("http"),
	csv = require('fast-csv'),
	moment = require("moment");

function downloadZipfile(url, filename, callback) {
	// download zip file of data
	if (fs.existsSync(filename)) {
		log.info("Already have " + filename + " downloaded. Unzipping to ./data");
		unzip();
		return;
	}

	log.info("Downloading " + filename + " from " + url);

	var f = fs.createWriteStream(filename);

	f.on('finish', function() {
        // unzip
		log.info("Finished downloading. Unzipping to ./data");
		unzip();
    });

	var request = http.get(url, function(response) {
		response.pipe(f);
	});

	function unzip() {
		var zip = new AdmZip(filename);
		zip.extractAllTo("./data");

		//fs.unlink(filename, function() {
		log.info("Finished unzipping. Deleted");
		if (callback) {
			callback();
		}		
		//});
	}
}

function getYear(year, callback) {
	mkdirp("/data", function() {
		downloadZipfile(DATA_URL.replace("$year", year), "cache/" + year + ".zip", function() {
			var games = [];
			csv.fromPath(FILENAME.replace("$year", year))
				.on("record", function(data){
					callback(data);
				});
		});
	});
}

function parseYear(db, year) {
	if (year.replace(/\d+/, "") != "") {
		var collection = db.collection("postseason");
	} else {
		var collection = db.collection("season");
	}

	getYear(year, function(data) {
		var game = {};
		game.date = moment(data[0], "YYYYMMDD")._d;
		game.visitor = {
			team: data[3],
			league: data[4],
			game: parseInt(data[5]),
			runs: parseInt(data[9], 10),
			box: data[19],
			offense: {},
			defense: {},
			pitching: {}
		};

		game.hometeam = {
			team: data[6],
			league: data[7],
			game: data[8],
			runs: parseInt(data[10], 10),
			box: data[20],
			offense: {},
			defense: {},
			pitching: {}
		};

		game.info = {
			outs: parseInt(data[11], 10),
			day_or_night: data[12],
			completion: data[13],
			forfeit: data[14],
			protest: data[15],
			park: data[16],
			attendance: parseInt(data[17]),
			time: parseInt(data[18]),
			notes: data[159],
			retrosheets: data[160]
		};

		var offense = ["at_bats", "hits", "doubles", "triples", "homeruns", "RBI", "sacrifices", "sacrifices_since_1954", "hit_by_pitch", "walks", "intentional_walks", "strikeouts", "stolen_bases", "caught_stealing", "GIDP", "catcher_interference", "left_on_base"];

		offense.forEach(function(stat, s) {
			game.visitor.offense[stat] = parseInt(data[s+21], 10);
			game.hometeam.offense[stat] = parseInt(data[s+49], 10);
		});

		var pitching = ["pitchers_used", "individual_earned_runs", "team_earned_runs", "wild_pitches", "balks"];

		pitching.forEach(function(stat, s) {
			game.visitor.pitching[stat] = parseInt(data[s+38], 10);
			game.hometeam.pitching[stat] = parseInt(data[s+66], 10);
		});

		var defense = ["putouts", "assists", "errors", "passed_balls", "double_plays", "triple_plays"];

		defense.forEach(function(stat, s) {
			game.visitor.defense[stat] = parseInt(data[s+43], 10);
			game.hometeam.defense[stat] = parseInt(data[s+71], 10);
		});		

		game._id = game.hometeam.team + "_" + game.hometeam.league + "_" + game.hometeam.game + "_" + data[0];

		// additional stats
		if (game.hometeam.runs > game.visitor.runs) {
			game.winner = game.hometeam.team;
		} else if (game.visitor.runs > game.hometeam.runs) {
			game.winner = game.visitor.team;
		} else {
			game.winner = null;
		}

		collection.insert(game, function() {

		});
	});
}

function getSeasons(db, opts) {
	var collection = db.collection(opts.postseason ? "postseason" : "season"),
		years = {},
		filename = opts.postseason ? "postseason" : "regular";

	var postseason;
	try {
		postseason = require("./json/postseason_teams.json");
	} catch(e) {
		postseason = null;
	}
	console.log(postseason);

	collection.find({ winner: { $ne: null }}).toArray(function(err, games) {
		games.forEach(function(game) {
			var year = game.date.getFullYear();		
			years[year] = years[year] || [];
			if (years[year].indexOf(game.hometeam.team) == -1) {
				years[year].push(game.hometeam.team);
			}
			if (years[year].indexOf(game.visitor.team) == -1) {
				years[year].push(game.visitor.team);
			}
		});
		fs.writeFileSync("./json/" + filename + "_teams.json", JSON.stringify(years, null, 2));

		var data = {},
			seasons = [];

		var count = 0;		

		for (var c = 1996; c <= 2013; c += 1) {
			seasons.push(c);
		}

		seasons.forEach(function(c) {
			years[c].forEach(function(team) {
				count += 1;
				getRecord(db, { team: team, year: c }, function(rec) {
					data[team + "_" + c] = {
						record: rec
					};
					if (postseason) {
						data[team + "_" + c].postseason = postseason[c].indexOf(team) !== -1 ? 1 : 0
					}
					count -= 1;
					console.log(count, team, c, data[team + "_" + c].postseason);
					if (count === 0) {
						db.close();
						fs.writeFileSync("./json/" + filename + "_records.json", JSON.stringify(data));
					}
				});				
			});
		});

	});
}

function parseRegularSeason(db) {
	for (var c = 1996; c <= 2013; c += 1) {
		parseYear(db, String(c))
	}
}

function parsePostSeason(db) {
	parseYear(db, "lc");
	parseYear(db, "dv");
	parseYear(db, "ws");
}


function getRecord(db, opts, callback) {
	var collection = db.collection("season"),
		year = parseInt(opts.year),
		team = opts.team,
		record = [0, 0],
		records = [];

	var cursor = collection.find({ $or: [ { "hometeam.team": team }, { "visitor.team": team }], date: { $gte: new Date(year, 1, 0), $lte: new Date(year+1, 1, 0) } }).sort({ date: 1 });

	cursor.each(function(err, doc) {
		if (doc) {
			record[((doc.hometeam.team === team) === (doc.hometeam.runs > doc.visitor.runs)) ? 0 : 1]++;
			records.push([record[0], record[1]]);
		} else {
			callback(records);
		}
	});

}

var argv = require('optimist').argv;

var commands = {
	parse: parseYear,
	season: parseRegularSeason,
	postseason: parsePostSeason,
	write: getSeasons,
	record: getRecord
}



var MongoClient = require('mongodb').MongoClient;

// Connect to the db
MongoClient.connect("mongodb://localhost:27017/baseball", function(err, db) {
	if(!err) {		
		log.info("connected");
		commands[argv._[0]](db, argv);
	} else {
		log.error(err);
	}
});

/*
getYear("2013", function(data) {
	console.log(data.length);
});
*/