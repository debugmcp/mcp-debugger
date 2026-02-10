# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/encodings/iso2022_kr.py
@source-hash: 1c86362e17944f0b
@generated: 2026-02-09T18:10:50Z

## Primary Purpose
Python Unicode codec implementation for ISO 2022-KR encoding, a Korean character encoding standard that uses escape sequences to switch between character sets.

## Core Architecture
The file follows Python's codec registry pattern, defining a complete codec implementation by wrapping a native C extension (`_codecs_iso2022`) with standardized Python codec interfaces.

## Key Components

### Codec Foundation
- **codec** (L10): Core codec object retrieved from `_codecs_iso2022.getcodec('iso2022_kr')` - provides native encode/decode functionality
- **Codec** (L12-14): Basic codec class exposing encode/decode methods directly from the native codec

### Incremental Processing Classes
- **IncrementalEncoder** (L16-18): Handles streaming encoding via multiple inheritance from `mbc.MultibyteIncrementalEncoder` and `codecs.IncrementalEncoder`
- **IncrementalDecoder** (L20-22): Handles streaming decoding with similar inheritance pattern

### Stream Processing Classes  
- **StreamReader** (L24-25): Combines Codec, `mbc.MultibyteStreamReader`, and `codecs.StreamReader` for file-like reading
- **StreamWriter** (L27-28): Combines Codec, `mbc.MultibyteStreamWriter`, and `codecs.StreamWriter` for file-like writing

### Registry Integration
- **getregentry()** (L30-39): Returns `codecs.CodecInfo` object for Python's codec registry, mapping encoding name to all codec classes

## Dependencies
- `_codecs_iso2022`: C extension providing native ISO 2022-KR implementation
- `_multibytecodec`: Multibyte codec utilities for incremental/stream processing  
- `codecs`: Python's standard codec framework

## Architecture Pattern
Uses composition over inheritance - all classes delegate actual encoding/decoding to the native `codec` object while providing different interfaces (basic, incremental, streaming) required by Python's codec system.

## Critical Notes
- All codec functionality ultimately delegates to the C extension for performance
- Multiple inheritance is used strategically to combine multibyte codec utilities with standard codec interfaces
- The pattern enables registration of a single encoding name with multiple processing modes