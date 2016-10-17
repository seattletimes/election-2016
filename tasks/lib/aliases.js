var fs = require("fs");
var getJSON = require("./getJSON");

var candidates = {};
var cSheet = getJSON("Candidates");
var aliases = getJSON("Aliases");
cSheet.forEach(function(person) {
  candidates[person.name] = person;
});

module.exports = {
  antialias: function(name) {
    return aliases[name] ? aliases[name].alias : name;
  },
  getCandidateInfo: function(name) {
    return candidates[name] || { name: name };
  }
};