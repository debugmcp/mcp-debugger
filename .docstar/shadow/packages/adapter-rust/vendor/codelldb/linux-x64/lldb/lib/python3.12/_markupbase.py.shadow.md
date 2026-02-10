# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/_markupbase.py
@source-hash: cb14dd6f2e2439eb
@generated: 2026-02-09T18:10:21Z

**Primary Purpose**: Shared foundation module for parsing HTML/XHTML document type declarations and markup constructs. Provides low-level parsing infrastructure used by html.parser module. Not intended for direct use - serves as base class for SGML/HTML parsers.

**Core Class**:
- `ParserBase` (L23-396): Abstract base class providing common parsing methods for SGML/HTML/XHTML parsers. Must be subclassed - throws RuntimeError if instantiated directly (L28-30).

**Key Methods**:
- `reset()` (L32-34): Initializes line number and offset tracking
- `getpos()` (L36-38): Returns current parsing position (line, offset)
- `updatepos()` (L44-55): Updates line/offset counters based on newlines in parsed text
- `parse_declaration()` (L60-137): Main declaration parser handling <!DOCTYPE>, comments, marked sections, and other SGML constructs
- `parse_comment()` (L165-175): Parses HTML comments (<!-- ... -->)
- `parse_marked_section()` (L141-162): Handles SGML marked sections including MS Office extensions
- `_parse_doctype_subset()` (L179-246): Parses internal DTD subset within DOCTYPE declarations

**DOCTYPE-specific parsers**:
- `_parse_doctype_element()` (L249-257): Handles <!ELEMENT> declarations
- `_parse_doctype_attlist()` (L260-314): Handles <!ATTLIST> declarations  
- `_parse_doctype_notation()` (L317-337): Handles <!NOTATION> declarations
- `_parse_doctype_entity()` (L340-372): Handles <!ENTITY> declarations

**Utility Methods**:
- `_scan_name()` (L376-392): Scans and validates name tokens in declarations
- `unknown_decl()` (L395-396): Hook for handling unrecognized declarations (to be overridden)

**Key Dependencies**:
- Pre-compiled regex patterns for efficient parsing: `_declname_match` (L10), `_declstringlit_match` (L11), `_commentclose` (L12), `_markedsectionclose` (L13), `_msmarkedsectionclose` (L18)

**Architecture Notes**:
- Uses position tracking (`lineno`, `offset`) for error reporting
- Handles incomplete buffers by returning -1
- Supports both standard SGML and MS Office markup extensions
- Expects `rawdata` attribute containing text to parse
- Implements robust error handling with detailed AssertionError messages

**Critical Invariants**:
- All parsing methods return position index or -1 for incomplete data
- Position tracking must be updated for each parsed segment
- Buffer boundaries handled consistently across all parsers