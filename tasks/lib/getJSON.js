var fs = require("fs");

var cache = {};

module.exports = function(sheetName) {
  if (cache[sheetName]) return cache[sheetName];
  try {
    var data = JSON.parse(fs.readFileSync("./data/" + sheetName + ".sheet.json", "utf8"));
  } catch (err) {
    data = [];
  }
  if (data instanceof Array) {
    data.forEach(function(row, i) {
      row.index = i;
    });
  }
  cache[sheetName] = data;
  return data;
}