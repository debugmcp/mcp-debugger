# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/encodings/hz.py
@source-hash: 025a9531e3046e52
@generated: 2026-02-09T18:10:46Z

## Purpose
Python Unicode codec implementation for the HZ (Hanzi) encoding standard, providing complete encoding/decoding capabilities for Chinese text using the HZ character encoding format.

## Core Components

**Codec Registration (L10, L30-39)**: Retrieves the native HZ codec from `_codecs_cn` module and creates a full `CodecInfo` registration entry with all required codec interfaces.

**Base Codec Class (L12-14)**: Simple wrapper that exposes the native codec's encode/decode methods through the standard Python `codecs.Codec` interface.

**Incremental Processing Classes**:
- `IncrementalEncoder` (L16-18): Handles streaming encoding with state preservation across chunks
- `IncrementalDecoder` (L20-22): Handles streaming decoding with state preservation across chunks

**Stream Processing Classes**:
- `StreamReader` (L24-25): File-like interface for reading HZ-encoded streams
- `StreamWriter` (L27-28): File-like interface for writing HZ-encoded streams

## Dependencies
- `_codecs_cn`: Native Chinese codec implementation (provides core HZ algorithm)
- `_multibytecodec`: Multibyte codec infrastructure for incremental and stream operations
- `codecs`: Standard Python codec framework

## Architecture Pattern
Follows Python's standard codec registration pattern with multiple inheritance to combine:
1. Native codec functionality (`_codecs_cn`)
2. Multibyte codec infrastructure (`_multibytecodec`) 
3. Standard codec interfaces (`codecs`)

All classes share the same underlying `codec` instance, ensuring consistent behavior across different usage patterns (direct, incremental, streaming).

## Key Invariant
The `codec` instance (L10) is shared across all codec classes, providing unified encoding/decoding behavior regardless of the interface used.