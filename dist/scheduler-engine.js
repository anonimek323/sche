var ShiftwiseEngine = (() => {
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

  // src/scheduler-engine.ts
  var scheduler_engine_exports = {};
  __export(scheduler_engine_exports, {
    addDays: () => addDays,
    buildInstances: () => buildInstances,
    gapMinutes: () => gapMinutes,
    highsAdapter: () => highsAdapter,
    intervalFor: () => intervalFor,
    jsonModelToLp: () => jsonModelToLp,
    pairingContinuity: () => pairingContinuity,
    solve: () => solve
  });
  var DAY_MS = 864e5;
  function parseMonth(value) {
    const [year, month] = value.split("-").map(Number);
    return { year, month: month - 1 };
  }
  function dateAtNoon(year, month, day) {
    return new Date(year, month, day, 12);
  }
  function iso(date) {
    return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())).toISOString().slice(0, 10);
  }
  function addDays(value, amount) {
    const date = /* @__PURE__ */ new Date(value + "T12:00:00");
    date.setDate(date.getDate() + amount);
    return iso(date);
  }
  function daysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
  }
  function startTimestamp(date, time) {
    return (/* @__PURE__ */ new Date(date + "T" + time + ":00")).getTime();
  }
  function intervalFor(date, shift) {
    const start = startTimestamp(date, shift.start);
    let end = startTimestamp(date, shift.end);
    if (end <= start) end = (/* @__PURE__ */ new Date(addDays(date, 1) + "T" + shift.end + ":00")).getTime();
    return { start, end, minutes: Math.round((end - start) / 6e4) };
  }
  function gapMinutes(a, b) {
    if (a.end <= b.start) return (b.start - a.end) / 6e4;
    if (b.end <= a.start) return (a.start - b.end) / 6e4;
    return -1;
  }
  function overlapsOrTooClose(a, b, minimumRestMinutes) {
    const gap = gapMinutes(a, b);
    return gap < minimumRestMinutes;
  }
  function availabilityBlocked(config, workerId, date, period) {
    return config.availability.some((item) => item.workerId === workerId && item.date === date && (item.period === "all" || item.period === period));
  }
  function safeName(value) {
    return String(value).replace(/[^a-zA-Z0-9_]/g, "_");
  }
  function linearExpression(terms) {
    if (!terms.length) return "0";
    return terms.map(([name, coefficient], index) => {
      const sign = coefficient < 0 ? "-" : index ? "+" : "";
      return (sign ? sign + " " : "") + Math.abs(coefficient) + " " + name;
    }).join(" ");
  }
  function jsonModelToLp(model) {
    const variables = Object.keys(model.variables), objective = variables.map((name) => [name, Number(model.variables[name][model.optimize] || 0)]).filter(([, value]) => value !== 0), rows = [];
    Object.entries(model.constraints).forEach(([constraintName, bounds]) => {
      const terms = variables.map((name) => [name, Number(model.variables[name][constraintName] || 0)]).filter(([, value]) => value !== 0), expression = linearExpression(terms), safe = safeName(constraintName);
      if (bounds.equal !== void 0) rows.push(safe + ": " + expression + " = " + bounds.equal);
      else {
        if (bounds.min !== void 0) rows.push(safe + "_min: " + expression + " >= " + bounds.min);
        if (bounds.max !== void 0) rows.push(safe + "_max: " + expression + " <= " + bounds.max);
      }
    });
    return ["Minimize", " obj: " + linearExpression(objective), "Subject To", ...rows, "Binary", " " + Object.keys(model.binaries || {}).join(" "), "End"].join("\n");
  }
  function highsAdapter(highs) {
    return { Solve(model) {
      const result = highs.solve(jsonModelToLp(model), { presolve: "on", mip_rel_gap: 0 });
      const solution = { feasible: result.Status === "Optimal", result: result.ObjectiveValue, status: result.Status };
      Object.entries(result.Columns || {}).forEach(([name, column]) => {
        if (column.Primal) solution[name] = column.Primal;
      });
      return solution;
    } };
  }
  function buildInstances(config) {
    const { year, month } = parseMonth(config.current), instances = [];
    for (let day = 1; day <= daysInMonth(year, month); day++) {
      const date = iso(dateAtNoon(year, month, day)), weekday = (/* @__PURE__ */ new Date(date + "T12:00:00")).getDay();
      Object.entries(config.shifts).forEach(([shiftId, shift]) => {
        if (shift.enabled === false || !shift.activeDays.includes(weekday)) return;
        for (let index = 0; index < Number(shift.coverage || 0); index++) {
          const interval = intervalFor(date, shift);
          instances.push({ key: date + "|" + shiftId + "-" + index, date, shiftId, index, shift, ...interval });
        }
      });
    }
    return instances;
  }
  function pairingContinuity(pairing, shifts) {
    const first = shifts[pairing.firstShiftId], second = shifts[pairing.secondShiftId];
    if (!first || !second) return { valid: false, reason: "A component shift was removed." };
    const base = "2026-01-05", firstInterval = intervalFor(base, first), secondInterval = intervalFor(addDays(base, Number(pairing.dayOffset || 0)), second);
    const total = secondInterval.end - firstInterval.start;
    if (firstInterval.end !== secondInterval.start) return { valid: false, reason: "The component shifts are not continuous." };
    if (total !== DAY_MS) return { valid: false, reason: "The pairing lasts " + Math.round(total / 36e4) / 10 + "h, not 24h." };
    return { valid: true, reason: "Continuous 24h duty.", start: first.start, end: second.end };
  }
  function buildPairOccurrences(config, instances, byKey) {
    const result = [], { year, month } = parseMonth(config.current), total = daysInMonth(year, month);
    config.pairings.filter((pairing) => pairing.enabled !== false).forEach((pairing) => {
      const validation = pairingContinuity(pairing, config.shifts);
      if (!validation.valid) return;
      for (let day = 1; day <= total; day++) {
        const firstDate = iso(dateAtNoon(year, month, day)), secondDate = addDays(firstDate, Number(pairing.dayOffset || 0));
        if (!secondDate.startsWith(config.current)) continue;
        const firstSlots = instances.filter((item) => item.date === firstDate && item.shiftId === pairing.firstShiftId);
        const secondSlots = instances.filter((item) => item.date === secondDate && item.shiftId === pairing.secondShiftId);
        const count = Math.min(firstSlots.length, secondSlots.length);
        for (let index = 0; index < count; index++) {
          const first = firstSlots[index], second = secondSlots[index];
          if (!byKey[first.key] || !byKey[second.key]) continue;
          result.push({ id: pairing.id + "_" + firstDate + "_" + index, pairing, first, second, start: first.start, end: second.end, startDate: firstDate, keys: [first.key, second.key] });
        }
      }
    });
    return result;
  }
  function solve(config, solverInstance) {
    const lp = solverInstance || (typeof solver !== "undefined" ? solver : null);
    if (!lp || typeof lp.Solve !== "function") return { feasible: false, error: "The integer solver did not load." };
    const instances = buildInstances(config), byKey = Object.fromEntries(instances.map((item) => [item.key, item]));
    const occurrences = buildPairOccurrences(config, instances, byKey), model = { optimize: "cost", opType: "min", constraints: {}, variables: {}, binaries: {} };
    const variableInfo = {}, xBySlotWorker = {}, candidatesByWorker = {}, managerCandidateCount = {}, diagnostics = { lockConflicts: [], invalidPairings: [], candidateCounts: {}, modelVariables: 0, modelConstraints: 0 };
    const defaultManager = config.workers.find((worker) => worker.defaultManager), minimumRestMinutes = Number(config.minimumRestHours || 0) * 60, recoveryMinutes = Number(config.settings.recoveryDays || 0) * 1440;
    config.pairings.forEach((pairing) => {
      const check = pairingContinuity(pairing, config.shifts);
      if (!check.valid) diagnostics.invalidPairings.push(pairing.name + ": " + check.reason);
    });
    function constraint(name, definition) {
      model.constraints[name] = definition;
      return name;
    }
    function variable(name, coefficients, info) {
      model.variables[name] = { cost: 0, ...coefficients };
      model.binaries[name] = 1;
      variableInfo[name] = info;
      return name;
    }
    function addCoefficient(variableName, constraintName, value) {
      model.variables[variableName][constraintName] = (model.variables[variableName][constraintName] || 0) + value;
    }
    function externalConflicts(worker, instance) {
      const assignmentConflict = Object.entries(config.assignments).some(([key, workerId]) => {
        if (workerId !== worker.id || key.startsWith(config.current) || !key.includes("|")) return false;
        const [date, slotId] = key.split("|"), shiftId = slotId.slice(0, slotId.lastIndexOf("-")), shift = config.shifts[shiftId];
        if (!shift) return false;
        return overlapsOrTooClose(instance, intervalFor(date, shift), minimumRestMinutes);
      });
      if (assignmentConflict) return true;
      if (!recoveryMinutes) return false;
      return (config.twentyFourPairs || []).some((pair) => {
        if (pair.workerId !== worker.id || !Array.isArray(pair.keys) || pair.keys.some((key) => key.startsWith(config.current))) return false;
        const intervals = pair.keys.map((key) => {
          const separator = key.indexOf("|");
          if (separator < 0) return null;
          const date = key.slice(0, separator), slotId = key.slice(separator + 1), suffix = slotId.lastIndexOf("-"), shiftId = suffix < 0 ? slotId : slotId.slice(0, suffix), shift = config.shifts[shiftId];
          return shift ? intervalFor(date, shift) : null;
        }).filter(Boolean);
        if (!intervals.length) return false;
        const pairEnd = Math.max(...intervals.map((interval) => interval.end));
        return instance.start >= pairEnd && instance.start < pairEnd + recoveryMinutes * 6e4;
      });
    }
    function eligible(worker, instance, ignoreLock) {
      if (!ignoreLock && config.locks[instance.key] && config.assignments[instance.key] !== worker.id) return false;
      if (instance.shift.manager) {
        if (!worker.managerQualified) return false;
      } else if (!worker.categories.includes(instance.shift.category)) return false;
      if (availabilityBlocked(config, worker.id, instance.date, instance.shift.period)) return false;
      if (externalConflicts(worker, instance)) return false;
      return true;
    }
    function preferenceCost(worker, instance) {
      const period = instance.shift.period;
      if (worker.preference === "either") return 0.02;
      return worker.preference === period ? 0 : 0.2;
    }
    instances.forEach((instance, slotIndex) => {
      const cover = constraint("cover_" + slotIndex, { equal: 1 }), lockedWorkerId = config.locks[instance.key] ? config.assignments[instance.key] : null;
      let workers;
      if (lockedWorkerId) {
        const worker = config.workers.find((item) => item.id === lockedWorkerId);
        workers = worker ? [worker] : [];
        if (!worker || !eligible(worker, instance, true)) diagnostics.lockConflicts.push(instance.key + ": locked assignment violates a hard rule.");
      } else if (instance.shift.manager) {
        const defaultAvailable = defaultManager && eligible(defaultManager, instance, false);
        workers = defaultAvailable ? [defaultManager] : config.workers.filter((worker) => eligible(worker, instance, false));
      } else workers = config.workers.filter((worker) => eligible(worker, instance, false));
      diagnostics.candidateCounts[instance.key] = workers.length;
      workers.forEach((worker) => {
        const name = "x_" + slotIndex + "_" + safeName(worker.id), random = (config.randomRanks && config.randomRanks[worker.id] || 0) / 1e5;
        variable(name, { [cover]: 1, cost: preferenceCost(worker, instance) + random }, { kind: "assignment", instance, worker });
        xBySlotWorker[instance.key + "|" + worker.id] = name;
        (candidatesByWorker[worker.id] ||= []).push({ name, instance });
        if (instance.shift.manager && (!defaultManager || worker.id !== defaultManager.id)) (managerCandidateCount[worker.id] ||= []).push(name);
      });
      if (!lockedWorkerId) variable("u_" + slotIndex, { [cover]: 1, cost: 1e12 }, { kind: "unfilled", instance });
    });
    if (diagnostics.lockConflicts.length) return { feasible: false, error: diagnostics.lockConflicts.join(" "), diagnostics };
    const allowedPairKeys = /* @__PURE__ */ new Set(), pairVariables = [];
    occurrences.forEach((occurrence, occurrenceIndex) => {
      config.workers.forEach((worker) => {
        if (!(worker.pair24 === "any" || worker.pair24 === occurrence.pairing.id)) return;
        const firstX = xBySlotWorker[occurrence.first.key + "|" + worker.id], secondX = xBySlotWorker[occurrence.second.key + "|" + worker.id];
        if (!firstX || !secondX) return;
        const name = "p_" + occurrenceIndex + "_" + safeName(worker.id), c1 = constraint("p1_" + occurrenceIndex + "_" + safeName(worker.id), { max: 0 }), c2 = constraint("p2_" + occurrenceIndex + "_" + safeName(worker.id), { max: 0 }), c3 = constraint("p3_" + occurrenceIndex + "_" + safeName(worker.id), { max: 1 });
        variable(name, { [c1]: 1, [c2]: 1, [c3]: -1, cost: -0.1 }, { kind: "pair", occurrence, worker });
        addCoefficient(firstX, c1, -1);
        addCoefficient(secondX, c2, -1);
        addCoefficient(firstX, c3, 1);
        addCoefficient(secondX, c3, 1);
        const token = [occurrence.first.key, occurrence.second.key].sort().join("~");
        allowedPairKeys.add(worker.id + "|" + token);
        pairVariables.push({ name, occurrence, worker });
      });
    });
    Object.entries(candidatesByWorker).forEach(([workerId, candidates]) => {
      for (let i = 0; i < candidates.length; i++) for (let j = i + 1; j < candidates.length; j++) {
        const left = candidates[i], right = candidates[j];
        if (!overlapsOrTooClose(left.instance, right.instance, minimumRestMinutes)) continue;
        const token = [left.instance.key, right.instance.key].sort().join("~");
        if (allowedPairKeys.has(workerId + "|" + token)) continue;
        const name = constraint("rest_" + safeName(workerId) + "_" + i + "_" + j, { max: 1 });
        addCoefficient(left.name, name, 1);
        addCoefficient(right.name, name, 1);
      }
    });
    pairVariables.forEach((pair, index) => {
      (candidatesByWorker[pair.worker.id] || []).forEach((candidate, candidateIndex) => {
        if (pair.occurrence.keys.includes(candidate.instance.key)) return;
        if (candidate.instance.start >= pair.occurrence.end && candidate.instance.start < pair.occurrence.end + recoveryMinutes * 6e4) {
          const name = constraint("recovery_" + index + "_" + candidateIndex, { max: 1 });
          addCoefficient(pair.name, name, 1);
          addCoefficient(candidate.name, name, 1);
        }
      });
    });
    for (let i = 0; i < pairVariables.length; i++) for (let j = i + 1; j < pairVariables.length; j++) {
      const left = pairVariables[i], right = pairVariables[j];
      if (left.worker.id !== right.worker.id) continue;
      const first = left.occurrence.start <= right.occurrence.start ? left : right, second = first === left ? right : left;
      if (second.occurrence.start < first.occurrence.end + recoveryMinutes * 6e4) {
        const name = constraint("pairRecovery_" + i + "_" + j, { max: 1 });
        addCoefficient(left.name, name, 1);
        addCoefficient(right.name, name, 1);
      }
    }
    instances.filter((instance) => instance.shift.manager).forEach((managerInstance, managerIndex) => {
      const normalCandidates = Object.keys(xBySlotWorker).filter((key) => key.startsWith(managerInstance.key + "|"));
      if (normalCandidates.length) return;
      const coverName = Object.keys(model.constraints).find((name) => name === "cover_" + instances.indexOf(managerInstance));
      const supportSlots = instances.filter((item) => item.date === managerInstance.date && !item.shift.manager && item.start <= managerInstance.start && item.end >= managerInstance.end);
      pairVariables.filter((pair) => pair.occurrence.start <= managerInstance.start && pair.occurrence.end >= managerInstance.end).forEach((pair, fallbackIndex) => {
        const supportVariables = [];
        supportSlots.forEach((slot) => config.workers.forEach((worker) => {
          if (worker.id === pair.worker.id) return;
          const variableName = xBySlotWorker[slot.key + "|" + worker.id];
          if (variableName) supportVariables.push(variableName);
        }));
        if (!supportVariables.length) return;
        const name = "fm_" + managerIndex + "_" + fallbackIndex, link = constraint("fmPair_" + managerIndex + "_" + fallbackIndex, { max: 0 }), support = constraint("fmSupport_" + managerIndex + "_" + fallbackIndex, { max: 0 });
        variable(name, { [coverName]: 1, [link]: 1, [support]: 1, cost: 1 }, { kind: "managerFallback", instance: managerInstance, worker: pair.worker, pair });
        addCoefficient(pair.name, link, -1);
        supportVariables.forEach((variableName) => addCoefficient(variableName, support, -1));
      });
    });
    config.workers.forEach((worker, workerIndex) => {
      const candidates = candidatesByWorker[worker.id] || [], durations = candidates.map((item) => item.instance.minutes), choice = constraint("hourChoice_" + workerIndex, { equal: 1 }), balance = constraint("hourBalance_" + workerIndex, { equal: 0 });
      candidates.forEach((item) => addCoefficient(item.name, balance, item.instance.minutes));
      let reachable = /* @__PURE__ */ new Set([0]);
      durations.forEach((duration) => {
        const next = new Set(reachable);
        reachable.forEach((total) => next.add(total + duration));
        reachable = next;
      });
      [...reachable].sort((a, b) => a - b).forEach((minutes, optionIndex) => {
        const error = minutes / 60 - Number(worker.target), name = "h_" + workerIndex + "_" + optionIndex;
        variable(name, { [choice]: 1, [balance]: -minutes, cost: error * error * 1e3 }, { kind: "hours", worker, minutes });
      });
      const managerVars = managerCandidateCount[worker.id] || [];
      if (managerVars.length) {
        const managerChoice = constraint("managerChoice_" + workerIndex, { equal: 1 }), managerBalance = constraint("managerBalance_" + workerIndex, { equal: 0 });
        managerVars.forEach((name) => addCoefficient(name, managerBalance, 1));
        for (let count = 0; count <= managerVars.length; count++) variable("mc_" + workerIndex + "_" + count, { [managerChoice]: 1, [managerBalance]: -count, cost: count * count * 5 }, { kind: "managerCount", worker, count });
      }
    });
    diagnostics.modelVariables = Object.keys(model.variables).length;
    diagnostics.modelConstraints = Object.keys(model.constraints).length;
    const solution = lp.Solve(model), assignments = {}, assignmentReasons = {}, managerFallbacks = {}, twentyFourPairs = [], unfilled = [];
    if (!solution.feasible) return { feasible: false, error: "No schedule satisfies the hard constraints.", diagnostics, raw: solution };
    Object.entries(variableInfo).forEach(([name, info]) => {
      if (!(Number(solution[name]) > 0.5)) return;
      if (info.kind === "assignment") {
        assignments[info.instance.key] = info.worker.id;
        assignmentReasons[info.instance.key] = config.locks[info.instance.key] ? "Locked assignment preserved." : info.instance.shift.manager ? info.worker.defaultManager ? "Default manager assigned." : "Qualified manager replacement selected with balanced replacement count." : "Eligible for " + info.instance.shift.category + "; selected by the global minimum-error solver.";
      } else if (info.kind === "unfilled") {
        unfilled.push({ key: info.instance.key, reason: diagnostics.candidateCounts[info.instance.key] ? "All eligible workers conflict with rest or overlapping duties." : "No available worker has the required qualification." });
      } else if (info.kind === "pair") {
        twentyFourPairs.push({ id: info.occurrence.id + "_" + info.worker.id, workerId: info.worker.id, pairingId: info.occurrence.pairing.id, orientation: info.occurrence.pairing.id, name: info.occurrence.pairing.name, startDate: info.occurrence.startDate, keys: info.occurrence.keys });
        info.occurrence.keys.forEach((key) => {
          assignmentReasons[key] = "Part of " + info.occurrence.pairing.name + " 24h duty; exact recovery constraints applied.";
        });
      } else if (info.kind === "managerFallback") {
        assignments[info.instance.key] = info.worker.id;
        managerFallbacks[info.instance.date] = info.worker.id;
        assignmentReasons[info.instance.key] = "24h manager fallback; a separate worker covers the full 08:00\u201316:00 window.";
      }
    });
    return { feasible: true, assignments, assignmentReasons, managerFallbacks, twentyFourPairs, unfilled, diagnostics, objective: solution.result, exact: true };
  }
  return __toCommonJS(scheduler_engine_exports);
})();
