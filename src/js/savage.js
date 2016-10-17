var Promise = require("es6-promise/dist/es6-promise.min").Promise;
//Simple, promise-based interaction with SVG documents imported via <object>

var registerLoad = function(savage) {
  savage.document = new Promise(function(ok) {
    savage.root.addEventListener("load", function() {
      ok(savage.root.contentDocument);
    });
  });
};

var Savage = function(root) {
  if (!(this instanceof Savage)) {
    return new Savage(root);
  }
  this.root = root;
  registerLoad(this);
};

Savage.prototype = {
  query: function(q) {
    return this.document.then(function(doc) {
      return doc.querySelector(q);
    });
  },
  queryAll: function(q) {
    return this.document.then(function(doc) {
      return [].slice.call(doc.querySelectorAll(q));
    });
  },
  //notify that this object is becoming invisible, and will need to reload before use
  unload: function() {
    registerLoad(this);
  }
};

//lifts up an element for stroke, since z-index doesn't apply to SVG
Savage.raise = function(element) {
  element.parentNode.appendChild(element);
};

Savage.addClass = function(shape, add) {
  shape.setAttribute("class", shape.getAttribute("class") + " " + add);
};

Savage.removeClass = function(shape, remove) {
  var re = new RegExp("(^|\\s)" + remove + "(\\s|$)", "g");
  shape.setAttribute("class", shape.getAttribute("class").replace(re, ""));
};

Savage.toggleClass = function(shape, toggle) {
  var current = shape.getAttribute("class");
  if (current.indexOf(toggle) == -1) {
    Savage.addClass(shape, toggle);
  } else {
    Savage.removeclass(shape, toggle);
  }
};

module.exports = Savage;
