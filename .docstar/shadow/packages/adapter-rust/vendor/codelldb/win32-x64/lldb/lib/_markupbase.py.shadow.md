# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/_markupbase.py
@source-hash: cb14dd6f2e2439eb
@generated: 2026-02-09T18:12:44Z

**Purpose:** Foundation module for parsing HTML/XML document type declarations and markup constructs. Provides base parsing infrastructure for html.parser and similar modules.

**Core Architecture:**
- `ParserBase` (L23-396): Abstract base class providing common parsing functionality
- Must be subclassed - direct instantiation raises RuntimeError (L28-30)
- Manages position tracking (line/offset) and incremental parsing state

**Key Methods:**
- `reset()` (L32-34): Initialize line/offset counters
- `getpos()` (L36-38): Return current parsing position
- `updatepos()` (L44-55): Update line/offset based on consumed input
- `parse_declaration()` (L60-137): Main entry point for parsing `<!...>` declarations
- `parse_comment()` (L165-175): Parse HTML comments `<!--...-->`
- `parse_marked_section()` (L141-162): Parse SGML marked sections `<![...]>`

**Declaration Parsing Subsystem:**
- `_parse_doctype_subset()` (L179-246): Parse internal DTD subset
- `_parse_doctype_element()` (L249-257): Parse `<!ELEMENT>` declarations
- `_parse_doctype_attlist()` (L260-314): Parse `<!ATTLIST>` declarations  
- `_parse_doctype_notation()` (L317-337): Parse `<!NOTATION>` declarations
- `_parse_doctype_entity()` (L340-372): Parse `<!ENTITY>` declarations
- `_scan_name()` (L376-392): Extract name tokens from markup

**Regex Patterns:**
- `_declname_match` (L10): Matches declaration names `[a-zA-Z][-_.a-zA-Z0-9]*`
- `_declstringlit_match` (L11): Matches quoted string literals
- `_commentclose` (L12): Matches comment end `-->`
- `_markedsectionclose` (L13): Matches marked section end `]]>`
- `_msmarkedsectionclose` (L18): MS Word extension support `]>`

**Extension Points:**
- `unknown_decl()` (L395-396): Hook for unrecognized declarations
- `handle_decl()`: Expected to be implemented by subclasses for DOCTYPE handling
- `handle_comment()`: Expected to be implemented by subclasses for comment handling

**Key Patterns:**
- Incremental parsing with `-1` return values indicating incomplete input
- Position tracking throughout parsing for error reporting
- Support for both standard SGML and Microsoft Office extensions
- State management through `rawdata` attribute (expected from subclasses)

**Dependencies:** Uses `re` module for pattern matching, deleted after compilation (L20)

**Critical Invariants:**
- All parsing methods return position indices or -1 for incomplete
- Position tracking must be maintained for proper error reporting
- `rawdata` attribute must be available from subclass context