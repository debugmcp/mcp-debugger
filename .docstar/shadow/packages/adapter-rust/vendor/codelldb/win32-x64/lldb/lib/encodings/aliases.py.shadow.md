# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/encodings/aliases.py
@source-hash: 6fdcc49ba23a0203
@generated: 2026-02-09T18:10:39Z

## Purpose and Responsibility

This module serves as a comprehensive encoding alias registry for Python's `encodings` package. It provides a centralized mapping from normalized encoding names and aliases to their corresponding Python codec module names, enabling the encodings search function to resolve various character set names to the appropriate implementation.

## Key Data Structure

**`aliases` dictionary (L18-551)**: The core data structure containing ~540 mappings from encoding aliases to canonical codec names. The dictionary maps normalized encoding names (strings) to Python codec module names (strings).

## Organization and Architecture

The aliases are systematically organized by target codec family:

- **ASCII variants** (L23-34): Maps various ASCII standard names (`'646'`, `'ansi_x3.4_1968'`, etc.) to `'ascii'`
- **Code page encodings** (L51-221): Extensive mappings for IBM code pages (CP037, CP1026, etc.) and Windows code pages (CP1250-1258)
- **East Asian encodings** (L222-295): Japanese (EUC-JIS, Shift-JIS variants), Korean (EUC-KR), and Chinese (GB2312, GBK, Big5) character sets
- **ISO standards** (L307-409): ISO-8859 series mappings for various regional character sets
- **Unicode encodings** (L504-538): UTF-7, UTF-8, UTF-16, UTF-32 variants and aliases
- **Legacy/specialized codecs** (L414-544): KOI8-R, Mac encodings, compression codecs (base64, bz2, hex, etc.)

## Notable Implementation Details

**Performance optimization note** (L422-428): Contains important architectural comment explaining why `iso8859_1` is aliased to `latin_1` - the latter has a faster internal C implementation.

**Temporary aliases** (L546-550): Mac CJK aliases marked as temporary placeholders pending proper codec implementation in Python 3.1.

**Sorting directive** (L20): Comment instructs maintainers to keep entries alphabetically sorted by target codec name.

## Dependencies and Integration

- Integrates with Python's `encodings` package search mechanism
- Relies on the existence of corresponding codec modules named in the dictionary values
- Used by encoding normalization and lookup functions in the standard library

## Critical Constraints

- All keys must be normalized encoding names (lowercase, underscores/hyphens standardized)
- All values must correspond to actual Python codec module names
- Maintains IANA character set name compatibility while adding Python-specific aliases
- Dictionary structure is critical for encoding resolution performance