# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/calendar.py
@source-hash: 3091dbd1070a9286
@generated: 2026-02-09T18:12:55Z

Python calendar module providing comprehensive calendar functionality with text and HTML output capabilities.

## Core Purpose
Provides calendar generation and formatting for dates, months, and years. Supports both text (UNIX cal-like) and HTML output formats with locale-aware internationalization.

## Key Components

### Exceptions (L31-42)
- `IllegalMonthError`: Validates month range 1-12
- `IllegalWeekdayError`: Validates weekday range 0-6 (Monday-Sunday)

### Enums and Constants (L58-84)
- `Month`: IntEnum for months JANUARY(1) through DECEMBER(12)
- `Day`: IntEnum for weekdays MONDAY(0) through SUNDAY(6)
- `mdays` (L87): Days per month lookup table [0,31,28,31,...]

### Date Utilities (L141-187)
- `isleap(year)` (L141): Leap year calculation using 4/100/400 rule
- `leapdays(y1, y2)` (L146): Count leap years in range
- `weekday(year, month, day)` (L154): Returns Day enum for date
- `monthrange(year, month)` (L161): Returns (first_weekday, num_days) tuple
- Helper functions: `_monthlen`, `_prevmonth`, `_nextmonth` (L171-186)

### Localization Support (L94-138)
- `_localized_month`: Dynamic month name formatting using strftime
- `_localized_day`: Dynamic weekday name formatting using strftime
- Global instances: `day_name`, `day_abbr`, `month_name`, `month_abbr`
- `different_locale` context manager (L578-591) for temporary locale switching

### Base Calendar Class (L189-322)
`Calendar` - Abstract base providing data structures:
- `firstweekday` property for week start configuration
- Iterator methods: `iterweekdays`, `itermonthdates`, `itermonthdays*`
- Calendar matrix generators: `monthdatescalendar`, `monthdays2calendar`, etc.
- Year-level data: `yeardatescalendar`, `yeardays2calendar`

### Text Output (L325-440)
`TextCalendar` - Plain text calendar formatting:
- `formatday/week/month/year` methods for text output
- `prmonth/pryear` methods for direct printing
- UNIX cal(1) compatible formatting

### HTML Output (L442-576)
`HTMLCalendar` - HTML table-based calendar generation:
- CSS class configuration for styling
- `formatday/week/month/year` methods returning HTML strings
- `formatyearpage` generates complete HTML document with encoding support

### Locale-Aware Subclasses (L603-642)
- `LocaleTextCalendar`: Text calendar with locale-specific names
- `LocaleHTMLCalendar`: HTML calendar with locale-specific names
- Both use `different_locale` context manager for name formatting

### Module-Level Interface (L644-661)
Legacy functions delegating to global `TextCalendar` instance:
- `setfirstweekday`, `monthcalendar`, `prmonth`, `month`, `calendar`, etc.

### Utilities (L668-691)
- `formatstring`: Multi-column string formatting for year calendars
- `timegm`: Unix timestamp calculation from GMT tuple
- Constants: `EPOCH=1970`, `_EPOCH_ORD`

### Command-Line Interface (L693-798)
`main()` function with argparse-based CLI supporting:
- Text/HTML output selection
- Locale and encoding configuration  
- Year/month specification
- Formatting options (width, spacing, CSS)

## Architecture Notes
- Uses composition pattern with Calendar base class and formatting subclasses
- Locale handling via context managers for thread safety
- Extensive use of generators for memory efficiency in date iteration
- HTML output uses proper encoding and XHTML DOCTYPE