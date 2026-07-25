// scripts/grafik-arkusz.gs only runs inside Google, so it is exercised here against a
// mock SpreadsheetApp that enforces the limits the real one does -- above all the
// 26 columns a new sheet starts with, which silently broke the availability grid.
// The sheet the mock ends up holding is then parsed by the real importer, so the
// Apps Script and the .xlsx generator cannot drift apart unnoticed.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const sheetIo = require('../sheet-io');

const DEFAULT_ROWS = 1000;
const DEFAULT_COLUMNS = 26;

function chainable(target, methods) {
  methods.forEach(name => { if (!target[name]) target[name] = () => target; });
  return target;
}

function makeProtection(target, label) {
  const protection = { target: label, editorsRemoved: false, domainEdit: true, description: '' };
  protection.setDescription = text => { protection.description = text; return protection; };
  protection.getEditors = () => ['someone@example.com'];
  protection.removeEditors = () => { protection.editorsRemoved = true; return protection; };
  protection.canDomainEdit = () => protection.domainEdit;
  protection.setDomainEdit = value => { protection.domainEdit = value; return protection; };
  return protection;
}

function makeSheet(name) {
  const cells = new Map();
  const sheet = {
    name,
    rowCount: DEFAULT_ROWS,
    columnCount: DEFAULT_COLUMNS,
    columnWidths: {},
    frozenRows: 0,
    frozenColumns: 0,
    validations: [],
    conditionalRules: [],
    protections: [],
    rangeProtections: [],
    notes: new Map(),
    numberFormats: new Map(),
    getName: () => name,
    getMaxRows: () => sheet.rowCount,
    getMaxColumns: () => sheet.columnCount,
    getLastRow: () => [...cells.keys()].reduce((most, key) => Math.max(most, Number(key.split(':')[0])), 0),
    getLastColumn: () => [...cells.keys()].reduce((most, key) => Math.max(most, Number(key.split(':')[1])), 0),
    insertColumnsAfter: (after, howMany) => { sheet.columnCount += howMany; return sheet; },
    deleteColumns: (from, howMany) => { sheet.columnCount -= howMany; return sheet; },
    insertRowsAfter: (after, howMany) => { sheet.rowCount += howMany; return sheet; },
    deleteRows: (from, howMany) => { sheet.rowCount -= howMany; return sheet; },
    setColumnWidth: (column, width) => {
      if (column > sheet.columnCount) throw new Error('setColumnWidth: column ' + column + ' is out of bounds (' + sheet.columnCount + ' columns)');
      sheet.columnWidths[column] = width;
      return sheet;
    },
    setFrozenRows: rows => { sheet.frozenRows = rows; return sheet; },
    setFrozenColumns: columns => { sheet.frozenColumns = columns; return sheet; },
    setConditionalFormatRules: rules => { sheet.conditionalRules = rules; return sheet; },
    protect: () => { const protection = makeProtection(sheet, 'sheet'); sheet.protections.push(protection); return protection; },
    cellValue: (row, column) => cells.get(row + ':' + column),
    getRange(row, column, numRows, numColumns) {
      numRows = numRows === undefined ? 1 : numRows;
      numColumns = numColumns === undefined ? 1 : numColumns;
      if (row < 1 || column < 1) throw new Error('getRange: coordinates must be positive');
      if (row + numRows - 1 > sheet.rowCount) {
        throw new Error('getRange: rows ' + row + '..' + (row + numRows - 1) + ' are out of bounds (' + sheet.rowCount + ' rows) on ' + name);
      }
      if (column + numColumns - 1 > sheet.columnCount) {
        throw new Error('getRange: columns ' + column + '..' + (column + numColumns - 1) + ' are out of bounds (' + sheet.columnCount + ' columns) on ' + name);
      }
      const range = {
        setValue(value) { cells.set(row + ':' + column, value); return range; },
        setValues(values) {
          assert.equal(values.length, numRows, 'setValues row count matches the range on ' + name);
          values.forEach((line, rowOffset) => {
            assert.equal(line.length, numColumns, 'setValues column count matches the range on ' + name);
            line.forEach((value, columnOffset) => cells.set((row + rowOffset) + ':' + (column + columnOffset), value));
          });
          return range;
        },
        setFormulas(values) { return range.setValues(values); },
        getValues: () => Array.from({ length: numRows }, (_, rowOffset) =>
          Array.from({ length: numColumns }, (_, columnOffset) => cells.get((row + rowOffset) + ':' + (column + columnOffset)) ?? '')),
        setNote(note) { sheet.notes.set(row + ':' + column, note); return range; },
        setNumberFormat(format) { sheet.numberFormats.set(row + ':' + column, format); return range; },
        setDataValidation(validation) { sheet.validations.push({ row, column, numRows, numColumns, validation }); return range; },
        protect() {
          const protection = makeProtection(range, 'range');
          protection.rows = numRows;
          protection.columns = numColumns;
          sheet.rangeProtections.push(protection);
          return protection;
        }
      };
      return chainable(range, ['setBackground', 'setFontColor', 'setFontWeight', 'setFontSize', 'setFontStyle',
        'setHorizontalAlignment', 'setVerticalAlignment', 'setWrap', 'setBorder', 'merge', 'setFontLine']);
    }
  };
  return chainable(sheet, ['setTabColor', 'setHiddenGridlines', 'setRowHeight', 'activate']);
}

function makeSpreadsheet() {
  const sheets = [makeSheet('Feuille 1')];
  return {
    sheets,
    getSheets: () => sheets.slice(),
    getSheetByName: name => sheets.find(sheet => sheet.getName() === name) || null,
    insertSheet(name, position) {
      const sheet = makeSheet(name);
      sheets.splice(position === undefined ? sheets.length : position, 0, sheet);
      return sheet;
    },
    deleteSheet(sheet) { sheets.splice(sheets.indexOf(sheet), 1); },
    setActiveSheet: sheet => sheet
  };
}

function validationBuilder() {
  const builder = { requirement: null, choices: null };
  builder.requireValueInList = choices => { builder.requirement = 'list'; builder.choices = choices; return builder; };
  builder.requireValueInRange = () => { builder.requirement = 'range'; return builder; };
  builder.requireNumberBetween = (low, high) => { builder.requirement = 'number'; builder.choices = [low, high]; return builder; };
  builder.setAllowInvalid = () => builder;
  builder.setHelpText = () => builder;
  builder.build = () => ({ requirement: builder.requirement, choices: builder.choices });
  return builder;
}

function conditionalRuleBuilder() {
  const rule = {};
  const builder = {};
  builder.whenTextEqualTo = text => { rule.text = text; return builder; };
  builder.setBackground = colour => { rule.background = colour; return builder; };
  builder.setFontColor = colour => { rule.fontColor = colour; return builder; };
  builder.setBold = () => builder;
  builder.setRanges = ranges => { rule.ranges = ranges; return builder; };
  builder.build = () => rule;
  return builder;
}

const spreadsheet = makeSpreadsheet();
const SpreadsheetApp = {
  getActiveSpreadsheet: () => spreadsheet,
  newDataValidation: validationBuilder,
  newConditionalFormatRule: conditionalRuleBuilder,
  BorderStyle: { SOLID: 'SOLID', SOLID_MEDIUM: 'SOLID_MEDIUM' },
  getUi: () => { throw new Error('the mock never opens the UI: call the builders directly'); }
};

const source = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'grafik-arkusz.gs'), 'utf8');
const script = new Function('SpreadsheetApp', 'Utilities', 'Session',
  source + '\n;return { budujInstrukcje, budujPracownikow, budujDostepnosc, budujAdministratora, removeEmptyDefaultSheet, freshSheet, ensureSize, columnLetter, nazwaMiesiaca };'
)(SpreadsheetApp, { formatDate: () => '2026-08' }, { getScriptTimeZone: () => 'Europe/Warsaw' });

assert.equal(script.columnLetter(32), 'AF', 'the last day of a 31-day month sits in column AF');
assert.equal(script.nazwaMiesiaca('2026-08'), 'sierpień 2026');

// Build all three tabs exactly as the menu item does.
const month = '2026-08';
script.budujInstrukcje(script.freshSheet(spreadsheet, 'Instrukcja', 0), month);
const workers = script.budujPracownikow(script.freshSheet(spreadsheet, 'Pracownicy', 1), month);
script.budujDostepnosc(script.freshSheet(spreadsheet, 'Dostępność', 2), month, workers);
script.budujAdministratora(script.freshSheet(spreadsheet, 'Administrator', 3), month, workers);
script.removeEmptyDefaultSheet(spreadsheet);

assert.deepEqual(spreadsheet.getSheets().map(sheet => sheet.getName()),
  ['Instrukcja', 'Pracownicy', 'Dostępność', 'Administrator'], 'the empty default tab is removed');

// The scheduler-only tab must be locked, not merely labelled.
const admin = spreadsheet.getSheetByName('Administrator');
assert.deepEqual([1, 2, 3, 4, 5].map(column => admin.cellValue(3, column)),
  ['Imię i nazwisko', 'Kategorie', 'Uprawnienia kierownika', 'Kierownik domyślny', 'Uwagi']);
assert.equal(admin.protections.length, 1, 'the whole Administrator tab is protected');
assert.equal(admin.protections[0].editorsRemoved, true, 'other editors are removed, leaving the owner');
assert.equal(admin.protections[0].domainEdit, false, 'domain-wide editing is switched off');
assert.ok(admin.protections[0].description.length > 0);
assert.equal(admin.validations.filter(entry => entry.validation.requirement === 'list').length, 2,
  'Tak/Nie dropdowns live on the Administrator tab now');
assert.equal(admin.frozenRows, 3);

// Employees keep their four columns, and their headers are locked against renaming.
const employeeSheet = spreadsheet.getSheetByName('Pracownicy');
assert.equal(employeeSheet.cellValue(3, 4), 'Dyżur 24h');
assert.equal(employeeSheet.cellValue(3, 5), undefined, 'the scheduler-only columns are gone from the employee tab');
assert.equal(employeeSheet.protections.length, 0, 'the employee tab itself stays editable');
assert.equal(employeeSheet.rangeProtections.length, 1, 'only its header rows are protected');
assert.equal(employeeSheet.rangeProtections[0].rows, 3);
assert.equal(spreadsheet.getSheetByName('Dostępność').rangeProtections.length, 1, 'the day header is protected too');

const availability = spreadsheet.getSheetByName('Dostępność');
assert.ok(availability.getMaxColumns() >= 33, 'the sheet is widened past the 26 columns a new sheet starts with');
assert.equal(availability.cellValue(1, 1), 'Miesiąc');
assert.equal(availability.cellValue(1, 2), month);
assert.equal(availability.numberFormats.get('1:2'), '@', 'the month stays text so Sheets cannot turn it into a date');
assert.equal(availability.cellValue(3, 2), 'So', '1 August 2026 is a Saturday');
assert.equal(availability.cellValue(4, 1), 'Imię i nazwisko');
assert.equal(availability.cellValue(4, 2), 1);
assert.equal(availability.cellValue(4, 32), 31, 'all 31 day columns are written');
assert.equal(availability.cellValue(4, 33), 'Razem');
assert.equal(availability.cellValue(5, 33), '=COUNTA(B5:AF5)');
assert.equal(availability.frozenRows, 4);
assert.equal(availability.frozenColumns, 1);
assert.equal(availability.conditionalRules.length, 3, 'X, D and N each get a colour rule');
assert.deepEqual(availability.conditionalRules.map(rule => rule.text), ['X', 'D', 'N']);
const gridValidation = availability.validations.find(entry => entry.column === 2);
assert.deepEqual(gridValidation.validation.choices, ['X', 'D', 'N']);

const workerSheet = spreadsheet.getSheetByName('Pracownicy');
assert.equal(workerSheet.cellValue(3, 1), 'Imię i nazwisko');
assert.equal(workerSheet.cellValue(3, 1), 'Imię i nazwisko');
assert.equal(workerSheet.frozenRows, 3);
assert.ok(workerSheet.notes.get('3:2').includes('godzin'), 'header hints are attached as notes');
assert.equal(workerSheet.validations.filter(entry => entry.validation.requirement === 'list').length, 2,
  'the employee tab keeps only its own two dropdowns');

// A 30-day month must not leave a stale 31st column behind.
const shortMonth = makeSpreadsheet();
const shortWorkers = script.budujPracownikow(script.freshSheet(shortMonth, 'Pracownicy', 0), '2026-09');
const september = script.freshSheet(shortMonth, 'Dostępność', 1);
script.budujDostepnosc(september, '2026-09', shortWorkers);
assert.equal(september.cellValue(4, 31), 30, 'September ends on day 30');
assert.equal(september.cellValue(4, 32), 'Razem');
assert.equal(september.getMaxColumns(), 32, 'the grid is trimmed to the month it describes');

// Finally: what the Apps Script built must import cleanly.
function tableFrom(sheet) {
  const rows = [];
  for (let row = 1; row <= Math.min(sheet.getLastRow(), 40); row++) {
    const line = [];
    for (let column = 1; column <= sheet.getMaxColumns(); column++) {
      const value = sheet.cellValue(row, column);
      line.push(value === undefined ? '' : value);
    }
    rows.push(line);
  }
  return { name: sheet.getName(), rows };
}

const parsed = sheetIo.parseSheets(spreadsheet.getSheets().map(tableFrom), {
  workers: [{ id: 'w1', name: 'Anna Kowalska', target: 160, preference: 'either', pair24: 'none', categories: ['General'], managerQualified: false, defaultManager: false }],
  pairings: [{ id: 'pair8', name: '08:00 → 08:00' }, { id: 'pair20', name: '20:00 → 20:00' }],
  categories: ['General'],
  currentMonth: '2026-07'
});
assert.equal(parsed.issues.filter(issue => issue.level === 'error').length, 0,
  'the importer recognises the tabs the Apps Script builds: ' + JSON.stringify(parsed.issues));
assert.equal(parsed.month, '2026-08', 'the month is read out of B1');
assert.equal(parsed.monthFromSheet, true);
assert.equal(parsed.workers.length, 0, 'an empty roster yields no worker rows');
assert.equal(parsed.availability.length, 0, 'an empty grid yields no availability rows');

// The same sheet, once somebody has filled it in.
const filled = spreadsheet.getSheets().map(tableFrom);
const grid = filled.find(table => table.name === 'Dostępność');
const roster = filled.find(table => table.name === 'Pracownicy');
roster.rows[3] = ['Anna Kowalska', 168, 'Noc', 'Dowolny'];
const adminTable = filled.find(table => table.name === 'Administrator');
adminTable.rows[3] = ['Anna Kowalska', 'General, Nursing', 'Tak', 'Tak', 'notatka kierownika'];
grid.rows[4] = ['Anna Kowalska', 'X', '', 'N', ...Array(grid.rows[4].length - 4).fill('')];
const withData = sheetIo.parseSheets(filled, {
  workers: [{ id: 'w1', name: 'Anna Kowalska', target: 160, preference: 'either', pair24: 'none', categories: ['General'], managerQualified: false, defaultManager: false }],
  pairings: [{ id: 'pair8', name: '08:00 → 08:00' }, { id: 'pair20', name: '20:00 → 20:00' }],
  categories: ['General'],
  currentMonth: '2026-07'
});
assert.equal(withData.issues.filter(issue => issue.level === 'error').length, 0);
assert.equal(withData.workers.length, 1);
assert.equal(withData.workers[0].workerId, 'w1');
assert.equal(withData.workers[0].values.target, 168);
assert.equal(withData.workers[0].values.pair24, 'any');
// The two tabs describe one person, so they merge into a single imported row.
assert.equal(withData.workers.length, 1, 'the employee tab and the Administrator tab merge by name');
assert.deepEqual(withData.workers[0].values.categories, ['General', 'Nursing']);
assert.equal(withData.workers[0].values.managerQualified, true);
assert.equal(withData.workers[0].values.defaultManager, true);
assert.deepEqual(withData.workers[0].sheets, ['Pracownicy', 'Administrator']);
assert.deepEqual(withData.availability[0].entries, [
  { date: '2026-08-01', period: 'all' },
  { date: '2026-08-03', period: 'night' }
]);

console.log('Apps Script sheet builder tests passed');
