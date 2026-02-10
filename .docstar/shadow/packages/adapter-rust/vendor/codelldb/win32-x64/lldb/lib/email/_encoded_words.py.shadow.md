# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/email/_encoded_words.py
@source-hash: 4178321600c0a19c
@generated: 2026-02-09T18:10:28Z

## Purpose
Internal email module for encoding/decoding RFC 2047 encoded words in email headers. Handles charset conversion and content transfer encoding (CTE) for non-ASCII text in email headers.

## Architecture
Two-phase encoding/decoding system:
1. **Content Transfer Encoding**: Base64 ('b') or Quoted-Printable ('q')  
2. **Charset conversion**: Between bytes and Unicode strings

## Core Functions

### Quoted-Printable (Q-encoding)
- `decode_q(encoded)` (L67-69): Decodes Q-encoded bytes, replacing '_' with spaces and hex sequences
- `encode_q(bstring)` (L89-90): Encodes bytes using Q-encoding rules
- `len_q(bstring)` (L92-93): Calculates encoded length
- `_QByteMap` class (L73-83): Custom dict for byte-to-encoding mapping with safe characters

### Base64 (B-encoding)  
- `decode_b(encoded)` (L100-136): Robust Base64 decoder with padding correction and error handling
- `encode_b(bstring)` (L138-139): Standard Base64 encoding
- `len_b(bstring)` (L141-144): Calculates Base64 encoded length

### Main API
- `decode(ew)` (L152-191): Parses RFC 2047 encoded word format `=?charset*lang?cte?encoded_string?=`, returns (string, charset, lang, defects)
- `encode(string, charset, encoding, lang)` (L204-233): Creates RFC 2047 encoded word, auto-selects optimal CTE

## Key Data Structures
- `_cte_decoders` (L147-150): Maps CTE identifiers to decoder functions
- `_cte_encoders` (L194-197): Maps CTE identifiers to encoder functions  
- `_cte_encode_length` (L199-202): Maps CTE identifiers to length calculators
- `_q_byte_subber` (L64-65): Compiled regex for Q-encoding hex substitution

## Error Handling
Uses `email.errors` defect system for graceful degradation:
- Invalid Base64 padding/characters
- Unknown charsets (fallback to 'unknown-8bit')
- Unicode decode errors (surrogateescape handling)

## Dependencies
- `re`, `base64`, `binascii`: Core encoding operations
- `email.errors`: Defect reporting system
- `functools`: Partial function application for regex