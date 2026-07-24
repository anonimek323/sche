const assert = require('assert');
const fs = require('fs');
const { JSDOM } = require('jsdom');
const engine = require('../scheduler-engine');

(async () => {
  const html = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');
  let appScript = fs.readFileSync(require('path').join(__dirname, '..', 'dist', 'app.js'), 'utf8');
  appScript = appScript.replace(/\n  renderAll\(\);\n\}\)\(\);\s*$/, `
    window.__test = { getApp:()=>app, renderAll, generate, currentMeta, checkpoint, undoSchedule, redoSchedule, setScheduleStatus, assignmentConflicts, detailsForAssignment };
    renderAll();
  })();
  `);
  const dom = new JSDOM(html, { url: 'http://shiftwise.test/', runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom;
  const highs = await require('highs')();
  window.Module = () => Promise.resolve(highs);
  window.ShiftwiseEngine = engine;
  window.ShiftwiseSheetIO = require('../sheet-io');
  window.solver = require('javascript-lp-solver');
  window.XLSX = require('xlsx');
  window.alert = message => { throw new Error('Unexpected alert: ' + message); };
  window.confirm = () => true;
  window.prompt = () => null;
  window.scrollTo = () => {};
  window.URL.createObjectURL = () => 'blob:test';
  window.URL.revokeObjectURL = () => {};
  window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  window.HTMLDialogElement.prototype.close = function () { this.open = false; };
  window.eval(appScript);

  assert.equal(window.document.querySelectorAll('#workersTable tr').length, 10, 'worker table renders');
  assert.equal(window.document.querySelectorAll('#pairingsTable tr').length, 2, 'configured pairings render');
  assert.equal(window.document.querySelectorAll('#reportsTable tr').length, 10, 'operational report renders');
  assert.ok(window.document.getElementById('scheduleViewMode'), 'schedule view filters exist');
  assert.ok(window.document.getElementById('unfilledList'), 'bulk unfilled panel exists');

  assert.ok(window.document.getElementById('sheetImportModal'), 'the sheet import preview modal exists');
  assert.equal(window.document.getElementById('sheetImportState').textContent, 'No import yet');
  assert.equal(window.document.getElementById('undoSheetImport').hidden, true, 'undo stays hidden until an import happens');
  assert.equal(window.document.getElementById('sheetFile').accept, '.xlsx,.xlsm,.xls,.csv');

  await window.__test.generate();
  const app = window.__test.getApp();
  const currentAssignments = Object.entries(app.assignments).filter(([key]) => key.startsWith(app.current));
  assert.ok(currentAssignments.length > 100, 'full month is generated');
  assert.equal(window.__test.currentMeta().solver.exact, true, 'exact solver status is stored');
  assert.equal(window.document.querySelectorAll('#unfilledList .unfilled-row').length, 0, 'representative schedule has full coverage');
  assert.ok(app.assignmentReasons[currentAssignments[0][0]], 'generated assignments include an explanation');

  const chip=window.document.querySelector('[data-assignment]');
  chip.dispatchEvent(new window.MouseEvent('click',{bubbles:true,ctrlKey:true}));
  assert.equal(window.document.getElementById('bulkCount').textContent,'1 selected','Ctrl-click selects a filled shift for bulk reassignment');
  window.document.querySelector('[data-assignment="'+chip.dataset.assignment+'"]').dispatchEvent(new window.MouseEvent('click',{bubbles:true,ctrlKey:true}));
  assert.equal(window.document.getElementById('bulkCount').textContent,'0 selected','Ctrl-click toggles a bulk selection');

  const [lockedKey, lockedWorker] = currentAssignments[0];
  app.locks[lockedKey] = true;
  await window.__test.generate();
  assert.equal(app.assignments[lockedKey], lockedWorker, 'regeneration preserves locked assignments');

  window.__test.setScheduleStatus('published');
  assert.equal(window.__test.currentMeta().status, 'published');
  window.__test.checkpoint('Before DOM undo test');
  delete app.assignments[lockedKey];
  window.__test.undoSchedule();
  assert.equal(app.assignments[lockedKey], lockedWorker, 'undo restores assignment');
  window.__test.redoSchedule();
  assert.equal(app.assignments[lockedKey], undefined, 'redo reapplies change');

  window.__test.renderAll();
  assert.equal(window.document.querySelectorAll('#reportsTable tr').length, 10);
  assert.ok(window.document.getElementById('reportMetrics').textContent.includes('Payroll hours'));
  assert.ok(window.__test.currentMeta().versions.length >= 2, 'schedule versions are retained');

  console.log('app DOM workflow tests passed');
})();
