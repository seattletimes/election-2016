require("./lib/social");
require("./lib/ads");
require("./components/svg-map/svg-map");

var yes = ["yes", "approved", "maintained"];

var qsa = s => Array.prototype.slice.call(document.querySelectorAll(s));

//enable county maps
qsa("svg-map.county").forEach(function(map, i) {
  var raceID = map.getAttribute("data-race");
  var data = window.mapData[raceID];
  if (Object.keys(data).length) {
    map.eachPath(".county", function(shape) {
      var id = shape.id.replace(/_/g, " ");
      var result = data[id];
      if (!result) {
        map.savage.addClass(shape, "null");
      } else if (!result.winner) {
        map.savage.addClass(shape, "tie");
      } else if (result.winner.party) {
        map.savage.addClass(shape, result.winner.party == "D" ? "dem" : "rep");
      } else {
        var option = result.winner.candidate.toLowerCase();
        map.savage.addClass(shape, yes.indexOf(option) > -1 ? "yes" : "no");
      }
    });
    var mapState = map.getState();
    mapState.onhover = function(county) {
      county = county.replace(/_/g, " ");
      var c = data[county];
      if (!c) c = { county };
      c.county = county;
      return c || {};
    };
    mapState.hoverClass = "county";
  }
});

qsa("svg-map.district").forEach(function(map, i) {
  var districtID = map.getAttribute("data-district");
  map.eachPath(".district", function(shape) {
    map.savage.addClass(shape, shape.id == districtID ? "district" : "null");
  });
});

var onTabClick = function(e) {
  if (e) e.preventDefault();
  var href = this.getAttribute("href");
  var active = document.querySelector(".tab.active");
  if (active) active.classList.remove("active");
  this.classList.add("active");
  qsa("section.category.show").forEach(s => s.classList.remove("show"));
  var section = document.querySelector(href);
  section.classList.add("show")
  if (window.history && window.history.replaceState) {
    window.history.replaceState(href, "", href);
  } else {
    window.location.hash = href.replace("#", "section-");
  }
}

qsa(".tab").forEach(t => t.addEventListener("click", onTabClick));

var hash = window.location.hash.replace("section-", "");
if (hash) {
  //restore place from the URL hash
  var tab = document.querySelector(`a.tab[href="${hash}"]`);
  onTabClick.call(tab);
} else {
  onTabClick.call(document.querySelector("a.tab"));
}

var closest = function(el, className) {
  while (!el.classList.contains(className) && el !== document.body) el = el.parentElement;
  if (el == document.body) return null;
  return el;
};

var onSubnavChange = function() {
  var val = this.value;
  var section = closest(this, "category");
  var selector = `[data-subcat="${val}"]`;
  var subcats = Array.prototype.slice.call(section.querySelectorAll(".subcategory"));
  subcats.forEach(s => s.classList.remove("show"));
  section.querySelector(selector).classList.add("show");
};

qsa("select.subnav").forEach(function(s) {
  s.addEventListener("change", onSubnavChange);
  onSubnavChange.call(s);
});

document.body.className = "";