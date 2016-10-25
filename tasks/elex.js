var shell = require("shelljs");

module.exports = function(grunt) {

  grunt.registerTask("elex", "Grab national results from AP", function() {
    shell.exec("elex results 2016-11-08 > data/national.csv", this.async());
  });

};