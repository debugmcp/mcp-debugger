# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/re/_casefix.py
@source-hash: 1b12d9136f23db6c
@generated: 2026-02-09T18:06:08Z

This file provides Unicode case mapping support for Python's regular expression engine, specifically handling special Unicode characters that have complex case relationships.

## Primary Purpose
Auto-generated lookup table for special Unicode case folding scenarios where multiple lowercase characters map to the same uppercase character, enabling correct case-insensitive regex matching across various scripts.

## Key Data Structure
**`_EXTRA_CASES` (L5-106)**: Dictionary mapping Unicode code points (integers) to tuples of alternative lowercase character codes that share the same uppercase form. Essential for case-insensitive pattern matching in regex operations.

## Character Coverage
- **Latin characters (L7-15, L91-93)**: Handles dotless i/i, long s/s, and s with dot variations
- **Greek characters (L11, L17-57, L95-99)**: Comprehensive coverage of Greek letters with their symbol variants, including combining characters and diacritical marks
- **Cyrillic characters (L59-89, L101)**: Various Cyrillic letter forms and their regional/historical variants
- **Ligatures (L103-105)**: Latin ligature mappings for typographic compatibility

## Technical Details
- Maps from integer Unicode code points to tuples of alternative code points
- Bidirectional relationships ensure symmetric case folding behavior
- Includes both simple 1:1 mappings and complex 1:many relationships
- Generated content ensures consistency with Unicode standards

## Dependencies
Part of Python's `re` module infrastructure, consumed by regex compilation and matching logic for Unicode-aware case-insensitive operations.

## Architectural Notes
- Read-only data structure designed for fast lookup operations
- Auto-generated to maintain synchronization with Unicode standards
- Covers edge cases that standard case folding algorithms miss