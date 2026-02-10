# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/encodings/punycode.py
@source-hash: 34edc8fb1c50e4d1
@generated: 2026-02-09T18:10:58Z

## Purpose
Implements RFC 3492 Punycode encoding/decoding for internationalized domain names (IDN). Separates ASCII characters from extended Unicode characters, encodes extended characters using variable-length integer encoding with bias adaptation.

## Core Encoding Algorithm (L10-124)
- **segregate()** (L10-20): Separates ASCII (<128) from extended Unicode characters
- **selective_len()** (L22-28): Counts characters below specified ordinal threshold
- **selective_find()** (L30-46): Locates next character occurrence with position tracking
- **insertion_unsort()** (L48-68): Generates delta values for character insertion positions
- **T()** (L70-75): Calculates threshold values using Punycode parameters (tmin=1, tmax=26, base=36)
- **generate_generalized_integer()** (L78-89): Encodes integers using base-36 digits
- **adapt()** (L91-103): Adjusts bias for optimal encoding based on character frequency
- **generate_integers()** (L106-115): Applies bias adaptation to delta sequence
- **punycode_encode()** (L117-123): Main encoding entry point

## Core Decoding Algorithm (L127-194)
- **decode_generalized_number()** (L127-154): Decodes variable-length base-36 integers
- **insertion_sort()** (L157-180): Reconstructs original string from deltas and bias
- **punycode_decode()** (L182-194): Main decoding entry point with ASCII/extended separation

## Codec Implementation (L198-237)
- **Codec** (L198-208): Basic encode/decode interface
- **IncrementalEncoder/IncrementalDecoder** (L210-218): Streaming encode/decode support
- **StreamWriter/StreamReader** (L220-224): File-like object interfaces
- **getregentry()** (L228-237): Python codec registration function

## Key Constants & Parameters
- Punycode constants: initial_bias=72, damp=700, skew=38, base=36
- Digit mapping: 'abcdefghijklmnopqrstuvwxyz0123456789' (L77)
- Unicode limit: 0x10FFFF for valid characters (L172)

## Dependencies
- codecs: Python standard library codec framework
- No external dependencies

## Architecture Notes
- Implements complete RFC 3492 specification
- Error handling: 'strict', 'replace', 'ignore' modes
- Memory efficient: uses bytearray for mutable sequences
- Stateless design: no instance variables in core functions