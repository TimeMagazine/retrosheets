#!/usr/bin/env node

var downcache = require("downcache"),
	request = require("request"),
	fs = require("fs"),
	cheerio = require("cheerio");

var URL = "http://www.baseball-reference.com/teams/$team/$year-schedule-scores.shtml";

function getTeam(team, year, callback) {
	request(URL.replace("$team", team).replace("$year", 2014), function(err, resp, body) {
		var $ = cheerio.load(body);
		callback(get_csv_output($, "team_schedule"));
	});
}

function getTeams() {
	var teams = [],
		count = 30;

	downcache("http://www.baseball-reference.com/teams/", function(err, resp, body) {
		var $ = cheerio.load(body.replace(/ \. franchise_names/g, ".franchise_names"));
		$("#active").find(".franchise_names a").each(function(i, v) {
			var team = $(v).text(),
				team_id = $(v).attr("href").split("/")[2];

			teams.push({
				ids: {
					"baseball-reference": team_id
				},
				name: team,
				twitter: "",
				teamname: ""
			});
		});
		teams = teams.sort(function(a, b) { return a.name > b.name ? 1 : -1; });
		fs.writeFileSync("./json/names.json", JSON.stringify(teams, null, 2));
	});	
}

function getSeason() {
	var teams = {},
		count = 30;

	require("./json/names_twitter.json").forEach(function(team) {
		console.log(team);
		getTeam(team.ids["baseball-reference"], 2014, function(data) {
			teams[team.ids["baseball-reference"]] = {
				info: team,
				record: data
			};
			if (data.length == 0) {
				console.error(team);
			}
			count -= 1;
			console.log(team.name, data.slice(-1));
			if (count == 0) {
				fs.writeFileSync("./json/current.json", JSON.stringify(teams));
			}
		});
	})
}

var removals = [
	'Streak',
	'Attendance',
	'D/N',
	'Time',
	'Win',
	'Loss',
	'Save',
	'Inn'
];

function get_csv_output($, tableid, do_drop_over_headers, blank_colspans) {
    var tableref = $("#" + tableid),
    	headers = [],
    	data = [];

    tableref.find("thead th").each(function(i, v) {
    	headers.push($(v).text());
    });

    tableref.find("tbody tr").each(function(i, v) {
    	var datum = {};
    	$(v).find("td").each(function(ii, vv) {
    		if (headers[ii].replace(/\s/g, "") !== "") {
	    		datum[headers[ii]] = $(vv).text();
	    	}
    	});

    	if (datum.RA) {
    		data.push(datum["W-L"].split("-").map(function(d) {
    			return parseInt(d, 10);
    		}));
    	}
    });
    return data;
}

//getTeam("PHI", 2014);

//getTeams();

getSeason();