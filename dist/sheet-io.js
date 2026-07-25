var ShiftwiseSheetIO = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/sheet-io.ts
  var sheet_io_exports = {};
  __export(sheet_io_exports, {
    applyImport: () => applyImport,
    buildTemplateTables: () => buildTemplateTables,
    classifySheet: () => classifySheet,
    daysInMonth: () => daysInMonth,
    headerField: () => headerField,
    importSummary: () => importSummary,
    nameKey: () => nameKey,
    normalise: () => normalise,
    normaliseMonth: () => normaliseMonth,
    parseAvailabilityCode: () => parseAvailabilityCode,
    parseBoolean: () => parseBoolean,
    parsePair24: () => parsePair24,
    parsePreference: () => parsePreference,
    parseSheets: () => parseSheets,
    restoreImportBackup: () => restoreImportBackup
  });
  var WORKER_SHEET_NAMES = ["pracownicy", "pracownik", "zespol", "obsada", "workers", "employees", "staff", "team"];
  var ADMIN_SHEET_NAMES = ["administrator", "administracja", "admin", "kierownictwo", "ustawienia", "kwalifikacje"];
  var AVAILABILITY_SHEET_NAMES = ["dostepnosc", "dyspozycyjnosc", "availability", "absencje", "urlopy", "grafik"];
  var IGNORED_SHEET_NAMES = ["instrukcja", "instrukcje", "instructions", "legenda", "legend", "readme", "pomoc"];
  var HEADER_SYNONYMS = {
    name: ["imie i nazwisko", "imie nazwisko", "imie", "nazwisko", "pracownik", "osoba", "name", "full name", "worker", "employee"],
    target: ["godziny docelowe", "godziny docelowe w miesiacu", "godziny", "liczba godzin", "wymiar godzin", "etat", "target", "target hours", "hours", "monthly hours"],
    preference: ["preferowana pora", "preferencja", "preferencje", "pora dnia", "preferred period", "preference", "shift preference"],
    pair24: ["dyzur 24h", "dyzury 24h", "uklad 24h", "24h", "pair24", "24h duty", "24h pattern", "24h arrangement"],
    categories: ["kategorie", "kategoria", "kwalifikacje", "categories", "category", "skills", "qualifications"],
    managerQualified: ["uprawnienia kierownika", "kierownik uprawnienia", "moze byc kierownikiem", "manager qualified", "can manage", "kierownik"],
    defaultManager: ["kierownik domyslny", "domyslny kierownik", "default manager", "primary manager"]
  };
  var HEADER_FALLBACK_ORDER = ["defaultManager", "managerQualified", "name", "target", "preference", "pair24", "categories"];
  var PERIOD_VALUES = {
    day: ["dzien", "d", "dzienna", "dzienne", "dniowka", "rano", "ranek", "day", "days", "morning", "am"],
    night: ["noc", "n", "nocna", "nocne", "nocka", "night", "nights", "pm"],
    either: ["bez preferencji", "brak preferencji", "obojetnie", "wszystko jedno", "dowolna", "dowolnie", "either", "any", "both", "no preference"]
  };
  var AVAILABILITY_CODES = {
    all: ["x", "c", "cd", "caly dzien", "caly", "calodobowo", "urlop", "wolne", "wolny", "l4", "nieobecny", "nieobecna", "niedostepny", "niedostepna", "u", "w", "all", "off", "day off", "unavailable"],
    day: ["d", "dz", "dzien", "rano", "ranek", "przedpoludnie", "day", "morning", "am"],
    night: ["n", "noc", "nocka", "nocne", "night", "pm"]
  };
  var TRUE_VALUES = ["tak", "t", "yes", "y", "true", "prawda", "x", "1"];
  var FALSE_VALUES = ["nie", "n", "no", "false", "falsz", "brak", "0"];
  var NO_PAIR_VALUES = ["nie", "brak", "zadne", "none", "no", "false"];
  var ANY_PAIR_VALUES = ["dowolny", "dowolne", "dowolna", "kazdy", "obojetnie", "any", "either", "all"];
  var POLISH_MONTHS = ["stycz", "luty|lut", "marz|marc", "kwiec", "maj", "czerw", "lip", "sierp", "wrzes|wrze\u015B", "pazdzier", "listopad", "grudz"];
  var DEFAULT_TARGET_HOURS = 160;
  function stripDiacritics(value) {
    return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\u0142/g, "l").replace(/\u0141/g, "L");
  }
  function normalise(value) {
    return stripDiacritics(String(value ?? "")).toLowerCase().replace(/[^a-z0-9:→>-]+/g, " ").replace(/\s+/g, " ").trim();
  }
  function nameKey(value) {
    return normalise(value).replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  }
  function looksLikeNote(value) {
    return value.length > 60 || nameKey(value).split(" ").filter(Boolean).length > 5;
  }
  function tokenKey(value) {
    return nameKey(value).split(" ").filter(Boolean).sort().join(" ");
  }
  function cellText(value) {
    if (value === null || value === void 0) return "";
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    const text = String(value).trim();
    return text.startsWith("=") ? "" : text;
  }
  function cellRows(table) {
    return (table.rows || []).map((row) => Array.isArray(row) ? row : []);
  }
  function rowIsEmpty(row) {
    return !row.some((cell) => cellText(cell) !== "");
  }
  function matchesSynonym(header, field) {
    const value = normalise(header);
    if (!value) return false;
    return HEADER_SYNONYMS[field].includes(value);
  }
  function isHeaderLabel(value) {
    return HEADER_FALLBACK_ORDER.find((field) => matchesSynonym(value, field)) || null;
  }
  function headerField(header) {
    const value = normalise(header);
    if (!value) return null;
    const exact = isHeaderLabel(value);
    if (exact) return exact;
    return HEADER_FALLBACK_ORDER.find((field) => HEADER_SYNONYMS[field].some((synonym) => synonym.length > 3 && value.includes(synonym))) || null;
  }
  function dayNumber(value) {
    const text = cellText(value).replace(/[.\s]/g, "");
    if (!/^\d{1,2}$/.test(text)) return null;
    const day = Number(text);
    return day >= 1 && day <= 31 ? day : null;
  }
  function daysInMonth(month) {
    const [year, index] = month.split("-").map(Number);
    return new Date(year, index, 0).getDate();
  }
  function isMonth(value) {
    return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
  }
  function normaliseMonth(value) {
    const text = cellText(value);
    const compact = text.replace(/[/.]/g, "-");
    const iso = compact.match(/^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/);
    if (iso) {
      const month = String(Number(iso[2])).padStart(2, "0");
      return isMonth(iso[1] + "-" + month) ? iso[1] + "-" + month : null;
    }
    const words = normalise(text).match(/^([a-z]+)\s*(\d{4})$/) || normalise(text).match(/^(\d{4})\s*([a-z]+)$/);
    if (!words) return null;
    const word = /^\d/.test(words[1]) ? words[2] : words[1], year = /^\d/.test(words[1]) ? words[1] : words[2];
    const index = POLISH_MONTHS.findIndex((entry) => entry.split("|").some((stem) => word.startsWith(stem)));
    return index < 0 ? null : year + "-" + String(index + 1).padStart(2, "0");
  }
  function findMonth(rows) {
    for (const row of rows.slice(0, 8)) for (const cell of row) {
      const month = normaliseMonth(cell);
      if (month) return month;
    }
    return null;
  }
  function classifySheet(table) {
    const name = normalise(table.name);
    if (IGNORED_SHEET_NAMES.some((entry) => name.startsWith(entry))) return "ignored";
    if (AVAILABILITY_SHEET_NAMES.some((entry) => name.startsWith(entry))) return "availability";
    if (WORKER_SHEET_NAMES.some((entry) => name.startsWith(entry))) return "workers";
    if (ADMIN_SHEET_NAMES.some((entry) => name.startsWith(entry))) return "workers";
    const rows = cellRows(table);
    for (const row of rows.slice(0, 10)) {
      if (!row.some((cell) => matchesSynonym(cellText(cell), "name"))) continue;
      if (row.filter((cell) => dayNumber(cell) !== null).length >= 5) return "availability";
      if (row.some((cell) => ["target", "preference", "pair24", "categories"].includes(headerField(cellText(cell))))) return "workers";
    }
    return null;
  }
  function findHeaderRow(rows, predicate) {
    for (let index = 0; index < Math.min(rows.length, 12); index++) if (predicate(rows[index])) return index;
    return -1;
  }
  function matchWorker(name, context) {
    const key = nameKey(name);
    if (!key) return { worker: null, matchedBy: null };
    const exact = context.workers.find((worker) => nameKey(worker.name) === key);
    if (exact) return { worker: exact, matchedBy: "exact" };
    const tokens = tokenKey(name);
    const reordered = context.workers.find((worker) => tokenKey(worker.name) === tokens);
    return reordered ? { worker: reordered, matchedBy: "reordered" } : { worker: null, matchedBy: null };
  }
  function parseBoolean(value) {
    const text = normalise(value);
    if (!text) return null;
    if (TRUE_VALUES.includes(text)) return true;
    if (FALSE_VALUES.includes(text)) return false;
    return null;
  }
  function parsePreference(value) {
    const text = normalise(value);
    if (!text) return null;
    return Object.keys(PERIOD_VALUES).find((period) => PERIOD_VALUES[period].includes(text)) || null;
  }
  function parsePair24(value, pairings) {
    const text = normalise(value);
    if (!text) return null;
    if (NO_PAIR_VALUES.includes(text)) return "none";
    if (ANY_PAIR_VALUES.includes(text)) return "any";
    const byId = pairings.find((pairing) => normalise(pairing.id) === text);
    if (byId) return byId.id;
    const byName = pairings.find((pairing) => normalise(pairing.name) === text);
    if (byName) return byName.id;
    const signature = hourSignature(value);
    const byHours = signature.split("-").length >= 2 && pairings.find((pairing) => hourSignature(pairing.name) === signature);
    return byHours ? byHours.id : null;
  }
  function hourSignature(value) {
    const numbers = String(value ?? "").match(/\d{1,2}/g) || [];
    const hours = value.includes(":") ? numbers.filter((_, index) => index % 2 === 0) : numbers;
    return hours.map((number) => String(Number(number))).join("-");
  }
  function parseCategories(value, known) {
    const parts = value.split(/[,;/|]+/).map((part) => part.trim()).filter(Boolean);
    return parts.map((part) => known.find((category) => normalise(category) === normalise(part)) || part);
  }
  function parseAvailabilityCode(value) {
    const text = normalise(value);
    if (!text) return null;
    return Object.keys(AVAILABILITY_CODES).find((period) => AVAILABILITY_CODES[period].includes(text)) || null;
  }
  function describeValue(field, value, context) {
    if (field === "preference") return { day: "Day", night: "Night", either: "Either" }[String(value)] || String(value);
    if (field === "pair24") return value === "none" ? "No 24h" : value === "any" ? "Any 24h pattern" : context.pairings.find((pairing) => pairing.id === value)?.name || String(value);
    if (field === "categories") return value.join(", ");
    if (typeof value === "boolean") return value ? "Yes" : "No";
    return String(value ?? "");
  }
  function parseWorkersTable(table, context, result, byName) {
    const rows = cellRows(table);
    const headerIndex = findHeaderRow(rows, (row) => row.some((cell) => matchesSynonym(cellText(cell), "name")));
    if (headerIndex < 0) {
      result.issues.push({ level: "error", sheet: table.name, message: "No header row with a name column was found, so this tab was skipped." });
      return;
    }
    const columns = {};
    rows[headerIndex].forEach((cell, index) => {
      const field = headerField(cellText(cell));
      if (field && columns[field] === void 0) columns[field] = index;
    });
    const seen = /* @__PURE__ */ new Map();
    let defaultManagerRow = 0;
    for (let index = headerIndex + 1; index < rows.length; index++) {
      const row = rows[index], rowNumber = index + 1;
      if (rowIsEmpty(row)) continue;
      const name = cellText(row[columns.name]);
      if (!name) {
        result.issues.push({ level: "warning", sheet: table.name, row: rowNumber, message: "Row has data but no name, so it was skipped." });
        continue;
      }
      if (isHeaderLabel(name)) continue;
      if (looksLikeNote(name)) {
        result.issues.push({ level: "warning", sheet: table.name, row: rowNumber, message: 'The name column reads like a note ("' + name.slice(0, 40) + '\u2026"), so the row was skipped.' });
        continue;
      }
      const key = nameKey(name);
      if (seen.has(key)) {
        result.issues.push({ level: "warning", sheet: table.name, row: rowNumber, message: '"' + name + '" also appears in row ' + seen.get(key) + ". Only the first row was used." });
        continue;
      }
      seen.set(key, rowNumber);
      const values = {};
      if (columns.target !== void 0) {
        const raw = cellText(row[columns.target]);
        if (raw) {
          const digits = raw.replace(",", ".").replace(/[^0-9.]/g, ""), hours = Number(digits);
          if (/\d/.test(digits) && Number.isFinite(hours) && hours >= 0 && hours <= 744) values.target = Math.round(hours);
          else result.issues.push({ level: "warning", sheet: table.name, row: rowNumber, message: '"' + raw + '" is not a usable number of hours for ' + name + ". The existing target was kept." });
        }
      }
      if (columns.preference !== void 0) {
        const raw = cellText(row[columns.preference]);
        const preference = parsePreference(raw);
        if (preference) values.preference = preference;
        else if (raw) result.issues.push({ level: "warning", sheet: table.name, row: rowNumber, message: 'Unknown preferred period "' + raw + '" for ' + name + ". Use Dzie\u0144, Noc or Bez preferencji." });
      }
      if (columns.pair24 !== void 0) {
        const raw = cellText(row[columns.pair24]);
        const pair = parsePair24(raw, context.pairings);
        if (pair) values.pair24 = pair;
        else if (raw) result.issues.push({ level: "warning", sheet: table.name, row: rowNumber, message: 'Unknown 24h duty "' + raw + '" for ' + name + ". Use Nie, Dowolny or a configured pairing name." });
      }
      if (columns.categories !== void 0) {
        const raw = cellText(row[columns.categories]);
        if (raw) {
          const categories = parseCategories(raw, context.categories);
          values.categories = categories;
          categories.filter((category) => !context.categories.some((known) => normalise(known) === normalise(category)) && !result.newCategories.includes(category)).forEach((category) => result.newCategories.push(category));
        }
      }
      if (columns.managerQualified !== void 0) {
        const value = parseBoolean(cellText(row[columns.managerQualified]));
        if (value !== null) values.managerQualified = value;
      }
      if (columns.defaultManager !== void 0) {
        const value = parseBoolean(cellText(row[columns.defaultManager]));
        if (value === true && defaultManagerRow) result.issues.push({ level: "warning", sheet: table.name, row: rowNumber, message: "Row " + defaultManagerRow + " is already the default manager, so " + name + " was imported as manager-qualified only." });
        else if (value !== null) {
          values.defaultManager = value;
          if (value) {
            defaultManagerRow = rowNumber;
            values.managerQualified = true;
          }
        }
      }
      const merged = byName.get(key);
      if (merged) {
        Object.assign(merged.values, values);
        merged.changes = computeChanges(merged.values, context.workers.find((worker) => worker.id === merged.workerId), context);
        if (!merged.sheets.includes(table.name)) merged.sheets.push(table.name);
        continue;
      }
      const match = matchWorker(name, context);
      if (match.matchedBy === "reordered") result.issues.push({ level: "warning", sheet: table.name, row: rowNumber, message: '"' + name + '" was matched to the existing worker "' + match.worker.name + '".' });
      const parsed = {
        sheet: table.name,
        sheets: [table.name],
        row: rowNumber,
        name,
        workerId: match.worker?.id || null,
        isNew: !match.worker,
        matchedBy: match.matchedBy,
        values,
        changes: computeChanges(values, match.worker, context)
      };
      byName.set(key, parsed);
      result.workers.push(parsed);
    }
  }
  function computeChanges(values, worker, context) {
    return Object.entries(values).filter(([field, value]) => !worker || describeValue(field, value, context) !== describeValue(field, worker[field], context)).map(([field, value]) => ({ field, from: worker ? describeValue(field, worker[field], context) : "\u2014", to: describeValue(field, value, context) }));
  }
  function parseAvailabilityTable(table, context, result) {
    const rows = cellRows(table);
    const month = findMonth(rows);
    if (month) {
      result.month = month;
      result.monthFromSheet = true;
    } else result.issues.push({ level: "warning", sheet: table.name, message: "No month was found in the sheet, so " + result.month + " was assumed. Put it in cell B1 as YYYY-MM." });
    const headerIndex = findHeaderRow(rows, (row) => row.some((cell) => matchesSynonym(cellText(cell), "name")) && row.filter((cell) => dayNumber(cell) !== null).length >= 5);
    if (headerIndex < 0) {
      result.issues.push({ level: "error", sheet: table.name, message: "No header row with a name column and day numbers was found, so this tab was skipped." });
      return;
    }
    const nameColumn = rows[headerIndex].findIndex((cell) => matchesSynonym(cellText(cell), "name"));
    const dayColumns = [];
    rows[headerIndex].forEach((cell, index) => {
      const day = dayNumber(cell);
      if (day !== null && index !== nameColumn) dayColumns.push({ column: index, day });
    });
    const total = daysInMonth(result.month);
    const beyond = dayColumns.filter((entry) => entry.day > total);
    if (beyond.length) result.issues.push({ level: "warning", sheet: table.name, message: result.month + " has only " + total + " days, so column" + (beyond.length === 1 ? "" : "s") + " " + beyond.map((entry) => entry.day).join(", ") + " were ignored." });
    const seen = /* @__PURE__ */ new Map();
    for (let index = headerIndex + 1; index < rows.length; index++) {
      const row = rows[index], rowNumber = index + 1;
      if (rowIsEmpty(row)) continue;
      const name = cellText(row[nameColumn]);
      if (!name) {
        result.issues.push({ level: "warning", sheet: table.name, row: rowNumber, message: "Availability was filled in without a name, so the row was skipped." });
        continue;
      }
      if (isHeaderLabel(name) || looksLikeNote(name)) continue;
      const match = matchWorker(name, context);
      const existing = seen.get(nameKey(name));
      const parsed = existing || { sheet: table.name, row: rowNumber, name, workerId: match.worker?.id || null, isNew: !match.worker, entries: [] };
      if (existing) result.issues.push({ level: "warning", sheet: table.name, row: rowNumber, message: '"' + name + '" also appears in row ' + existing.row + ". Both rows were merged." });
      for (const entry of dayColumns) {
        if (entry.day > total) continue;
        const raw = cellText(row[entry.column]);
        if (!raw) continue;
        const period = parseAvailabilityCode(raw);
        if (!period) {
          result.issues.push({ level: "warning", sheet: table.name, row: rowNumber, message: 'Unknown code "' + raw + '" on day ' + entry.day + " for " + name + ". Use X, D or N." });
          continue;
        }
        const date = result.month + "-" + String(entry.day).padStart(2, "0");
        const known = parsed.entries.find((item) => item.date === date);
        if (known) known.period = known.period === period ? period : "all";
        else parsed.entries.push({ date, period });
      }
      if (!existing) {
        seen.set(nameKey(name), parsed);
        result.availability.push(parsed);
      }
    }
  }
  function parseSheets(tables, context) {
    const result = { month: context.currentMonth, monthFromSheet: false, workers: [], availability: [], issues: [], newCategories: [], sheetsUsed: [] };
    const classified = tables.map((table) => ({ table, kind: classifySheet(table) }));
    const workerTables = classified.filter((entry) => entry.kind === "workers");
    const availabilityTables = classified.filter((entry) => entry.kind === "availability");
    if (!workerTables.length && !availabilityTables.length) {
      result.issues.push({ level: "error", sheet: tables.map((table) => table.name).join(", ") || "file", message: 'No "Pracownicy" or "Dost\u0119pno\u015B\u0107" tab was recognised in this file.' });
      return result;
    }
    const workerIndex = /* @__PURE__ */ new Map();
    workerTables.forEach((entry) => {
      result.sheetsUsed.push({ name: entry.table.name, kind: "workers" });
      parseWorkersTable(entry.table, context, result, workerIndex);
    });
    const withImported = { ...context, workers: context.workers.concat(result.workers.filter((row) => row.isNew).map((row) => ({ id: "new:" + row.row, name: row.name }))) };
    availabilityTables.forEach((entry) => {
      result.sheetsUsed.push({ name: entry.table.name, kind: "availability" });
      parseAvailabilityTable(entry.table, withImported, result);
    });
    result.availability.forEach((row) => {
      if (row.workerId?.startsWith("new:")) {
        row.workerId = null;
        row.isNew = true;
      }
    });
    result.availability.filter((row) => row.isNew && !result.workers.some((worker) => nameKey(worker.name) === nameKey(row.name))).forEach((row) => result.issues.push({ level: "warning", sheet: row.sheet, row: row.row, message: '"' + row.name + '" is not on the Pracownicy tab and does not match anyone in the app, so their availability needs a worker first.' }));
    return result;
  }
  function importSummary(result, options = {}) {
    const addNew = options.addNewWorkers !== false;
    const known = (row) => Boolean(row.workerId) || addNew && result.workers.some((worker) => worker.isNew && nameKey(worker.name) === nameKey(row.name));
    const usable = result.availability.filter(known);
    return {
      workersUpdated: result.workers.filter((row) => !row.isNew && row.changes.length).length,
      workersNew: result.workers.filter((row) => row.isNew).length,
      availabilityWorkers: usable.length,
      availabilityDays: usable.reduce((total, row) => total + row.entries.length, 0),
      blocked: result.availability.length - usable.length
    };
  }
  function applyImport(app, result, options = {}) {
    const addNewWorkers = options.addNewWorkers !== false, updateWorkers = options.updateWorkers !== false, replaceAvailability = options.replaceAvailability !== false;
    const makeId = options.makeId || (() => Math.random().toString(36).slice(2, 10));
    const backup = { workers: JSON.parse(JSON.stringify(app.workers)), availability: JSON.parse(JSON.stringify(app.availability)), categories: [...app.categories], month: result.month, at: (/* @__PURE__ */ new Date()).toISOString() };
    result.newCategories.forEach((category) => {
      if (!app.categories.some((known) => normalise(known) === normalise(category))) app.categories.push(category);
    });
    const idByName = /* @__PURE__ */ new Map();
    app.workers.forEach((worker) => idByName.set(nameKey(worker.name), worker.id));
    result.workers.forEach((row) => {
      if (row.isNew) {
        if (!addNewWorkers) return;
        const worker2 = { id: makeId(), name: row.name, target: DEFAULT_TARGET_HOURS, preference: "either", pair24: "none", categories: ["General"], managerQualified: false, defaultManager: false, ...row.values };
        app.workers.push(worker2);
        idByName.set(nameKey(worker2.name), worker2.id);
        return;
      }
      if (!updateWorkers) return;
      const worker = app.workers.find((item) => item.id === row.workerId);
      if (worker) Object.assign(worker, row.values);
    });
    const promoted = result.workers.find((row) => row.values.defaultManager);
    if (promoted) {
      const id = idByName.get(nameKey(promoted.name));
      app.workers.forEach((worker) => {
        if (worker.defaultManager && worker.id !== id) worker.defaultManager = false;
      });
    }
    if (replaceAvailability) {
      result.availability.forEach((row) => {
        const workerId = row.workerId || idByName.get(nameKey(row.name));
        if (!workerId) return;
        app.availability = app.availability.filter((entry) => !(entry.workerId === workerId && entry.date.startsWith(result.month)));
        row.entries.forEach((entry) => app.availability.push({ id: makeId(), workerId, date: entry.date, period: entry.period }));
      });
    }
    return backup;
  }
  function restoreImportBackup(app, backup) {
    app.workers = JSON.parse(JSON.stringify(backup.workers));
    app.availability = JSON.parse(JSON.stringify(backup.availability));
    app.categories = [...backup.categories];
  }
  function buildTemplateTables(app, month) {
    const total = daysInMonth(month), [year, index] = month.split("-").map(Number);
    const weekdays = ["Pn", "Wt", "\u015Ar", "Cz", "Pt", "So", "Nd"];
    const pairName = (worker) => worker.pair24 === "any" ? "Dowolny" : app.pairings.find((pairing) => pairing.id === worker.pair24)?.name || "Nie";
    const instructions = [
      ["Grafik \u2014 dane od pracownik\xF3w"],
      ["Miesi\u0105c: " + month],
      [],
      ["Krok 1 \u2014 zak\u0142adka \u201EPracownicy\u201D: uzupe\u0142nij sw\xF3j wiersz (godziny docelowe, preferowana pora, dy\u017Cury 24h)."],
      ["Krok 2 \u2014 zak\u0142adka \u201EDost\u0119pno\u015B\u0107\u201D: zaznacz dni, w kt\xF3rych NIE mo\u017Cesz pracowa\u0107. Puste pole = jestem dost\u0119pny."],
      ["Zak\u0142adka \u201EAdministrator\u201D nale\u017Cy do osoby uk\u0142adaj\u0105cej grafik \u2014 pracownicy jej nie zmieniaj\u0105."],
      [],
      ["Legenda kod\xF3w dost\u0119pno\u015Bci"],
      ["X", "niedost\u0119pny przez ca\u0142y dzie\u0144 (np. urlop, L4)"],
      ["D", "niedost\u0119pny rano i w dzie\u0144 \u2014 zmiany nocne s\u0105 w porz\u0105dku"],
      ["N", "niedost\u0119pny w nocy \u2014 zmiany dzienne s\u0105 w porz\u0105dku"],
      ["", "puste pole \u2014 jestem dost\u0119pny"],
      [],
      ["Nie zmieniaj nazw zak\u0142adek ani nag\u0142\xF3wk\xF3w kolumn. Mo\u017Cesz dopisywa\u0107 wiersze na dole."],
      ["Gdy zesp\xF3\u0142 sko\u0144czy: Plik \u2192 Pobierz \u2192 Microsoft Excel (.xlsx), a potem w Shiftwise: Workers \u2192 Import from sheet."]
    ];
    const workers = [["Imi\u0119 i nazwisko", "Godziny docelowe", "Preferowana pora", "Dy\u017Cur 24h"]];
    app.workers.forEach((worker) => workers.push([
      worker.name,
      worker.target,
      { day: "Dzie\u0144", night: "Noc", either: "Bez preferencji" }[worker.preference] || "Bez preferencji",
      pairName(worker)
    ]));
    const administrator = [["Imi\u0119 i nazwisko", "Kategorie", "Uprawnienia kierownika", "Kierownik domy\u015Blny", "Uwagi"]];
    app.workers.forEach((worker) => administrator.push([
      worker.name,
      worker.categories.join(", "),
      worker.managerQualified ? "Tak" : "Nie",
      worker.defaultManager ? "Tak" : "Nie",
      ""
    ]));
    const days = Array.from({ length: total }, (_, offset) => offset + 1);
    const availability = [
      ["Miesi\u0105c", month, "Format RRRR-MM."],
      ["", "", "X = ca\u0142y dzie\u0144 \xB7 D = rano / dzie\u0144 \xB7 N = noc \xB7 puste = dost\u0119pny"],
      ["Dzie\u0144 tygodnia", ...days.map((day) => weekdays[(new Date(year, index - 1, day).getDay() + 6) % 7])],
      ["Imi\u0119 i nazwisko", ...days]
    ];
    app.workers.forEach((worker) => {
      const row = [worker.name];
      days.forEach((day) => {
        const date = month + "-" + String(day).padStart(2, "0");
        const entry = app.availability.find((item) => item.workerId === worker.id && item.date === date);
        row.push(entry ? { all: "X", day: "D", night: "N" }[entry.period] : "");
      });
      availability.push(row);
    });
    return [
      { name: "Instrukcja", rows: instructions },
      { name: "Pracownicy", rows: workers },
      { name: "Dost\u0119pno\u015B\u0107", rows: availability },
      { name: "Administrator", rows: administrator }
    ];
  }
  return __toCommonJS(sheet_io_exports);
})();
