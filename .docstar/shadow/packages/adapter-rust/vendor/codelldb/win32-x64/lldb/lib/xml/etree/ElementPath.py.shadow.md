# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/xml/etree/ElementPath.py
@source-hash: ae8a80a8b51567b4
@generated: 2026-02-09T18:06:24Z

## Primary Purpose
This module implements limited XPath support for ElementTree, providing XPath-style selection capabilities for XML elements. It serves as the core path resolution engine for ElementTree's find/findall operations.

## Core Architecture

### Tokenization & Parsing
- **xpath_tokenizer_re (L61-72)**: Regex pattern for tokenizing XPath expressions, handles quotes, operators, namespaces, and element names
- **xpath_tokenizer (L74-95)**: Generator that tokenizes XPath patterns with namespace resolution support, converting prefixed tags to full namespace URIs

### Selection Engine
- **_SelectorContext (L350-353)**: Context object holding root element and parent mapping for XPath evaluation
- **_cache (L348)**: Global cache for compiled selectors, cleared when exceeding 100 entries
- **ops (L339-346)**: Dispatch table mapping XPath operators to their preparation functions

### Core Selector Functions
- **prepare_child (L153-170)**: Handles direct child selection (`tag` or `*`)
- **prepare_star (L172-176)**: Handles wildcard selection (`*`)
- **prepare_self (L178-181)**: Handles current element selection (`.`)
- **prepare_parent (L214-225)**: Handles parent element selection (`..`)
- **prepare_descendant (L183-212)**: Handles descendant selection (`//`)
- **prepare_predicate (L227-337)**: Complex predicate handling for `[condition]` expressions

### Wildcard & Namespace Handling
- **_is_wildcard_tag (L108-109)**: Detects namespace wildcards like `{*}tag` or `{ns}*`
- **_prepare_tag (L112-150)**: Creates specialized selectors for wildcard patterns:
  - `{*}*`: Any element (excluding comments/PIs)
  - `{}*`: Any non-namespaced element
  - `{*}name`: Element name in any namespace
  - `{ns}*`: Any element in specific namespace

### Public API
- **iterfind (L360-399)**: Main iterator function, compiles XPath and yields matching elements
- **find (L404-405)**: Returns first match or None
- **findall (L410-411)**: Returns list of all matches
- **findtext (L416-423)**: Returns text content of first match

## Key Implementation Details

### Predicate Support
The predicate parser (L227-337) supports:
- Attribute existence: `[@attr]`
- Attribute comparison: `[@attr='value']` and `[@attr!='value']`
- Child element existence: `[child_tag]`
- Text content comparison: `[.='text']` or `[tag='text']`
- Position indexing: `[1]`, `[last()]`, `[last()-1]`

### Parent Mapping
- **get_parent_map (L98-105)**: Lazy construction of parent-child relationships by iterating the entire tree

### Caching Strategy
Compiled selectors are cached using path and namespace mappings as keys, with automatic cache clearing to prevent memory bloat.

## Dependencies
- `re`: For XPath tokenization regex
- Relies on ElementTree elements having `.tag`, `.text`, `.get()`, `.find()`, `.findall()`, `.iter()`, and `.itertext()` methods

## Critical Constraints
- No absolute paths (starting with `/`) allowed on elements
- XPath positions are 1-based (converted to 0-based internally)
- Namespace prefixes must be defined in the namespaces parameter
- Cache limited to 100 entries for memory management