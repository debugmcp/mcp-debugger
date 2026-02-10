# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/_markupbase.py
@source-hash: cb14dd6f2e2439eb
@generated: 2026-02-09T18:07:00Z

## _markupbase.py

**Purpose:** Internal foundational module for HTML/XHTML document type declaration parsing. Provides base parser functionality for markup processing, specifically handling SGML/HTML/XHTML declaration syntax.

**Architecture:** Abstract base class design requiring subclassing. Not intended for direct use - serves as foundation for html.parser module.

### Key Components

**ParserBase Class (L23-396):** Core abstract parser providing common markup declaration parsing methods.

- `__init__` (L27-30): Prevents direct instantiation, enforces subclassing
- `reset` (L32-34): Initializes line/offset tracking 
- `getpos` (L36-38): Returns current parse position
- `updatepos` (L44-55): Updates line/offset counters based on newlines

**Declaration Parsing Methods:**
- `parse_declaration` (L60-137): Main declaration parser handling DOCTYPE, comments, marked sections
- `parse_comment` (L165-175): HTML comment parsing with `<!--` ... `-->`
- `parse_marked_section` (L141-162): Handles SGML marked sections and MS Office extensions

**DOCTYPE Processing:**
- `_parse_doctype_subset` (L179-246): Parses internal DTD subset
- `_parse_doctype_element` (L249-257): Handles `<!ELEMENT>` declarations
- `_parse_doctype_attlist` (L260-314): Processes `<!ATTLIST>` declarations  
- `_parse_doctype_notation` (L317-337): Handles `<!NOTATION>` declarations
- `_parse_doctype_entity` (L340-372): Processes `<!ENTITY>` declarations

**Utility Methods:**
- `_scan_name` (L376-392): Tokenizes declaration names with case normalization
- `unknown_decl` (L395-396): Override hook for unknown declaration handling

### Regex Patterns (L10-18)
- `_declname_match`: Matches declaration names `[a-zA-Z][-_.a-zA-Z0-9]*`
- `_declstringlit_match`: Matches quoted strings in declarations
- `_commentclose`: Matches comment closing `-->`  
- `_markedsectionclose`: Matches standard marked section close `]]>`
- `_msmarkedsectionclose`: MS Office extension close `]>`

### Dependencies
- **re module**: Compiled regex patterns for parsing
- **Expected attributes**: Subclasses must provide `rawdata`, `handle_comment`, `handle_decl` methods

### Critical Patterns
- **Incremental parsing**: Returns -1 for incomplete input requiring more data
- **Position tracking**: Maintains line/offset for error reporting
- **Error handling**: Raises AssertionError for malformed markup with position info
- **Extension support**: Handles Microsoft Office markup extensions (`[if]`, `[endif]`)

### Parser State
- `rawdata`: Input buffer (expected from subclass)
- `lineno`: Current line number  
- `offset`: Current character offset within line
- `_decl_otherchars`: Additional valid declaration characters