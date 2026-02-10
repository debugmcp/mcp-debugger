# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/stringprep.py
@source-hash: 60b6c83581093029
@generated: 2026-02-09T18:13:13Z

## StringPrep RFC 3454 Implementation

This is a generated Python library that implements the StringPrep specification (RFC 3454) for internationalized domain name preparation. It provides table-based character testing and mapping functions for Unicode normalization and validation.

### Primary Components

**Dependencies & Validation (L8-10)**
- Imports `ucd_3_2_0` from `unicodedata` for Unicode 3.2.0 compatibility
- Asserts specific Unicode version requirement

**Table A1 - Unassigned Code Points (L12-16)**
- `in_table_a1(code)`: Tests if character is unassigned in Unicode 3.2.0
- Excludes non-character code points (0xFDD0-0xFDF0 range and 0xFFFE/0xFFFF endings)

**Table B1 - Mapping to Nothing (L19-21)**
- `b1_set`: Pre-computed set of code points to be removed (zero-width chars, soft hyphens, etc.)
- `in_table_b1(code)`: Tests membership in removal set

**Table B2/B3 - Case Folding (L24-203)**
- `b3_exceptions` (L24-187): Massive dictionary mapping special Unicode codepoints to their normalized forms
  - Contains mathematical symbols, ligatures, Greek letters, and styled text variants
- `map_table_b3(code)` (L189-192): Applies exceptions or falls back to lowercase
- `map_table_b2(code)` (L195-203): Iterative NFKC normalization with case folding

**Table C - Prohibited Characters (L206-265)**
- `in_table_c11(code)` (L206-207): ASCII space character
- `in_table_c12(code)` (L210-211): Non-ASCII space separators  
- `in_table_c11_c12(code)` (L213-214): Combined space separator test
- `in_table_c21(code)` (L217-218): ASCII control characters
- `in_table_c22(code)` (L221-225): Non-ASCII control + special formatting chars
- `in_table_c21_c22(code)` (L227-229): Combined control character test
- `in_table_c3(code)` (L232-233): Private use characters
- `in_table_c4(code)` (L236-240): Non-character code points
- `in_table_c5(code)` (L243-244): Surrogate code points
- `in_table_c6(code)` (L247-249): Inappropriate for plain text
- `in_table_c7(code)` (L252-254): Inappropriate for canonical representation
- `in_table_c8(code)` (L257-259): Change display properties/deprecated
- `in_table_c9(code)` (L262-264): Tagging characters

**Table D - Bidirectional Characters (L267-272)**
- `in_table_d1(code)` (L267-268): Right-to-left characters
- `in_table_d2(code)` (L271-272): Left-to-right characters

### Architecture Notes

- Implements StringPrep tables as efficient set lookups and category checks
- Uses Unicode 3.2.0 specifically for compatibility requirements
- Separates mapping operations (B tables) from prohibition tests (C tables)
- Heavy use of precomputed sets for performance optimization