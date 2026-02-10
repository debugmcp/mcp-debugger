# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/pydoc.py
@source-hash: eaff7a02820dcde3
@generated: 2026-02-09T18:07:30Z

Python's built-in documentation generation and help system module. Provides interactive help, HTML documentation generation, and a web-based documentation server.

## Core Classes

**Doc (L485-539)**: Abstract base formatter class with document() dispatcher method that routes to type-specific handlers. Contains PYTHONDOCS URL configuration and getdocloc() for finding module documentation.

**HTMLDoc (L585-1184)**: HTML documentation formatter extending Doc. Key methods:
- page() (L594-604): Generates complete HTML page structure
- docmodule() (L778-893): Produces comprehensive module documentation
- docclass() (L895-1055): Documents classes with MRO, methods, and attributes
- docroutine() (L1061-1148): Formats functions/methods with signatures
- markup() (L718-755): Auto-links identifiers and creates hyperlinks

**TextDoc (L1220-1628)**: Plain text formatter extending Doc. Methods mirror HTMLDoc but output formatted text with bold() overstriking and indent() utilities.

**Helper (L1897-2310)**: Interactive help system with keyword/topic databases. Manages help sessions and provides listkeywords(), listtopics(), listmodules() functionality.

## Key Functions

**getdoc() (L186-189)**: Extracts and cleans documentation strings from objects
**locate() (L1799-1816)**: Resolves dotted paths to Python objects with safe importing
**safeimport() (L441-481)**: Safe module importing with error handling and reload support
**synopsis() (L365-402)**: Extracts one-line module summaries from files

## Documentation Utilities

**pathdirs() (L82-92)**: Converts sys.path to normalized directory list
**visiblename() (L289-311)**: Determines if names should be documented based on __all__ and naming conventions
**classify_class_attrs() (L313-324)**: Enhanced inspect.classify_class_attrs with descriptor handling

## Server Infrastructure

**_start_server() (L2387-2537)**: HTTP server for web-based documentation browsing
**_url_handler() (L2540-2773)**: URL routing for documentation server with CSS and HTML content handling

## CLI Interface

**cli() (L2854-2938)**: Command-line interface supporting:
- Text documentation display
- Web server mode (-b, -p, -n flags)
- HTML file generation (-w)
- Keyword search (-k)

## Global Instances

- **help (L2310)**: Global Helper instance for interactive use
- **text, html, plaintext (L1820-1822)**: Pre-configured formatter instances

## Notable Patterns

Uses dynamic method dispatch in Doc.document() based on object type inspection. Implements caching in synopsis() for performance. Handles encoding issues carefully throughout for cross-platform compatibility. Server uses threading for non-blocking operation.

## Dependencies

Heavy reliance on inspect module for introspection. Uses importlib for safe module loading. HTTP server functionality requires http.server, threading, and select modules.