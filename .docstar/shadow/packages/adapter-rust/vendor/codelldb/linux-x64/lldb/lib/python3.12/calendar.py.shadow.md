# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/calendar.py
@source-hash: 3091dbd1070a9286
@generated: 2026-02-09T18:09:42Z

This is Python's standard calendar module that provides calendar formatting and date calculation functionality for text and HTML output.

## Primary Purpose
Calendar printing and date calculation utilities with support for different output formats (text/HTML), localization, and configurable week start days. Mimics UNIX `cal(1)` functionality with additional features.

## Key Classes and Functions

### Exception Classes (L31-42)
- `IllegalMonthError`: Validates month numbers (1-12)
- `IllegalWeekdayError`: Validates weekday numbers (0-6, Monday-Sunday)

### Enums (L59-83)
- `Month(IntEnum)`: Month constants (JANUARY=1 through DECEMBER=12) with `@global_enum` decorator
- `Day(IntEnum)`: Weekday constants (MONDAY=0 through SUNDAY=6) with `@global_enum` decorator

### Core Date Functions (L141-187)
- `isleap(year)` (L141): Leap year calculation using standard algorithm
- `leapdays(y1, y2)` (L146): Count leap years in range using mathematical formulas
- `weekday(year, month, day)` (L154): Returns Day enum for given date, handles year range limits
- `monthrange(year, month)` (L161): Returns (first_weekday, num_days) tuple for month
- `_monthlen()`, `_prevmonth()`, `_nextmonth()` (L171-186): Internal month navigation helpers

### Localization Classes (L94-138)
- `_localized_month` (L94): Dynamic month name lookup using strftime, 1-based indexing
- `_localized_day` (L113): Dynamic weekday name lookup using strftime, 0-based indexing
- Global instances: `day_name`, `day_abbr`, `month_name`, `month_abbr` for localized names

### Base Calendar Class (L189-323)
- `Calendar` (L189): Abstract base providing data generation methods
  - Configurable first weekday via property (L195-204)
  - Iterator methods: `iterweekdays()`, `itermonthdates()`, `itermonthdays()`, etc. (L206-267)
  - Calendar matrix generators: `monthdatescalendar()`, `monthdays2calendar()`, etc. (L269-322)
  - Year calendar generators with configurable width (L295-322)

### Text Formatting (L325-440)
- `TextCalendar(Calendar)` (L325): Plain text calendar output similar to UNIX cal
  - Day/week/month formatting methods (L337-398)
  - Year formatting with multi-column layout (L400-439)
  - Print methods: `prweek()`, `prmonth()`, `pryear()`

### HTML Formatting (L442-576)
- `HTMLCalendar(Calendar)` (L442): HTML table-based calendar output
  - CSS class configuration (L448-466)
  - HTML element formatting methods (L468-528)
  - Complete HTML page generation with DOCTYPE and encoding (L554-575)

### Locale Support (L578-642)
- `different_locale` (L578): Context manager for temporary locale switching
- `LocaleTextCalendar` and `LocaleHTMLCalendar` (L603-641): Localized versions of formatters

### Module-Level Interface (L644-661)
- Global `TextCalendar` instance `c` for backward compatibility
- Function aliases: `monthcalendar`, `prmonth`, `calendar`, etc. map to instance methods
- `setfirstweekday()` with validation

### Utilities (L663-690)
- `formatstring()` (L673): Multi-column string formatting for year calendars
- `timegm()` (L683): Unix timestamp calculation from GMT tuple

### Command-Line Interface (L693-798)
- `main()`: Full argparse-based CLI with text/HTML output options, locale support, and flexible year/month display

## Key Dependencies
- `datetime`: Core date calculations and `datetime.date` objects
- `enum.IntEnum`: Type-safe constants with `@global_enum` decorator
- `locale`: Localization support for month/day names
- `argparse`: Command-line interface

## Important Patterns
- European convention: Monday=0 as first weekday (configurable)
- 1-based month indexing throughout (consistent with datetime)
- Iterator-based data generation with multiple output formats
- Locale-aware formatting via context managers
- CSS class-based HTML styling with configurable class names
- Complete weeks in calendar output (includes adjacent month days)

## Critical Constraints
- Month numbers must be 1-12, weekdays 0-6
- Year handling accommodates datetime.MINYEAR to datetime.MAXYEAR limits
- HTML output uses XHTML 1.0 Strict DOCTYPE
- Calendar matrices always represent complete weeks (7 days)
- Localized names computed fresh on each access for locale changes