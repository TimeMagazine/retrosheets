var fs = require("fs");
var csv = require('fast-csv');
var moment = require("moment");

var args = require('minimist')(process.argv.slice(2));
var PREFIX = "/Users/cwilson1130/Desktop/baseball/data/";

var positions = {
	"1":  [ "P",  "Pitcher" ],
	"2":  [ "C",  "Catcher" ],
	"3":  [ "1B", "First baseman" ],
	"4":  [ "2B", "Second baseman" ],
	"5":  [ "3B", "Third baseman" ],
	"6":  [ "SS", "Shortstop" ],
	"7":  [ "LF", "Left field" ],
	"8":  [ "CF", "Center field" ],
	"9":  [ "RF", "Right field" ],
	"10": [ "DH", "Designated Hitter"]
};


module.exports.by_year = function(year, callback, done) {
	var pattern = /(\d{4})([A-Z0-9]+)\.EV*/;
	var files = fs.readdirSync(PREFIX).filter(function(d) {
		var m = pattern.exec(d);
		return m && m[1] == year;
	}).map(function(d) {
		var m = pattern.exec(d);
		return {
			year: m[1],
			team: m[2]
		}
	});

	var count = 0;

	files.forEach(function(team) {
		by_team_and_year(team.team, team.year, function(data, finished) {
			if (!data) {
				return;
			}
			callback(data);
			if (finished) {
				count += 1;
				if (count === files.length) {
					done && done();
				}
			}
		});
	});
}



// for a given year and team, get the 9 players who started on opening day
var by_team_and_year = module.exports.by_team_and_year = function(team, year, callback) {
	var stub = PREFIX + year + team,
		filename = fs.existsSync(stub + ".EVA")? (stub + ".EVA") : (stub + ".EVN");

	var game = null

	csv.fromPath(filename)
		.on("data", function(data){
			if (data[0] === "id") { // we've reached a new game
				game && callback(game);

				game = {
					id: data[1],
					season: parseInt(year, 10),
					info: {
					},
					starters: {}
				};
			}

			if (data[0] === "info") {
				game.info[data[1]] = data[2] || true;
				if (data[1] == "date") {
					game.info.date = moment(data[2], "YYYY/MM/DD")._d;
				}		
			} else if (data[0] === "start") {
				game.starters[game.info.visteam] = game.starters[game.info.visteam] || {};
				game.starters[game.info.hometeam] = game.starters[game.info.hometeam] || {};

				// there's occassionally an extra character
				data[5] = data[5].replace(/[^\d]/g, "");

				var position = positions[data[5]],
					team = data[3]=="0" ? game.info.visteam : game.info.hometeam;

				if (!position) {
					console.log(data);
				}

				game.starters[team][position[0]] = {
					id: data[1],
					name: data[2],
					position: position[1],
					batting_order: data[4]
				};
			}
		})
		.on("end", function(){
			callback(game, true);
		})
		.on("error", function(e) {
			console.log(e, team, year);
			//callback(null);
		});
}

// get the OD roster for a given team for every year in range
function get_opening_day_rosters(team, start_year, end_year, callback) {
	var count = 1 + end_year - start_year,
		games = [];

	for (var year = start_year; year <= end_year; year += 1) {
		get_opening_day_roster(team, year, function(game) {
			games.push(game);
			if (games.length === count) {
				games.sort(function(a, b) { return a.info.year - b.info.year; });
				callback && callback(games);
			}
		});
	}
}

function count_opening_day_starts(team, start_year, end_year, callback) {
	var players = {};
	get_opening_day_rosters(team, start_year, end_year, function(games) {
		games.forEach(function(game) {
			for (var position in game.starters) {
				var player = game.starters[position];
				players[player.id] = players[player.id] || 0;
				players[player.id] += 1;
				player.start_number = players[player.id];
			}
		});
		callback(games);
	});
}