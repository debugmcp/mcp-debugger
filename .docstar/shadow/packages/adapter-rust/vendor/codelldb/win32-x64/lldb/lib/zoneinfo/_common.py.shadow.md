# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/zoneinfo/_common.py
@source-hash: 67deaf0ba41aa486
@generated: 2026-02-09T18:11:26Z

## Purpose
Core utility module for parsing binary timezone data files in TZif format, part of Python's zoneinfo implementation. Provides timezone data loading and binary format parsing capabilities.

## Key Functions

### `load_tzdata(key)` (L4-24)
Loads timezone data from tzdata package using importlib resources. Takes a timezone key like "America/New_York", splits into package components, and returns an open binary file handle. Handles common exceptions (ImportError, FileNotFoundError, UnicodeEncodeError) and raises ZoneInfoNotFoundError on failure.

### `load_data(fobj)` (L27-124)
Primary TZif binary format parser. Handles both version 1 (32-bit) and version 2+ (64-bit) timezone files. Returns parsed timezone data as tuple: (trans_idx, trans_list_utc, utcoff, isdst, abbr, tz_str).

**Key parsing logic:**
- Reads TZif header to determine format version
- For v2+: skips v1 data block (L40-53) and reads second header
- Parses transition times and timezone type indices (L60-67)
- Extracts UTC offsets, DST flags, and abbreviation indices (L70-77)
- Processes null-terminated abbreviation strings with caching (L86-101)
- For v2+: extracts POSIX TZ string from file footer (L108-122)

### `get_abbr(idx)` (L86-101)
Nested helper function that extracts timezone abbreviations from packed null-terminated string data. Uses lazy loading with caching to handle overlapping abbreviation substrings efficiently.

## Key Classes

### `_TZifHeader` (L127-160)
Lightweight data structure representing TZif file header metadata. Uses `__slots__` for memory efficiency with fields: version, isutcnt, isstdcnt, leapcnt, timecnt, typecnt, charcnt.

**Methods:**
- `__init__(*args)` (L138-140): Maps positional args to slots
- `from_file(stream)` (L142-160): Class method that parses binary header from file stream, validates magic bytes "TZif", and unpacks structured data

### `ZoneInfoNotFoundError` (L163-164)
Custom exception inheriting from KeyError, raised when timezone key lookup fails.

## Dependencies
- `struct`: Binary data parsing
- `importlib.resources`: Dynamic timezone data loading

## Architecture Notes
- Designed for Python's standard library zoneinfo module
- Handles TZif format complexities: version differences, nested headers, packed string data
- Memory-efficient with slots and lazy abbreviation loading
- Robust error handling for missing timezone data