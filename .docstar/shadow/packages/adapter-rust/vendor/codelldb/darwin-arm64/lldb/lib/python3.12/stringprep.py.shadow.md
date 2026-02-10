# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/stringprep.py
@source-hash: 60b6c83581093029
@generated: 2026-02-09T18:07:25Z

This file implements RFC 3454 StringPrep protocol tables for Unicode string preprocessing, commonly used in internationalized domain names and other text normalization contexts.

**Purpose**: Provides lookup tables and test functions for character classification and mapping according to StringPrep specification, using Unicode 3.2.0 data.

**Key Dependencies**:
- `unicodedata` (L8): Uses Unicode 3.2.0 character database for category lookups and normalization
- Version assertion (L10): Enforces Unicode 3.2.0 compatibility

**Core Tables and Functions**:

**A Tables (Unassigned Characters)**:
- `in_table_a1(code)` (L12-16): Tests for unassigned Unicode code points, excluding certain ranges like noncharacters

**B Tables (Character Mapping)**:
- `b1_set` (L19): Set of characters to be removed/mapped to nothing (soft hyphens, zero-width chars, etc.)
- `in_table_b1(code)` (L20-21): Tests membership in removal set
- `b3_exceptions` (L24-187): Large mapping dictionary for case folding exceptions (Greek, mathematical symbols, ligatures)
- `map_table_b3(code)` (L189-192): Performs case folding with special exception handling
- `map_table_b2(a)` (L195-203): Iterative normalization using NFKC and case folding

**C Tables (Prohibited Characters)**:
- `in_table_c11(code)` (L206-207): ASCII space character
- `in_table_c12(code)` (L210-211): Non-ASCII space characters
- `in_table_c11_c12(code)` (L213-214): Combined space character test
- `in_table_c21(code)` (L217-218): ASCII control characters
- `c22_specials` (L220): Set of non-ASCII control and special characters
- `in_table_c22(code)` (L221-225): Non-ASCII control characters
- `in_table_c21_c22(code)` (L227-229): Combined control character test
- `in_table_c3(code)` (L232-233): Private use characters
- `in_table_c4(code)` (L236-240): Non-character code points
- `in_table_c5(code)` (L243-244): Surrogate code points
- `in_table_c6(code)` (L247-249): Inappropriate for plain text
- `in_table_c7(code)` (L252-254): Inappropriate for canonical representation
- `in_table_c8(code)` (L257-259): Change display properties
- `in_table_c9(code)` (L262-264): Tagging characters

**D Tables (Bidirectional Text)**:
- `in_table_d1(code)` (L267-268): Right-to-left characters
- `in_table_d2(code)` (L271-272): Left-to-right characters

**Architecture Notes**:
- Generated file (L1) - not meant for manual editing
- Uses precomputed sets for O(1) lookups where possible
- Extensive hardcoded Unicode mappings for mathematical and Greek characters
- Bidirectional text support through Unicode category checking