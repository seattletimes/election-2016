/*

Parent module for scraping election results and loading into the local JSON store.
Relies on adapters in tasks/lib for specific sites.

*/

var async = require("async");
var shell = require("shelljs");

var getDateline = function() {
  //find the current dateline
  var now = new Date();
  var month = ["October", "November", "December"][now.getMonth() - 9];
  var day = now.getDate();
  var hours = now.getHours();
  var minutes = now.getMinutes() + "";
  if (minutes.length == 1) {
    minutes = "0" + minutes;
  }
  var time;
  if (hours < 13) {
    time = hours + ":" + minutes + " am";
  } else {
    time = hours - 12 + ":" + minutes + " pm";
  }
  return month + " " + day + ", 2016 at " + time;
};

module.exports = function(grunt) {

  //call various adapters to get resources
  var secState = require("./lib/secState");
  var turnout = require("./lib/turnout");
  var processCounties = require("./lib/processCounties");

  grunt.registerTask("scrape", "Pull data from election result endpoints", function() {

    grunt.task.requires("state");
    grunt.task.requires("json");

    if (grunt.option("nocache")) {
      shell.rm("-rf", "temp");
    }

    var c = this.async();

    async.parallel([secState.statewide, secState.counties, turnout], function(err, results) {
      if (err) console.log(err);

      var [statewide, counties, turnout] = results;

      //national results come in from Elex
      var national = grunt.data.csv.national;

      var races = {};
      var categorized = {};
      var featured = [];

      // remove uncontested races from the config files
      var raceConfig = require("../data/Races.sheet.json").filter(d => !d.filter);

      // generate the races hash by SOS ID
      raceConfig.forEach(function(row, i) {
        races[row.id] = row;
        if (!row) console.error("Broken row, index ", i);
        row.results = [];

        //don't categorize presidential race
        if (row.id == 1) return;

        //create a category/subcategory for this
        var cat = row.category || "none";
        if (!categorized[cat]) {
          categorized[cat] = {
            races: [],
            grouped: {}
          };
        }
        //rows can have multiple subcategories, comma-separated
        if (row.subcategory) {
          var subcats = row.subcategory.split(/,\s?/);
          subcats.forEach(function(subcat) {
            if (!categorized[cat].grouped[subcat]) {
              categorized[cat].grouped[subcat] = [];
            }
            categorized[cat].grouped[subcat].push(row);
          });
        } else {
          categorized[cat].races.push(row);
        }
        if (row.featured) {
          featured.push(row);
        }
      });

      //sort and add Key Races as a category
      featured.sort(function(a, b) {
        if (a.featured == b.featured) return a.index - b.index;
        return a.featured - b.featured;
      });
      categorized["Key Races"] = { races: featured, grouped: {} };

      //add results to races
      statewide.forEach(function(result) {
        var race = races[result.race];
        if (!race) console.log("Bad statewide race ", result)
        race.results.push(result);
        if (result.votes > 0 && (!race.winner || race.winner.votes < result.votes)) {
          race.winner = result;
        }
      });

      //add mappable county data to races via reference
      var countyData = processCounties(counties, races, raceConfig);

      //add national results to our single AP race
      var ap = {
        national: [],
        electoral: {},
        byCandidate: {}
      };
      var parties = {
        Dem: "D",
        GOP: "R",
        Grn: "G",
        Lib: "L"
      };
      national.forEach(function(row) {
        if (!(row.party in parties)) return;
        var result = {
          race: 1,
          candidate: row.first + " " + row.last,
          last: row.last,
          party: parties[row.party] || "I",
          votes: row.votecount * 1,
          percent: row.votepct * 100,
          source: "AP",
          location: row.statepostal,
          electoral: row.electwon * 1,
          electoralTotal: row.electtotal * 1
        };

        if (!ap.byCandidate[row.last]) ap.byCandidate[row.last] = {
          national: null,
          electoral: {}
        }
        if (row.level == "national") {
          ap.national.push(result);
          ap.byCandidate[row.last].national = result;
        } else if (row.level == "state") {
          if (!ap.electoral[result.location]) ap.electoral[result.location] = { winner: null, results: [] };
          var election = ap.electoral[result.location];
          election.results.push(result);
          ap.byCandidate[row.last].electoral[result.location] = result;
          if (result.electoral > 0 && (!election.winner || election.winner.electoral < result.electoral)) {
            election.winner = result;
          }
        }
      });
      // redo the structure of race 1 to match
      var waPresidential = races[1];
      // console.log(waPresidential);
      waPresidential.local = waPresidential.results;

      //sort all results in order of descending vote count
      var voteSort = (a, b) => b.votes - a.votes;
      for (var k in races) {
        races[k].results.sort(voteSort);
      }

      ap.national.sort(voteSort);
      for (var k in ap.electoral) {
        ap.electoral[k].results.sort(voteSort);
      }

      //Set up widget races
      var widget = require("../data/Widget.sheet.json").filter(r => !r.filter).map(function(row) {
        var original = races[row.race];
        return {
          results: original.results,
          race: row.race,
          name: row.rename || original.name,
          description: row.description || original.description,
          group: row.group,
          called: original.called
        };
      });

      grunt.data.election = {
        all: races,
        ap: ap,
        categorized: categorized,
        // move Key Races to the front
        categories: ["Key Races", "Statewide", "Congressional", "Legislative", "Local"],
        mapped: countyData.mapped,
        zoomed: [1,11,21,23,25,26,27,28,29,30,32,33,34,36,37,38,41,43,44,45,46,47,48],
        turnout: turnout,
        updated: getDateline(),
        widget: widget,
        occupiedSenate: { // not running: districts 6, 7, 8, 13, 15, 21, 26, 29, 30, 31, 32, 33, 34, 35, 37, 38, 42, 43, 44, 45, 46, 47, 48
          d: 12, // 21, 29, 32, 33, 34, 35, 37, 38, 43, 44, 46, 48
          r: 11 // 6, 7, 8, 13, 15, 26, 30, 31, 42, 45, 47
        }
      };

      c();
    });

  });


};