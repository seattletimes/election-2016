var alias = require("./aliases");
var fs = require("fs");
var request = require("request");
var project = require("../../project.json");

var url = "http://your.kingcounty.gov/elections/2015/nov-general/results/pi.txt";

var hyphenate = function(s) {
  return s.toLowerCase().replace(/\s+/g, "-");
};

var matchers = {
  "king-charter-1": /King County Charter Amendment No. 1/,
  "king-prop-1": /King County Proposition No. 1/,
  "measure-$1": /Initiative Measure No. (\d+)/,
  "advisory-$1": /Advisory Vote No. (\d+)/,
  "king-assessor": /Assessor/,
  "king-elections": /Director of Elections/,
  "king-council-$1": /Metropolitan King County Council District No. (\d+)/,
  "port-$1": /Port of Seattle.*No. (\d)/,
  "$1-council-$3": /City of (.*?) Council (Position|District) No. (\d+)/,
  "$1-prop-$2": /City of (.*?) Advisory Proposition No. (\d+)/,
  "$1-prop-1": /City of (\w+) Proposition No. 1/,
  "normandy-park-prop-1": /City of Normandy Park Proposition No. 1/,
  "$1-mayor": /City of (.*?) Mayor/,
  "$1-school-director-$3": /(.*?) School District No. \d+ Director (Position|District) No. (\d+)/,
  "enumclaw-prop-1": /Enumclaw.*?Proposition No. 1/,
  "king-fire-$1-$2": /King County Fire Protection District No. (\d+) Commissioner Position No. (\d+)/,
  "king-fire-$1-prop-$2": /King County Fire Protection District No. (\d+) Proposition No. (\d+)/,
  "south-king-fire-prop-$1": /South King Fire & Rescue Proposition No. (\d+)/,
  "$1-fire-$2": /(.*?) Fire.*No. (\d+)/,
  "king-water-$1-$2": /King County Water District No. (\d+) Commissioner Position No. (\d+)/,
  "king-water-1-prop-$1": /King County Water District No. \d+ Proposition No. (\d+)/,
  "tukwila-pool-prop-1": /Tukwila Pool Metro.*Proposition No. 1/,
  "tukwila-pool-$1": /Tukwila Pool.*District Commissioner Position No. (\d+)/,
  "vashon-park-$1": /Vashon-Maury Island Park.* Position No. (\d+)/
};

var getRaceID = function(title) {
  //easy matches
  for (var prefix in matchers) {
    var match = title.match(matchers[prefix]);
    if (match) {
      var output = prefix;
      for (var i = 1; i < match.length; i++) {
        output = output.replace("$" + i, hyphenate(match[i]));
      }
      return output;
    }
  }



  //harder or single matches
  if (title.match(/^King County Proposition No. 1/)) {
    return "prop-move-seattle";
  }

  //console.log("[king] Ignoring race:", title.substr(0, 40) + "...");
  return "redundant";
};

var parser = {
  index: 0,
  mode: "init",
  buffer: null,
  parsed: [],
  regex: {
    nameRow: null,
    result: /([\s\S]+?)\s{2,}\w+\s+([\d.]+)\s+([\d.]+)%/
  },
  findNonBlank: function(index) {
    while (index < this.lines.length) {
      var line = this.lines[index];
      if (line.trim()) {
        return line;
      }
      index++;
    }
  },
  parseLine: function(line) {
    switch (this.mode) {

    case "search":
      if (line.match(this.regex.nameRow)) {
        //matched the start of a race
        if (this.buffer) {
          console.error("Buffer not cleared!", this.buffer);
        }
        var trimmed = line.trim();
        var id = getRaceID(trimmed);

        //jump out on races we already get from SoS
        if (id == "redundant") return;

        this.buffer = {
          name: trimmed,
          race: id,
          results: []
        };

        this.mode = "race";
      }
      break;

    case "race":
      //indentation changes reset the buffer, but blank lines do not
      if (!line.trim()) return;
      if (line.match(this.regex.nameRow)) {
        this.mode = "search";
        this.parsed.push(this.buffer);
        this.buffer = null;
        return true;
      } else if (line.match(/\d\%$/)) { //result lines end with percentages
        line = line.trim();
        var matches = line.match(this.regex.result);
        if (!matches) {
          //precinct counting lines or other garbage
          return;
        }
        var name = matches[1];
        name = alias.antialias(name);
        if (name.match(/write-in/i)) return;
        var candidateInfo = alias.getCandidateInfo(name);
        var result = {
          candidate: candidateInfo.name,
          party: candidateInfo.party,
          incumbent: candidateInfo.incumbent,
          votes: matches[2] * 1,
          percent: Math.round(matches[3] * 10) / 10,
          source: "King County",
          location: "King"
        };
        this.buffer.results.push(result);
      }
      break;

    //start by looking for the first race name
    case "init":
      if (line.match(/november 3, 2015/i)) {
        var next = this.findNonBlank(this.index + 1);
        var padding = next.match(/^\s+/)[0];
        //we build a custom regex to handle it in case they change their indentation scheme
        this.regex.nameRow = new RegExp("^" + padding + "\\w");
        this.mode = "search";
      }

    }
  },
  parse: function(doc) {
    var lines = this.lines = doc.replace(/\r/g, "").split("\n");
    while (this.index < lines.length) {
      var line = lines[this.index];
      var result = this.parseLine(line);
      if (!result) {
        this.index++;
      }
    }
    //push remaining races in the buffer over to the parsed list
    if (this.buffer) {
      this.parsed.push(this.buffer);
    }
    return this.parsed;
  }
};

var getData = function(c) {
  var cache = "./temp/king.json";
  if (project.caching && fs.existsSync(cache)) {
    if (fs.statSync(cache).mtime > (new Date(Date.now() - 5 * 60 * 1000))) {
      console.log("Using cached:", url);
      var data = JSON.parse(fs.readFileSync(cache));
      return c(null, data);
    }
  }
  request(url, function(err, response, body) {
    var result = parser.parse(body);
    //always cache
    if (!fs.existsSync("./temp")) {
      fs.mkdirSync("./temp");
    }
    fs.writeFileSync(cache.replace("json", "txt"), body);
    fs.writeFileSync(cache, JSON.stringify(result, null, 2));
    c(null, result);
  });
};

module.exports = getData;
