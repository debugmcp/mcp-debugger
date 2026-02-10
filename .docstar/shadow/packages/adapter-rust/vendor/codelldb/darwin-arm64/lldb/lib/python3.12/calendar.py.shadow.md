# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/calendar.py
@source-hash: 3091dbd1070a9286
@generated: 2026-02-09T18:07:15Z

## Purpose and Responsibility
Python standard library calendar module providing calendar printing and date manipulation functions. Implements multiple calendar formatters (text, HTML, locale-aware) and utilities for date calculations. Primary goal is generating formatted calendar displays and providing date-related utilities.

## Key Classes and Functions

### Core Exceptions (L31-43)
- `IllegalMonthError(ValueError)` - Raised for invalid month numbers (must be 1-12)
- `IllegalWeekdayError(ValueError)` - Raised for invalid weekday numbers (must be 0-6)

### Date Constants and Enums (L57-84)
- `Month(IntEnum)` (L59-72) - Global enum for month constants (JANUARY=1, DECEMBER=12)
- `Day(IntEnum)` (L76-84) - Global enum for weekday constants (MONDAY=0, SUNDAY=6)
- `mdays` (L87) - Array of days per month [0, 31, 28, 31, ...]

### Date Calculation Utilities
- `isleap(year)` (L141-143) - Leap year detection using standard algorithm
- `leapdays(y1, y2)` (L146-151) - Count leap years in range using divisibility rules
- `weekday(year, month, day)` (L154-158) - Returns Day enum for given date
- `monthrange(year, month)` (L161-168) - Returns (first_weekday, num_days) for month
- `timegm(tuple)` (L683-690) - Unix timestamp calculation from GMT tuple

### Localization Support (L94-139)
- `_localized_month` (L94-111) - Dynamic month name provider using strftime
- `_localized_day` (L113-130) - Dynamic day name provider using strftime
- Module-level instances: `day_name`, `day_abbr`, `month_name`, `month_abbr` (L132-138)

### Base Calendar Class (L189-323)
- `Calendar` (L189-323) - Abstract base providing data generation without formatting
  - `firstweekday` property (L198-204) - Week start day configuration
  - `itermonthdates()` (L214-221) - Yields datetime.date objects for complete weeks
  - `itermonthdays()` (L223-233) - Yields day numbers (0 for outside month)
  - `itermonthdays2()` (L235-241) - Yields (day, weekday) tuples
  - `itermonthdays3()` (L243-259) - Yields (year, month, day) tuples
  - `monthdatescalendar()` (L269-275) - Returns matrix of datetime.date objects
  - `yeardatescalendar()` (L295-303) - Returns year data as list of month rows

### Text Calendar Formatter (L325-440)
- `TextCalendar(Calendar)` (L325-440) - Plain text calendar formatter mimicking Unix cal
  - `formatday()` (L337-345) - Right-aligned day formatting with centering
  - `formatweek()` (L347-351) - Space-separated week row
  - `formatmonth()` (L384-398) - Complete month with headers and spacing
  - `formatyear()` (L400-435) - Multi-column year layout with configurable spacing

### HTML Calendar Formatter (L442-576)
- `HTMLCalendar(Calendar)` (L442-576) - HTML table-based calendar formatter
  - CSS class configuration (L448-466) for styling hooks
  - `formatday()` (L468-476) - Table cell with CSS classes
  - `formatmonth()` (L510-528) - Complete HTML table for month
  - `formatyearpage()` (L554-575) - Full XHTML page with DOCTYPE and encoding

### Locale-Aware Formatters (L603-642)
- `LocaleTextCalendar(TextCalendar)` (L603-622) - Text formatter with locale support
- `LocaleHTMLCalendar(HTMLCalendar)` (L624-642) - HTML formatter with locale support
- `different_locale` context manager (L578-591) - Temporary locale switching

### Module-Level Interface (L644-661)
Global TextCalendar instance `c` provides backward compatibility functions:
- `setfirstweekday()`, `monthcalendar()`, `prmonth()`, `calendar()` etc.

### Command Line Interface (L693-798)
- `main(args)` (L693-795) - Full argparse-based CLI supporting text/HTML output
- Supports locale, encoding, width, spacing, and layout options

## Dependencies and Relationships
- **datetime** - Core date manipulation and validation
- **locale** - Internationalization support via _locale module
- **enum** - IntEnum base classes with global_enum decorator
- **itertools.repeat** - Efficient padding generation
- **argparse** - Command-line interface (in main())

## Architectural Patterns
1. **Template Method** - Calendar base class defines iteration algorithms, subclasses implement formatting
2. **Strategy Pattern** - Different formatters (Text, HTML, Locale variants) for same data
3. **Factory Pattern** - Module-level functions create appropriate calendar instances
4. **Context Manager** - different_locale for safe locale switching

## Critical Invariants
- Week always starts on configured firstweekday (0=Monday to 6=Sunday)
- Month arrays are 1-indexed (month_name[0] is empty string)
- All calendar matrices represent complete weeks (may include adjacent month days)
- Leap year calculation handles century years correctly (divisible by 400)
- Date validation defers to datetime module for range checking