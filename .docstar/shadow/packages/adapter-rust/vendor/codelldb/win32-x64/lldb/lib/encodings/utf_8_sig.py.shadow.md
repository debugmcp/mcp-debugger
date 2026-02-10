# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/encodings/utf_8_sig.py
@source-hash: 1ef3da8d8aa08149
@generated: 2026-02-09T18:11:07Z

## Purpose
Python codec implementation for UTF-8 with BOM (Byte Order Mark) signature handling. Provides encoding/decoding that automatically manages UTF-8 BOM prefix (0xEF 0xBB 0xBF) for compatibility with systems that require or expect BOM markers.

## Core Functions
- `encode(input, errors='strict')` (L14-16): Prepends UTF-8 BOM to encoded output, returns (encoded_bytes, input_length)
- `decode(input, errors='strict')` (L18-24): Strips UTF-8 BOM if present at start of input, returns (decoded_string, consumed_bytes)

## Key Classes

### IncrementalEncoder (L26-47)
Stateful encoder that adds BOM only on first encoding operation. Tracks state via `self.first` flag.
- `encode(input, final=False)` (L31-37): Adds BOM on first call, standard UTF-8 encoding thereafter
- `reset()` (L39-41): Resets first-call flag
- State management via `getstate()`/`setstate()` (L43-47)

### IncrementalDecoder (L49-83)
Buffered decoder that handles partial BOM detection across multiple decode calls.
- `_buffer_decode(input, errors, final)` (L54-69): Core logic with BOM detection and partial input handling
- BOM detection logic: waits for 3+ bytes before deciding, handles partial BOM prefixes
- State management preserves both buffer state and first-call flag

### StreamWriter (L85-95)
Stream-based encoder with dynamic method replacement optimization.
- `encode()` (L93-95): Replaces itself with `codecs.utf_8_encode` after first BOM-prefixed call
- `reset()` (L86-91): Removes dynamic method replacement to restore BOM behavior

### StreamReader (L97-117)
Stream-based decoder with similar dynamic method replacement pattern.
- `decode()` (L105-117): Handles BOM detection then replaces itself with `codecs.utf_8_decode`
- Partial input handling for BOM detection (L106-110)

## Module API
- `getregentry()` (L121-130): Returns `CodecInfo` object for codec registration system

## Dependencies
- `codecs` module: Core codec infrastructure, BOM constants, and UTF-8 encode/decode functions

## Architecture Patterns
- **State Management**: All classes use `first` flag to track initial processing state
- **Dynamic Method Replacement**: Stream classes replace their own methods after BOM processing for performance
- **Partial Input Handling**: Decoders carefully handle cases where BOM might be split across input chunks
- **Error Propagation**: Consistent error parameter threading through codec chain

## Critical Invariants
- BOM is exactly 3 bytes (UTF-8 encoded: 0xEF 0xBB 0xBF)
- Encoders always prepend BOM on first operation
- Decoders only consume BOM if present at absolute start of stream
- State must be properly managed across reset/getstate/setstate operations