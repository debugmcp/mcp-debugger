# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/encodings/idna.py
@source-hash: 9ca58e82d12b171f
@generated: 2026-02-09T18:10:54Z

## Purpose
Implements IDNA (Internationalized Domain Names in Applications) as per RFCs 3490 and 3491, providing codec functionality to convert international domain names between Unicode and ASCII-Compatible Encoding (ACE) using Punycode.

## Key Dependencies
- `stringprep` module for RFC 3454 string preparation tables
- `unicodedata.ucd_3_2_0` for Unicode 3.2.0 normalization
- `codecs` module for codec registration and base classes

## Core Constants & Patterns
- `dots` regex (L7): Matches various Unicode dot separators for domain labels
- `ace_prefix` (L10): Binary "xn--" prefix for ACE encoding
- `sace_prefix` (L11): String "xn--" prefix for ACE detection

## Core Functions

### nameprep(label) (L14-58)
Implements RFC 3454 nameprep algorithm for Unicode string preparation:
- Maps characters using stringprep tables B1/B2
- Normalizes to NFKC form using Unicode 3.2.0
- Prohibits characters from stringprep tables C1-C9
- Enforces bidirectional text requirements (BIDI) for right-to-left scripts

### ToASCII(label) (L60-101)
Converts Unicode domain label to ASCII-Compatible Encoding:
- Attempts direct ASCII encoding first
- Falls back to nameprep + Punycode encoding
- Adds "xn--" ACE prefix for non-ASCII labels
- Enforces 63-byte label length limit

### ToUnicode(label) (L103-150)
Converts ACE-encoded label back to Unicode:
- Handles both string and bytes input
- Applies nameprep for non-ASCII input
- Decodes Punycode after removing ACE prefix
- Performs round-trip validation to ensure consistency
- Includes 1024-character input limit for security (CVE protection)

## Codec Implementation

### Codec class (L154-224)
Base codec with strict-only error handling:
- `encode()` (L155-190): Splits on dots, processes each label via ToASCII
- `decode()` (L192-224): Splits on dots, processes each label via ToUnicode
- Fast-path optimization for pure ASCII domains

### IncrementalEncoder (L226-259) 
Buffered incremental encoding that handles partial input by preserving incomplete labels between calls.

### IncrementalDecoder (L261-298)
Buffered incremental decoding with similar partial input handling.

### Stream Classes (L300-304)
- `StreamWriter`/`StreamReader`: Simple codec wrappers for stream I/O

## Registration
`getregentry()` (L308-317): Returns CodecInfo for 'idna' codec registration.

## Architecture Notes
- Strict RFC compliance with no error handling flexibility
- Domain dot preservation logic handles trailing dots correctly
- Security considerations include input length limits
- Bidirectional text support for international scripts
- Round-trip validation ensures encoding/decoding consistency