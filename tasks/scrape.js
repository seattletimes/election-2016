/*

Parent module for scraping election results and loading into the local JSON store.
Relies on adapters in tasks/lib for specific sites.

*/

var async = require("async");
var getJSON = require("./lib/getJSON");
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
  return month + " " + day + ", 2015 at " + time;
};

module.exports = function(grunt) {

  //call various adapters to get resources
  var secState = require("./lib/secState");
  var kingCounty = require("./lib/king");
  var turnout = require("./lib/turnout");
  var processCounties = require("./lib/processCounties");
  var overrides = require("./lib/overrides");

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

      var races = {};
      var categorized = {};
      var featured = [];

      // remove uncontested races from the config files
      var uncontested = [];
      var raceConfig = getJSON("Races").filter(d => !d.uncontested);

      // generate the races hash by SOS ID
      raceConfig.forEach(function(row, i) {
        races[row.id] = row;
        if (!row) console.error("Broken row, index ", i);
        row.results = [];

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
      });

      //add mappable county data to races via reference
      var countyData = processCounties(counties, races, raceConfig);

      //Set up widget races
      var widget = getJSON("Widget").map(function(row) {
        var original = races[row.race];
        return {
          results: original.results,
          race: row.race,
          name: row.rename || original.name,
          description: row.description || original.description,
          group: row.group,
          called: original.called
        };
      }).reduce(function(o, row) {
        if (!o[row.group]) o[row.group] = [];
        o[row.group].push(row);
        return o;
      }, {});

      grunt.data.election = {
        all: races,
        categorized: categorized,
        // move Key Races to the front
        categories: ["Key Races"].concat(Object.keys(categorized).filter(r => r != "Key Races")),
        mapped: countyData.mapped,
        turnout: turnout,
        updated: getDateline(),
        widget: widget
      };

      c();
    });

  });


};