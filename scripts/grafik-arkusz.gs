/**
 * Buduje arkusz „Grafik — dane od pracowników” natywnie w Arkuszach Google.
 *
 * Instalacja: w arkuszu Rozszerzenia → Apps Script, wklej ten plik, zapisz,
 * odśwież arkusz. W menu pojawi się „Grafik”.
 *
 * Układ zakładek i kody muszą się zgadzać z importerem w src/sheet-io.ts oraz
 * z generatorem scripts/make-sheet-template.py — zmieniaj je razem.
 */

var INK = '#10281E';
var ACCENT = '#1D7645';
var MINT = '#EDF9F1';
var LINE = '#DCE6E1';
var MUTED = '#6B7A72';
var BAND = '#F8FBF9';
var WEEKEND = '#EFF3F1';
var PAPER = '#FFFFFF';

var CODES = [
  { code: 'X', background: '#FCE3E3', ink: '#8C2F2F', short: 'cały dzień', long: 'niedostępny przez cały dzień (urlop, L4)' },
  { code: 'D', background: '#FDEFD5', ink: '#8A5A12', short: 'rano / dzień', long: 'niedostępny rano i w dzień — noce są w porządku' },
  { code: 'N', background: '#E2E4FA', ink: '#3A3E8F', short: 'noc', long: 'niedostępny w nocy — dni są w porządku' }
];

var WEEKDAYS_PL = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So'];
var MONTHS_PL = ['styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec',
                 'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'];

var WORKER_COLUMNS = [
  { label: 'Imię i nazwisko', width: 190, note: 'Tak samo jak w zakładce Dostępność — najlepiej wybierz siebie z listy.' },
  { label: 'Godziny docelowe', width: 110, note: 'Ile godzin chcesz przepracować w tym miesiącu. Liczba, np. 160.' },
  { label: 'Preferowana pora', width: 125, note: 'Dzień, Noc albo Bez preferencji.' },
  { label: 'Dyżur 24h', width: 125, note: 'Czy bierzesz dyżury 24-godzinne i w jakim układzie.' },
  { label: 'Kategorie', width: 150, note: 'Twoje kwalifikacje, po przecinku. Domyślnie: General.' },
  { label: 'Uprawnienia kierownika', width: 140, note: 'Tak, jeśli możesz pełnić zmianę kierownika.' },
  { label: 'Kierownik domyślny', width: 130, note: 'Tak tylko dla jednej osoby w zespole.' },
  { label: 'Uwagi', width: 220, note: 'Pole dowolne — program je pomija.' }
];

var PERIOD_CHOICES = ['Dzień', 'Noc', 'Bez preferencji'];
var PAIR_CHOICES = ['Nie', 'Dowolny', '08:00 → 08:00', '20:00 → 20:00'];
var YES_NO = ['Tak', 'Nie'];

var WORKER_HEADER_ROW = 3;
var WORKER_FIRST_ROW = 4;
var AVAILABILITY_HEADER_ROW = 4;
var AVAILABILITY_FIRST_ROW = 5;
var DEFAULT_ROWS = 30;

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Grafik')
    .addItem('Utwórz arkusz na miesiąc…', 'utworzArkusze')
    .addItem('Wyczyść dostępność i ustaw nowy miesiąc…', 'nowyMiesiac')
    .addToUi();
}

function askForMonth(caption) {
  var ui = SpreadsheetApp.getUi();
  var today = new Date();
  var suggested = Utilities.formatDate(new Date(today.getFullYear(), today.getMonth() + 1, 1),
                                       Session.getScriptTimeZone(), 'yyyy-MM');
  var answer = ui.prompt(caption, 'Miesiąc w formacie RRRR-MM (np. ' + suggested + '):', ui.ButtonSet.OK_CANCEL);
  if (answer.getSelectedButton() !== ui.Button.OK) return null;
  var value = answer.getResponseText().trim();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
    ui.alert('Nieprawidłowy miesiąc', 'Podaj miesiąc w formacie RRRR-MM, np. ' + suggested + '.', ui.ButtonSet.OK);
    return null;
  }
  return value;
}

function utworzArkusze() {
  var month = askForMonth('Nowy arkusz danych');
  if (!month) return;
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  budujInstrukcje(freshSheet(spreadsheet, 'Instrukcja', 0), month);
  var workers = budujPracownikow(freshSheet(spreadsheet, 'Pracownicy', 1), month);
  budujDostepnosc(freshSheet(spreadsheet, 'Dostępność', 2), month, workers);
  removeEmptyDefaultSheet(spreadsheet);
  spreadsheet.setActiveSheet(spreadsheet.getSheetByName('Instrukcja'));
  SpreadsheetApp.getUi().alert('Gotowe', 'Arkusz na ' + nazwaMiesiaca(month) + ' jest gotowy. Wyślij link zespołowi.', SpreadsheetApp.getUi().ButtonSet.OK);
}

function nowyMiesiac() {
  var month = askForMonth('Nowy miesiąc');
  if (!month) return;
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var workers = spreadsheet.getSheetByName('Pracownicy');
  if (!workers) { SpreadsheetApp.getUi().alert('Brak zakładki „Pracownicy”. Użyj najpierw „Utwórz arkusz na miesiąc…”.'); return; }
  var range = { first: WORKER_FIRST_ROW, last: WORKER_FIRST_ROW + DEFAULT_ROWS - 1 };
  var sheet = freshSheet(spreadsheet, 'Dostępność', 2);
  budujDostepnosc(sheet, month, range);
  // Nazwiska przenoszą się z „Pracowników”, żeby zespół nie wpisywał ich ponownie.
  var names = workers.getRange(range.first, 1, DEFAULT_ROWS, 1).getValues();
  sheet.getRange(AVAILABILITY_FIRST_ROW, 1, DEFAULT_ROWS, 1).setValues(names);
}

function freshSheet(spreadsheet, name, position) {
  var existing = spreadsheet.getSheetByName(name);
  if (existing) spreadsheet.deleteSheet(existing);
  var sheet = spreadsheet.insertSheet(name, position);
  sheet.setHiddenGridlines(true);
  return sheet;
}

/**
 * insertSheet() daje arkusz 26 kolumn × 1000 wierszy, a siatka dostępności
 * potrzebuje 33 kolumn. Bez tego getRange() na kolumnie 27 zgłasza błąd
 * „zakres poza arkuszem” i budowanie przerywa się w połowie.
 */
function ensureSize(sheet, rows, columns) {
  var maxColumns = sheet.getMaxColumns();
  if (maxColumns < columns) sheet.insertColumnsAfter(maxColumns, columns - maxColumns);
  else if (maxColumns > columns) sheet.deleteColumns(columns + 1, maxColumns - columns);
  var maxRows = sheet.getMaxRows();
  if (maxRows < rows) sheet.insertRowsAfter(maxRows, rows - maxRows);
  else if (maxRows > rows) sheet.deleteRows(rows + 1, maxRows - rows);
}

// Świeży arkusz Google ma jedną pustą zakładkę o nazwie zależnej od języka.
var DEFAULT_SHEET_NAMES = ['Sheet1', 'Sheet 1', 'Arkusz1', 'Arkusz 1', 'Feuille 1', 'Feuille1',
                           'Hoja 1', 'Hoja1', 'Tabelle1', 'Foglio1', 'Blad1', 'Лист1'];

function removeEmptyDefaultSheet(spreadsheet) {
  if (spreadsheet.getSheets().length < 2) return;
  spreadsheet.getSheets().forEach(function (sheet) {
    if (DEFAULT_SHEET_NAMES.indexOf(sheet.getName()) >= 0 && sheet.getLastRow() === 0 && spreadsheet.getSheets().length > 1) {
      spreadsheet.deleteSheet(sheet);
    }
  });
}

function nazwaMiesiaca(month) {
  var parts = month.split('-');
  return MONTHS_PL[Number(parts[1]) - 1] + ' ' + parts[0];
}

function budujInstrukcje(sheet, month) {
  sheet.setTabColor(ACCENT);

  var rows = [
    ['', 'Grafik — dane od pracowników', 'title'],
    ['', nazwaMiesiaca(month) + ' · wypełnij swój wiersz w obu zakładkach, zajmuje to około dwóch minut', 'lead'],
    ['', '', 'gap'],
    ['1', 'Zakładka „Pracownicy”', 'step'],
    ['', 'Znajdź swoje imię i nazwisko albo dopisz je w pierwszym wolnym wierszu. Uzupełnij, ile godzin chcesz ' +
         'przepracować, jaką porę dnia wolisz i czy bierzesz dyżury 24h. Komórki z listą rozwijaną wypełnij ' +
         'wyłącznie wartościami z listy.', 'body'],
    ['', '', 'gap'],
    ['2', 'Zakładka „Dostępność”', 'step'],
    ['', 'W swoim wierszu zaznacz tylko te dni, w których NIE możesz pracować. Puste pole znaczy, że jesteś ' +
         'dostępny — przy dniach, w które możesz pracować, nie wpisuj niczego.', 'body'],
    ['', '', 'gap'],
    ['', 'Kody dostępności', 'head']
  ];
  CODES.forEach(function (entry) { rows.push([entry.code, entry.long, 'code']); });
  rows.push(['', 'puste pole — jestem dostępny', 'body']);
  rows.push(['', '', 'gap']);
  rows.push(['', 'O czym pamiętać', 'head']);
  rows.push(['', 'Imię i nazwisko musi brzmieć tak samo w obu zakładkach — w „Dostępności” wybierz je z listy.', 'body']);
  rows.push(['', 'Nie zmieniaj nazw zakładek ani nagłówków kolumn — po nich program rozpoznaje dane.', 'body']);
  rows.push(['', 'Możesz dopisywać wiersze na dole i dodawać własne kolumny; program pomija to, czego nie zna.', 'body']);
  rows.push(['', '', 'gap']);
  rows.push(['', 'Dla osoby układającej grafik', 'head']);
  rows.push(['', 'Gdy zespół skończy: Plik → Pobierz → Microsoft Excel (.xlsx), a następnie w programie Shiftwise ' +
                 'zakładka Workers → Import from sheet. Przed zapisem zobaczysz podgląd wszystkich zmian.', 'body']);

  ensureSize(sheet, rows.length + 2, 2);
  sheet.setColumnWidth(1, 40);
  sheet.setColumnWidth(2, 720);
  sheet.getRange(1, 1, rows.length, 2).setValues(rows.map(function (row) { return [row[0], row[1]]; }));
  rows.forEach(function (row, index) {
    var line = index + 1;
    var marker = sheet.getRange(line, 1);
    var body = sheet.getRange(line, 2);
    var style = row[2];
    if (style === 'title') { body.setFontSize(20).setFontWeight('bold').setFontColor(INK); sheet.setRowHeight(line, 34); }
    else if (style === 'lead') { body.setFontSize(11).setFontColor(MUTED); }
    else if (style === 'step') {
      marker.setBackground(ACCENT).setFontColor('#FFFFFF').setFontWeight('bold').setHorizontalAlignment('center');
      body.setFontSize(12).setFontWeight('bold').setFontColor(INK);
      sheet.setRowHeight(line, 26);
    } else if (style === 'body') { body.setFontSize(10).setFontColor(INK).setWrap(true); }
    else if (style === 'code') {
      var entry = CODES.filter(function (item) { return item.code === row[0]; })[0];
      marker.setBackground(entry.background).setFontColor(entry.ink).setFontWeight('bold')
            .setHorizontalAlignment('center').setBorder(true, true, true, true, false, false, LINE, SpreadsheetApp.BorderStyle.SOLID);
      body.setFontSize(10).setFontColor(INK);
    } else if (style === 'head') { body.setFontSize(11).setFontWeight('bold').setFontColor(ACCENT); sheet.setRowHeight(line, 28); }
    else { sheet.setRowHeight(line, 10); }
  });
}

function budujPracownikow(sheet, month) {
  sheet.setTabColor(INK);
  var last = WORKER_FIRST_ROW + DEFAULT_ROWS - 1;
  ensureSize(sheet, last + 20, WORKER_COLUMNS.length);

  sheet.getRange(1, 1).setValue('Pracownicy').setFontSize(14).setFontWeight('bold').setFontColor(INK);
  sheet.getRange(2, 1).setValue('Jeden wiersz na osobę · ' + nazwaMiesiaca(month)).setFontSize(10).setFontColor(MUTED);

  var labels = WORKER_COLUMNS.map(function (column) { return column.label; });
  var header = sheet.getRange(WORKER_HEADER_ROW, 1, 1, labels.length);
  header.setValues([labels])
        .setBackground(INK).setFontColor('#FFFFFF').setFontWeight('bold')
        .setHorizontalAlignment('center').setVerticalAlignment('middle').setWrap(true)
        .setBorder(null, null, true, null, null, null, ACCENT, SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  sheet.setRowHeight(WORKER_HEADER_ROW, 34);
  WORKER_COLUMNS.forEach(function (column, index) {
    sheet.setColumnWidth(index + 1, column.width);
    sheet.getRange(WORKER_HEADER_ROW, index + 1).setNote(column.note);
  });

  var body = sheet.getRange(WORKER_FIRST_ROW, 1, DEFAULT_ROWS, labels.length);
  body.setBorder(true, true, true, true, true, true, LINE, SpreadsheetApp.BorderStyle.SOLID)
      .setVerticalAlignment('middle');
  sheet.getRange(WORKER_FIRST_ROW, 2, DEFAULT_ROWS, 1).setNumberFormat('0 "h"').setHorizontalAlignment('center');
  sheet.getRange(WORKER_FIRST_ROW, 3, DEFAULT_ROWS, 2).setHorizontalAlignment('center');
  sheet.getRange(WORKER_FIRST_ROW, 6, DEFAULT_ROWS, 2).setHorizontalAlignment('center');
  for (var row = WORKER_FIRST_ROW + 1; row <= last; row += 2) {
    sheet.getRange(row, 1, 1, labels.length).setBackground(BAND);
  }

  listRule(sheet.getRange(WORKER_FIRST_ROW, 3, DEFAULT_ROWS, 1), PERIOD_CHOICES, 'Dzień, Noc albo Bez preferencji.');
  listRule(sheet.getRange(WORKER_FIRST_ROW, 4, DEFAULT_ROWS, 1), PAIR_CHOICES, 'Nie, Dowolny albo konkretny układ 24-godzinny.');
  listRule(sheet.getRange(WORKER_FIRST_ROW, 6, DEFAULT_ROWS, 1), YES_NO, 'Tak albo Nie.');
  listRule(sheet.getRange(WORKER_FIRST_ROW, 7, DEFAULT_ROWS, 1), YES_NO, 'Tak tylko dla jednej osoby w zespole.');
  sheet.getRange(WORKER_FIRST_ROW, 2, DEFAULT_ROWS, 1).setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireNumberBetween(0, 400)
      .setAllowInvalid(false)
      .setHelpText('Podaj liczbę godzin z zakresu 0–400.')
      .build());

  sheet.setFrozenRows(WORKER_HEADER_ROW);
  return { first: WORKER_FIRST_ROW, last: last };
}

function listRule(range, choices, help) {
  range.setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(choices, true)
      .setAllowInvalid(false)
      .setHelpText(help)
      .build());
}

function budujDostepnosc(sheet, month, workers) {
  sheet.setTabColor(ACCENT);
  var parts = month.split('-');
  var year = Number(parts[0]);
  var monthIndex = Number(parts[1]);
  var days = new Date(year, monthIndex, 0).getDate();
  var lastDayColumn = days + 1;
  var totalColumn = days + 2;
  var last = AVAILABILITY_FIRST_ROW + DEFAULT_ROWS - 1;
  ensureSize(sheet, last + 20, totalColumn);

  sheet.getRange(1, 1).setValue('Miesiąc').setFontWeight('bold').setFontColor(MUTED).setHorizontalAlignment('right');
  sheet.getRange(1, 2)
       .setNumberFormat('@')  // najpierw tekst, inaczej Arkusze zrobią z tego datę
       .setValue(month).setFontWeight('bold').setFontColor(ACCENT).setBackground(MINT)
       .setHorizontalAlignment('center')
       .setBorder(true, true, true, true, false, false, LINE, SpreadsheetApp.BorderStyle.SOLID);
  sheet.getRange(1, 4).setValue('Zaznacz tylko te dni, w których NIE możesz pracować — ' + nazwaMiesiaca(month))
       .setFontWeight('bold').setFontColor(INK);

  var column = 4;
  CODES.forEach(function (entry) {
    sheet.getRange(2, column).setValue(entry.code).setBackground(entry.background).setFontColor(entry.ink)
         .setFontWeight('bold').setHorizontalAlignment('center')
         .setBorder(true, true, true, true, false, false, LINE, SpreadsheetApp.BorderStyle.SOLID);
    sheet.getRange(2, column + 1).setValue(entry.short).setFontSize(9).setFontColor(MUTED);
    column += 6;
  });
  sheet.getRange(2, column).setValue('puste = dostępny').setFontSize(9).setFontColor(MUTED);

  sheet.getRange(3, 1).setValue('Dzień tygodnia').setFontSize(9).setFontStyle('italic')
       .setFontColor(MUTED).setHorizontalAlignment('right');

  var weekdays = [];
  var numbers = [];
  var weekendColumns = [];
  for (var day = 1; day <= days; day++) {
    var weekday = new Date(year, monthIndex - 1, day).getDay();
    weekdays.push(WEEKDAYS_PL[weekday]);
    numbers.push(day);
    if (weekday === 0 || weekday === 6) weekendColumns.push(day + 1);
    sheet.setColumnWidth(day + 1, 30);
  }
  sheet.getRange(3, 2, 1, days).setValues([weekdays]).setFontSize(9).setFontColor(MUTED).setHorizontalAlignment('center');

  sheet.getRange(AVAILABILITY_HEADER_ROW, 1).setValue('Imię i nazwisko');
  sheet.getRange(AVAILABILITY_HEADER_ROW, 2, 1, days).setValues([numbers]);
  sheet.getRange(AVAILABILITY_HEADER_ROW, totalColumn).setValue('Razem');
  sheet.getRange(AVAILABILITY_HEADER_ROW, 1, 1, totalColumn)
       .setBackground(INK).setFontColor('#FFFFFF').setFontWeight('bold')
       .setHorizontalAlignment('center').setVerticalAlignment('middle')
       .setBorder(null, null, true, null, null, null, ACCENT, SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  sheet.getRange(AVAILABILITY_HEADER_ROW, 1).setHorizontalAlignment('left');
  sheet.setColumnWidth(1, 190);
  sheet.setColumnWidth(totalColumn, 60);

  var body = sheet.getRange(AVAILABILITY_FIRST_ROW, 1, DEFAULT_ROWS, totalColumn);
  body.setBorder(true, true, true, true, true, true, LINE, SpreadsheetApp.BorderStyle.SOLID)
      .setVerticalAlignment('middle');
  sheet.getRange(AVAILABILITY_FIRST_ROW, 2, DEFAULT_ROWS, days).setHorizontalAlignment('center');
  for (var row = AVAILABILITY_FIRST_ROW + 1; row <= last; row += 2) {
    sheet.getRange(row, 1, 1, totalColumn).setBackground(BAND);
  }
  weekendColumns.forEach(function (index) {
    sheet.getRange(AVAILABILITY_FIRST_ROW, index, DEFAULT_ROWS, 1).setBackground(WEEKEND);
    sheet.getRange(3, index).setBackground(WEEKEND).setFontWeight('bold');
  });

  var totals = [];
  for (var line = AVAILABILITY_FIRST_ROW; line <= last; line++) {
    totals.push(['=COUNTA(' + columnLetter(2) + line + ':' + columnLetter(lastDayColumn) + line + ')']);
  }
  sheet.getRange(AVAILABILITY_FIRST_ROW, totalColumn, totals.length, 1)
       .setFormulas(totals).setFontWeight('bold').setFontColor(MUTED).setHorizontalAlignment('center');

  var names = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Pracownicy')
                .getRange(workers.first, 1, workers.last - workers.first + 1, 1);
  sheet.getRange(AVAILABILITY_FIRST_ROW, 1, DEFAULT_ROWS, 1).setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInRange(names, true)
      .setAllowInvalid(true)
      .setHelpText('Wybierz siebie z listy z zakładki Pracownicy.')
      .build());

  var grid = sheet.getRange(AVAILABILITY_FIRST_ROW, 2, DEFAULT_ROWS, days);
  grid.setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(CODES.map(function (entry) { return entry.code; }), true)
      .setAllowInvalid(false)
      .setHelpText('X = cały dzień, D = rano / dzień, N = noc. Puste pole = jestem dostępny.')
      .build());

  sheet.setConditionalFormatRules(CODES.map(function (entry) {
    return SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo(entry.code)
      .setBackground(entry.background)
      .setFontColor(entry.ink)
      .setBold(true)
      .setRanges([grid])
      .build();
  }));

  sheet.setFrozenRows(AVAILABILITY_HEADER_ROW);
  sheet.setFrozenColumns(1);
}

function columnLetter(index) {
  var letters = '';
  while (index > 0) {
    var remainder = (index - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    index = Math.floor((index - remainder) / 26);
  }
  return letters;
}
