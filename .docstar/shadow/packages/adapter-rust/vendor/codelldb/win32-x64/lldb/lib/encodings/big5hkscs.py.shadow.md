# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/encodings/big5hkscs.py
@source-hash: 21d051a00fb5c6a8
@generated: 2026-02-09T18:10:34Z

## Purpose
Python Unicode codec implementation for BIG5-HKSCS character encoding, providing comprehensive encode/decode functionality for Hong Kong Supplementary Character Set variant of Big5 encoding.

## Core Components

**Codec Class (L12-14)**: Base codec class inheriting from `codecs.Codec`, delegates encode/decode operations to the native `_codecs_hk` implementation.

**IncrementalEncoder (L16-18)**: Supports incremental encoding by combining `mbc.MultibyteIncrementalEncoder` and `codecs.IncrementalEncoder` for streaming data processing.

**IncrementalDecoder (L20-22)**: Provides incremental decoding capabilities through multiple inheritance pattern matching the encoder structure.

**StreamReader (L24-25)**: File-like reading interface combining Codec, multibyte stream handling, and standard stream reader functionality.

**StreamWriter (L27-28)**: File-like writing interface with same inheritance pattern as StreamReader for output operations.

**getregentry() (L30-39)**: Registration function returning `CodecInfo` object that registers all codec components with Python's codec registry system.

## Dependencies
- `_codecs_hk`: Native Hong Kong codecs module providing core BIG5-HKSCS implementation
- `_multibytecodec`: Multibyte codec infrastructure (mbc alias)
- `codecs`: Python standard library codec framework

## Architecture Pattern
Follows Python's standard codec registration pattern with delegation to native implementation. Uses multiple inheritance to combine multibyte functionality with standard codec interfaces. All classes share the same underlying codec instance (L10) for consistency.

## Key Invariant
All codec classes reference the same `codec` instance from `_codecs_hk.getcodec('big5hkscs')`, ensuring consistent encoding behavior across different usage patterns.