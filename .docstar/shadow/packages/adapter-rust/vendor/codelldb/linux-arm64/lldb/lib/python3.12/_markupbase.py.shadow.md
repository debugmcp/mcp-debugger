# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/_markupbase.py
@source-hash: cb14dd6f2e2439eb
@generated: 2026-02-09T18:08:30Z

## Purpose
Internal base parser for HTML/SGML/XHTML document type declarations. Provides shared infrastructure for scanning and parsing markup declarations, comments, and marked sections. Not intended for direct use - serves as foundation for html.parser module.

## Key Components

### ParserBase Class (L23-396)
Abstract base class providing common parsing infrastructure:

**Core State Management:**
- `reset()` (L32-34): Initializes line tracking (lineno=1, offset=0)
- `getpos()` (L36-38): Returns current (line, offset) position
- `updatepos()` (L44-55): Updates position tracking after processing text segments

**Declaration Parsing:**
- `parse_declaration()` (L60-137): Main entry point for parsing `<!...>` declarations
  - Handles DOCTYPE, comments, marked sections, and other SGML constructs
  - Returns position after declaration or -1 if incomplete
- `_parse_doctype_subset()` (L179-246): Processes internal DTD subset within DOCTYPE
- `_parse_doctype_element()` (L249-257): Handles `<!ELEMENT>` declarations
- `_parse_doctype_attlist()` (L260-314): Handles `<!ATTLIST>` declarations  
- `_parse_doctype_notation()` (L317-337): Handles `<!NOTATION>` declarations
- `_parse_doctype_entity()` (L340-372): Handles `<!ENTITY>` declarations

**Specialized Parsers:**
- `parse_comment()` (L165-175): Processes `<!-- ... -->` comments
- `parse_marked_section()` (L141-162): Handles SGML marked sections `<![CDATA[...]]>` and MS Office extensions

**Utility Functions:**
- `_scan_name()` (L376-392): Extracts valid names from declarations, returns (name, position)

### Regex Patterns (L10-18)
Pre-compiled patterns for efficient parsing:
- `_declname_match`: Matches declaration names ([a-zA-Z][-_.a-zA-Z0-9]*)
- `_declstringlit_match`: Matches quoted string literals
- `_commentclose`: Matches comment end (`--\s*>`)
- `_markedsectionclose`: Standard marked section end (`]\s*]\s*>`)
- `_msmarkedsectionclose`: MS Office marked section end (`]\s*>`)

## Architecture Patterns

**Template Method Pattern**: Abstract methods `unknown_decl()` (L395-396) and `handle_decl()` (called at L104) must be implemented by subclasses.

**State Machine**: Uses position-based parsing with incomplete state handling (returns -1 when more data needed).

**Error Handling**: Raises AssertionError for malformed markup with descriptive context.

## Critical Invariants
- Must be subclassed (enforced in `__init__` L28-30)
- All parsing methods return next position or -1 for incomplete input
- Position tracking must be maintained for error reporting
- Handles both standard SGML and Microsoft Office HTML extensions

## Dependencies
- `re` module for regex matching (imported L8, deleted L20 for namespace cleanup)
- Expects `self.rawdata` attribute containing input text
- Subclasses must implement `handle_decl()`, `handle_comment()`, `unknown_decl()` methods