# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/_markupbase.py
@source-hash: cb14dd6f2e2439eb
@generated: 2026-02-09T18:07:34Z

## Purpose and Responsibility

Foundation module for parsing HTML/XHTML document type declarations and markup constructs. Provides core parsing infrastructure for SGML/HTML parsers through the `ParserBase` abstract class. Not intended for direct use - serves as base class for html.parser and similar modules.

## Key Classes and Functions

### ParserBase (L23-392)
Abstract base class providing common parsing methods for markup language parsers. Must be subclassed - raises RuntimeError if instantiated directly (L28-30).

**Core Methods:**
- `__init__()` (L27-30): Prevents direct instantiation
- `reset()` (L32-34): Initializes line/offset tracking
- `getpos()` (L36-38): Returns current parsing position
- `updatepos(i, j)` (L44-55): Updates line number and character offset tracking

**Declaration Parsing:**
- `parse_declaration(i)` (L60-137): Main declaration parser handling DOCTYPE, comments, marked sections
- `parse_comment(i, report=1)` (L165-175): Parses HTML comments (`<!-- -->`)
- `parse_marked_section(i, report=1)` (L141-162): Handles SGML marked sections and MS Office extensions

**DOCTYPE Parsing:**
- `_parse_doctype_subset(i, declstartpos)` (L179-246): Parses internal DTD subset
- `_parse_doctype_element(i, declstartpos)` (L249-257): Handles ELEMENT declarations
- `_parse_doctype_attlist(i, declstartpos)` (L260-314): Handles ATTLIST declarations
- `_parse_doctype_notation(i, declstartpos)` (L317-337): Handles NOTATION declarations
- `_parse_doctype_entity(i, declstartpos)` (L340-372): Handles ENTITY declarations

**Utility Methods:**
- `_scan_name(i, declstartpos)` (L376-392): Scans and validates name tokens
- `unknown_decl(data)` (L395-396): Hook for subclasses to handle unknown declarations

## Regular Expressions and Constants

**Pattern Matching (L10-18):**
- `_declname_match`: Matches declaration names `[a-zA-Z][-_.a-zA-Z0-9]*`
- `_declstringlit_match`: Matches quoted string literals
- `_commentclose`: Matches comment end `-->`
- `_markedsectionclose`: Matches marked section end `]]>`
- `_msmarkedsectionclose`: MS Office marked section end `]>`

**Class Variables:**
- `_decl_otherchars` (L57): Additional valid characters in declarations

## Dependencies and Architecture

**External Dependencies:**
- `re` module for regex pattern matching (deleted after use L20)

**Parser Architecture:**
- Abstract base class pattern requiring subclassing
- Position tracking for error reporting
- Incremental parsing with incomplete buffer handling (returns -1)
- Hook methods (`handle_decl`, `handle_comment`, `unknown_decl`) for subclass customization

## Critical Patterns and Invariants

**Error Handling:**
- Returns -1 for incomplete parsing (need more data)
- Raises AssertionError for malformed markup
- Position tracking for detailed error reporting

**Parsing Strategy:**
- Stateless parsing with explicit position management
- Handles buffer boundaries gracefully
- Supports both standard SGML and Microsoft Office extensions

**MS Office Extensions:**
- Special handling for `[if]`, `[else]`, `[endif]` constructs (L150-152)
- Different closing patterns for MS marked sections vs standard SGML