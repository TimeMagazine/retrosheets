var get_data = require("./lib/get_data"),
	parse_game_log = require("./lib/parse_game_log"),
	fs = require("fs"),
	moment = require("moment"),
	events = require("./lib/events");

var args = require('minimist')(process.argv.slice(2)),
	db;

function download(args, callback) {
	var year = args.year,
		start = args.start || year,
		end = args.end || year,
		type = args.type || "game_log";

	for (var y = start; y <= end; y += 1) {
		get_data(y, type, callback);
	}
}


function add_games(args, db) {
	var year = args.year,
		start = args.start || year,
		end = args.end || year;

	var collection = db.collection("games"),
		count = 0;

	for (var y = start; y <= end; y += 1) {
		download(args, function(data) {
			count += 1;
			var game = parse_game_log(data);
			collection.insert(game, function() {
				count -= 1;
				console.log(count);
			});
		})
	}
}

function get_seasons(args) {
	var collection = db.collection(opts.postseason ? "postseason" : "season"),
		years = {},
		filename = opts.postseason ? "postseason" : "regular";

	var postseason;
	try {
		postseason = require("./json/postseason_teams.json");
	} catch(e) {
		postseason = null;
	}

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
				get_record(db, { team: team, year: c }, function(rec) {
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

function parse_regular_season(db) {
	for (var c = 1996; c <= 2013; c += 1) {
		parse_year(db, String(c))
	}
}

function parse_postseason(db) {
	parse_year(db, "lc");
	parse_year(db, "dv");
	parse_year(db, "ws");
}


function get_record(db, opts, callback) {
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

function get_events(db, args) {
	var collection = db.collection("events");
	var count = 0;

	function callback(game) {
		game._id = game.id;
		collection.insert(game, function(err, doc) {
			count += 1;
			//console.log(count);
		});
	}

	if (args.team && args.year) {
		events.by_team_and_year(args.team, args.year, callback);
	} else if (args.start && args.end) {
		var year = args.start - 1;
		var done = function() {
			year += 1;
			if (year <= args.end) {
				console.log("Starting", year);
				events.by_year(year, callback, done);
			}
		}

		done();
	} else {
		//events.by_year(args.year, callback);		
	}
}

var commands = {
	download: download,
	events: get_events,
	add_games: add_games,
	season: parse_regular_season,
	postseason: parse_postseason,
	write: get_seasons,
	record: get_record
}

var MongoClient = require('mongodb').MongoClient;

// Connect to the db
MongoClient.connect("mongodb://localhost:27017/baseball", function(err, db) {
	if(!err) {
		console.log("connected to MongoDB");
		commands[args._[0]](args, db);
	} else {
		console.log(err);
	}
});