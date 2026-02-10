# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/stringprep.py
@source-hash: 60b6c83581093029
@generated: 2026-02-09T18:09:14Z

## StringPrep RFC 3454 Implementation

This auto-generated file implements Unicode string preparation tables as defined in RFC 3454, providing character classification and mapping functions for internationalized domain name (IDN) processing.

**Core Dependencies:**
- `unicodedata` with version 3.2.0 constraint (L8-10)

**Character Classification Functions:**

**Table A1 - Unassigned Code Points (L12-16):**
- `in_table_a1(code)` - Identifies unassigned Unicode characters
- Filters out non-existent categories and specific ranges (0xFDD0-0xFDF0, 0xFFFE, 0xFFFF)

**Table B1 - Mapping to Nothing (L19-21):**
- `b1_set` - Precomputed set of characters to be removed
- `in_table_b1(code)` - Tests membership in removal set
- Includes zero-width characters, soft hyphens, and format controls

**Table B2/B3 - Case Folding and Normalization (L24-203):**
- `b3_exceptions` (L24-187) - Massive dictionary of special case mappings for characters that don't follow standard lowercase rules
- `map_table_b3(code)` (L189-192) - Applies special mappings or standard lowercasing
- `map_table_b2(a)` (L195-203) - Recursive normalization with NFKC and case folding

**Table C - Prohibited Characters:**
- **C11/C12 - Space Characters (L206-214):**
  - `in_table_c11(code)` - ASCII space only
  - `in_table_c12(code)` - Non-ASCII space characters
  - `in_table_c11_c12(code)` - All space characters

- **C21/C22 - Control Characters (L217-229):**
  - `in_table_c21(code)` - ASCII control characters
  - `c22_specials` (L220) - Non-ASCII control character set
  - `in_table_c22(code)` - Non-ASCII control characters
  - `in_table_c21_c22(code)` - All control characters

- **C3-C9 - Various Prohibited Categories (L232-264):**
  - `in_table_c3(code)` - Private use characters
  - `in_table_c4(code)` - Non-character code points
  - `in_table_c5(code)` - Surrogate code points
  - `in_table_c6(code)` - Inappropriate for plain text (L247-249)
  - `in_table_c7(code)` - Inappropriate for canonical representation (L252-254)
  - `in_table_c8(code)` - Change display properties or deprecated (L257-259)
  - `in_table_c9(code)` - Tagging characters (L262-264)

**Table D - Bidirectional Categories (L267-272):**
- `in_table_d1(code)` - Right-to-left characters (Arabic, Hebrew)
- `in_table_d2(code)` - Left-to-right characters

**Architecture Notes:**
- Heavy use of precomputed sets for O(1) lookup performance
- Combines Unicode database queries with hardcoded exception tables
- Functions follow consistent naming pattern: `in_table_*` for membership tests, `map_table_*` for transformations
- All functions accept single Unicode characters as input