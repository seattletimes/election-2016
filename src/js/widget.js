require("component-responsive-frame/child");

document.querySelector(".group").classList.add("show");

var timer;

var onGo = function() {
  if (timer) clearTimeout(timer);
  var forward = this.classList.contains("forward");
  var current = document.querySelector(".group.show");
  var next;
  if (forward) {
    next = current.nextElementSibling;
    if (!next || !next.classList.contains("group")) next = document.querySelector(".group");
  } else {
    next = current.previousElementSibling;
    if (!next || !next.classList.contains("group")) next = Array.prototype.pop.call(document.querySelectorAll(".group"));
  }
  current.classList.remove("show");
  next.classList.add("show");
};

var rotate = function() {
  timer = setTimeout(function() {
    onGo.call(document.querySelector(".go.forward"));
    rotate();
  }, 8000);
};
rotate();

Array.prototype.forEach.call(document.querySelectorAll(".go"), e => e.addEventListener("click", onGo));