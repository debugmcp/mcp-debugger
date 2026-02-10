# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/html/parser.py
@source-hash: ab5a0a2fce2bec75
@generated: 2026-02-09T18:11:12Z

## HTML/XHTML Parser Implementation

**Primary Purpose**: Event-driven HTML/XHTML parser that tokenizes markup and invokes handler methods for different HTML constructs (tags, data, comments, etc.). Based on sgmllib.py with tolerant parsing approach.

### Core Components

**HTMLParser class (L62-456)**: Main parser class inheriting from `_markupbase.ParserBase`
- Constructor (L86-94): Accepts `convert_charrefs` parameter to control automatic character reference conversion
- `reset()` (L96-102): Initializes parser state with empty rawdata buffer and normal parsing mode
- `feed(data)` (L104-111): Appends data to internal buffer and triggers parsing
- `close()` (L113-115): Forces processing of any remaining buffered data

### Parsing Engine

**Main parsing loop - `goahead(end)` (L134-251)**: Core parsing algorithm that:
- Scans for interesting characters (`<` and `&`) using regex patterns
- Handles character reference conversion when enabled
- Dispatches to specialized parsers based on markup type
- Manages CDATA mode for `<script>` and `<style>` elements
- Processes text data between markup elements

**CDATA handling (L123-129)**: 
- `set_cdata_mode(elem)`: Switches to raw text mode for script/style elements
- `clear_cdata_mode()`: Returns to normal parsing mode
- Uses dynamic regex compilation for end tag detection

### Specialized Parsers

**Start tag parser - `parse_starttag(i)` (L301-341)**:
- Uses tolerant regex patterns for tag name and attribute extraction
- Handles both regular tags and self-closing XHTML-style tags
- Automatically enters CDATA mode for script/style elements
- Stores complete tag text for `get_starttag_text()` access

**End tag parser - `parse_endtag(i)` (L379-416)**:
- Handles malformed end tags gracefully
- Special handling for CDATA elements
- Exits CDATA mode when appropriate end tag found

**Other parsers**:
- `parse_html_declaration(i)` (L256-273): DOCTYPE and declaration handling
- `parse_bogus_comment(i)` (L277-286): Malformed comment recovery
- `parse_pi(i)` (L289-298): Processing instruction parsing

### Regular Expressions (L21-58)

Key parsing patterns:
- `interesting_normal`: Finds `<` and `&` characters for normal mode
- `tagfind_tolerant`, `attrfind_tolerant`: Lenient tag/attribute parsing
- `locatestarttagend_tolerant`: Complex pattern for complete start tag detection
- `entityref`, `charref`: Entity and character reference patterns

### Handler Methods (L419-456)

Virtual methods for subclass override:
- `handle_starttag(tag, attrs)`, `handle_endtag(tag)`
- `handle_data(data)`: Text content between tags
- `handle_charref(name)`, `handle_entityref(name)`: Reference handling
- `handle_comment(data)`, `handle_decl(decl)`, `handle_pi(data)`: Special constructs

### Dependencies

- `re`: Extensive regex usage for tokenization
- `_markupbase`: Base class providing common markup parsing utilities
- `html.unescape`: Character reference conversion

### Design Patterns

- **Event-driven architecture**: Parser generates events rather than building parse tree
- **Tolerant parsing**: Handles malformed HTML gracefully using lenient regex patterns
- **State machine**: Switches between normal and CDATA parsing modes
- **Template method pattern**: Virtual handler methods for customization