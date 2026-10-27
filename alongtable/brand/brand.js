/*
  ALongTable motion and the seat row. No dependencies.
  Read DESIGN.md first.

  Seat row markup:
    <ul class="alt-seats" id="seats-pythagoras"
        data-alt-seats="10" data-alt-taken="6"></ul>
    <p class="alt-seat-count" data-alt-count-for="seats-pythagoras"></p>

  Join button (fills the next open seat):
    <button class="alt-button alt-button--primary"
            data-alt-join="seats-pythagoras"
            data-alt-toast="toast-region">Pull up a chair</button>

  In React, call ALongTable.renderSeats(el) from a ref, or port the same
  rules: ink = taken, green = yours, dashed = open, bar above 12 seats.
*/
(function () {
  "use strict";

  var BAR_THRESHOLD = 12;

  function prefersReducedMotion() {
    return typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function readInt(el, name, fallback) {
    var n = parseInt(el.getAttribute(name), 10);
    return isNaN(n) ? fallback : n;
  }

  function seatWords(open, total) {
    if (open === 0) return "Table's full";
    if (open === 1) return "1 seat open";
    return open + " of " + total + " seats open";
  }

  function updateCount(id, open, total) {
    var counts = document.querySelectorAll('[data-alt-count-for="' + id + '"]');
    for (var i = 0; i < counts.length; i++) counts[i].textContent = seatWords(open, total);
  }

  function renderSeats(list, opts) {
    var total = Math.max(0, readInt(list, "data-alt-seats", 0));
    var taken = Math.min(total, Math.max(0, readInt(list, "data-alt-taken", 0)));
    var newest = readInt(list, "data-alt-newest", -1);
    var pop = opts && opts.pop;

    list.setAttribute("role", "img");
    list.setAttribute("aria-label", taken + " of " + total + " seats taken");
    list.innerHTML = "";

    if (total > BAR_THRESHOLD) {
      list.classList.add("alt-seats--bar");
      var bar = document.createElement("div");
      bar.className = "alt-seat-bar";
      bar.style.width = "100%";
      var fill = document.createElement("span");
      fill.style.width = (total ? (taken / total) * 100 : 0) + "%";
      bar.appendChild(fill);
      list.appendChild(bar);
    } else {
      list.classList.remove("alt-seats--bar");
      for (var i = 0; i < total; i++) {
        var seat = document.createElement("li");
        seat.className = "alt-seat";
        if (i < taken) seat.setAttribute("data-state", i === newest ? "yours" : "taken");
        else seat.setAttribute("data-state", "open");
        if (pop && i === newest && !prefersReducedMotion()) seat.setAttribute("data-pop", "");
        list.appendChild(seat);
      }
    }

    if (list.id) updateCount(list.id, total - taken, total);
    return { total: total, taken: taken, open: total - taken };
  }

  function showToast(regionId, text) {
    var region = regionId && document.getElementById(regionId);
    if (!region) return;
    region.innerHTML = "";
    var toast = document.createElement("div");
    toast.className = "alt-toast";
    toast.setAttribute("role", "status");
    var chip = document.createElement("span");
    chip.className = "alt-chip";
    chip.textContent = "Confirmed";
    var words = document.createElement("span");
    words.textContent = text;
    toast.appendChild(chip);
    toast.appendChild(words);
    region.appendChild(toast);
  }

  function join(button) {
    var id = button.getAttribute("data-alt-join");
    var list = id && document.getElementById(id);
    if (!list) return;
    var total = readInt(list, "data-alt-seats", 0);
    var taken = readInt(list, "data-alt-taken", 0);
    if (taken >= total) return;

    list.setAttribute("data-alt-taken", String(taken + 1));
    list.setAttribute("data-alt-newest", String(taken));
    var state = renderSeats(list, { pop: true });

    button.setAttribute("data-joined", "");
    button.textContent = "You're in";
    showToast(button.getAttribute("data-alt-toast"),
      "You're in. We'll send the address the day before.");
  }

  function init(root) {
    var scope = root || document;
    var lists = scope.querySelectorAll(".alt-seats[data-alt-seats]");
    for (var i = 0; i < lists.length; i++) renderSeats(lists[i]);

    var buttons = scope.querySelectorAll("[data-alt-join]");
    for (var j = 0; j < buttons.length; j++) {
      buttons[j].addEventListener("click", function (e) {
        var b = e.currentTarget;
        if (b.hasAttribute("data-joined") || b.getAttribute("aria-disabled") === "true") return;
        join(b);
      });
    }
  }

  window.ALongTable = { init: init, renderSeats: renderSeats, join: join, seatWords: seatWords };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { init(); });
  } else {
    init();
  }
})();
