# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/xml/etree/ElementInclude.py
@source-hash: 8e10c99668216701
@generated: 2026-02-09T18:06:13Z

## Purpose
Limited XInclude support for ElementTree XML processing. Enables XML documents to include content from external resources using W3C XInclude specification, with security protections against recursive inclusion attacks.

## Key Components

### Exception Classes
- `FatalIncludeError(SyntaxError)` (L67-68): Base exception for critical inclusion failures
- `LimitedRecursiveIncludeError(FatalIncludeError)` (L71-72): Raised when maximum inclusion depth exceeded

### Constants
- `XINCLUDE` (L55): XInclude namespace URI "{http://www.w3.org/2001/XInclude}"
- `XINCLUDE_INCLUDE` (L57): Qualified name for xi:include elements
- `XINCLUDE_FALLBACK` (L58): Qualified name for xi:fallback elements  
- `DEFAULT_MAX_INCLUSION_DEPTH` (L61): Security limit of 6 recursive inclusions

### Core Functions
- `default_loader(href, parse, encoding=None)` (L87-96): Default resource loader supporting both XML and text parsing modes. Opens files from disk with appropriate encoding handling.

- `include(elem, loader=None, base_url=None, max_depth=DEFAULT_MAX_INCLUSION_DEPTH)` (L117-129): Public API for XInclude expansion. Validates parameters, normalizes element input, and delegates to internal implementation.

- `_include(elem, loader, base_url, max_depth, _parent_hrefs)` (L132-186): Recursive core implementation that:
  - Iterates through child elements
  - Processes xi:include directives with href resolution
  - Handles both XML and text inclusion modes
  - Tracks parent hrefs to prevent infinite recursion
  - Manages depth limiting for security
  - Integrates included content into target tree

## Dependencies
- `copy`: For shallow copying included XML nodes
- `ElementTree`: XML parsing and tree manipulation
- `urllib.parse.urljoin`: URL resolution for relative hrefs

## Security Features
- Recursive inclusion detection via href tracking
- Configurable depth limiting (default 6 levels)
- Validation of parse modes and parameters

## Processing Modes
- **XML mode**: Parses included content as XML, recursively processes for nested inclusions
- **Text mode**: Includes content as raw text, merges with element text/tail content

## Architecture Notes
- Modifies ElementTree in-place rather than returning new tree
- Uses iterative child processing with manual index management
- Supports pluggable loaders for custom resource handling
- Maintains XInclude specification compliance for basic use cases