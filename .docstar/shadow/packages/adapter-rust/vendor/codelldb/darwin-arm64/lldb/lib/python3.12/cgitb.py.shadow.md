# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/cgitb.py
@source-hash: 08bbcca13a431551
@generated: 2026-02-09T18:07:04Z

## Purpose
A deprecated Python module for comprehensive traceback formatting with rich HTML and text output capabilities. Provides enhanced error reporting for CGI scripts and debugging, with context-aware source code display and variable inspection.

## Key Components

### Core Functions

**`reset()` (L40-48)**: Returns HTML string to reset CGI/browser state. Contains hardcoded HTML with bgcolor and font tags.

**`lookup(name, frame, locals)` (L69-83)**: Variable resolution function that searches for names in local, global, and builtin scopes. Returns tuple of (scope_type, value) or (None, __UNDEF__).

**`scanvars(reader, frame, locals)` (L85-104)**: Tokenizes Python source line and extracts variable values using `tokenize.generate_tokens()`. Handles attribute access (dot notation) and builds list of (name, scope, value) tuples.

### Formatters

**`html(einfo, context=5)` (L106-201)**: Primary HTML formatter that creates rich traceback display. Processes exception info tuple (etype, evalue, etb), generates styled HTML table with:
- Stack frame information with file links
- Source code context with line highlighting  
- Variable dumps with scope indicators
- Exception details with attributes

**`text(einfo, context=5)` (L203-267)**: Plain text formatter equivalent. Same logic as HTML version but outputs unformatted text.

### HTML Utility Functions
**`small()`, `strong()`, `grey()` (L51-67)**: Simple HTML tag wrappers for text styling.

### Hook Class

**`Hook` (L269-322)**: Exception handler class that replaces `sys.excepthook`. Key attributes:
- `display`: Controls browser output (L274)
- `logdir`: Directory for saving tracebacks (L275) 
- `context`: Lines of source context (L276)
- `format`: "html" or "text" (L278)

**`Hook.__call__()` (L280-281)**: Makes instances callable as exception handlers.

**`Hook.handle()` (L283-322)**: Main processing method that formats and outputs tracebacks, with optional file logging using `tempfile.mkstemp()`.

### Module Interface

**`handler` (L324)**: Global Hook instance for direct use.

**`enable()` (L325-332)**: Main API function that installs Hook as system exception handler.

## Dependencies
- `inspect`: Stack frame introspection
- `tokenize`: Source code parsing
- `linecache`: Source file reading
- `pydoc`: HTML/text representation utilities
- `tempfile`: Log file creation
- `traceback`: Fallback formatting

## Architecture Notes
- Uses sentinel object `__UNDEF__` (L50) for undefined variables
- Deprecated in Python 3.13 (L37)  
- Designed for CGI environment but works in any Python context
- Graceful fallback to standard traceback on formatting errors (L292-294)
- HTML output includes original traceback in comments (L194-201)