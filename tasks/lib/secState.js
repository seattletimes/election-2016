var csv = require("csv");
var fs = require("fs");
var request = require("request");
var aliases = require("./aliases");
var getJSON = require("./getJSON");
var project = require("../../project.json");
var configs = {
  statewide: {
    cache: "statewide.json",
    url: "http://results.vote.wa.gov/results/current/export/MediaResults.txt",
    location: "state"
  },
  counties: {
    cache: "counties.json",
    url: "http://results.vote.wa.gov/results/current/export/MediaResultsByCounty.txt",
    location: function(d) { return d.CountyName }
  }
};

var getResults = function(config, c) {
  aliases.load();

  //load results during call, not startup, to let `sheets` run
  var races = getJSON("Races");
  var raceList = races.filter(d => !d.uncontested).map(d => d.id);
  var cachePath = "./temp/" + config.cache;
  if (project.caching && fs.existsSync(cachePath)) {
    if (fs.statSync(cachePath).mtime > (new Date(Date.now() - 5 * 60 * 1000))) {
      console.log("Using cached:", config.url);
      return c(null, JSON.parse(fs.readFileSync(cachePath)));
    }
  }
  var parser = csv.parse({
    columns: true,
    auto_parse: true,
    delimiter: "\t"
  });
  var rows = [];
  parser.on("data", function(row) {
    //transform the data to match our schema
    var name = aliases.antialias(row.BallotName);
    var candidate = aliases.getCandidateInfo(name);
    if (raceList.indexOf(row.RaceID) < 0) return;

    rows.push({
      race: row.RaceID,
      candidate: name,
      party: candidate.party,
      incumbent: candidate.incumbent,
      votes: row.Votes * 1,
      percent: Math.round(row.Votes / row.TotalBallotsCastByRace * 1000) / 10,
      source: "Secretary of State",
      location: typeof config.location == "function" ? config.location(row) : config.location
    });

  });
  parser.on("finish", function() {
    //cache results no matter what
    if (!fs.existsSync("./temp")) {
      fs.mkdirSync("./temp");
    }
    fs.writeFileSync(cachePath, JSON.stringify(rows, null, 2));
    c(null, rows);
  });
  if (!fs.existsSync("temp")) {
    fs.mkdirSync("temp");
  }
  var temp = fs.createWriteStream("temp/" + config.cache.replace("json", "txt"));
  var r = request(config.url);
  r.pipe(parser);
  r.pipe(temp);
};

module.exports = {
  statewide: getResults.bind(null, configs.statewide),
  counties: getResults.bind(null, configs.counties)
};
