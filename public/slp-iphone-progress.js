(function (global) {
  "use strict";

  // Read the same authenticated roster as Today. A pending invite proves
  // creation only. Claim and roster records are returned after the parent
  // consents, and the server filters out children who stopped sharing.
  function time(value) {
    return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value) ? Date.parse(value) : NaN;
  }

  function positive(count) {
    return typeof count === "number" && isFinite(count) && count >= 1;
  }

  function hasPractice(child) {
    var outcomes = child.outcomes || {};
    var homeworkDays = (child.hw && child.hw.days) || {};
    return Object.keys(outcomes).some(function (sound) {
      var outcome = outcomes[sound];
      if (!outcome) return false;
      var days = outcome.days || {};
      return positive(outcome.attempts) || Object.keys(days).some(function (day) {
        return days[day] && positive(days[day].a);
      });
    }) || Object.keys(homeworkDays).some(function (day) {
      return positive(homeworkDays[day]);
    });
  }

  function element(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function link(label, href, className) {
    var node = element("a", className, label);
    node.href = href;
    return node;
  }

  function render(host, children, invites) {
    if (!host || global.__sonaSlpApp !== true) return;
    var current = host.querySelector("#slpIphoneProgress");
    if (current) host.removeChild(current);

    var created = { label: "Invite created", rows: [] };
    var joined = { label: "Joined", rows: [] };
    var practiced = { label: "First practice", rows: [] };
    var stages = [created, joined, practiced];
    var now = Date.now();

    invites.forEach(function (invite) {
      if (!invite || invite.claimedBy || !isFinite(time(invite.createdAt)) || time(invite.expiresAt) <= now) return;
      var label = typeof invite.label === "string" ? invite.label.trim() : "";
      created.rows.push({ label: label || "Family invite", href: "#caseload" });
    });
    children.forEach(function (child) {
      if (!child || !child.childId || (child.meta && child.meta.archived)) return;
      var consented = child.synced === true && isFinite(time(child.consentAt));
      var claimed = child.meta && isFinite(time(child.meta.joinedAt));
      if (!consented && !claimed) return;
      // Synchronization, a played game and a homework assignment alone are
      // insufficient. A shared attempt or tracked homework rep is evidence.
      var stage = consented && hasPractice(child) ? practiced : joined;
      var name = consented && typeof child.child === "string" ? child.child.trim() : "";
      stage.rows.push({
        label: name || "New family",
        href: consented ? "#child/" + encodeURIComponent(child.childId) : "#caseload"
      });
    });

    var card = element("section", "card slp-progress");
    card.id = "slpIphoneProgress";
    card.setAttribute("aria-labelledby", "slpIphoneProgressTitle");
    var heading = element("div", "slp-progress-heading");
    var title = element("h2", "", "Family progress");
    title.id = "slpIphoneProgressTitle";
    heading.appendChild(title);
    heading.appendChild(link("View caseload", "#caseload", "slp-progress-link"));
    card.appendChild(heading);

    var totals = element("ul", "slp-progress-counts");
    var rows = element("ul", "slp-progress-rows");
    stages.forEach(function (stage) {
      var total = element("li", "");
      total.appendChild(element("strong", "", String(stage.rows.length)));
      total.appendChild(element("span", "", stage.label));
      totals.appendChild(total);
      stage.rows.slice(0, 2).forEach(function (entry) {
        if (rows.childElementCount >= 5) return;
        var row = element("li", "");
        row.appendChild(link(entry.label, entry.href, "slp-progress-link"));
        row.appendChild(element("span", "slp-progress-label", stage.label));
        rows.appendChild(row);
      });
    });
    card.appendChild(totals);
    if (rows.childElementCount) card.appendChild(rows);
    else card.appendChild(element("p", "slp-progress-empty", "Create a family invite to see progress here."));
    host.insertBefore(card, host.firstChild);
  }

  global.SonaSlpIphoneProgress = { render: render };
})(window);
