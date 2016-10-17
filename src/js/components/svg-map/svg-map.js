/*
  Creates a custom element for the SVG maps.

  The custom element exposes a few new properties and methods:
  - getState() - returns the internal properties, not attached directly to the element to prevent memory leaks
  - eachPath(selector, f) - calls f for each path matching the selector, passing in the shape and [data-location]
  - setTemplate(str) - normally set by wrapping the template in the <svg-map>, but can be called separately

  If you want to enable hover behavior, you must:
  - define the onhover function on the state object, which should return a data object for templating
  - specify a class that should trigger hover using state.hoverClass

*/
var Promise = require("es6-promise/dist/es6-promise.min").Promise;
var savage = require("../../savage");
require("document-register-element");
require("./svg-map.less");


var dot = require("dot");
dot.templateSettings.varname = "data";
dot.templateSettings.selfcontained = true;
dot.templateSettings.evaluate = /\{%([\s\S]+?)%\}/g;
dot.templateSettings.interpolate = /\{%=([\s\S]+?)%\}/g;

var xhrCache = {};

var xhr = function(url) {
  if (url in xhrCache) {
    return xhrCache[url];
  }
  var promise = new Promise(function(ok, fail) {
    var x = new XMLHttpRequest();
    x.open("GET", url);
    x.onerror = fail;
    x.onload = function() {
      ok(x.response || x.responseText);
    };
    x.send();
  });
  xhrCache[url] = promise;
  return promise;
};

var qsa = function(el, s) { return Array.prototype.slice.call(el.querySelectorAll(s)) };

var onHover = function(e) {
  var popup = this.querySelector(".popup");
  var state = this.getState();
  //if no listener, don't do anything
  if (!state.onhover) return;
  if (e.target.tagName != "path" || e.target.getAttribute("class").indexOf(state.hoverClass) == -1) {
    popup.removeAttribute("show");
    return;
  }
  state.ready.then(function(self) {
    var svg = self.querySelector("svg");
    var active = qsa(svg, ".active");
    active.forEach(function(el) { savage.removeClass(el, "active") });
    savage.addClass(e.target, "active");
  });
  var key = e.target.id;
  popup.setAttribute("show", "");
  if (state.lastHover != key) {
    //we're on a new path, so inject new template output
    var data = state.onhover(key);
    popup.innerHTML = data ? state.transclude(data) : "";
    savage.raise(e.target);
  }
  state.lastHover = key;
  var bounds = this.getBoundingClientRect();
  var popupBounds = popup.getBoundingClientRect();
  var x = e.clientX - bounds.left;
  var y = e.clientY - bounds.top;
  popup.style.top = y + 20 + "px";
  if (x + popupBounds.width > bounds.width) {
    popup.style.left = (x - popupBounds.width) + "px";
  } else {
    popup.style.left = x + "px";
  }
};

var states = {};
var idCounter = 0;

var mapProto = Object.create(HTMLElement.prototype);
//lifecycle: created, attached, detached, attributeChanged
mapProto.createdCallback = function() {
  var src = this.getAttribute("src");
  var id = idCounter++;
  var templateName = "temp-" + id;
  this.setAttribute("data-instance", id);
  var state = this.getState();
  var template = dot.template(this.innerHTML);
  this.innerHTML = "";
  state.transclude = template;
  var self = this;
  state.ready = new Promise(function(ok) {
    xhr(src).then(function(response) {
      self.innerHTML = response + "<div class=popup></div>";
      self.setAttribute("ready", "");
      ok(self);
    });
  });
};
mapProto.attachedCallback = function() {
  var self = this;
  this.addEventListener("mousemove", onHover);
  this.addEventListener("touchstart", onHover);
  this.addEventListener("mouseleave", function() {
    self.querySelector(".popup").removeAttribute("show");
  });
};
mapProto.detachedCallback = function() {
  this.removeEventListener("mousemove");
  this.removeEventListener("touchstart");
  this.removeEventListener("mouseleave");
};
mapProto.eachPath = function(selector, f) {
  var state = this.getState();
  state.ready.then(function(self) {
    var selected = Array.prototype.slice.call(self.querySelectorAll(selector));
    selected.forEach(function(element, i) {
      f(element);
    });
  });
};
mapProto.getState = function(key) {
  var instance = this.getAttribute("data-instance");
  if (!states[instance]) {
    states[instance] = {};
  }
  if (key) {
    return states[instance][key];
  }
  return states[instance];
};
mapProto.setTemplate = function(str) {
  var state = this.getState();
  state.transclude = dot.template(str);
};
mapProto.savage = savage;

document.registerElement("svg-map", { prototype: mapProto });