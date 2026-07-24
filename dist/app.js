(() => {
  // src/app.ts
  var eventElement = (event) => event.target;
  var STORAGE = "shiftwise-v1";
  function decodeWasmBase64(value) {
    const binary = atob(value), bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }
  var highsOptions = { locateFile: (file) => "./node_modules/highs/build/" + file, print: () => {
  }, printErr: () => {
  } };
  if (window.HIGHS_WASM_BASE64) highsOptions.wasmBinary = decodeWasmBase64(window.HIGHS_WASM_BASE64);
  var highsReady = window.Module(highsOptions);
  var shiftMeta = {
    "8d": { label: "8h day", short: "8D", hours: 8, period: "day", cls: "s-8d", category: "General", start: "08:00", end: "16:00", activeDays: [0, 1, 2, 3, 4, 5, 6], coverage: 1, pairGroup: null, manager: false },
    "8n": { label: "8h night", short: "8N", hours: 8, period: "night", cls: "s-8n", category: "General", start: "16:00", end: "00:00", activeDays: [1, 2, 3, 4, 5], coverage: 1, pairGroup: null, manager: false },
    "12d": { label: "12h day", short: "12D", hours: 12, period: "day", cls: "s-12d", category: "General", start: "08:00", end: "20:00", activeDays: [0, 1, 2, 3, 4, 5, 6], coverage: 1, pairGroup: "default-24", manager: false },
    "12n": { label: "12h night", short: "12N", hours: 12, period: "night", cls: "s-12n", category: "General", start: "20:00", end: "08:00", activeDays: [0, 1, 2, 3, 4, 5, 6], coverage: 1, pairGroup: "default-24", manager: false },
    "manager": { label: "Manager", short: "MGR", hours: 8, period: "day", cls: "s-manager", category: "Manager", start: "08:00", end: "16:00", activeDays: [1, 2, 3, 4, 5], coverage: 1, pairGroup: null, manager: true }
  };
  var systemShiftIds = ["8d", "8n", "12d", "12n", "manager"];
  var defaultShiftMeta = JSON.parse(JSON.stringify(shiftMeta));
  var names = ["Alex Morgan", "Jordan Lee", "Maya Patel", "Sam Rivera", "Taylor Kim", "Noah Wilson", "Casey Nguyen", "Avery Brown", "Riley Chen", "Jamie Brooks"];
  var uid = () => Math.random().toString(36).slice(2, 10);
  var iso = (d) => {
    const z = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    return z.toISOString().slice(0, 10);
  };
  var localDate = (y, m, d) => new Date(y, m, d, 12);
  var monthKey = (y, m) => String(y) + "-" + String(m + 1).padStart(2, "0");
  var fmtMonth = (y, m) => new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(localDate(y, m, 1));
  var fmtDate = (value) => new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }).format(/* @__PURE__ */ new Date(value + "T12:00:00"));
  var daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
  var initials = (n) => n.split(/\s+/).map((x) => x[0]).slice(0, 2).join("").toUpperCase();
  function defaultData() {
    return {
      current: "2026-07",
      settings: { eightDay: 1, eightNight: 1, twelveDay: 1, twelveNight: 1, weekendNo8Night: true, recoveryDays: 2 },
      categories: ["General"],
      shifts: JSON.parse(JSON.stringify(defaultShiftMeta)),
      managerFallbacks: {},
      twentyFourPairs: [],
      pairings: [
        { id: "pair8", name: "08:00 \u2192 08:00", firstShiftId: "12d", secondShiftId: "12n", dayOffset: 0, enabled: true },
        { id: "pair20", name: "20:00 \u2192 20:00", firstShiftId: "12n", secondShiftId: "12d", dayOffset: 1, enabled: true }
      ],
      workers: names.map((name, i) => ({ id: uid(), name, target: i < 8 ? 160 : 144, preference: i % 3 === 0 ? "day" : i % 3 === 1 ? "night" : "either", pair24: i === 0 ? "pair8" : i === 3 ? "pair20" : i === 7 ? "pair8" : "none", categories: ["General"], managerQualified: i === 1 || i === 4, defaultManager: i === 1 })),
      availability: [],
      assignments: {},
      locks: {},
      assignmentReasons: {},
      unfilledReasons: {},
      scheduleMeta: {},
      history: {},
      minimumRestHours: 8
    };
  }
  var app;
  var generationTieRanks = {};
  var availabilityEditor = { workerId: null, y: null, m: null, period: "all" };
  var availabilityPainting = false;
  var scheduleFilters = { mode: "month", weekDate: "", worker: "", category: "", shift: "", availability: "", unfilledOnly: false };
  var bulkSelected = /* @__PURE__ */ new Set();
  try {
    app = JSON.parse(localStorage.getItem(STORAGE)) || defaultData();
  } catch {
    app = defaultData();
  }
  function ensureDataShape() {
    const defaults = JSON.parse(JSON.stringify(defaultShiftMeta));
    app.categories = Array.isArray(app.categories) && app.categories.length ? app.categories : ["General"];
    app.shifts = app.shifts || {};
    Object.entries(defaults).forEach(([id, shift]) => {
      if (!app.shifts[id]) {
        const legacyCount = id === "8d" ? app.settings?.eightDay : id === "8n" ? app.settings?.eightNight : id === "12d" ? app.settings?.twelveDay : id === "12n" ? app.settings?.twelveNight : void 0;
        app.shifts[id] = { ...shift, ...legacyCount !== void 0 ? { coverage: Number(legacyCount) } : {} };
      }
    });
    Object.assign(shiftMeta, app.shifts);
    app.managerFallbacks = app.managerFallbacks || {};
    app.twentyFourPairs = Array.isArray(app.twentyFourPairs) ? app.twentyFourPairs : [];
    app.pairings = Array.isArray(app.pairings) && app.pairings.length ? app.pairings : [{ id: "pair8", name: "08:00 \u2192 08:00", firstShiftId: "12d", secondShiftId: "12n", dayOffset: 0, enabled: true }, { id: "pair20", name: "20:00 \u2192 20:00", firstShiftId: "12n", secondShiftId: "12d", dayOffset: 1, enabled: true }];
    app.locks = app.locks || {};
    app.assignmentReasons = app.assignmentReasons || {};
    app.unfilledReasons = app.unfilledReasons || {};
    app.scheduleMeta = app.scheduleMeta || {};
    app.history = app.history || {};
    app.minimumRestHours = Number(app.minimumRestHours ?? 8);
    app.workers.forEach((worker) => {
      if (!Array.isArray(worker.categories) || !worker.categories.length) worker.categories = ["General"];
      if (typeof worker.managerQualified !== "boolean") worker.managerQualified = false;
      if (typeof worker.defaultManager !== "boolean") worker.defaultManager = false;
      if (worker.pair24 === "day-night") worker.pair24 = "pair8";
      if (worker.pair24 === "night-day") worker.pair24 = "pair20";
      if (worker.pair24 === "either-24") worker.pair24 = "any";
    });
  }
  ensureDataShape();
  function save() {
    localStorage.setItem(STORAGE, JSON.stringify(app));
  }
  function currentMeta() {
    return app.scheduleMeta[app.current] || (app.scheduleMeta[app.current] = { status: "draft", revision: 1, versions: [] });
  }
  function currentHistory() {
    return app.history[app.current] || (app.history[app.current] = { undo: [], redo: [] });
  }
  function monthSlice(object) {
    return Object.fromEntries(Object.entries(object || {}).filter(([key2]) => key2.startsWith(app.current)));
  }
  function scheduleSnapshot(label = "Snapshot") {
    const meta = currentMeta();
    return { id: uid(), label, timestamp: (/* @__PURE__ */ new Date()).toISOString(), status: meta.status, revision: meta.revision, assignments: monthSlice(app.assignments), locks: monthSlice(app.locks), reasons: monthSlice(app.assignmentReasons), unfilledReasons: monthSlice(app.unfilledReasons), managerFallbacks: Object.fromEntries(Object.entries(app.managerFallbacks).filter(([date]) => date.startsWith(app.current))), twentyFourPairs: app.twentyFourPairs.filter((pair) => pair.keys.some((key2) => key2.startsWith(app.current))) };
  }
  function clearCurrentScheduleData() {
    [app.assignments, app.locks, app.assignmentReasons, app.unfilledReasons].forEach((object) => Object.keys(object).forEach((key2) => {
      if (key2.startsWith(app.current)) delete object[key2];
    }));
    Object.keys(app.managerFallbacks).forEach((date) => {
      if (date.startsWith(app.current)) delete app.managerFallbacks[date];
    });
    app.twentyFourPairs = app.twentyFourPairs.filter((pair) => !pair.keys.some((key2) => key2.startsWith(app.current)));
  }
  function restoreSnapshot(snapshot) {
    clearCurrentScheduleData();
    Object.assign(app.assignments, snapshot.assignments || {});
    Object.assign(app.locks, snapshot.locks || {});
    Object.assign(app.assignmentReasons, snapshot.reasons || {});
    Object.assign(app.unfilledReasons, snapshot.unfilledReasons || {});
    Object.assign(app.managerFallbacks, snapshot.managerFallbacks || {});
    app.twentyFourPairs.push(...snapshot.twentyFourPairs || []);
    const meta = currentMeta();
    meta.status = snapshot.status || "draft";
    meta.revision = snapshot.revision || meta.revision;
    save();
    renderAll();
  }
  function checkpoint(label) {
    const snapshot = scheduleSnapshot(label), history = currentHistory(), meta = currentMeta();
    history.undo.push(snapshot);
    if (history.undo.length > 30) history.undo.shift();
    history.redo = [];
    meta.versions.push(snapshot);
    if (meta.versions.length > 20) meta.versions.shift();
    meta.revision++;
    meta.status = "draft";
  }
  function undoSchedule() {
    const history = currentHistory();
    if (!history.undo.length) return;
    history.redo.push(scheduleSnapshot("Redo point"));
    restoreSnapshot(history.undo.pop());
  }
  function redoSchedule() {
    const history = currentHistory();
    if (!history.redo.length) return;
    history.undo.push(scheduleSnapshot("Undo point"));
    restoreSnapshot(history.redo.pop());
  }
  function setScheduleStatus(status) {
    checkpoint("Before " + status);
    currentMeta().status = status;
    save();
    renderAll();
  }
  function ym() {
    const [y, m] = app.current.split("-").map(Number);
    return { y, m: m - 1 };
  }
  function key(date, type) {
    return date + "|" + type;
  }
  function getWorker(id) {
    return app.workers.find((w) => w.id === id);
  }
  function activeTypes(date) {
    const day = (/* @__PURE__ */ new Date(date + "T12:00:00")).getDay();
    return Object.entries(app.shifts).filter(([, shift]) => shift.enabled !== false && Array.isArray(shift.activeDays) && shift.activeDays.includes(day)).flatMap(([type, shift]) => Array.from({ length: Number(shift.coverage) || 0 }, (_, index) => ({ type, index, id: type + "-" + index })));
  }
  function assignmentKey(date, slot) {
    return key(date, slot.id);
  }
  function assignmentsInMonth() {
    const { y, m } = ym();
    const prefix = monthKey(y, m);
    return Object.entries(app.assignments).filter(([k]) => k.startsWith(prefix));
  }
  function hoursByWorker() {
    const hours = Object.fromEntries(app.workers.map((w) => [w.id, 0]));
    assignmentsInMonth().forEach(([k, id]) => {
      const [date, slotId] = k.split("|"), type = slotId.slice(0, slotId.lastIndexOf("-")), meta = shiftMeta[type];
      if (id && hours[id] !== void 0 && meta && !(meta.manager && app.managerFallbacks[date] === id)) hours[id] += ShiftwiseEngine.intervalFor(date, meta).minutes / 60;
    });
    return hours;
  }
  function unavailable(workerId, date, period) {
    return app.availability.some((a) => a.workerId === workerId && a.date === date && (a.period === "all" || a.period === period));
  }
  function sameDayAssignments(workerId, date) {
    return Object.entries(app.assignments).filter(([k, id]) => id === workerId && k.startsWith(date + "|")).map(([k]) => k.split("|")[1].split("-")[0]);
  }
  function has24OnDate(workerId, date) {
    if (app.twentyFourPairs.some((pair) => pair.workerId === workerId && pair.keys.some((key2) => key2.startsWith(date + "|")))) return true;
    const types = sameDayAssignments(workerId, date), groups = {};
    types.forEach((type) => {
      const meta = shiftMeta[type];
      if (meta?.pairGroup) {
        groups[meta.pairGroup] = groups[meta.pairGroup] || {};
        groups[meta.pairGroup][meta.period] = true;
      }
    });
    return Object.values(groups).some((group) => group.day && group.night);
  }
  function selectOptions(selected, includeEmpty = true, workers = app.workers) {
    return (includeEmpty ? '<option value="">Unassigned</option>' : "") + workers.map((w) => '<option value="' + w.id + '" ' + (w.id === selected ? "selected" : "") + ">" + escapeHtml(w.name) + "</option>").join("");
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[c]);
  }
  function badge(preference) {
    return preference === "either" ? '<span class="pill">Either</span>' : '<span class="pill ' + preference + '">' + (preference === "day" ? "Day" : "Night") + "</span>";
  }
  function pairLabel(pair) {
    if (pair === "any") return '<span class="pill dual">Any 24h pattern</span>';
    const pairing = app.pairings.find((item) => item.id === pair);
    return pairing ? '<span class="pill dual">' + escapeHtml(pairing.name) + "</span>" : '<span class="pill">No 24h</span>';
  }
  function overview() {
    const { y, m } = ym(), total = daysInMonth(y, m);
    let totalSlots = 0, filled = 0;
    for (let d = 1; d <= total; d++) {
      const date = iso(localDate(y, m, d));
      activeTypes(date).forEach((slot) => {
        totalSlots++;
        if (app.assignments[assignmentKey(date, slot)]) filled++;
      });
    }
    const hrs = hoursByWorker(), totalHours = Object.values(hrs).reduce((a, b) => a + b, 0), targets = app.workers.reduce((a, w) => a + Number(w.target), 0);
    const squaredTargetError = app.workers.reduce((sum, w) => sum + square((hrs[w.id] || 0) - Number(w.target)), 0);
    return { totalSlots, filled, unfilled: totalSlots - filled, totalHours, targets, hrs, squaredTargetError };
  }
  function renderReadiness() {
    const { y, m } = ym(), categoryGaps = Object.entries(app.shifts).filter(([, shift]) => !shift.manager && shift.enabled !== false && !app.workers.some((worker) => worker.categories.includes(shift.category))).map(([, shift]) => shift.label), noEligibleDates = [];
    let requiredHours = 0;
    for (let d = 1; d <= daysInMonth(y, m); d++) {
      const date = iso(localDate(y, m, d));
      activeTypes(date).forEach((slot) => {
        const meta = shiftMeta[slot.type];
        requiredHours += meta.hours;
        const eligible = app.workers.filter((worker) => (meta.manager ? worker.managerQualified : worker.categories.includes(meta.category)) && !unavailable(worker.id, date, meta.period));
        if (!eligible.length) noEligibleDates.push(date + " " + meta.label);
      });
    }
    const pairingWarnings = app.pairings.filter((pairing) => !ShiftwiseEngine.pairingContinuity(pairing, app.shifts).valid), lockWarnings = Object.entries(monthSlice(app.locks)).filter(([key2]) => assignmentConflicts(app.assignments[key2], key2).length), requestedHours = app.workers.reduce((sum, worker) => sum + Number(worker.target), 0), qualified = app.workers.filter((worker) => worker.managerQualified).length, defaultManager = app.workers.find((worker) => worker.defaultManager), outcome = overview(), fallbackCount = Object.keys(app.managerFallbacks).filter((date) => date.startsWith(app.current)).length, warnings = categoryGaps.length + noEligibleDates.length + pairingWarnings.length + lockWarnings.length;
    const title = warnings ? "Review scheduling risks" : "Ready to generate";
    const detail = warnings ? (categoryGaps.length ? "No eligible worker for " + categoryGaps.join(", ") + ". " : "") + (noEligibleDates.length ? noEligibleDates.length + " date/shift combination" + (noEligibleDates.length === 1 ? " has" : "s have") + " no available eligible worker. " : "") + (pairingWarnings.length ? pairingWarnings.length + " invalid 24h pairing" + (pairingWarnings.length === 1 ? "" : "s") + ". " : "") + (lockWarnings.length ? lockWarnings.length + " locked assignment conflict" + (lockWarnings.length === 1 ? "" : "s") + "." : "") : "Required coverage: " + requiredHours + "h; team requested: " + requestedHours + "h. " + (defaultManager ? qualified > 1 ? qualified - 1 + " qualified manager replacement" + (qualified === 2 ? "" : "s") + " available." : "No qualified manager replacement is configured." : qualified + " manager-qualified worker" + (qualified === 1 ? " is" : "s are") + " configured.") + (outcome.filled ? " Generated: " + outcome.filled + "/" + outcome.totalSlots + " filled; " + fallbackCount + " 24h manager fallback" + (fallbackCount === 1 ? "" : "s") + "." : "") + (currentMeta().solver?.exact ? " Exact optimum verified across " + currentMeta().solver.variables + " decision variables." : "");
    const element = document.getElementById("scheduleReadiness");
    element.classList.toggle("warn", Boolean(warnings));
    element.innerHTML = "<div><b>" + title + "</b><p>" + escapeHtml(detail) + '</p></div><span class="pill">' + (warnings ? warnings + " issue" + (warnings === 1 ? "" : "s") : "Checks passed") + "</span>";
  }
  function renderStats() {
    const o = overview(), pct = o.totalSlots ? Math.round(o.filled / o.totalSlots * 100) : 0;
    document.getElementById("stats").innerHTML = [
      ["Coverage", pct + "%", o.filled + " of " + o.totalSlots + " required shifts filled"],
      ["Unfilled shifts", o.unfilled, o.unfilled ? "Review gaps or add staff" : "Every required shift is covered"],
      ["Scheduled hours", o.totalHours, "Across " + app.workers.length + " workers"],
      ["Hour-target error", o.squaredTargetError + " h\xB2", "Lower means a closer fit to all requests"]
    ].map((x) => '<div class="stat"><div class="stat-label">' + x[0] + '</div><div class="stat-value">' + x[1] + '</div><div class="stat-note">' + x[2] + "</div></div>").join("");
  }
  function weekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 864e5 + 1) / 7);
  }
  function renderCalendar() {
    const { y, m } = ym(), first = localDate(y, m, 1), last = localDate(y, m, daysInMonth(y, m));
    let start = localDate(y, m, 1 - (first.getDay() + 6) % 7), end = localDate(y, m, daysInMonth(y, m) + (6 - (last.getDay() + 6) % 7));
    if (scheduleFilters.mode === "week") {
      const focus = /* @__PURE__ */ new Date((scheduleFilters.weekDate || app.current + "-01") + "T12:00:00");
      start = new Date(focus);
      start.setDate(start.getDate() - (start.getDay() + 6) % 7);
      end = new Date(start);
      end.setDate(end.getDate() + 6);
    }
    let html = '<div class="weekhead">Week</div>' + ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => '<div class="weekhead">' + d + "</div>").join("");
    for (let cur = new Date(start); cur <= end; cur.setDate(cur.getDate() + 7)) {
      html += '<div class="weeknum">W' + weekNumber(cur) + "</div>";
      for (let i = 0; i < 7; i++) {
        const d = localDate(cur.getFullYear(), cur.getMonth(), cur.getDate() + i), date = iso(d), isCurrent = d.getMonth() === m, weekend = i > 4;
        let shifts = "";
        if (isCurrent) activeTypes(date).filter((slot) => slotMatchesFilters(date, slot)).forEach((slot) => {
          const key2 = assignmentKey(date, slot), assignee = app.assignments[key2], worker = getWorker(assignee), meta = shiftMeta[slot.type], pair = worker && app.twentyFourPairs.find((item) => item.workerId === worker.id && item.keys.includes(key2)), is24 = worker && pair, short = meta.short || meta.label.slice(0, 4).toUpperCase(), reason = app.assignmentReasons[key2] || app.unfilledReasons[key2] || (!worker ? "No eligible assignment yet" : "Manual assignment.");
          shifts += '<button draggable="' + Boolean(worker) + '" class="shift-chip ' + (meta.cls || "s-custom") + (worker ? "" : " unfilled") + (app.locks[key2] ? " locked" : "") + (bulkSelected.has(key2) ? " selected" : "") + '" data-assignment="' + key2 + '" title="' + escapeHtml(reason) + '"><span class="time">' + short + '</span><span class="worker">' + (worker ? escapeHtml(worker.name) : "Unfilled") + "</span>" + (is24 ? '<span class="shift-24" title="' + escapeHtml(pair.name || "24-hour shift") + '">24</span>' : "") + (meta.manager && app.managerFallbacks[date] === assignee ? '<span class="shift-24" title="24-hour manager fallback">FB</span>' : "") + "</button>";
        });
        html += '<div class="day ' + (weekend ? "weekend " : "") + (!isCurrent ? "out-month" : "") + '"><div class="date"><span>' + d.getDate() + "</span>" + (isCurrent && weekend && app.settings.weekendNo8Night ? "<small>No 8N</small>" : "") + "</div>" + shifts + "</div>";
      }
    }
    document.getElementById("calendar").innerHTML = html;
    document.getElementById("calendarTitle").innerHTML = fmtMonth(y, m).replace(/ (\d{4})$/, " <span>$1</span>");
    document.getElementById("monthPicker").textContent = fmtMonth(y, m) + " \u25BE";
    document.getElementById("monthAside").textContent = fmtMonth(y, m);
    document.getElementById("scheduleSubtitle").textContent = "One worker is required for every active shift in " + fmtMonth(y, m) + ".";
  }
  function renderOverview() {
    const o = overview(), { y, m } = ym(), targetTotal = app.workers.reduce((n, w) => n + Number(w.target), 0), coverage = Math.round(o.filled / Math.max(1, o.totalSlots) * 100), targetPct = Math.round(o.totalHours / Math.max(1, targetTotal) * 100);
    document.getElementById("coverage").innerHTML = '<div class="coverage-item"><span>Shift coverage</span><b>' + coverage + '%</b><div class="bar"><i style="width:' + coverage + '%"></i></div></div><div class="coverage-item"><span>Squared target error</span><b>' + o.squaredTargetError + ' h\xB2</b><span>Optimised by the schedule generator</span></div><div class="coverage-item"><span>24h assignments</span><b>' + app.workers.reduce((n, w) => n + count24(w.id), 0) + '</b><span>With recovery rule applied</span></div><div class="coverage-item"><span>Unfilled shifts</span><b>' + o.unfilled + "</b><span>" + (o.unfilled ? "Add workers or relax a constraint" : "Ready to publish") + "</span></div>";
    const sorted = [...app.workers].sort((a, b) => o.hrs[a.id] / Math.max(1, a.target) - o.hrs[b.id] / Math.max(1, b.target)).slice(0, 6);
    document.getElementById("workerSummary").innerHTML = sorted.map((w) => {
      let h = o.hrs[w.id], p = Math.min(100, Math.round(h / Math.max(1, w.target) * 100));
      return '<div class="worker-summary-row"><span class="name">' + escapeHtml(w.name) + '</span><div class="bar"><i style="width:' + p + '%"></i></div><span class="hours">' + h + " / " + w.target + "h</span></div>";
    }).join("") || '<div class="empty">Add workers to start scheduling.</div>';
  }
  function count24(id) {
    const { y, m } = ym(), prefix = monthKey(y, m), recorded = app.twentyFourPairs.filter((pair) => pair.workerId === id && pair.startDate.startsWith(prefix));
    if (recorded.length) return recorded.length;
    let n = 0;
    for (let d = 1; d <= daysInMonth(y, m); d++) {
      if (has24OnDate(id, iso(localDate(y, m, d)))) n++;
    }
    return n;
  }
  function renderWorkers() {
    const hrs = hoursByWorker();
    document.getElementById("workersTable").innerHTML = app.workers.map((w) => {
      const h = hrs[w.id] || 0, p = Math.min(100, Math.round(h / Math.max(1, w.target) * 100)), categories = w.categories.map((category) => '<span class="category-tag">' + escapeHtml(category) + "</span>").join(""), managerStatus = w.defaultManager ? '<span class="pill dual">Default</span>' : w.managerQualified ? '<span class="pill dual">Qualified</span>' : '<span class="pill">\u2014</span>';
      return '<tr><td><span class="avatar">' + initials(w.name) + "</span><b>" + escapeHtml(w.name) + "</b></td><td>" + w.target + 'h</td><td><div class="progress-line"><div class="bar"><i style="width:' + p + '%"></i></div><small>' + h + "h</small></div></td><td>" + categories + "</td><td>" + managerStatus + "</td><td>" + badge(w.preference) + "</td><td>" + pairLabel(w.pair24) + '</td><td><button class="btn edit-worker" data-id="' + w.id + '">Edit</button></td></tr>';
    }).join("") || '<tr><td colspan="8" class="empty">No workers yet.</td></tr>';
  }
  function weekdayNames(days) {
    const names2 = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return days.length === 7 ? "Every day" : days.map((day) => names2[day]).join(", ");
  }
  function renderShifts() {
    document.getElementById("categoryList").innerHTML = app.categories.map((category) => '<span class="pill">' + escapeHtml(category) + "</span>").join("") || '<span class="sub">No categories yet.</span>';
    document.getElementById("shiftsTable").innerHTML = Object.entries(app.shifts).map(([id, shift]) => "<tr><td><b>" + escapeHtml(shift.label) + "</b>" + (shift.manager ? '<span class="category-tag">Manager role</span>' : "") + "</td><td>" + shift.start + "\u2013" + shift.end + ' <span class="sub">(' + shift.hours + "h)</span></td><td>" + escapeHtml(shift.category) + "</td><td>" + shift.coverage + "</td><td>" + weekdayNames(shift.activeDays) + "</td><td>" + (app.pairings.some((pairing) => pairing.firstShiftId === id || pairing.secondShiftId === id) ? '<span class="pill dual">24h component</span>' : '<span class="pill">\u2014</span>') + "</td><td>" + (shift.manager ? '<span class="pill">Built in</span>' : '<button class="btn edit-shift" data-id="' + id + '">Edit</button>') + "</td></tr>").join("");
    document.getElementById("pairingsTable").innerHTML = app.pairings.map((pairing) => {
      const check = ShiftwiseEngine.pairingContinuity(pairing, app.shifts), first = app.shifts[pairing.firstShiftId], second = app.shifts[pairing.secondShiftId];
      return "<tr><td><b>" + escapeHtml(pairing.name) + "</b></td><td>" + escapeHtml(first?.label || "Missing") + "</td><td>" + escapeHtml(second?.label || "Missing") + "</td><td>" + (pairing.dayOffset ? "Next day" : "Same day") + '</td><td><span class="pill ' + (check.valid ? "dual" : "") + '">' + escapeHtml(check.reason) + '</span></td><td><button class="btn edit-pairing" data-id="' + pairing.id + '">Edit</button></td></tr>';
    }).join("") || '<tr><td colspan="6" class="empty">No 24-hour pairings configured.</td></tr>';
  }
  function renderAvailability() {
    const { y, m } = ym(), prefix = monthKey(y, m);
    const visible = app.availability.filter((a) => a.date.startsWith(prefix)).sort((a, b) => a.date.localeCompare(b.date));
    const body = document.getElementById("availabilityTable");
    body.innerHTML = visible.map((a) => '<tr><td><span class="avatar">' + initials(getWorker(a.workerId)?.name || "?") + "</span><b>" + escapeHtml(getWorker(a.workerId)?.name || "Removed worker") + "</b></td><td>" + fmtDate(a.date) + "</td><td>" + { all: "Whole day", day: "Day / morning", night: "Night" }[a.period] + '</td><td><button class="btn danger remove-availability" data-id="' + a.id + '">Remove</button></td></tr>').join("");
    document.getElementById("availabilityEmpty").hidden = visible.length > 0;
  }
  function renderSettings() {
    const { y, m } = ym(), s = app.settings;
    document.getElementById("settingsMonth").value = monthKey(y, m);
    document.getElementById("recoveryDays").value = s.recoveryDays;
    document.getElementById("minimumRestHours").value = app.minimumRestHours;
  }
  function renderScheduleControls() {
    const meta = currentMeta(), status = document.getElementById("scheduleStatus");
    status.textContent = meta.status[0].toUpperCase() + meta.status.slice(1) + " \xB7 v" + meta.revision;
    status.className = "pill status-" + meta.status;
    document.getElementById("publishSchedule").disabled = meta.status === "published";
    document.getElementById("archiveSchedule").disabled = meta.status === "archived";
    const workerOptions = '<option value="">All workers</option>' + app.workers.map((worker) => '<option value="' + worker.id + '">' + escapeHtml(worker.name) + "</option>").join(""), categoryOptions = '<option value="">All categories</option>' + app.categories.map((category) => "<option>" + escapeHtml(category) + "</option>").join(""), shiftOptions = '<option value="">All shifts</option>' + Object.entries(app.shifts).map(([id, shift]) => '<option value="' + id + '">' + escapeHtml(shift.label) + "</option>").join("");
    document.getElementById("scheduleWorkerFilter").innerHTML = workerOptions;
    document.getElementById("scheduleWorkerFilter").value = scheduleFilters.worker;
    document.getElementById("scheduleCategoryFilter").innerHTML = categoryOptions;
    document.getElementById("scheduleCategoryFilter").value = scheduleFilters.category;
    document.getElementById("scheduleShiftFilter").innerHTML = shiftOptions;
    document.getElementById("scheduleShiftFilter").value = scheduleFilters.shift;
    document.getElementById("scheduleAvailabilityFilter").value = scheduleFilters.availability;
    document.getElementById("scheduleViewMode").value = scheduleFilters.mode;
    document.getElementById("scheduleUnfilledOnly").checked = scheduleFilters.unfilledOnly;
    document.getElementById("weekDateLabel").hidden = scheduleFilters.mode !== "week";
    document.getElementById("scheduleWeekDate").value = scheduleFilters.weekDate || app.current + "-01";
    document.getElementById("bulkWorker").innerHTML = '<option value="">Choose worker\u2026</option>' + app.workers.map((worker) => '<option value="' + worker.id + '">' + escapeHtml(worker.name) + "</option>").join("");
  }
  function slotMatchesFilters(date, slot) {
    const workerId = app.assignments[assignmentKey(date, slot)], meta = shiftMeta[slot.type];
    if (scheduleFilters.worker && workerId !== scheduleFilters.worker) return false;
    if (scheduleFilters.category && meta.category !== scheduleFilters.category) return false;
    if (scheduleFilters.shift && slot.type !== scheduleFilters.shift) return false;
    if (scheduleFilters.availability && (!workerId || scheduleFilters.availability === "violation" !== unavailable(workerId, date, meta.period))) return false;
    if (scheduleFilters.unfilledOnly && workerId) return false;
    return true;
  }
  function renderUnfilled() {
    const { y, m } = ym(), rows = [];
    for (let day = 1; day <= daysInMonth(y, m); day++) {
      const date = iso(localDate(y, m, day));
      activeTypes(date).forEach((slot) => {
        const key2 = assignmentKey(date, slot);
        if (!app.assignments[key2]) rows.push({ key: key2, date, slot, meta: shiftMeta[slot.type] });
      });
    }
    document.getElementById("bulkCount").textContent = bulkSelected.size + " selected";
    document.getElementById("unfilledList").innerHTML = rows.map((row) => '<label class="unfilled-row"><input type="checkbox" data-bulk-key="' + row.key + '" ' + (bulkSelected.has(row.key) ? "checked" : "") + " /><span>" + row.date.slice(5) + "</span><b>" + escapeHtml(row.meta.label) + '</b><span class="sub">' + escapeHtml(app.unfilledReasons[row.key] || "Open assignment") + "</span></label>").join("") || '<div class="empty">Every required shift is filled.</div>';
  }
  function operationalReport() {
    const hours = hoursByWorker(), data = app.workers.map((worker) => ({ worker, hours: hours[worker.id] || 0, night: 0, weekend: 0, manager: 0, violations: 0 }));
    const byWorker = Object.fromEntries(data.map((row) => [row.worker.id, row]));
    assignmentsInMonth().forEach(([key2, workerId]) => {
      const details = detailsForAssignment(key2), row = byWorker[workerId];
      if (!details || !row) return;
      const duration = details.minutes / 60;
      if (details.shift.period === "night") row.night += duration;
      if ([0, 6].includes((/* @__PURE__ */ new Date(details.date + "T12:00:00")).getDay())) row.weekend += duration;
      if (details.shift.manager && !getWorker(workerId)?.defaultManager) row.manager++;
      if (unavailable(workerId, details.date, details.shift.period)) row.violations++;
    });
    return data;
  }
  function renderReports() {
    const data = operationalReport(), totalHours = data.reduce((sum, row) => sum + row.hours, 0), night = data.reduce((sum, row) => sum + row.night, 0), weekend = data.reduce((sum, row) => sum + row.weekend, 0), fallbacks = Object.keys(app.managerFallbacks).filter((date) => date.startsWith(app.current)).length;
    document.getElementById("reportMetrics").innerHTML = [["Payroll hours", totalHours + "h"], ["Night hours", night + "h"], ["Weekend hours", weekend + "h"], ["24h duties", app.workers.reduce((sum, worker) => sum + count24(worker.id), 0)], ["Manager fallbacks", fallbacks], ["Availability violations", data.reduce((sum, row) => sum + row.violations, 0)]].map((item) => '<div class="report-metric"><span class="sub">' + item[0] + "</span><b>" + item[1] + "</b></div>").join("");
    document.getElementById("reportsTable").innerHTML = data.map((row) => {
      const variance = Math.round((row.hours - Number(row.worker.target)) * 10) / 10;
      return "<tr><td><b>" + escapeHtml(row.worker.name) + "</b></td><td>" + row.hours + 'h</td><td class="' + (variance > 0 ? "negative" : variance < 0 ? "" : "positive") + '">' + (variance > 0 ? "+" : "") + variance + "h</td><td>" + row.night + "h</td><td>" + row.weekend + "h</td><td>" + count24(row.worker.id) + "</td><td>" + row.manager + "</td><td>" + row.violations + "</td></tr>";
    }).join("");
    const categories = {};
    const { y, m } = ym();
    for (let day = 1; day <= daysInMonth(y, m); day++) {
      const date = iso(localDate(y, m, day));
      activeTypes(date).forEach((slot) => {
        const category = shiftMeta[slot.type].category;
        categories[category] ||= { required: 0, filled: 0 };
        categories[category].required++;
        if (app.assignments[assignmentKey(date, slot)]) categories[category].filled++;
      });
    }
    document.getElementById("categoryReport").innerHTML = Object.entries(categories).map(([category, value]) => "<tr><td>" + escapeHtml(category) + "</td><td>" + value.required + "</td><td>" + value.filled + "</td><td>" + Math.round(value.filled / Math.max(1, value.required) * 100) + "%</td></tr>").join("");
    const select = document.getElementById("reportWorker"), selected = select.value;
    select.innerHTML = '<option value="">Choose worker\u2026</option>' + app.workers.map((worker) => '<option value="' + worker.id + '">' + escapeHtml(worker.name) + "</option>").join("");
    select.value = selected;
    renderWorkerReport(selected);
  }
  function renderWorkerReport(workerId) {
    const target = document.getElementById("workerScheduleReport");
    if (!workerId) {
      target.innerHTML = "";
      return;
    }
    const worker = getWorker(workerId), rows = assignmentsInMonth().filter(([, id]) => id === workerId).map(([key2]) => detailsForAssignment(key2)).filter(Boolean).sort((a, b) => a.start - b.start);
    target.innerHTML = "<h3>" + escapeHtml(worker.name) + ' schedule</h3><div class="table-wrap"><table><thead><tr><th>Date</th><th>Shift</th><th>Time</th><th>Category</th><th>Reason</th></tr></thead><tbody>' + rows.map((row) => "<tr><td>" + fmtDate(row.date) + "</td><td>" + escapeHtml(row.shift.label) + "</td><td>" + row.shift.start + "\u2013" + row.shift.end + "</td><td>" + escapeHtml(row.shift.category) + "</td><td>" + escapeHtml(app.assignmentReasons[row.key] || "Manual assignment") + "</td></tr>").join("") + "</tbody></table></div>";
  }
  function renderAll() {
    renderScheduleControls();
    renderReadiness();
    renderStats();
    renderCalendar();
    renderUnfilled();
    renderOverview();
    renderWorkers();
    renderImportState();
    renderShifts();
    renderAvailability();
    renderSettings();
    renderReports();
  }
  function switchView(name) {
    document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.id === name + "View"));
    document.querySelectorAll("[data-view]").forEach((b) => b.classList.toggle("active", b.dataset.view === name));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function renderWorkerCategoryChoices(selected = []) {
    document.getElementById("workerCategories").innerHTML = app.categories.map((category) => '<label class="category-choice"><input type="checkbox" value="' + escapeHtml(category) + '" ' + (selected.includes(category) ? "checked" : "") + " />" + escapeHtml(category) + "</label>").join("");
  }
  function renderWorkerPairingOptions(selected = "none") {
    document.getElementById("worker24").innerHTML = '<option value="none">Does not prefer 24h shifts</option><option value="any">Any configured 24h pattern</option>' + app.pairings.filter((pairing) => pairing.enabled !== false).map((pairing) => '<option value="' + pairing.id + '">Prefer ' + escapeHtml(pairing.name) + "</option>").join("");
    document.getElementById("worker24").value = selected;
  }
  function openWorker(id) {
    const w = id ? getWorker(id) : null;
    document.getElementById("workerModalTitle").textContent = w ? "Edit worker" : "Add worker";
    document.getElementById("workerId").value = w?.id || "";
    document.getElementById("workerName").value = w?.name || "";
    document.getElementById("workerTarget").value = w?.target || 160;
    document.getElementById("workerPreference").value = w?.preference || "either";
    renderWorkerPairingOptions(w?.pair24 || "none");
    renderWorkerCategoryChoices(w?.categories || ["General"]);
    document.getElementById("workerManagerQualified").checked = Boolean(w?.managerQualified);
    document.getElementById("workerDefaultManager").checked = Boolean(w?.defaultManager);
    syncDefaultManagerControl();
    document.getElementById("manageWorkerAvailability").hidden = !w;
    document.getElementById("deleteWorker").hidden = !w;
    document.getElementById("workerModal").showModal();
  }
  function shiftHours(start, end) {
    const toMinutes = (value) => {
      const [hours, minutes] = value.split(":").map(Number);
      return hours * 60 + minutes;
    };
    let duration = toMinutes(end) - toMinutes(start);
    if (duration <= 0) duration += 1440;
    return duration / 60;
  }
  function renderShiftDays(selected) {
    const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    document.getElementById("shiftDays").innerHTML = labels.map((label, index) => '<label><input type="checkbox" value="' + index + '" ' + (selected.includes(index) ? "checked" : "") + " />" + label + "</label>").join("");
  }
  function openShift(id) {
    const shift = id ? app.shifts[id] : null;
    document.getElementById("shiftModalTitle").textContent = shift ? "Edit shift" : "Add shift";
    document.getElementById("shiftId").value = id || "";
    document.getElementById("shiftName").value = shift?.label || "";
    document.getElementById("shiftCategory").innerHTML = app.categories.map((category) => '<option value="' + escapeHtml(category) + '" ' + (shift?.category === category ? "selected" : "") + ">" + escapeHtml(category) + "</option>").join("");
    document.getElementById("shiftStart").value = shift?.start || "08:00";
    document.getElementById("shiftEnd").value = shift?.end || "16:00";
    document.getElementById("shiftCoverage").value = shift?.coverage || 1;
    document.getElementById("shiftPeriod").value = shift?.period || "day";
    renderShiftDays(shift?.activeDays || [0, 1, 2, 3, 4, 5, 6]);
    updateShiftDuration();
    document.getElementById("deleteShift").hidden = !shift || systemShiftIds.includes(id);
    document.getElementById("shiftModal").showModal();
  }
  function updatePairingPreview() {
    const pairing = { firstShiftId: document.getElementById("pairingFirst").value, secondShiftId: document.getElementById("pairingSecond").value, dayOffset: Number(document.getElementById("pairingOffset").value) }, check = ShiftwiseEngine.pairingContinuity(pairing, app.shifts);
    const preview = document.getElementById("pairingPreview");
    preview.className = "pairing-preview " + (check.valid ? "positive" : "negative");
    preview.textContent = check.reason;
    return check;
  }
  function openPairing(id) {
    const pairing = id ? app.pairings.find((item) => item.id === id) : null, options = Object.entries(app.shifts).filter(([, shift]) => !shift.manager).map(([shiftId, shift]) => '<option value="' + shiftId + '">' + escapeHtml(shift.label) + " (" + shift.start + "\u2013" + shift.end + ")</option>").join("");
    document.getElementById("pairingModalTitle").textContent = pairing ? "Edit 24h pairing" : "Add 24h pairing";
    document.getElementById("pairingId").value = pairing?.id || "";
    document.getElementById("pairingName").value = pairing?.name || "";
    document.getElementById("pairingFirst").innerHTML = options;
    document.getElementById("pairingSecond").innerHTML = options;
    document.getElementById("pairingFirst").value = pairing?.firstShiftId || Object.keys(app.shifts).find((id2) => !app.shifts[id2].manager);
    document.getElementById("pairingSecond").value = pairing?.secondShiftId || Object.keys(app.shifts).find((id2) => !app.shifts[id2].manager);
    document.getElementById("pairingOffset").value = String(pairing?.dayOffset || 0);
    document.getElementById("deletePairing").hidden = !pairing;
    updatePairingPreview();
    document.getElementById("pairingModal").showModal();
  }
  function availabilityState(workerId, date) {
    return app.availability.find((a) => a.workerId === workerId && a.date === date)?.period || "neutral";
  }
  function renderWorkerAvailabilityCalendar() {
    const { workerId, y, m, period } = availabilityEditor, worker = getWorker(workerId);
    document.getElementById("availabilityCalendarWorker").textContent = worker ? worker.name : "";
    document.getElementById("availabilityCalendarMonth").textContent = fmtMonth(y, m);
    let html = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => '<div class="mini-weekday">' + d + "</div>").join("");
    const first = (localDate(y, m, 1).getDay() + 6) % 7, count = daysInMonth(y, m);
    html += Array.from({ length: first }, () => '<div class="mini-day empty"></div>').join("");
    for (let d = 1; d <= count; d++) {
      const date = iso(localDate(y, m, d)), state = availabilityState(workerId, date);
      html += '<button class="mini-day state-' + state + '" data-availability-date="' + date + '" title="' + { all: "Unavailable all day", day: "Unavailable in the morning / day", night: "Unavailable at night", neutral: "No restriction recorded" }[state] + '">' + d + "</button>";
    }
    document.getElementById("workerAvailabilityCalendar").innerHTML = html;
    document.querySelectorAll(".palette-option").forEach((button) => button.classList.toggle("active", button.dataset.period === period));
    document.getElementById("availabilityPaintState").textContent = { all: "Whole day unavailable", night: "Night unavailable", day: "Morning / day unavailable", available: "Available \u2014 clear restriction" }[period];
  }
  function openWorkerAvailability() {
    const workerId = document.getElementById("workerId").value;
    if (!workerId) return;
    const { y, m } = ym();
    availabilityEditor = { workerId, y, m, period: "all" };
    document.getElementById("workerModal").close();
    renderWorkerAvailabilityCalendar();
    document.getElementById("workerAvailabilityModal").showModal();
  }
  function setAvailabilityFromCalendar(date, state) {
    app.availability = app.availability.filter((a) => !(a.workerId === availabilityEditor.workerId && a.date === date));
    if (state !== "available") app.availability.push({ id: uid(), workerId: availabilityEditor.workerId, date, period: state });
  }
  function updateAvailabilityFromCalendar(date) {
    setAvailabilityFromCalendar(date, availabilityEditor.period);
    save();
    renderWorkerAvailabilityCalendar();
    renderAvailability();
  }
  function applyAvailabilityToCalendarDates(dates, state = availabilityEditor.period) {
    dates.forEach((date) => setAvailabilityFromCalendar(date, state));
    save();
    renderWorkerAvailabilityCalendar();
    renderAvailability();
  }
  function openAvailability() {
    document.getElementById("availabilityWorker").innerHTML = selectOptions("", false);
    document.getElementById("availabilityDate").value = app.current + "-01";
    document.getElementById("availabilityDate").min = app.current + "-01";
    const { y, m } = ym();
    document.getElementById("availabilityDate").max = app.current + "-" + String(daysInMonth(y, m)).padStart(2, "0");
    document.getElementById("availabilityModal").showModal();
  }
  function detailsForAssignment(key2) {
    const [date, slotId] = key2.split("|"), type = slotId.slice(0, slotId.lastIndexOf("-")), shift = app.shifts[type];
    return shift ? { key: key2, date, type, shift, ...ShiftwiseEngine.intervalFor(date, shift) } : null;
  }
  function configuredPairAllows(worker, keyA, keyB) {
    const a = detailsForAssignment(keyA), b = detailsForAssignment(keyB);
    if (!a || !b || !(worker.pair24 === "any" || app.pairings.some((pairing) => pairing.id === worker.pair24))) return false;
    return app.pairings.some((pairing) => {
      if (!(worker.pair24 === "any" || worker.pair24 === pairing.id)) return false;
      const expectedSecond = ShiftwiseEngine.addDays(a.date, Number(pairing.dayOffset || 0));
      return a.type === pairing.firstShiftId && b.type === pairing.secondShiftId && b.date === expectedSecond || b.type === pairing.firstShiftId && a.type === pairing.secondShiftId && a.date === ShiftwiseEngine.addDays(b.date, Number(pairing.dayOffset || 0));
    });
  }
  function assignmentConflicts(workerId, key2) {
    if (!workerId) return [];
    const worker = getWorker(workerId), details = detailsForAssignment(key2), issues = [];
    if (!worker || !details) return ["Worker or shift no longer exists."];
    if (details.shift.manager && !worker.managerQualified) issues.push("Worker is not manager-qualified.");
    if (!details.shift.manager && !worker.categories.includes(details.shift.category)) issues.push("Worker lacks the " + details.shift.category + " category.");
    if (unavailable(worker.id, details.date, details.shift.period)) issues.push("Worker marked this period unavailable.");
    if (details.shift.manager) {
      const defaultManager = app.workers.find((item) => item.defaultManager);
      if (defaultManager && defaultManager.id !== worker.id && !unavailable(defaultManager.id, details.date, "day")) issues.push("The default manager is available and must be used first.");
    }
    Object.entries(app.assignments).forEach(([otherKey, otherWorker]) => {
      if (otherKey === key2 || otherWorker !== worker.id) return;
      const other = detailsForAssignment(otherKey);
      if (!other) return;
      const gap = ShiftwiseEngine.gapMinutes(details, other);
      if (gap < Number(app.minimumRestHours) * 60 && !configuredPairAllows(worker, key2, otherKey)) issues.push(gap < 0 ? "Overlaps " + other.shift.label + " on " + other.date + "." : "Only " + Math.max(0, Math.round(gap / 60 * 10) / 10) + "h rest before/after " + other.shift.label + ".");
    });
    app.twentyFourPairs.filter((pair) => pair.workerId === worker.id && !pair.keys.includes(key2)).forEach((pair) => {
      const pairDetails = pair.keys.map(detailsForAssignment).filter(Boolean).sort((a, b) => a.start - b.start);
      if (pairDetails.length && details.start >= pairDetails.at(-1).end && details.start < pairDetails.at(-1).end + Number(app.settings.recoveryDays) * 864e5) issues.push("Falls inside recovery after " + (pair.name || "a 24h duty") + ".");
    });
    return [...new Set(issues)];
  }
  function updateAssignmentValidation() {
    const key2 = document.getElementById("assignmentKey").value, workerId = document.getElementById("assignmentWorker").value, issues = assignmentConflicts(workerId, key2), box = document.getElementById("assignmentConflict");
    box.hidden = !issues.length;
    box.textContent = issues.join(" ");
    return issues;
  }
  function openAssignment(encoded) {
    const [date, slotid] = encoded.split("|");
    const type = slotid.slice(0, slotid.lastIndexOf("-")), current = app.assignments[encoded];
    document.getElementById("assignmentKey").value = encoded;
    document.getElementById("assignmentDate").value = fmtDate(date);
    document.getElementById("assignmentShift").value = shiftMeta[type].label;
    document.getElementById("assignmentWorker").innerHTML = selectOptions(current, true, app.workers);
    document.getElementById("assignmentLocked").checked = Boolean(app.locks[encoded]);
    document.getElementById("assignmentReason").textContent = app.assignmentReasons[encoded] || app.unfilledReasons[encoded] || "Manual assignment: choose a worker to see exact conflict checks.";
    updateAssignmentValidation();
    document.getElementById("assignmentModal").showModal();
  }
  function compareAssignments(snapshot) {
    const current = monthSlice(app.assignments), previous = snapshot.assignments || {}, keys = /* @__PURE__ */ new Set([...Object.keys(current), ...Object.keys(previous)]);
    let changed = 0, added = 0, removed = 0;
    keys.forEach((key2) => {
      if (current[key2] === previous[key2]) return;
      if (!previous[key2]) added++;
      else if (!current[key2]) removed++;
      else changed++;
    });
    return { changed, added, removed };
  }
  function openVersions() {
    const meta = currentMeta();
    document.getElementById("versionsSubtitle").textContent = fmtMonth(ym().y, ym().m) + " \xB7 current revision " + meta.revision;
    document.getElementById("versionsList").innerHTML = [...meta.versions].reverse().map((version) => '<div class="version-row"><div><b>v' + version.revision + " \xB7 " + escapeHtml(version.label) + '</b><p class="sub">' + new Date(version.timestamp).toLocaleString() + " \xB7 " + version.status + '</p></div><div class="version-actions"><button class="btn compare-version" data-id="' + version.id + '">Compare</button><button class="btn restore-version" data-id="' + version.id + '">Restore</button></div></div>').join("") || '<div class="empty">No previous versions yet.</div>';
    document.getElementById("versionComparison").hidden = true;
    document.getElementById("versionsModal").showModal();
  }
  function square(x) {
    return x * x;
  }
  function prepareGenerationRandomness() {
    let seed;
    if (globalThis.crypto?.getRandomValues) {
      const values = new Uint32Array(1);
      globalThis.crypto.getRandomValues(values);
      seed = values[0];
    } else seed = Math.floor(Math.random() * 4294967295);
    let state = seed || 1;
    const random = () => {
      state = state * 1664525 + 1013904223 >>> 0;
      return state / 4294967296;
    };
    generationTieRanks = Object.fromEntries(app.workers.map((worker) => [worker.id, random()]));
    app.lastGenerationSeed = seed;
  }
  async function generate() {
    const button = document.getElementById("generateSchedule"), original = button.textContent;
    button.disabled = true;
    button.textContent = "Solving exactly\u2026";
    try {
      prepareGenerationRandomness();
      const highs = await highsReady, result = ShiftwiseEngine.solve({ ...app, randomRanks: generationTieRanks }, ShiftwiseEngine.highsAdapter(highs));
      if (!result.feasible) {
        alert("Schedule could not be generated: " + (result.error || "Unknown constraint conflict."));
        return;
      }
      checkpoint("Before exact regeneration");
      const preservedLocks = monthSlice(app.locks);
      clearCurrentScheduleData();
      Object.assign(app.assignments, result.assignments);
      Object.assign(app.assignmentReasons, result.assignmentReasons);
      Object.assign(app.managerFallbacks, result.managerFallbacks);
      Object.assign(app.locks, preservedLocks);
      app.twentyFourPairs.push(...result.twentyFourPairs);
      result.unfilled.forEach((item) => app.unfilledReasons[item.key] = item.reason);
      const meta = currentMeta();
      meta.status = "draft";
      meta.solver = { exact: Boolean(result.exact), objective: result.objective, variables: result.diagnostics.modelVariables, constraints: result.diagnostics.modelConstraints, generatedAt: (/* @__PURE__ */ new Date()).toISOString(), seed: app.lastGenerationSeed };
      save();
      renderAll();
    } catch (error) {
      console.error(error);
      alert("The exact solver could not start. If this folder was moved, keep highs-wasm.js next to index.html. Technical detail: " + error.message);
    } finally {
      button.disabled = false;
      button.textContent = original;
    }
  }
  document.addEventListener("click", (e) => {
    const v = eventElement(e).closest("[data-view]");
    if (v) switchView(v.dataset.view);
    if (eventElement(e).id === "addWorker") openWorker();
    if (eventElement(e).closest(".edit-worker")) openWorker(eventElement(e).closest(".edit-worker").dataset.id);
    if (eventElement(e).id === "addAvailability") openAvailability();
    if (eventElement(e).closest(".remove-availability")) {
      app.availability = app.availability.filter((a) => a.id !== eventElement(e).closest(".remove-availability").dataset.id);
      save();
      renderAll();
    }
    if (eventElement(e).id === "addShift") openShift();
    if (eventElement(e).closest(".edit-shift")) openShift(eventElement(e).closest(".edit-shift").dataset.id);
    if (eventElement(e).id === "addPairing") openPairing();
    if (eventElement(e).closest(".edit-pairing")) openPairing(eventElement(e).closest(".edit-pairing").dataset.id);
    if (eventElement(e).id === "addCategory") {
      const category = prompt("Category name (for example: Security or Nursing)")?.trim();
      if (category && !app.categories.some((existing) => existing.toLowerCase() === category.toLowerCase())) {
        app.categories.push(category);
        save();
        renderAll();
      }
    }
    if (eventElement(e).id === "deleteShift") {
      const id = document.getElementById("shiftId").value, shift = app.shifts[id];
      if (shift && !systemShiftIds.includes(id) && confirm("Delete " + shift.label + "? Its assignments will be removed.")) {
        delete app.shifts[id];
        delete shiftMeta[id];
        Object.keys(app.assignments).forEach((key2) => {
          if (key2.split("|")[1].startsWith(id + "-")) delete app.assignments[key2];
        });
        save();
        renderAll();
        document.getElementById("shiftModal").close();
      }
    }
    if (eventElement(e).id === "deletePairing") {
      const id = document.getElementById("pairingId").value, pairing = app.pairings.find((item) => item.id === id);
      if (pairing && confirm("Delete " + pairing.name + "? Existing schedules remain, but this pattern will not be generated again.")) {
        app.pairings = app.pairings.filter((item) => item.id !== id);
        app.workers.forEach((worker) => {
          if (worker.pair24 === id) worker.pair24 = "none";
        });
        save();
        renderAll();
        document.getElementById("pairingModal").close();
      }
    }
    if (eventElement(e).id === "deleteWorker") {
      const id = document.getElementById("workerId").value, worker = getWorker(id);
      if (worker && confirm("Delete " + worker.name + "? Their availability entries and scheduled shifts will be removed.")) {
        app.workers = app.workers.filter((w) => w.id !== id);
        app.availability = app.availability.filter((a) => a.workerId !== id);
        Object.keys(app.assignments).forEach((k) => {
          if (app.assignments[k] === id) delete app.assignments[k];
        });
        Object.keys(app.managerFallbacks).forEach((date) => {
          if (app.managerFallbacks[date] === id) delete app.managerFallbacks[date];
        });
        save();
        renderAll();
        document.getElementById("workerModal").close();
      }
    }
    if (eventElement(e).id === "manageWorkerAvailability") openWorkerAvailability();
    if (eventElement(e).id === "availabilityPreviousMonth" || eventElement(e).id === "availabilityNextMonth") {
      const d = localDate(availabilityEditor.y, availabilityEditor.m + (eventElement(e).id === "availabilityNextMonth" ? 1 : -1), 1);
      availabilityEditor.y = d.getFullYear();
      availabilityEditor.m = d.getMonth();
      renderWorkerAvailabilityCalendar();
    }
    if (eventElement(e).closest(".palette-option")) {
      availabilityEditor.period = eventElement(e).closest(".palette-option").dataset.period;
      renderWorkerAvailabilityCalendar();
    }
    if (eventElement(e).closest("[data-availability-date]")) updateAvailabilityFromCalendar(eventElement(e).closest("[data-availability-date]").dataset.availabilityDate);
    if (eventElement(e).id === "availabilityWeekdays") {
      const dates = [];
      for (let d = 1; d <= daysInMonth(availabilityEditor.y, availabilityEditor.m); d++) {
        const date = iso(localDate(availabilityEditor.y, availabilityEditor.m, d)), weekday = (/* @__PURE__ */ new Date(date + "T12:00:00")).getDay();
        if (weekday >= 1 && weekday <= 5) dates.push(date);
      }
      applyAvailabilityToCalendarDates(dates);
    }
    if (eventElement(e).id === "availabilityClearMonth") {
      const prefix = monthKey(availabilityEditor.y, availabilityEditor.m);
      app.availability = app.availability.filter((a) => !(a.workerId === availabilityEditor.workerId && a.date.startsWith(prefix)));
      save();
      renderWorkerAvailabilityCalendar();
      renderAvailability();
    }
    if (eventElement(e).id === "availabilityCopyPrevious") {
      const previous = localDate(availabilityEditor.y, availabilityEditor.m - 1, 1), sourcePrefix = monthKey(previous.getFullYear(), previous.getMonth()), targetPrefix = monthKey(availabilityEditor.y, availabilityEditor.m), source = app.availability.filter((a) => a.workerId === availabilityEditor.workerId && a.date.startsWith(sourcePrefix));
      app.availability = app.availability.filter((a) => !(a.workerId === availabilityEditor.workerId && a.date.startsWith(targetPrefix)));
      source.forEach((a) => {
        const day = Number(a.date.slice(-2));
        if (day <= daysInMonth(availabilityEditor.y, availabilityEditor.m)) app.availability.push({ id: uid(), workerId: availabilityEditor.workerId, date: iso(localDate(availabilityEditor.y, availabilityEditor.m, day)), period: a.period });
      });
      save();
      renderWorkerAvailabilityCalendar();
      renderAvailability();
    }
    if (eventElement(e).closest("[data-shift-days]")) {
      const action = eventElement(e).closest("[data-shift-days]").dataset.shiftDays, days = action === "all" ? [0, 1, 2, 3, 4, 5, 6] : action === "weekdays" ? [1, 2, 3, 4, 5] : action === "weekend" ? [0, 6] : [];
      document.querySelectorAll("#shiftDays input").forEach((input) => input.checked = days.includes(Number(input.value)));
    }
    const clickedAssignment = eventElement(e).closest("[data-assignment]");
    if (clickedAssignment) {
      const key2 = clickedAssignment.dataset.assignment;
      if (e.ctrlKey || e.metaKey) {
        if (bulkSelected.has(key2)) bulkSelected.delete(key2);
        else bulkSelected.add(key2);
        renderCalendar();
        renderUnfilled();
      } else openAssignment(key2);
    }
    if (eventElement(e).dataset.close) document.getElementById(eventElement(e).dataset.close).close();
    if (eventElement(e).id === "scheduleVersions") openVersions();
    if (eventElement(e).id === "publishSchedule") setScheduleStatus("published");
    if (eventElement(e).id === "archiveSchedule") setScheduleStatus("archived");
    if (eventElement(e).id === "undoSchedule") undoSchedule();
    if (eventElement(e).id === "redoSchedule") redoSchedule();
    if (eventElement(e).closest(".compare-version")) {
      const version = currentMeta().versions.find((item) => item.id === eventElement(e).closest(".compare-version").dataset.id), comparison = compareAssignments(version), box = document.getElementById("versionComparison");
      box.hidden = false;
      box.textContent = "Compared with current: " + comparison.changed + " changed, " + comparison.added + " added, " + comparison.removed + " removed assignments.";
    }
    if (eventElement(e).closest(".restore-version")) {
      const version = currentMeta().versions.find((item) => item.id === eventElement(e).closest(".restore-version").dataset.id);
      if (version && confirm("Restore version " + version.revision + "?")) {
        checkpoint("Before version restore");
        restoreSnapshot(version);
        document.getElementById("versionsModal").close();
      }
    }
    if (eventElement(e).id === "clearScheduleFilters") {
      scheduleFilters = { mode: "month", weekDate: "", worker: "", category: "", shift: "", availability: "", unfilledOnly: false };
      renderAll();
    }
    if (eventElement(e).matches("[data-bulk-key]")) {
      if (eventElement(e).checked) bulkSelected.add(eventElement(e).dataset.bulkKey);
      else bulkSelected.delete(eventElement(e).dataset.bulkKey);
    }
    if (eventElement(e).id === "bulkAssign") {
      const workerId = document.getElementById("bulkWorker").value;
      if (!workerId || !bulkSelected.size) return;
      const keys = [...bulkSelected], original = Object.fromEntries(keys.map((key2) => [key2, app.assignments[key2]]));
      keys.forEach((key2) => delete app.assignments[key2]);
      const valid = [];
      keys.sort((a, b) => detailsForAssignment(a).start - detailsForAssignment(b).start).forEach((key2) => {
        if (!assignmentConflicts(workerId, key2).length) {
          app.assignments[key2] = workerId;
          valid.push(key2);
        }
      });
      keys.forEach((key2) => {
        if (original[key2]) app.assignments[key2] = original[key2];
        else delete app.assignments[key2];
      });
      if (!valid.length) {
        alert("The selected worker conflicts with every selected shift.");
        return;
      }
      checkpoint("Before bulk assignment");
      valid.forEach((key2) => {
        app.assignments[key2] = workerId;
        app.assignmentReasons[key2] = "Bulk manual assignment after exact conflict validation.";
        delete app.unfilledReasons[key2];
      });
      bulkSelected.clear();
      save();
      renderAll();
    }
    if (eventElement(e).id === "previousMonth" || eventElement(e).id === "nextMonth") {
      const { y, m } = ym(), d = localDate(y, m + (eventElement(e).id === "nextMonth" ? 1 : -1), 1);
      app.current = monthKey(d.getFullYear(), d.getMonth());
      save();
      renderAll();
    }
    if (eventElement(e).id === "monthPicker") {
      const picker = document.getElementById("settingsMonth");
      picker.showPicker?.();
      switchView("settings");
    }
    if (eventElement(e).id === "generateSchedule") {
      const existing = assignmentsInMonth().length;
      if (!existing || confirm("Generate a new exact schedule? Unlocked assignments will be replaced; locked assignments stay fixed.")) generate();
    }
    if (eventElement(e).id === "printSchedule") window.print();
    if (eventElement(e).id === "exportCsv") exportCsv();
    if (eventElement(e).id === "exportWorkerReport") exportWorkerReport();
    if (eventElement(e).id === "exportPayroll") exportPayroll();
    if (eventElement(e).id === "exportIcs") exportIcs();
    if (eventElement(e).id === "printReports") {
      switchView("reports");
      window.print();
    }
    if (eventElement(e).id === "openSheetImport" || eventElement(e).id === "openSheetImport2") {
      const input = document.getElementById("sheetFile");
      input.value = "";
      input.click();
    }
    if (eventElement(e).id === "downloadSheetTemplate") exportSheetTemplate();
    if (eventElement(e).id === "undoSheetImport") undoSheetImport();
    if (eventElement(e).id === "applySheetImport") applySheetImport();
    if (eventElement(e).id === "saveSettings") saveSettings();
    if (eventElement(e).id === "resetData") {
      if (confirm("Reset all workers, preferences and assignments to the demo data?")) {
        app = defaultData();
        save();
        renderAll();
        switchView("schedule");
      }
    }
  });
  document.getElementById("workerAvailabilityCalendar").addEventListener("pointerdown", (event) => {
    const day = eventElement(event).closest("[data-availability-date]");
    if (!day) return;
    event.preventDefault();
    availabilityPainting = true;
    updateAvailabilityFromCalendar(day.dataset.availabilityDate);
  });
  document.getElementById("workerAvailabilityCalendar").addEventListener("pointerover", (event) => {
    const day = eventElement(event).closest("[data-availability-date]");
    if (availabilityPainting && day) updateAvailabilityFromCalendar(day.dataset.availabilityDate);
  });
  document.addEventListener("pointerup", () => {
    availabilityPainting = false;
  });
  document.getElementById("calendar").addEventListener("dragstart", (event) => {
    const chip = eventElement(event).closest("[data-assignment]");
    if (!chip || !app.assignments[chip.dataset.assignment] || app.locks[chip.dataset.assignment]) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.setData("text/shiftwise-assignment", chip.dataset.assignment);
  });
  document.getElementById("calendar").addEventListener("dragover", (event) => {
    if (eventElement(event).closest("[data-assignment]")) event.preventDefault();
  });
  document.getElementById("calendar").addEventListener("drop", (event) => {
    const target = eventElement(event).closest("[data-assignment]"), sourceKey = event.dataTransfer.getData("text/shiftwise-assignment");
    if (!target || !sourceKey) return;
    event.preventDefault();
    const targetKey = target.dataset.assignment;
    if (sourceKey === targetKey || app.locks[targetKey]) return;
    const sourceWorker = app.assignments[sourceKey], targetWorker = app.assignments[targetKey];
    delete app.assignments[sourceKey];
    delete app.assignments[targetKey];
    const sourceIssues = assignmentConflicts(sourceWorker, targetKey), targetIssues = targetWorker ? assignmentConflicts(targetWorker, sourceKey) : [];
    app.assignments[sourceKey] = sourceWorker;
    if (targetWorker) app.assignments[targetKey] = targetWorker;
    if (sourceIssues.length || targetIssues.length) {
      alert([...sourceIssues, ...targetIssues].join(" "));
      return;
    }
    checkpoint("Before drag-and-drop assignment");
    app.assignments[targetKey] = sourceWorker;
    app.assignmentReasons[targetKey] = "Moved by drag-and-drop after exact conflict validation.";
    if (targetWorker) {
      app.assignments[sourceKey] = targetWorker;
      app.assignmentReasons[sourceKey] = "Swapped by drag-and-drop after exact conflict validation.";
    } else {
      delete app.assignments[sourceKey];
      app.unfilledReasons[sourceKey] = "Opened by drag-and-drop move.";
    }
    save();
    renderAll();
  });
  function updateShiftDuration() {
    const start = document.getElementById("shiftStart").value, end = document.getElementById("shiftEnd").value;
    if (start && end) document.getElementById("shiftDuration").textContent = "Duration: " + shiftHours(start, end) + " hour" + (shiftHours(start, end) === 1 ? "" : "s");
  }
  function syncDefaultManagerControl() {
    const qualified = document.getElementById("workerManagerQualified").checked, defaultManager = document.getElementById("workerDefaultManager");
    defaultManager.disabled = !qualified;
    if (!qualified) defaultManager.checked = false;
  }
  document.getElementById("workerManagerQualified").addEventListener("change", syncDefaultManagerControl);
  document.getElementById("shiftStart").addEventListener("input", updateShiftDuration);
  document.getElementById("shiftEnd").addEventListener("input", updateShiftDuration);
  document.getElementById("pairingFirst").addEventListener("change", updatePairingPreview);
  document.getElementById("pairingSecond").addEventListener("change", updatePairingPreview);
  document.getElementById("pairingOffset").addEventListener("change", updatePairingPreview);
  document.getElementById("assignmentWorker").addEventListener("change", updateAssignmentValidation);
  ["scheduleViewMode", "scheduleWorkerFilter", "scheduleCategoryFilter", "scheduleShiftFilter", "scheduleAvailabilityFilter", "scheduleUnfilledOnly", "scheduleWeekDate"].forEach((id) => document.getElementById(id).addEventListener("change", (event) => {
    scheduleFilters.mode = document.getElementById("scheduleViewMode").value;
    scheduleFilters.worker = document.getElementById("scheduleWorkerFilter").value;
    scheduleFilters.category = document.getElementById("scheduleCategoryFilter").value;
    scheduleFilters.shift = document.getElementById("scheduleShiftFilter").value;
    scheduleFilters.availability = document.getElementById("scheduleAvailabilityFilter").value;
    scheduleFilters.unfilledOnly = document.getElementById("scheduleUnfilledOnly").checked;
    scheduleFilters.weekDate = document.getElementById("scheduleWeekDate").value;
    renderAll();
  }));
  document.getElementById("reportWorker").addEventListener("change", (event) => renderWorkerReport(eventElement(event).value));
  document.getElementById("sheetFile").addEventListener("change", (event) => {
    const file = eventElement(event).files?.[0];
    if (file) readSheetFile(file);
  });
  ["sheetOptionUpdate", "sheetOptionAdd", "sheetOptionAvailability"].forEach((id) => document.getElementById(id).addEventListener("change", renderSheetImport));
  document.getElementById("sheetDropZone").addEventListener("dragover", (event) => {
    event.preventDefault();
    document.getElementById("sheetDropZone").classList.add("drag");
  });
  document.getElementById("sheetDropZone").addEventListener("dragleave", () => document.getElementById("sheetDropZone").classList.remove("drag"));
  document.getElementById("sheetDropZone").addEventListener("drop", (event) => {
    event.preventDefault();
    document.getElementById("sheetDropZone").classList.remove("drag");
    const file = event.dataTransfer?.files?.[0];
    if (file) readSheetFile(file);
  });
  document.getElementById("workerForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const id = document.getElementById("workerId").value, defaultManager = document.getElementById("workerDefaultManager").checked;
    const data = { id: id || uid(), name: document.getElementById("workerName").value.trim(), target: Number(document.getElementById("workerTarget").value), preference: document.getElementById("workerPreference").value, pair24: document.getElementById("worker24").value, categories: [...document.querySelectorAll("#workerCategories input:checked")].map((input) => input.value), managerQualified: document.getElementById("workerManagerQualified").checked || defaultManager, defaultManager };
    if (!data.name) return;
    if (defaultManager) app.workers.forEach((worker) => worker.defaultManager = false);
    const index = app.workers.findIndex((w) => w.id === id);
    if (index > -1) app.workers[index] = data;
    else app.workers.push(data);
    save();
    renderAll();
    document.getElementById("workerModal").close();
  });
  document.getElementById("shiftForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const currentId = document.getElementById("shiftId").value, id = currentId || "s" + uid(), existing = app.shifts[id], label = document.getElementById("shiftName").value.trim(), start = document.getElementById("shiftStart").value, end = document.getElementById("shiftEnd").value, activeDays = [...document.querySelectorAll("#shiftDays input:checked")].map((input) => Number(input.value));
    if (!label || !start || !end || !activeDays.length) return;
    const shift = { ...existing || {}, label, short: label.replace(/\s+/g, "").slice(0, 4).toUpperCase(), start, end, hours: shiftHours(start, end), coverage: Number(document.getElementById("shiftCoverage").value), category: document.getElementById("shiftCategory").value, period: document.getElementById("shiftPeriod").value, activeDays, cls: existing?.cls || "s-custom", manager: false, pairGroup: existing?.pairGroup || null };
    app.shifts[id] = shift;
    shiftMeta[id] = shift;
    save();
    renderAll();
    document.getElementById("shiftModal").close();
  });
  document.getElementById("pairingForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const check = updatePairingPreview();
    if (!check.valid) return;
    const currentId = document.getElementById("pairingId").value, id = currentId || "p" + uid(), pairing = { id, name: document.getElementById("pairingName").value.trim(), firstShiftId: document.getElementById("pairingFirst").value, secondShiftId: document.getElementById("pairingSecond").value, dayOffset: Number(document.getElementById("pairingOffset").value), enabled: true }, index = app.pairings.findIndex((item) => item.id === id);
    if (!pairing.name) return;
    if (index >= 0) app.pairings[index] = pairing;
    else app.pairings.push(pairing);
    save();
    renderAll();
    document.getElementById("pairingModal").close();
  });
  document.getElementById("availabilityForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const a = { id: uid(), workerId: document.getElementById("availabilityWorker").value, date: document.getElementById("availabilityDate").value, period: document.getElementById("availabilityPeriod").value };
    if (!a.workerId || !a.date) return;
    app.availability.push(a);
    save();
    renderAll();
    document.getElementById("availabilityModal").close();
  });
  document.getElementById("assignmentForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const k = document.getElementById("assignmentKey").value, v = document.getElementById("assignmentWorker").value, issues = updateAssignmentValidation(), [date, slotId] = k.split("|"), type = slotId.slice(0, slotId.lastIndexOf("-"));
    if (issues.length) return;
    checkpoint("Before manual assignment");
    if (v) {
      app.assignments[k] = v;
      app.assignmentReasons[k] = "Manual assignment passed category, availability, overlap, and rest validation.";
      delete app.unfilledReasons[k];
    } else {
      delete app.assignments[k];
      app.unfilledReasons[k] = "Manually left unfilled.";
    }
    if (document.getElementById("assignmentLocked").checked && v) app.locks[k] = true;
    else delete app.locks[k];
    if (shiftMeta[type]?.manager && app.managerFallbacks[date] !== v) delete app.managerFallbacks[date];
    save();
    renderAll();
    document.getElementById("assignmentModal").close();
  });
  function saveSettings() {
    app.settings = { ...app.settings, recoveryDays: Number(document.getElementById("recoveryDays").value) };
    app.minimumRestHours = Number(document.getElementById("minimumRestHours").value);
    const next = document.getElementById("settingsMonth").value;
    if (next) app.current = next;
    save();
    renderAll();
  }
  document.getElementById("settingsMonth").addEventListener("change", (e) => {
    if (eventElement(e).value) {
      app.current = eventElement(e).value;
      save();
      renderAll();
    }
  });
  var sheetImport = null;
  function sheetImportOptions() {
    return { updateWorkers: document.getElementById("sheetOptionUpdate").checked, addNewWorkers: document.getElementById("sheetOptionAdd").checked, replaceAvailability: document.getElementById("sheetOptionAvailability").checked, makeId: uid };
  }
  function readSheetFile(file) {
    const reader = new FileReader();
    reader.onerror = () => alert("The file could not be read from disk.");
    reader.onload = () => {
      try {
        const workbook = XLSX.read(new Uint8Array(reader.result), { type: "array", cellDates: true, raw: true });
        const tables = workbook.SheetNames.map((name) => ({ name, rows: XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, raw: true, defval: "", blankrows: true }) }));
        sheetImport = { result: ShiftwiseSheetIO.parseSheets(tables, { workers: app.workers, pairings: app.pairings, categories: app.categories, currentMonth: app.current }), fileName: file.name };
        renderSheetImport();
        document.getElementById("sheetImportModal").showModal();
      } catch (error) {
        alert("This file could not be read as a spreadsheet. Download the sheet from Google Sheets as .xlsx or .csv and try again. Technical detail: " + error.message);
      }
    };
    reader.readAsArrayBuffer(file);
  }
  function availabilityDetail(row) {
    const codes = { all: "X", day: "D", night: "N" };
    return row.entries.map((entry) => Number(entry.date.slice(-2)) + codes[entry.period]).join(", ") || "No unavailability recorded";
  }
  var importFieldLabels = { target: "Target hours", preference: "Preference", pair24: "24h duty", categories: "Categories", managerQualified: "Manager-qualified", defaultManager: "Default manager" };
  function importValueLabel(value) {
    return String(value).includes("\u2192") ? "\u201C" + value + "\u201D" : String(value);
  }
  function renderSheetImport() {
    if (!sheetImport) return;
    const { result, fileName } = sheetImport, options = sheetImportOptions(), summary = ShiftwiseSheetIO.importSummary(result, options), errors = result.issues.filter((issue) => issue.level === "error");
    document.getElementById("sheetImportSource").textContent = fileName + " \xB7 " + (result.sheetsUsed.map((sheet) => sheet.name).join(" + ") || "no recognised tab") + " \xB7 " + result.month + (result.monthFromSheet ? "" : " (assumed \u2014 the sheet did not name a month)");
    document.getElementById("sheetImportStats").innerHTML = [
      ["Updated", summary.workersUpdated, "Workers already in the app"],
      ["Added", summary.workersNew, "Only in the sheet"],
      ["Availability", summary.availabilityWorkers, "Workers with entries"],
      ["Days off", summary.availabilityDays, "Unavailable day/period entries"],
      ["Warnings", result.issues.length, errors.length ? "Includes " + errors.length + " blocking error" + (errors.length === 1 ? "" : "s") : "Rows that need a look"]
    ].map((item) => '<div class="stat"><div class="stat-label">' + item[0] + '</div><div class="stat-value">' + item[1] + '</div><div class="stat-note">' + escapeHtml(item[2]) + "</div></div>").join("");
    document.getElementById("sheetOptionAvailabilityLabel").textContent = "Replace recorded unavailability for " + result.month;
    const differentMonth = result.month !== app.current;
    document.getElementById("sheetOptionMonthRow").hidden = !differentMonth;
    document.getElementById("sheetOptionMonthLabel").textContent = "Switch the app from " + app.current + " to " + result.month + " after importing";
    document.getElementById("sheetImportWorkers").innerHTML = result.workers.map((row) => {
      const status = row.isNew ? options.addNewWorkers ? '<span class="pill dual">New</span>' : '<span class="pill">Skipped</span>' : row.changes.length ? options.updateWorkers ? '<span class="pill dual">Update</span>' : '<span class="pill">Skipped</span>' : '<span class="pill">No change</span>';
      const changes = row.changes.map((change) => escapeHtml((importFieldLabels[change.field] || change.field) + ": " + importValueLabel(change.from) + " \u2192 " + importValueLabel(change.to))).join("<br />") || '<span class="sub">Nothing to change</span>';
      return "<tr><td><b>" + escapeHtml(row.name) + "</b></td><td>" + status + "</td><td>" + changes + "</td></tr>";
    }).join("") || '<tr><td colspan="3" class="empty">No worker rows were found in this file.</td></tr>';
    document.getElementById("sheetImportAvailability").innerHTML = result.availability.map((row) => {
      const linked = Boolean(row.workerId) || options.addNewWorkers && result.workers.some((worker) => worker.isNew && worker.name === row.name);
      return "<tr><td><b>" + escapeHtml(row.name) + "</b>" + (linked ? "" : ' <span class="pill">No worker</span>') + "</td><td>" + row.entries.length + '</td><td class="sub">' + escapeHtml(availabilityDetail(row)) + "</td></tr>";
    }).join("") || '<tr><td colspan="3" class="empty">No availability grid was found in this file.</td></tr>';
    document.getElementById("sheetImportIssuesSection").hidden = !result.issues.length;
    document.getElementById("sheetImportIssues").innerHTML = result.issues.map((issue) => '<div class="issue-row ' + issue.level + '"><span>' + escapeHtml(issue.sheet + (issue.row ? " \xB7 row " + issue.row : "")) + "</span>" + escapeHtml(issue.message) + "</div>").join("");
    document.getElementById("applySheetImport").disabled = Boolean(errors.length) || !(result.workers.length || result.availability.length);
  }
  function applySheetImport() {
    if (!sheetImport) return;
    const { result } = sheetImport, options = sheetImportOptions();
    const switchMonth = !document.getElementById("sheetOptionMonthRow").hidden && document.getElementById("sheetOptionMonth").checked;
    app.lastImportBackup = ShiftwiseSheetIO.applyImport(app, result, options);
    if (switchMonth) app.current = result.month;
    sheetImport = null;
    save();
    renderAll();
    document.getElementById("sheetImportModal").close();
  }
  function undoSheetImport() {
    if (!app.lastImportBackup || !confirm("Undo the import from " + new Date(app.lastImportBackup.at).toLocaleString() + "? Workers, categories and unavailability return to how they were before it. Generated schedules are not changed.")) return;
    ShiftwiseSheetIO.restoreImportBackup(app, app.lastImportBackup);
    delete app.lastImportBackup;
    save();
    renderAll();
  }
  function renderImportState() {
    const backup = app.lastImportBackup;
    document.getElementById("sheetImportState").textContent = backup ? "Last import: " + backup.month + " \xB7 " + new Date(backup.at).toLocaleString() : "No import yet";
    document.getElementById("undoSheetImport").hidden = !backup;
  }
  function exportSheetTemplate() {
    const tables = ShiftwiseSheetIO.buildTemplateTables(app, app.current), workbook = XLSX.utils.book_new();
    tables.forEach((table) => {
      const sheet = XLSX.utils.aoa_to_sheet(table.rows);
      sheet["!cols"] = table.name === "Pracownicy" ? [{ wch: 30 }, { wch: 16 }, { wch: 18 }, { wch: 18 }, { wch: 24 }, { wch: 20 }, { wch: 18 }, { wch: 34 }] : table.name === "Dost\u0119pno\u015B\u0107" ? [{ wch: 30 }, ...Array.from({ length: 31 }, () => ({ wch: 4 }))] : [{ wch: 104 }];
      XLSX.utils.book_append_sheet(workbook, sheet, table.name);
    });
    XLSX.writeFile(workbook, "grafik-dane-" + app.current + ".xlsx");
  }
  function csvText(rows) {
    return rows.map((row) => row.map((value) => '"' + String(value ?? "").replaceAll('"', '""') + '"').join(",")).join("\n");
  }
  function downloadText(filename, text, type) {
    const blob = new Blob([text], { type }), url = URL.createObjectURL(blob), anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }
  function exportCsv() {
    const rows = [["Date", "Shift", "Start", "End", "Hours", "Category", "Worker", "Locked", "Reason"]];
    const { y, m } = ym();
    for (let day = 1; day <= daysInMonth(y, m); day++) {
      const date = iso(localDate(y, m, day));
      activeTypes(date).forEach((slot) => {
        const key2 = assignmentKey(date, slot), details = detailsForAssignment(key2), worker = getWorker(app.assignments[key2]);
        rows.push([date, details.shift.label, details.shift.start, details.shift.end, details.minutes / 60, details.shift.category, worker?.name || "Unfilled", app.locks[key2] ? "Yes" : "No", app.assignmentReasons[key2] || app.unfilledReasons[key2] || ""]);
      });
    }
    downloadText("shiftwise-schedule-" + app.current + ".csv", csvText(rows), "text/csv;charset=utf-8");
  }
  function exportWorkerReport() {
    const rows = [["Worker", "Target hours", "Scheduled hours", "Variance", "Night hours", "Weekend hours", "24h duties", "Manager replacements", "Availability violations"]];
    operationalReport().forEach((row) => rows.push([row.worker.name, row.worker.target, row.hours, row.hours - Number(row.worker.target), row.night, row.weekend, count24(row.worker.id), row.manager, row.violations]));
    downloadText("shiftwise-worker-report-" + app.current + ".csv", csvText(rows), "text/csv;charset=utf-8");
  }
  function exportPayroll() {
    const detailRows = [["Worker", "Date", "Shift", "Start", "End", "Regular hours", "Night hours", "Weekend hours", "Category", "Manager duty", "Locked"]], summaryRows = [["Worker", "Target hours", "Scheduled hours", "Variance", "Night hours", "Weekend hours", "24h duties", "Manager replacements"]];
    assignmentsInMonth().forEach(([key2, workerId]) => {
      const details = detailsForAssignment(key2), worker = getWorker(workerId);
      if (!details || !worker || details.shift.manager && app.managerFallbacks[details.date] === workerId) return;
      const hours = details.minutes / 60, night = details.shift.period === "night" ? hours : 0, weekend = [0, 6].includes((/* @__PURE__ */ new Date(details.date + "T12:00:00")).getDay()) ? hours : 0;
      detailRows.push([worker.name, details.date, details.shift.label, details.shift.start, details.shift.end, hours - night, night, weekend, details.shift.category, details.shift.manager ? "Yes" : "No", app.locks[key2] ? "Yes" : "No"]);
    });
    operationalReport().forEach((row) => summaryRows.push([row.worker.name, row.worker.target, row.hours, row.hours - Number(row.worker.target), row.night, row.weekend, count24(row.worker.id), row.manager]));
    const workbook = XLSX.utils.book_new(), detailsSheet = XLSX.utils.aoa_to_sheet(detailRows), summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
    detailsSheet["!cols"] = [{ wch: 24 }, { wch: 12 }, { wch: 18 }, { wch: 9 }, { wch: 9 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 13 }, { wch: 8 }];
    summarySheet["!cols"] = [{ wch: 24 }, { wch: 14 }, { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 22 }];
    XLSX.utils.book_append_sheet(workbook, summarySheet, "Worker totals");
    XLSX.utils.book_append_sheet(workbook, detailsSheet, "Payroll detail");
    XLSX.writeFile(workbook, "shiftwise-payroll-" + app.current + ".xlsx");
  }
  function icsDate(timestamp) {
    const date = new Date(timestamp);
    return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  }
  function exportIcs() {
    const selected = document.getElementById("reportWorker").value, rows = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Shiftwise//Schedule//EN", "CALSCALE:GREGORIAN"];
    assignmentsInMonth().filter(([, workerId]) => !selected || workerId === selected).forEach(([key2, workerId]) => {
      const details = detailsForAssignment(key2), worker = getWorker(workerId);
      if (!details || !worker) return;
      rows.push("BEGIN:VEVENT", "UID:" + safeIcs(key2 + "-" + workerId) + "@shiftwise", "DTSTAMP:" + icsDate(Date.now()), "DTSTART:" + icsDate(details.start), "DTEND:" + icsDate(details.end), "SUMMARY:" + safeIcs(details.shift.label + " \u2014 " + worker.name), "DESCRIPTION:" + safeIcs(app.assignmentReasons[key2] || ""), "END:VEVENT");
    });
    rows.push("END:VCALENDAR");
    downloadText("shiftwise-" + (selected ? getWorker(selected)?.name.replace(/\s+/g, "-").toLowerCase() + "-" : "") + app.current + ".ics", rows.join("\r\n"), "text/calendar;charset=utf-8");
  }
  function safeIcs(value) {
    return String(value).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
  }
  renderAll();
})();
