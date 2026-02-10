# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/stringprep.py
@source-hash: 60b6c83581093029
@generated: 2026-02-09T18:10:06Z

## Overview
Python module implementing StringPrep RFC 3454 Unicode normalization tables and functions. This is a **generated file** (L1) that provides Unicode character classification and mapping functions for string preparation operations. Uses Unicode 3.2.0 data (L8, L10).

## Core Architecture
- **Table A1 (L12-16)**: Identifies unassigned code points in Unicode 3.2.0, excluding specific ranges (0xFDD0-0xFDF0, 0xFFFE, 0xFFFF)
- **Table B1 (L19-21)**: Zero-width/format characters set for removal (173 characters including soft hyphen, zero-width spaces)
- **Table B2/B3 (L189-204)**: Case folding and normalization mapping functions with extensive exception dictionary (L24-187)

## Key Functions

### Character Classification Functions
- `in_table_a1(code)` (L12-16): Tests for unassigned Unicode points
- `in_table_b1(code)` (L20-21): Tests for zero-width characters to remove
- `in_table_c11/c12()` (L206-214): Space character classification (ASCII vs non-ASCII spaces)
- `in_table_c21/c22()` (L217-229): Control character classification (ASCII vs non-ASCII controls)
- `in_table_c3-c9()` (L232-264): Various prohibited character classes (private use, surrogates, etc.)
- `in_table_d1/d2()` (L267-272): Bidirectional character classification (RTL vs LTR)

### Mapping Functions
- `map_table_b3(code)` (L189-192): Case folding with 400+ special exceptions for mathematical symbols, ligatures, Greek letters
- `map_table_b2(a)` (L195-203): Iterative NFKC normalization with case folding until stable

## Data Structures
- `b1_set` (L19): Pre-computed set of 173 zero-width character codes
- `b3_exceptions` (L24-187): Massive dictionary (400+ entries) mapping Unicode points to normalized strings
- Multiple character sets (`c6_set`, `c7_set`, `c8_set`, `c9_set`) for prohibited character ranges

## Dependencies
- `unicodedata.ucd_3_2_0` (L8): Specific Unicode 3.2.0 implementation for consistency
- Assertion ensures correct Unicode version (L10)

## Usage Pattern
Functions take single Unicode characters as input and return boolean membership tests or string mappings. The module implements RFC 3454 StringPrep algorithm components for internationalized domain names and other applications requiring Unicode normalization.