var fs = require("fs");
var getJSON = require("./getJSON");

var candidates = {};
var aliases = null;

module.exports = {
  load: function() {
    if (aliases) return;
    var cSheet = getJSON("Candidates");
    aliases = getJSON("Aliases");
    cSheet.forEach(function(person) {
      candidates[person.name] = person;
    });
  },
  antialias: function(name) {
    name = name.trim();
    return aliases[name] ? aliases[name].alias : name;
  },
  getCandidateInfo: function(name) {
    return candidates[name] || { name: name };
  }
};