const assert = require('assert');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const sheetIo = require('../sheet-io');

const context = () => ({
  currentMonth: '2026-08',
  categories: ['General'],
  pairings: [
    { id: 'pair8', name: '08:00 → 08:00', firstShiftId: '12d', secondShiftId: '12n', dayOffset: 0, enabled: true },
    { id: 'pair20', name: '20:00 → 20:00', firstShiftId: '12n', secondShiftId: '12d', dayOffset: 1, enabled: true }
  ],
  workers: [
    { id: 'w1', name: 'Łukasz Zieliński', target: 160, preference: 'either', pair24: 'none', categories: ['General'], managerQualified: false, defaultManager: false },
    { id: 'w2', name: 'Agnieszka Wójcik', target: 160, preference: 'day', pair24: 'none', categories: ['General'], managerQualified: false, defaultManager: false }
  ]
});

const workerTable = () => ({
  name: 'Pracownicy',
  rows: [
    ['Imię i nazwisko', 'Godziny docelowe', 'Preferowana pora', 'Dyżur 24h'],
    ['Dokładnie tak samo jak w zakładce Dostępność.', 'Ile godzin chcesz przepracować.', 'Dzień, Noc albo Bez preferencji.', ''],
    ['Lukasz Zielinski', '168', 'Noc', 'Dowolny'],
    ['Wójcik Agnieszka', '150', 'Dzień', '08:00 → 08:00'],
    ['Paweł Nowak', '144', 'Bez preferencji', 'Nie'],
    [],
    ['Maja Dąbrowska', 'sto', 'wieczorem', 'Nie']
  ]
});

// The scheduler-only tab, merged into the same people by name.
const adminTable = () => ({
  name: 'Administrator',
  rows: [
    ['Imię i nazwisko', 'Kategorie', 'Uprawnienia kierownika', 'Kierownik domyślny', 'Uwagi'],
    ['Lukasz Zielinski', 'General', 'Tak', 'Tak', 'bez ogonków'],
    ['Wójcik Agnieszka', 'General, Nursing', 'Nie', 'Nie', 'odwrócona kolejność'],
    ['Paweł Nowak', 'General', 'Nie', 'Nie', 'nowa osoba']
  ]
});

const availabilityTable = () => ({
  name: 'Dostępność',
  rows: [
    ['Miesiąc', '2026-08', 'Format RRRR-MM.'],
    ['', '', 'X = cały dzień · D = rano / dzień · N = noc · puste = dostępny'],
    ['Dzień tygodnia', 'So', 'Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt'],
    ['Imię i nazwisko', 1, 2, 3, 4, 5, 6, 7],
    ['Lukasz Zielinski', 'X', '', 'N', 'n', '', 'D', ''],
    ['Paweł Nowak', '', 'urlop', '', '', 'Y', '', ''],
    ['Nieznana Osoba', 'X', '', '', '', '', '', '']
  ]
});

// Header, value and month tolerance
assert.equal(sheetIo.headerField('Imię i nazwisko'), 'name');
assert.equal(sheetIo.headerField('IMIE I NAZWISKO'), 'name');
assert.equal(sheetIo.headerField('Uprawnienia kierownika'), 'managerQualified');
assert.equal(sheetIo.headerField('Kierownik domyślny'), 'defaultManager', 'the more specific manager column wins');
assert.equal(sheetIo.headerField('Target hours'), 'target');
assert.equal(sheetIo.headerField('Zupełnie inna kolumna'), null);
assert.equal(sheetIo.parsePreference('Dzień'), 'day');
assert.equal(sheetIo.parsePreference('noc'), 'night');
assert.equal(sheetIo.parsePreference('Bez preferencji'), 'either');
assert.equal(sheetIo.parsePreference('kiedykolwiek'), null);
assert.equal(sheetIo.parseBoolean('Tak'), true);
assert.equal(sheetIo.parseBoolean('nie'), false);
assert.equal(sheetIo.parseBoolean(''), null);
assert.equal(sheetIo.parseAvailabilityCode('X'), 'all');
assert.equal(sheetIo.parseAvailabilityCode('urlop'), 'all');
assert.equal(sheetIo.parseAvailabilityCode('n'), 'night');
assert.equal(sheetIo.parseAvailabilityCode('Y'), null);
assert.equal(sheetIo.parsePair24('Dowolny', context().pairings), 'any');
assert.equal(sheetIo.parsePair24('08:00 → 08:00', context().pairings), 'pair8');
assert.equal(sheetIo.parsePair24('20-20', context().pairings), 'pair20');
assert.equal(sheetIo.parsePair24('Nie', context().pairings), 'none');
assert.equal(sheetIo.normaliseMonth('2026-08'), '2026-08');
assert.equal(sheetIo.normaliseMonth('2026-8'), '2026-08');
assert.equal(sheetIo.normaliseMonth('sierpień 2026'), '2026-08');
assert.equal(sheetIo.normaliseMonth('nie miesiąc'), null);
assert.equal(sheetIo.daysInMonth('2026-02'), 28);

// Tab recognition, including a single-tab CSV export
assert.equal(sheetIo.classifySheet(workerTable()), 'workers');
assert.equal(sheetIo.classifySheet(adminTable()), 'workers', 'the Administrator tab is read by the same parser');
assert.equal(sheetIo.classifySheet(availabilityTable()), 'availability');
assert.equal(sheetIo.classifySheet({ name: 'Instrukcja', rows: [['cokolwiek']] }), 'ignored');
assert.equal(sheetIo.classifySheet({ ...workerTable(), name: 'Arkusz1' }), 'workers', 'a renamed tab is recognised by its header row');
assert.equal(sheetIo.classifySheet({ ...availabilityTable(), name: 'export' }), 'availability', 'a renamed grid is recognised by its day columns');

const parsed = sheetIo.parseSheets([workerTable(), adminTable(), availabilityTable()], context());
assert.equal(parsed.month, '2026-08');
assert.equal(parsed.monthFromSheet, true);
assert.equal(parsed.issues.filter(issue => issue.level === 'error').length, 0);

const byName = name => parsed.workers.find(row => row.name === name);
assert.equal(parsed.workers.length, 4, 'the hint row and the blank row are skipped');
assert.equal(byName('Lukasz Zielinski').workerId, 'w1', 'names match without diacritics');
assert.equal(byName('Lukasz Zielinski').values.target, 168);
assert.equal(byName('Lukasz Zielinski').values.preference, 'night');
assert.equal(byName('Lukasz Zielinski').values.pair24, 'any');
assert.equal(byName('Lukasz Zielinski').values.defaultManager, true);
assert.equal(byName('Wójcik Agnieszka').workerId, 'w2', 'a reordered name still matches');
assert.deepEqual(byName('Wójcik Agnieszka').values.categories, ['General', 'Nursing'], 'categories come from the Administrator tab');
assert.deepEqual(byName('Lukasz Zielinski').sheets, ['Pracownicy', 'Administrator'], 'both tabs describe the same person');
assert.equal(parsed.workers.length, 4, 'the two tabs merge instead of importing everyone twice');
assert.equal(byName('Maja Dąbrowska').values.managerQualified, undefined, 'somebody missing from the Administrator tab keeps their settings');
assert.equal(byName('Paweł Nowak').isNew, true);
assert.equal(byName('Maja Dąbrowska').values.target, undefined, 'unusable hours are left to the existing value');
assert.equal(byName('Maja Dąbrowska').values.preference, undefined);
assert.deepEqual(parsed.newCategories, ['Nursing']);
assert.ok(parsed.issues.some(issue => issue.message.includes('sto')), 'bad hours are reported');
assert.ok(parsed.issues.some(issue => issue.message.includes('wieczorem')), 'an unknown period is reported');

const availabilityFor = name => parsed.availability.find(row => row.name === name);
assert.deepEqual(availabilityFor('Lukasz Zielinski').entries, [
  { date: '2026-08-01', period: 'all' },
  { date: '2026-08-03', period: 'night' },
  { date: '2026-08-04', period: 'night' },
  { date: '2026-08-06', period: 'day' }
]);
assert.equal(availabilityFor('Lukasz Zielinski').workerId, 'w1');
assert.equal(availabilityFor('Paweł Nowak').workerId, null, 'a worker introduced by the sheet has no id yet');
assert.equal(availabilityFor('Paweł Nowak').isNew, true);
assert.deepEqual(availabilityFor('Paweł Nowak').entries, [{ date: '2026-08-02', period: 'all' }]);
assert.ok(parsed.issues.some(issue => issue.message.includes('"Y"')), 'an unknown code is reported');
assert.ok(parsed.issues.some(issue => issue.message.includes('Nieznana Osoba')), 'availability without a worker is reported');

const summary = sheetIo.importSummary(parsed);
assert.equal(summary.workersNew, 2, 'Paweł and Maja are both new');
assert.equal(summary.availabilityWorkers, 2, 'the unknown person is not counted');
assert.equal(summary.blocked, 1);

// Applying the import
const app = {
  workers: context().workers, availability: [
    { id: 'a1', workerId: 'w1', date: '2026-08-05', period: 'all' },
    { id: 'a2', workerId: 'w1', date: '2026-09-05', period: 'all' },
    { id: 'a3', workerId: 'w2', date: '2026-08-09', period: 'night' }
  ],
  categories: ['General'], pairings: context().pairings, current: '2026-08'
};
app.workers[1].defaultManager = true;
let counter = 0;
const backup = sheetIo.applyImport(app, parsed, { makeId: () => 'id' + (++counter) });
assert.equal(app.workers.length, 4, 'both new workers are added');
assert.equal(app.workers[0].target, 168, 'an existing worker is updated');
assert.equal(app.workers[0].defaultManager, true);
assert.equal(app.workers[1].defaultManager, false, 'only one default manager remains');
assert.equal(app.workers[2].name, 'Paweł Nowak');
assert.equal(app.workers[2].target, 144);
assert.equal(app.workers[3].target, 160, 'a worker with unusable hours falls back to the default target');
assert.ok(app.categories.includes('Nursing'), 'a category used in the sheet is created');
assert.equal(app.availability.filter(entry => entry.workerId === 'w1' && entry.date.startsWith('2026-08')).length, 4);
assert.ok(!app.availability.some(entry => entry.id === 'a1'), 'the replaced month is cleared first');
assert.ok(app.availability.some(entry => entry.id === 'a2'), 'other months are untouched');
assert.ok(app.availability.some(entry => entry.id === 'a3'), 'workers missing from the sheet keep their entries');
const added = app.workers[2];
assert.equal(app.availability.filter(entry => entry.workerId === added.id).length, 1, 'a worker created by the import gets their availability');

sheetIo.restoreImportBackup(app, backup);
assert.equal(app.workers.length, 2, 'undo restores the roster');
assert.ok(app.availability.some(entry => entry.id === 'a1'), 'undo restores availability');
assert.deepEqual(app.categories, ['General'], 'undo restores categories');

const readOnly = sheetIo.parseSheets([workerTable()], context());
sheetIo.applyImport(app, readOnly, { addNewWorkers: false, makeId: () => 'x' + (++counter) });
assert.equal(app.workers.length, 2, 'new workers are skipped when the option is off');

// The generated workbook parses through the real spreadsheet reader
const workbook = XLSX.readFile(path.join(__dirname, 'fixtures', 'grafik-przyklad.xlsx'));
const tables = workbook.SheetNames.map(name => ({ name, rows: XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, raw: true, defval: '' }) }));
const fromFile = sheetIo.parseSheets(tables, { ...context(), workers: [] });
assert.equal(fromFile.month, '2026-08');
assert.equal(fromFile.issues.filter(issue => issue.level === 'error').length, 0, 'the generated template has no structural problems');
assert.equal(fromFile.workers.length, 4, 'every sample worker is read');
assert.equal(fromFile.workers.filter(row => row.isNew).length, 4);
assert.equal(fromFile.workers.find(row => row.name === 'Maja Dąbrowska').values.target, 144);
assert.equal(fromFile.workers.find(row => row.name === 'Łukasz Zieliński').values.defaultManager, true);
assert.equal(fromFile.workers.find(row => row.name === 'Paweł Nowak').values.pair24, 'pair8');
assert.equal(fromFile.availability.length, 4);
assert.equal(fromFile.availability.find(row => row.name === 'Maja Dąbrowska').entries.length, 5);
assert.deepEqual(fromFile.availability.find(row => row.name === 'Paweł Nowak').entries, [{ date: '2026-08-12', period: 'all' }]);

// The realistic ten-person test workbook: the dataset a demo is judged on, so it is
// checked to stay complete and importable.
const demoBook = XLSX.readFile(path.join(__dirname, '..', 'templates', 'Grafik-dane-2026-08-testowy.xlsx'));
const demoTables = demoBook.SheetNames.map(name => ({ name, rows: XLSX.utils.sheet_to_json(demoBook.Sheets[name], { header: 1, raw: true, defval: '' }) }));
const demo = sheetIo.parseSheets(demoTables, { ...context(), workers: [] });
assert.deepEqual(demoBook.SheetNames, ['Instrukcja', 'Pracownicy', 'Dostępność', 'Administrator']);
assert.equal(demo.issues.length, 0, 'the test workbook imports without a single warning: ' + JSON.stringify(demo.issues));
assert.equal(demo.month, '2026-08');
assert.equal(demo.workers.length, 10, 'a full team');
assert.equal(demo.availability.length, 10, 'everybody recorded something');
assert.equal(demo.availability.reduce((total, row) => total + row.entries.length, 0), 44);
assert.equal(demo.workers.filter(row => row.values.managerQualified).length, 4, 'four people can run a manager shift');
assert.equal(demo.workers.filter(row => row.values.defaultManager).length, 1, 'exactly one default manager');
assert.equal(demo.workers.filter(row => row.values.preference === 'night').length, 3);
assert.equal(demo.workers.filter(row => row.values.pair24 !== 'none').length, 5, 'three take any 24h pattern, two a specific one');
assert.equal(demo.workers.filter(row => row.values.pair24 === 'any').length, 3);
assert.ok(demo.workers.every(row => row.values.target >= 120 && row.values.target <= 168), 'targets look like real contracts');
assert.deepEqual(demo.newCategories, ['Nursing']);
const marked = demo.availability.flatMap(row => row.entries.map(entry => entry.period));
assert.ok(marked.filter(period => period === 'all').length > 20, 'holidays and sick days dominate');
assert.ok(marked.includes('day') && marked.includes('night'), 'part-day restrictions appear too');

// A round trip through the in-app template export
const exportApp = {
  workers: [{ id: 'w1', name: 'Łukasz Zieliński', target: 168, preference: 'night', pair24: 'pair20', categories: ['General'], managerQualified: true, defaultManager: true }],
  availability: [{ id: 'a1', workerId: 'w1', date: '2026-08-14', period: 'day' }],
  categories: ['General'], pairings: context().pairings, current: '2026-08'
};
const exported = sheetIo.buildTemplateTables(exportApp, '2026-08');
assert.deepEqual(exported.map(table => table.name), ['Instrukcja', 'Pracownicy', 'Dostępność', 'Administrator']);
assert.deepEqual(exported[1].rows[0], ['Imię i nazwisko', 'Godziny docelowe', 'Preferowana pora', 'Dyżur 24h'],
  'employees only see their own four columns');
assert.deepEqual(exported[3].rows[0], ['Imię i nazwisko', 'Kategorie', 'Uprawnienia kierownika', 'Kierownik domyślny', 'Uwagi']);
assert.equal(exported[3].rows[1][2], 'Tak', 'manager-qualified is exported to the Administrator tab');
const reimported = sheetIo.parseSheets(exported, { ...context(), workers: [] });
assert.equal(reimported.issues.filter(issue => issue.level === 'error').length, 0);
assert.equal(reimported.month, '2026-08');
assert.equal(reimported.workers[0].values.target, 168);
assert.equal(reimported.workers[0].values.preference, 'night');
assert.equal(reimported.workers[0].values.pair24, 'pair20');
assert.equal(reimported.workers[0].values.defaultManager, true);
assert.equal(reimported.workers.length, 1, 'the exported workbook re-imports as one person, not two');
assert.deepEqual(reimported.workers[0].values.categories, ['General']);
assert.equal(reimported.workers[0].values.managerQualified, true);
assert.deepEqual(reimported.availability[0].entries, [{ date: '2026-08-14', period: 'day' }]);

// A file that is not the expected workbook fails loudly instead of silently
const nonsense = sheetIo.parseSheets([{ name: 'Sheet1', rows: [['płatność', 'kwota'], ['faktura', 100]] }], context());
assert.equal(nonsense.workers.length, 0);
assert.equal(nonsense.issues.filter(issue => issue.level === 'error').length, 1);

console.log('sheet import/export tests passed');
