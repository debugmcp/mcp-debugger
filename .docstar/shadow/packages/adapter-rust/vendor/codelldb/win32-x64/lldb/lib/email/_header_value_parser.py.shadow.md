# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/email/_header_value_parser.py
@source-hash: 6af7b623ae68eb96
@generated: 2026-02-09T18:10:45Z

## Email Header Value Parser

**Primary Purpose**: Implements RFC 5322, 2822, 2047 compliant email header value parsing with comprehensive error recovery and structured token generation.

### Core Architecture

**TokenList Base Classes (L117-183)**:
- `TokenList` - Base recursive data structure for all parsed tokens
- Key properties: `value` (semantic meaning), `all_defects` (accumulated errors), token hierarchy
- Supports folding via `fold()` method and pretty-printing with `pprint()`

**Terminal Classes (L878-949)**:
- `Terminal` - Base string subclass for leaf nodes with token_type and defects
- `WhiteSpaceTerminal` - Collapses to single space in value
- `ValueTerminal` - Preserves actual content
- `EWWhiteSpaceTerminal` - Empty value for encoded word boundaries

### Specialized Token Types

**Address Components (L291-493)**:
- `AddressList`/`Address`/`Mailbox` hierarchy for email addresses
- `NameAddr`/`AngleAddr` for display-name and angle-bracket formats
- `Group` for mailing list syntax with display name and member list
- `Domain`/`AddrSpec` for local-part@domain parsing

**RFC 2047 Encoded Words (L219-224)**:
- `EncodedWord` with charset, encoding (cte), and language attributes
- Handles =?charset?encoding?text?= format with defect tracking

**MIME Support (L658-847)**:
- `MIMEVersion` with major/minor version parsing
- `Parameter`/`MimeParameters` for RFC 2231 parameter handling
- `ContentType`/`ContentDisposition`/`ContentTransferEncoding` headers
- Supports sectioned/extended parameters with charset encoding

### Parser Functions

**Core Parsers (L1036-2162)**:
- `get_unstructured()` (L1097) - Handles free-form text with encoded word detection
- `get_address_list()`/`get_mailbox_list()` - Address parsing with error recovery
- `get_quoted_string()`/`get_atom()` - Basic RFC 5322 constructs
- `parse_message_id()`/`parse_mime_version()` - Complete header parsers

**Parameter Parsing (L2434-2626)**:
- `get_parameter()`/`parse_mime_parameters()` - RFC 2231 compliant with encoding detection
- Handles sectioned parameters (name*0, name*1, etc.)
- Extended parameter support with charset/language tags

**Content Type Parsing (L2643-2758)**:
- `parse_content_type_header()` - maintype/subtype with parameters
- `parse_content_disposition_header()` - disposition-type parsing
- Error recovery maintains partial parsing results

### Folding Engine (L2776-3077)

**`_refold_parse_tree()` (L2783-2927)**:
- Implements RFC compliant line folding with configurable max_line_length
- Handles encoded word generation and combining
- Preserves semantic structure while optimizing line breaks
- MIME parameter folding via `_fold_mime_parameters()`

**Encoded Word Folding (L2929-3003)**:
- `_fold_as_ew()` - Combines adjacent encoded words when possible
- Handles charset transitions and whitespace preservation
- Splits oversized content across continuation lines

### Character Sets and Validation

**Constants (L83-97)**:
- `WSP`, `SPECIALS`, `ATOM_ENDS` - Character classification sets
- `PHRASE_ENDS`, `TOKEN_ENDS` - Parsing boundary definitions
- `rfc2047_matcher` (L102) - Regex for encoded word detection

**Validation (L996-1004)**:
- `_validate_xtext()` - Checks for non-printable characters
- Registers `NonPrintableDefect` and `UndecodableBytesDefect` as needed

### Error Handling

- Comprehensive defect system with specific error types
- Graceful degradation: invalid tokens become `Invalid*` variants
- Error recovery continues parsing after encountering malformed input
- Defects propagate up token hierarchy via `all_defects` property

### Key Features

- **Postel's Law**: Liberal input acceptance with strict output generation
- **RFC Compliance**: Supports RFC 5322, 2822, 2047, 2231 specifications  
- **Encoding Support**: UTF-8 and legacy charset handling
- **Structured Output**: Parse trees suitable for programmatic manipulation
- **Folding**: Intelligent line-length management for header generation