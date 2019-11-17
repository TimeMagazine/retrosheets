var moment = require("moment");

module.exports = function(data) {
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
	return game;
}