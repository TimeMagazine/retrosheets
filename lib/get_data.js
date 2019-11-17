var fs = require("fs"),
	path = require("path"),
	http = require("http"),
	mkdirp = require("mkdirp"),
	AdmZip = require("adm-zip"),
	csv = require('fast-csv');

// TO DO: Make function to clear cache

var get_data_for_year = module.exports = function(year, type, callback) {

	if (type === "game_log") {
		var DATA_URL = "http://www.retrosheet.org/gamelogs/gl$year.zip".replace("$year", year);
		var FILENAME = "GL$year".replace("$year", year);	
	} else if (type === "play_by_play") {
		var DATA_URL = "http://www.retrosheet.org/events/$yeareve.zip".replace("$year", year);
		var FILENAME = "$yeareve".replace("$year", year);	
	} else {
		console.log("get_data_for_year() needs either 'gamelog' or 'play_by_play' as its second argument.")
		return;
	}

	unzip_and_extract(DATA_URL, FILENAME + ".zip", function() {
		var games = [];
		if (type === "game_log") {
			csv.fromPath(path.join("data", FILENAME + ".txt"))
				.on("record", function(data){
					callback && callback(data);
				});
		} else {
			callback && callback();			
		}
	});
}

// get the zip file, extract it, and pass the result to the callback
function unzip_and_extract(url, filename, callback) {
	// download zip file of data
	mkdirp("cache", function() {
		var filepath = path.join("cache", filename);

		if (fs.existsSync(filepath)) {
			console.log("Already have " + filename + " in cache. Unzipping to data");
			unzip();
			return;
		}

		var f = fs.createWriteStream(filepath);

		console.log("Downloading " + filename + " from " + url);

		f.on('finish', function() {
	        // unzip
			console.log("Finished downloading " + filename + ". Unzipping to data");
			unzip(callback);
	    });

		var request = http.get(url, function(response) {
			response.pipe(f);
		});

		function unzip(callback) {
			mkdirp("data", function() {
				var zip = new AdmZip(filepath);
				zip.extractAllTo("data");

				console.log("Finished unzipping " + filename);
				// delete the zip file
				fs.unlink(path.join("cache", filename));
				callback && callback();
			});
		}
	});
}