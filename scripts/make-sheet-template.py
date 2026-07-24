#!/usr/bin/env python3
"""Generate the Polish employee data-collection workbook for Shiftwise.

The workbook is uploaded to Google Drive, filled in by the employees, downloaded
again as .xlsx (or .csv) and imported through Workers -> Import from sheet.

The tab names, header labels and cell codes written here are the ones the
importer understands. They are mirrored in src/sheet-io.ts (SHEET_NAMES,
HEADER_SYNONYMS, VALUE_SYNONYMS); change both sides together.

    python3 scripts/make-sheet-template.py --month 2026-08 --rows 30
"""

import argparse
import calendar
import datetime as dt
import os

from openpyxl import Workbook
from openpyxl.formatting.rule import CellIsRule
from openpyxl.comments import Comment
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

INK = '1F2430'
ACCENT = '4F46E5'
MUTED = '6B7280'
LINE = 'D8DCE6'
WEEKEND_FILL = 'EEF0F5'
CODE_FILLS = {'X': 'FBD5D5', 'D': 'FDE7C3', 'N': 'D9DBF7'}

WEEKDAYS_PL = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd']

PERIOD_CHOICES = ['Dzień', 'Noc', 'Bez preferencji']
PAIR_CHOICES = ['Nie', 'Dowolny', '08:00 → 08:00', '20:00 → 20:00']
YES_NO = ['Tak', 'Nie']

WORKER_COLUMNS = [
    ('Imię i nazwisko', 30, 'Dokładnie tak samo jak w zakładce Dostępność.'),
    ('Godziny docelowe', 16, 'Ile godzin chcesz przepracować w tym miesiącu.'),
    ('Preferowana pora', 18, 'Dzień, Noc albo Bez preferencji.'),
    ('Dyżur 24h', 18, 'Czy chcesz dyżury 24-godzinne i w jakim układzie.'),
    ('Kategorie', 24, 'Kwalifikacje, po przecinku. Domyślnie: General.'),
    ('Uprawnienia kierownika', 20, 'Tak, jeśli możesz pełnić zmianę kierownika.'),
    ('Kierownik domyślny', 18, 'Tak tylko dla jednej osoby w zespole.'),
    ('Uwagi', 34, 'Pole dowolne — program je pomija.'),
]

INSTRUCTIONS = [
    ('title', 'Grafik — dane od pracowników'),
    ('lead', 'Wypełnij swój wiersz w obu zakładkach. Zajmuje to około dwóch minut.'),
    ('gap', ''),
    ('head', 'Krok 1 — zakładka „Pracownicy”'),
    ('body', 'Znajdź swoje imię i nazwisko (albo dopisz je w pierwszym wolnym wierszu) i uzupełnij: '
             'ile godzin chcesz przepracować w tym miesiącu, jaką porę dnia wolisz i czy bierzesz dyżury 24h. '
             'Kolumny z listą rozwijaną wypełnij wyłącznie wartościami z listy.'),
    ('gap', ''),
    ('head', 'Krok 2 — zakładka „Dostępność”'),
    ('body', 'W swoim wierszu zaznacz dni, w których NIE możesz pracować. Puste pole oznacza, że jesteś dostępny — '
             'nie musisz nic wpisywać przy dniach, w które możesz pracować.'),
    ('gap', ''),
    ('head', 'Legenda kodów dostępności'),
    ('code', 'X    niedostępny przez cały dzień (np. urlop, L4)'),
    ('code', 'D    niedostępny rano i w dzień — zmiany nocne są w porządku'),
    ('code', 'N    niedostępny w nocy — zmiany dzienne są w porządku'),
    ('code', '     puste pole — jestem dostępny'),
    ('gap', ''),
    ('head', 'O czym pamiętać'),
    ('body', '• Imię i nazwisko musi brzmieć tak samo w obu zakładkach — w zakładce „Dostępność” wybierz je z listy.'),
    ('body', '• Nie zmieniaj nazw zakładek ani nagłówków kolumn — po nich program rozpoznaje dane.'),
    ('body', '• Możesz dopisywać wiersze na dole i dodawać własne kolumny; program pomija to, czego nie zna.'),
    ('body', '• Miesiąc, którego dotyczy arkusz, jest wpisany w komórce B1 zakładki „Dostępność”.'),
    ('gap', ''),
    ('head', 'Dla osoby układającej grafik'),
    ('body', 'Gdy zespół skończy wypełniać: Plik → Pobierz → Microsoft Excel (.xlsx). '
             'Następnie w programie Shiftwise: zakładka Workers → Import from sheet → wskaż pobrany plik. '
             'Przed zapisem zobaczysz podgląd tego, co zostanie zmienione.'),
]


def style_header_cell(cell):
    cell.font = Font(bold=True, color='FFFFFF', size=11)
    cell.fill = PatternFill('solid', fgColor=INK)
    cell.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
    cell.border = Border(bottom=Side(style='thin', color=INK))


def build_instructions(sheet):
    sheet.sheet_view.showGridLines = False
    sheet.column_dimensions['A'].width = 108
    row = 1
    for kind, text in INSTRUCTIONS:
        cell = sheet.cell(row=row, column=1, value=text)
        if kind == 'title':
            cell.font = Font(bold=True, size=20, color=INK)
            sheet.row_dimensions[row].height = 32
        elif kind == 'lead':
            cell.font = Font(size=12, color=MUTED)
            sheet.row_dimensions[row].height = 22
        elif kind == 'head':
            cell.font = Font(bold=True, size=12, color=ACCENT)
            sheet.row_dimensions[row].height = 24
        elif kind == 'code':
            cell.font = Font(size=11, name='Menlo', color=INK)
            sheet.row_dimensions[row].height = 18
        elif kind == 'gap':
            sheet.row_dimensions[row].height = 8
        else:
            cell.font = Font(size=11, color=INK)
            cell.alignment = Alignment(wrap_text=True, vertical='top')
            sheet.row_dimensions[row].height = 16 * (1 + len(text) // 96)
        row += 1


SAMPLE_WORKERS = [
    ('Łukasz Zieliński', 160, 'Dzień', 'Nie', 'General', 'Tak', 'Tak', ''),
    ('Agnieszka Wójcik', 152, 'Noc', 'Dowolny', 'General', 'Nie', 'Nie', 'Wolę bloki nocne.'),
    ('Paweł Nowak', 168, 'Bez preferencji', '08:00 → 08:00', 'General', 'Tak', 'Nie', ''),
    ('Maja Dąbrowska', 144, 'Dzień', 'Nie', 'General', 'Nie', 'Nie', 'Urlop w drugim tygodniu.'),
]
# {imię: {dzień: kod}} — pokazuje pracownikom, jak wygląda wypełniony arkusz.
SAMPLE_AVAILABILITY = {
    'Łukasz Zieliński': {3: 'N', 4: 'N', 17: 'X'},
    'Agnieszka Wójcik': {8: 'D', 9: 'D', 22: 'X', 23: 'X'},
    'Paweł Nowak': {12: 'X'},
    'Maja Dąbrowska': {10: 'X', 11: 'X', 12: 'X', 13: 'X', 14: 'X'},
}


def build_workers(sheet, rows, sample=False):
    sheet.sheet_view.showGridLines = False
    sheet.freeze_panes = 'A2'
    # Hints live in header comments, not in a row of their own: a text row under the
    # header would be read back as a worker called "Ile godzin chcesz przepracować…".
    for index, (label, width, hint) in enumerate(WORKER_COLUMNS, start=1):
        letter = get_column_letter(index)
        sheet.column_dimensions[letter].width = width
        header = sheet.cell(row=1, column=index, value=label)
        style_header_cell(header)
        header.comment = Comment(hint, 'Grafik', height=90, width=260)
    sheet.row_dimensions[1].height = 30

    first, last = 2, 1 + rows
    validations = [
        ('C', PERIOD_CHOICES, 'Preferowana pora', 'Wybierz: Dzień, Noc albo Bez preferencji.'),
        ('D', PAIR_CHOICES, 'Dyżur 24h', 'Nie, Dowolny albo konkretny układ 24-godzinny.'),
        ('F', YES_NO, 'Uprawnienia kierownika', 'Tak albo Nie.'),
        ('G', YES_NO, 'Kierownik domyślny', 'Tak tylko dla jednej osoby w zespole.'),
    ]
    for letter, choices, title, prompt in validations:
        rule = DataValidation(
            type='list',
            formula1='"' + ','.join(choices) + '"',
            allow_blank=True,
            showDropDown=False,
            errorTitle=title,
            error=prompt,
            promptTitle=title,
            prompt=prompt,
        )
        sheet.add_data_validation(rule)
        rule.add('%s%d:%s%d' % (letter, first, letter, last))

    hours = DataValidation(
        type='whole', operator='between', formula1=0, formula2=400, allow_blank=True,
        errorTitle='Godziny docelowe', error='Podaj liczbę godzin z zakresu 0–400.',
    )
    sheet.add_data_validation(hours)
    hours.add('B%d:B%d' % (first, last))

    thin = Side(style='thin', color=LINE)
    for row in range(first, last + 1):
        for column in range(1, len(WORKER_COLUMNS) + 1):
            cell = sheet.cell(row=row, column=column)
            cell.border = Border(bottom=thin, right=thin)
            cell.alignment = Alignment(vertical='center')
        sheet.cell(row=row, column=5).value = 'General'
    if sample:
        for offset, values in enumerate(SAMPLE_WORKERS):
            for column, value in enumerate(values, start=1):
                if value != '':
                    sheet.cell(row=first + offset, column=column).value = value
    return first, last


def build_availability(sheet, year, month, rows, worker_rows, sample=False):
    sheet.sheet_view.showGridLines = False
    days = calendar.monthrange(year, month)[1]

    label = sheet.cell(row=1, column=1, value='Miesiąc')
    label.font = Font(bold=True, size=11, color=INK)
    value = sheet.cell(row=1, column=2, value='%04d-%02d' % (year, month))
    value.font = Font(bold=True, size=11, color=ACCENT)
    value.alignment = Alignment(horizontal='left')
    hint = sheet.cell(row=1, column=3, value='Format RRRR-MM. Zmień, jeśli arkusz dotyczy innego miesiąca.')
    hint.font = Font(size=9, italic=True, color=MUTED)

    legend = sheet.cell(row=2, column=3, value='X = cały dzień   ·   D = rano / dzień   ·   N = noc   ·   puste = dostępny')
    legend.font = Font(size=10, color=MUTED)

    weekday_label = sheet.cell(row=3, column=1, value='Dzień tygodnia')
    weekday_label.font = Font(size=9, italic=True, color=MUTED)
    weekday_label.alignment = Alignment(horizontal='right', vertical='center')

    name_header = sheet.cell(row=4, column=1, value='Imię i nazwisko')
    style_header_cell(name_header)
    sheet.column_dimensions['A'].width = 30
    sheet.row_dimensions[4].height = 24

    weekend_columns = []
    for day in range(1, days + 1):
        column = day + 1
        letter = get_column_letter(column)
        sheet.column_dimensions[letter].width = 4.4
        weekday = dt.date(year, month, day).weekday()
        weekday_cell = sheet.cell(row=3, column=column, value=WEEKDAYS_PL[weekday])
        weekday_cell.font = Font(size=9, color=MUTED)
        weekday_cell.alignment = Alignment(horizontal='center')
        day_cell = sheet.cell(row=4, column=column, value=day)
        style_header_cell(day_cell)
        if weekday >= 5:
            weekend_columns.append(column)
            weekday_cell.fill = PatternFill('solid', fgColor=WEEKEND_FILL)

    first, last = 5, 4 + rows
    thin = Side(style='thin', color=LINE)
    for row in range(first, last + 1):
        sheet.cell(row=row, column=1).border = Border(bottom=thin, right=thin)
        for column in range(2, days + 2):
            cell = sheet.cell(row=row, column=column)
            cell.border = Border(bottom=thin, right=thin)
            cell.alignment = Alignment(horizontal='center', vertical='center')
            if column in weekend_columns:
                cell.fill = PatternFill('solid', fgColor=WEEKEND_FILL)

    names = DataValidation(
        type='list',
        formula1='=Pracownicy!$A$%d:$A$%d' % worker_rows,
        allow_blank=True,
        showDropDown=False,
        promptTitle='Imię i nazwisko',
        prompt='Wybierz siebie z listy z zakładki Pracownicy.',
    )
    sheet.add_data_validation(names)
    names.add('A%d:A%d' % (first, last))

    codes = DataValidation(
        type='list',
        formula1='"X,D,N"',
        allow_blank=True,
        showDropDown=False,
        errorTitle='Kod dostępności',
        error='Dozwolone kody: X (cały dzień), D (rano / dzień), N (noc). Puste pole = jestem dostępny.',
        promptTitle='Niedostępność',
        prompt='X = cały dzień, D = rano / dzień, N = noc. Puste = dostępny.',
    )
    sheet.add_data_validation(codes)
    grid = 'B%d:%s%d' % (first, get_column_letter(days + 1), last)
    codes.add(grid)

    for code, colour in CODE_FILLS.items():
        sheet.conditional_formatting.add(grid, CellIsRule(
            operator='equal',
            formula=['"%s"' % code],
            fill=PatternFill('solid', fgColor=colour),
        ))

    if sample:
        for offset, (name, codes) in enumerate(SAMPLE_AVAILABILITY.items()):
            sheet.cell(row=first + offset, column=1).value = name
            for day, code in codes.items():
                if day <= days:
                    sheet.cell(row=first + offset, column=day + 1).value = code

    sheet.freeze_panes = 'B5'


def build_workbook(year, month, rows, sample=False):
    workbook = Workbook()
    instructions = workbook.active
    instructions.title = 'Instrukcja'
    build_instructions(instructions)
    workers = workbook.create_sheet('Pracownicy')
    worker_rows = build_workers(workers, rows, sample)
    availability = workbook.create_sheet('Dostępność')
    build_availability(availability, year, month, rows, worker_rows, sample)
    return workbook


def next_month(today):
    return (today.year + 1, 1) if today.month == 12 else (today.year, today.month + 1)


def main():
    default_year, default_month = next_month(dt.date.today())
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--month', default='%04d-%02d' % (default_year, default_month),
                        help='Miesiąc arkusza w formacie RRRR-MM (domyślnie następny miesiąc).')
    parser.add_argument('--rows', type=int, default=30, help='Liczba pustych wierszy pracowników.')
    parser.add_argument('--out', default=None, help='Ścieżka pliku wyjściowego .xlsx.')
    parser.add_argument('--sample', action='store_true', help='Wypełnij arkusz przykładowymi danymi.')
    options = parser.parse_args()

    year, month = (int(part) for part in options.month.split('-'))
    suffix = '-przyklad' if options.sample else ''
    output = options.out or os.path.join('templates', 'Grafik-dane-%04d-%02d%s.xlsx' % (year, month, suffix))
    os.makedirs(os.path.dirname(output) or '.', exist_ok=True)
    build_workbook(year, month, options.rows, options.sample).save(output)
    print('Zapisano %s' % output)


if __name__ == '__main__':
    main()
