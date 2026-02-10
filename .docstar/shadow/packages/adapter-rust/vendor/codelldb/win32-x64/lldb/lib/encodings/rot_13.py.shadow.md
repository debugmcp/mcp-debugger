# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/encodings/rot_13.py
@source-hash: 14767f475acdc0bf
@generated: 2026-02-09T18:10:59Z

## Purpose
Python character encoding codec implementation for ROT13 cipher - a simple letter substitution cipher that replaces each letter with the letter 13 positions after it in the alphabet. Part of LLDB's encoding support within the Rust adapter package.

## Core Components

**Codec Class (L13-18)**: Main codec implementation inheriting from `codecs.Codec`. Both `encode()` and `decode()` methods perform identical ROT13 transformation using `str.translate()` with the `rot13_map` translation table, returning tuple of (transformed_string, input_length).

**Incremental Processors (L20-26)**: 
- `IncrementalEncoder` (L20-22): Supports streaming encoding with `encode()` method
- `IncrementalDecoder` (L24-26): Supports streaming decoding with `decode()` method
Both use same ROT13 transformation as base Codec.

**Stream Handlers (L28-32)**:
- `StreamWriter` (L28-29): File-like writing interface, inherits from Codec and codecs.StreamWriter
- `StreamReader` (L31-32): File-like reading interface, inherits from Codec and codecs.StreamReader

**Registry Function (L36-46)**: `getregentry()` returns `CodecInfo` object registering all codec components with name 'rot-13'. Sets `_is_text_encoding=False` indicating this is not a standard text encoding.

## Translation Map

**rot13_map (L50-104)**: Character translation dictionary created from identity mapping for all 256 characters, then updated with ROT13 substitutions:
- Uppercase A-Z (0x0041-0x005a) → N-Z, A-M 
- Lowercase a-z (0x0061-0x007a) → n-z, a-m
- All other characters remain unchanged

## Utility Functions

**rot13() (L108-109)**: File processing function that reads from input file, applies ROT13 encoding, and writes to output file.

**Main Execution (L111-113)**: Command-line interface that applies ROT13 to stdin→stdout when run as script.

## Dependencies
- `codecs`: Standard library codec framework
- `sys`: For stdin/stdout access in main execution

## Key Characteristics
- Symmetric operation: encoding and decoding are identical
- Preserves non-alphabetic characters
- Works with both incremental and stream processing
- Registered as non-text encoding in Python's codec system