# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/calendar.py
@source-hash: 3091dbd1070a9286
@generated: 2026-02-09T18:09:27Z

## Python Calendar Module

**Primary Purpose**: Comprehensive calendar functionality for date calculations, month/year formatting, and calendar display in both text and HTML formats.

### Core Data Structures and Constants
- `Month` enum (L59-71): IntEnum with constants JANUARY-DECEMBER (1-12)
- `Day` enum (L76-83): IntEnum with constants MONDAY-SUNDAY (0-6)
- `mdays` array (L87): Days per month lookup table [0, 31, 28, 31, ...]
- Localized name providers: `day_name`, `day_abbr`, `month_name`, `month_abbr` (L133-138)

### Exception Classes
- `IllegalMonthError` (L31-35): Validates month range 1-12
- `IllegalWeekdayError` (L38-42): Validates weekday range 0-6

### Date Calculation Functions
- `isleap(year)` (L141-143): Leap year detection using standard algorithm
- `leapdays(y1, y2)` (L146-151): Count leap years in range
- `weekday(year, month, day)` (L154-158): Returns Day enum for given date
- `monthrange(year, month)` (L161-168): Returns (first_weekday, num_days) tuple
- `timegm(tuple)` (L683-690): Unix timestamp calculation from GMT

### Base Calendar Class
`Calendar` (L189-323): Abstract base providing data generation methods
- Constructor sets first weekday (default Monday=0)
- Iterator methods: `iterweekdays()`, `itermonthdates()`, `itermonthdays()`, etc.
- Calendar matrix generators: `monthdatescalendar()`, `monthdays2calendar()`, etc.
- Year-level generators: `yeardatescalendar()`, `yeardays2calendar()`, etc.

### Text Formatting
`TextCalendar` (L325-440): Plain text calendar output
- Day/week/month/year formatting methods
- `prmonth()`, `formatmonth()` for single month display
- `formatyear()`, `pryear()` for full year calendars
- Configurable width, spacing, and layout parameters

### HTML Formatting  
`HTMLCalendar` (L442-576): HTML table-based calendar output
- CSS class configuration for styling hooks
- Similar method structure to TextCalendar but HTML output
- `formatyearpage()` generates complete HTML document with DOCTYPE

### Locale Support
- `different_locale` context manager (L578-591): Temporarily switches LC_TIME locale
- `LocaleTextCalendar` (L603-622): Text calendar with locale-specific names
- `LocaleHTMLCalendar` (L624-642): HTML calendar with locale-specific names
- `_get_default_locale()` (L593-600): Handles locale detection and fallback

### Module-Level Interface
Global instance `c = TextCalendar()` (L644) provides backward-compatible functions:
- `setfirstweekday()`, `monthcalendar()`, `prmonth()`, `month()`, etc. (L646-660)
- Legacy support for old-style function calls

### Command Line Interface
`main(args)` (L693-795): Full-featured CLI with argparse
- Supports both text and HTML output modes
- Locale, encoding, and formatting options
- Year/month selection with validation

### Key Dependencies
- `datetime` module for date objects and calculations
- `locale` module for internationalization
- `enum` for type-safe constants
- `itertools.repeat` for efficient iteration

### Architectural Notes
- Uses composition pattern: TextCalendar and HTMLCalendar inherit from Calendar base
- Locale handling through context managers ensures thread safety
- Extensive use of generators for memory-efficient calendar iteration
- Backward compatibility maintained through module-level function aliases