# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/html/entities.py
@source-hash: d9c65fb2828dbc1f
@generated: 2026-02-09T18:11:07Z

## HTML Character Entity Reference Module

This module provides comprehensive mappings between HTML character entity names and Unicode codepoints for HTML4 and HTML5 standards.

**Core Purpose**: Enables conversion between HTML entity names (like `&amp;`) and their corresponding Unicode characters (`&`) for HTML parsing, generation, and entity encoding/decoding operations.

### Key Data Structures

**name2codepoint (L7-260)**: Dictionary mapping HTML4 entity names to Unicode codepoints. Contains 252 standard HTML entities including:
- Latin characters with diacritical marks (`Aacute`, `Ecirc`, etc.)
- Greek letters (`Alpha`, `Beta`, `Gamma`, etc.) 
- Mathematical symbols (`asymp`, `equiv`, `infin`, etc.)
- Typographic symbols (`ldquo`, `mdash`, `hellip`, etc.)

**html5 (L268-2500)**: Comprehensive dictionary mapping HTML5 named character references to Unicode strings. Generated from official WHATWG specifications. Contains 2,231+ entries including:
- All HTML4 entities with and without semicolons
- Extended mathematical symbols
- Additional Unicode characters
- Multi-character sequences (e.g., combining characters)

**Derived Mappings (L502-513)**:
- `codepoint2name`: Reverse mapping from Unicode codepoint to HTML entity name
- `entitydefs`: Maps entity name to actual character string

### Module Interface

**Exported symbols (`__all__`, L3)**:
- `html5`: Complete HTML5 entity reference
- `name2codepoint`: HTML4 entity name to codepoint mapping  
- `codepoint2name`: Reverse codepoint to name mapping
- `entitydefs`: Entity name to character mapping

### Implementation Details

The module uses a hybrid approach:
1. Static HTML4 entities (L7-260) with explicit Unicode codepoints and descriptive comments
2. Auto-generated HTML5 entities (L268-2500) from official specifications
3. Runtime generation of reverse mappings (L509-511) for bidirectional lookups

**Character encoding**: All entities resolve to proper Unicode characters, handling both single characters and multi-character sequences.

### Usage Context

This module is essential for:
- HTML parsers needing entity resolution
- HTML generators requiring entity encoding
- Text processing tools handling HTML content
- Web scraping applications
- Documentation systems processing HTML entities

The data structure design supports efficient O(1) lookups in both directions (name→codepoint and codepoint→name) while maintaining compatibility with both HTML4 and HTML5 standards.