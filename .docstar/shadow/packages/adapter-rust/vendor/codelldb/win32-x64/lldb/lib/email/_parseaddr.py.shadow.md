# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/email/_parseaddr.py
@source-hash: 4308932872acbf4a
@generated: 2026-02-09T18:10:39Z

## Email Address Parsing Module

Legacy email address parsing utilities lifted from rfc822.py for RFC 2822 compliance. Provides both date/time parsing and email address parsing functionality.

### Core Constants (L18-42)
- String constants: `SPACE`, `EMPTYSTRING`, `COMMASPACE` for formatting
- Month/day name arrays: `_monthnames` (L23-26), `_daynames` (L28) for date parsing
- Timezone table: `_timezones` (L36-42) mapping timezone abbreviations to UTC offsets

### Date Parsing Functions

**`parsedate_tz(data)` (L45-55)**: Main date parser returning 10-element time tuple with timezone offset. Delegates to `_parsedate_tz()` and ensures timezone offset is set to 0 if None.

**`_parsedate_tz(data)` (L57-179)**: Core date parsing implementation handling multiple RFC formats:
- Processes day names, RFC 850 deprecated format, timezone extraction
- Handles 2-digit year conversion (69-99 → 1969-1999, 00-68 → 2000-2068)
- Returns `[year, month, day, hour, min, sec, wday, yday, dst, tzoffset]`
- Special handling for `-0000` timezone (returns None to indicate unknown source timezone)

**`parsedate(data)` (L182-188)**: Simple wrapper returning 9-element time tuple (strips timezone).

**`mktime_tz(data)` (L191-198)**: Converts 10-tuple from `parsedate_tz()` to POSIX timestamp, handling timezone offset.

### String Utilities

**`quote(str)` (L201-208)**: Escapes backslashes and quotes for use in quoted strings.

### Address Parsing Classes

**`AddrlistClass` (L211-510)**: Deprecated RFC 2822 address parser with stateful parsing:
- `__init__(field)` (L221-238): Sets up parsing state with special characters and field position
- `gotonext()` (L240-252): Advances position past whitespace and extracts comments
- `getaddrlist()` (L254-266): Main entry point returning list of `(name, address)` tuples
- `getaddress()` (L268-325): Parses single address handling various formats (groups, route addresses, simple addresses)
- `getrouteaddr()` (L327-357): Parses route addresses (Return-path style) skipping route info
- `getaddrspec()` (L359-395): Parses addr-spec (local@domain), handling quoted strings and atoms
- `getdomain()` (L397-418): Extracts domain part, prevents double-@ attacks (bpo-34155)
- `getdelimited()` (L420-455): Generic delimiter-based parsing with escape handling
- Helper methods: `getquote()` (L457-459), `getcomment()` (L461-463), `getdomainliteral()` (L465-467)
- `getatom()` (L469-487): Parses RFC 2822 atoms with configurable end delimiters
- `getphraselist()` (L489-510): Parses phrase sequences (atoms or quoted strings)

**`AddressList` (L512-556)**: Container class extending `AddrlistClass`:
- Implements list-like interface with set operations (`__add__`, `__sub__`, `__iadd__`, `__isub__`)
- Stores parsed addresses in `addresslist` attribute
- Supports indexing, length, and membership operations

### Dependencies
- `time`, `calendar` modules for timestamp conversion
- No external email module dependencies (standalone implementation)

### Architecture Notes
- State machine approach with position tracking for parsing
- Graceful error handling returning None/empty for invalid input
- Legacy code maintained for compatibility (marked deprecated)
- RFC 2822 compliant with obsolete syntax support