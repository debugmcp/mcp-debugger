# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/encodings/utf_32_be.py
@source-hash: cbba20e1f6d0879c
@generated: 2026-02-09T18:10:59Z

## Purpose
Python encoding module implementing UTF-32 Big Endian codec support. Part of the Python standard encodings library, providing complete codec infrastructure for UTF-32-BE character encoding/decoding operations.

## Key Components

### Core API Functions
- `encode` (L8): Direct reference to `codecs.utf_32_be_encode` for basic encoding operations
- `decode(input, errors='strict')` (L10-11): Wrapper around `codecs.utf_32_be_decode` with BOM handling enabled (third parameter `True`)

### Incremental Processing Classes
- `IncrementalEncoder` (L13-15): Extends `codecs.IncrementalEncoder`, implements chunked encoding via `encode(input, final=False)`
- `IncrementalDecoder` (L17-18): Extends `codecs.BufferedIncrementalDecoder`, uses `_buffer_decode` attribute for UTF-32-BE decoding

### Stream Processing Classes  
- `StreamWriter` (L20-21): Extends `codecs.StreamWriter` with UTF-32-BE encoding capability
- `StreamReader` (L23-24): Extends `codecs.StreamReader` with UTF-32-BE decoding capability

### Module Registration
- `getregentry()` (L28-37): Returns `codecs.CodecInfo` object registering all codec components under name 'utf-32-be'

## Dependencies
- `codecs` module: Provides all underlying UTF-32-BE implementation functions and base classes

## Architecture Notes
- Follows standard Python encoding module pattern with thin wrappers around `codecs` module functions
- BOM (Byte Order Mark) handling is explicitly enabled in decode function
- All classes delegate actual encoding/decoding work to optimized C implementations in `codecs` module
- Designed for registration with Python's encoding registry system

## Critical Behavior
- Decode function always enables BOM consumption (third parameter `True` in L11)
- Big-endian byte ordering enforced throughout all operations
- Error handling delegated to underlying `codecs` functions with configurable error modes