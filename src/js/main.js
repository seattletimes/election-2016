require("./lib/social");
require("./lib/ads");
require("savage-image");
var savage = require("savage-query");

var yes = ["yes", "approved", "maintained"];

var $ = require("./lib/qsa");

//color the presidential map
var presidential = document.querySelector("savage-image.presidency");
var ready = function() {
  for (var postal in window.apData.electoral) {
    var paths = $(`#${postal} path`, presidential);
    var state = window.apData.electoral[postal];
    state.results.forEach(function(result) {
      if (!result.electoral) return;
      for (var i = 0; i < result.electoral; i++) {
        var dot = paths.shift();
        // console.log(dot);
        if (!dot) return console.log("Missing dot", result);
        savage(dot).addClass(result.party == "D" ? "dem" : "rep");
      }
    });
  }
};

presidential.setAttribute("src", presidential.getAttribute("data-src"));
presidential.addEventListener("load", ready);

//enable county maps
$("savage-image.county").forEach(function(map, i) {
  var tooltip = document.createElement("div");
  tooltip.classList.add("popup");
  map.parentElement.appendChild(tooltip);

  var raceID = map.getAttribute("data-race");
  var data = window.mapData[raceID];
  var lastCounty = null;

  var hover = function(e) {

    var id = this.getAttribute("id").replace(/_/g, " ");
    if (id != lastCounty) {
      var county = data[id] || {};
      var results = county.results || [];

      var html = `<span class="county">${id}</span>
      <ul>
      ${results.map(r => {
        return `
        <li> ${r.candidate} - ${r.percent ? r.percent + "%" : "0.0%"}&nbsp;(${r.votes})`
      }).join("") || "<li> No results yet."}
      </ul>`

      tooltip.innerHTML = html;
    }
    lastCounty = id;
    tooltip.classList.add("show");

    var bounds = map.getBoundingClientRect();
    var x = e.clientX - bounds.left;
    var y = e.clientY - bounds.top;
    if (x > bounds.width >> 1) {
      x -= tooltip.offsetWidth;
    }
    if (y > bounds.height >> 1) {
      y -= tooltip.offsetHeight + 10;
    } else {
      y += 20;
    }

    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;


  };

  var exit = function() {
    tooltip.classList.remove("show");
  };

  var ready = function() {
    var counties = $(".county", map);
    counties.forEach(function(path) {
      var $path = savage(path);
      var id = path.id.replace(/_/g, " ");
      var result = data[id];
      if (!result) {
        $path.addClass("null");
      } else if (!result.winner) {
        $path.addClass("tie");
      } else if (result.winner.party) {
        $path.addClass(result.winner.party == "D" ? "dem" : "rep");
      } else {
        var option = result.winner.candidate.toLowerCase();
        $path.addClass(yes.indexOf(option) > -1 ? "yes" : "no");
      }

      path.addEventListener("mousemove", hover);
      path.addEventListener("mouseleave", exit);
    });
  }

  map.setAttribute("src", map.getAttribute("data-src"));
  map.addEventListener("load", ready);

});

$("savage-image.district").forEach(function(map, i) {
  var districtID = map.getAttribute("data-district") * 1;

  var ready = function() {
    var paths = $("path, polygon", map);
    paths.forEach(function(p) {
      savage(p).addClass(p.id == districtID ? "highlight" : "null");
    });
  }

  map.setAttribute("src", map.getAttribute("data-src"));
  map.addEventListener("load", ready);

});

var onTabClick = function(e) {
  if (e) e.preventDefault();
  var href = this.getAttribute("href");
  var active = document.querySelector(".tab.active");
  if (active) active.classList.remove("active");
  this.classList.add("active");
  $("section.category.show").forEach(s => s.classList.remove("show"));
  var section = document.querySelector(href);
  section.classList.add("show")
  if (window.history && window.history.replaceState) {
    window.history.replaceState(href, "", href);
  } else {
    window.location.hash = href.replace("#", "section-");
  }
}

$(".tab").forEach(t => t.addEventListener("click", onTabClick));

var hash = window.location.hash.replace("section-", "");
var firstTab = document.querySelector("a.tab");
if (hash) {
  //restore place from the URL hash
  var tab = document.querySelector(`a.tab[href="${hash}"]`);
  onTabClick.call(tab || firstTab);
} else {
  onTabClick.call(firstTab);
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

$("select.subnav").forEach(function(s) {
  s.addEventListener("change", onSubnavChange);
  onSubnavChange.call(s);
});

document.body.className = "";