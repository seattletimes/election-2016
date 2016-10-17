module.exports = function(counties, races, raceConfig) {

  //aggregate county results
  var aggregated = {};
  counties.forEach(function(county) {
    var race = races[county.race];
    if (!race) console.log("No race for this county", county);
    //do we have statewide results for this?
    if (race.results.length) return;
    //if not, create temporary aggregation info
    if (!aggregated[county.race]) aggregated[county.race] = race;
    if (!race.aggregate) race.aggregate = {};
    if (!race.aggregate[county.candidate]) race.aggregate[county.candidate] = [];
    //add the race to the aggregation
    race.aggregate[county.candidate].push(county);
  });
  Object.keys(aggregated).forEach(function(county) {
    var total = 0;
    county = aggregated[county];
    for (var candidate in county.aggregate) {
      var list = county.aggregate[candidate];
      var result = {};
      //object.create doesn't work for JSON, so manually copy
      for (var key in list[0]) result[key] = list[0][key];
      result.location = "Aggregated";
      result.votes = list.reduce(function(prev, now) { return prev + now.votes }, 0);
      county.results.push(result);
      total += result.votes;
    }
    //figure percentages
    county.results.forEach(function(result) {
      result.percent = Math.round(result.votes / total * 1000) / 10;
    });
    delete county.aggregate;
  });

  //add county data to mappable races
  var mapped = {};
  raceConfig.forEach(function(config) {
    if (config.map) {
      var countyMap = {};
      counties.forEach(function(result) {
        if (result.race == config.code) {
          if (!countyMap[result.location]) {
            countyMap[result.location] = {
              winner: null,
              results: []
            };
          }
          var county = countyMap[result.location];
          county.results.push(result);
          if (result.votes > 0 && (!county.winner || county.winner.votes < result.votes)) {
            county.winner = result;
          }
        }
      });
      races[config.code].map = mapped[config.code] = countyMap;
    }
  });

  return {
    mapped: mapped
  };

};