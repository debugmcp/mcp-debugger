# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/stringprep.py
@source-hash: 60b6c83581093029
@generated: 2026-02-09T18:08:10Z

## Purpose
Generated Python library implementing StringPrep RFC 3454 tables for Unicode normalization and validation. Contains two types of operations: membership testing for character sets and character mapping functions. Uses Unicode 3.2.0 data specifically.

## Key Dependencies
- `unicodedata.ucd_3_2_0` (L8): Unicode 3.2.0 database for character property lookups
- Validates Unicode version is exactly 3.2.0 (L10)

## Table A: Unassigned Code Points
- `in_table_a1(code)` (L12-16): Tests for unassigned Unicode code points, excluding certain ranges (0xFDD0-0xFDF0, 0xFFFE, 0xFFFF)

## Table B: Character Mappings
- `b1_set` (L19): Pre-computed set of characters that map to nothing (deletion)
- `in_table_b1(code)` (L20-21): Tests membership in deletion table
- `b3_exceptions` (L24-187): Large dictionary mapping special Unicode characters to their normalized forms (Greek letters, mathematical symbols, ligatures)
- `map_table_b3(code)` (L189-192): Character-to-string mapping using exceptions dict or lowercase fallback
- `map_table_b2(a)` (L195-203): Complex normalization applying B3 mapping + NFKC normalization iteratively until stable

## Table C: Prohibited Characters
Multiple prohibition categories implemented as membership tests:
- `in_table_c11(code)` (L206-207): ASCII space only
- `in_table_c12(code)` (L210-211): Non-ASCII space characters (Zs category except space)
- `in_table_c11_c12(code)` (L213-214): All space characters (Zs category)
- `in_table_c21(code)` (L217-218): ASCII control characters
- `c22_specials` (L220): Pre-computed set of special control-like characters
- `in_table_c22(code)` (L221-225): Non-ASCII control characters + specials
- `in_table_c21_c22(code)` (L227-229): Combined control character test
- `in_table_c3(code)` (L232-233): Private use characters (Co category)
- `in_table_c4(code)` (L236-240): Non-character code points (0xFDD0-0xFDF0 range + 0xFFFE/0xFFFF patterns)
- `in_table_c5(code)` (L243-244): Surrogate code points (Cs category)
- `in_table_c6(code)` (L247-249): Inappropriate for plain text characters
- `in_table_c7(code)` (L252-254): Inappropriate for canonical representation
- `in_table_c8(code)` (L257-259): Change display properties/deprecated characters
- `in_table_c9(code)` (L262-264): Tagging characters

## Table D: Bidirectional Properties
- `in_table_d1(code)` (L267-268): Right-to-left characters (R/AL bidirectional categories)
- `in_table_d2(code)` (L271-272): Left-to-right characters (L bidirectional category)

## Architecture Notes
- Generated file (not hand-written) - uses pre-computed sets for performance
- Consistent pattern: functions take single character, return boolean for sets or string for mappings
- Heavy use of Unicode category and bidirectional property lookups
- Large static data structures (b3_exceptions dict has 100+ entries, various character sets)