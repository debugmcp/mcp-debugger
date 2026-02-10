# packages/adapter-javascript/vendor/js-debug/hash.js
@source-hash: 7e8a5ef62d0054b4
@generated: 2026-02-09T18:14:10Z

## Purpose
High-performance hashing utility for JavaScript debugging, providing WebAssembly-accelerated chromehash and SHA256 implementations for file and buffer hashing with encoding normalization support.

## Architecture
The code is minified/bundled JavaScript with three main layers:
1. **WebAssembly Bindings (L1-51)** - Low-level WASM interface with memory management
2. **Hashing Functions (L52-98)** - File and buffer hashing with encoding detection  
3. **Worker Interface (L99-134)** - Multi-threaded hash computation via worker threads

## Key Components

### WebAssembly Hasher Class (L47-51)
- `Hasher` class wrapping WASM chromehash implementation
- Methods: `constructor()`, `update(data)`, `digest(buffer)`, `free()`
- Includes FinalizationRegistry for memory cleanup

### Core Hash Functions (L52-76)
- `hash(buffer)` (L52) - Fast chromehash using WASM
- `shaHash(buffer)` (L54) - SHA256 with encoding normalization
- `hashFile(path, bufferSize=4096)` (L56) - Streaming file hash with BOM detection
- `shaHashFile(path, bufferSize=4096)` (L77) - SHA256 streaming file hash

### Encoding Detection (L90-98)
- `isUTF8BOM()` (L90) - Detects UTF-8 BOM (EF BB BF)
- `isUTF16LEBOM()` (L91) - Detects UTF-16LE BOM (FF FE)
- `isUTF16BEBOM()` (L92) - Detects UTF-16BE BOM (FE FF)
- `normalizeShaBuffer()` (L96) - Strips BOMs and normalizes encoding

### Worker Message Types (L99-104)
- HashFile (0), HashBytes (1), VerifyFile (2), VerifyBytes (3)
- Hash modes: Chromehash (0), SHA256 (1), SHA256Naive (2)

### Content Verification (L112-125)
- `verifyHash()` (L112) - Multi-format hash verification
- Handles Node.js wrapper patterns and shebang detection
- Supports both direct matching and wrapped code verification

### Worker Handler (L126-134)
- `processMessage()` (L126) - Async message processor for worker threads
- `setupWorker()` (L132) - Worker thread message handler setup

## Dependencies
- `fs` - File system operations
- `crypto` - Native SHA256 implementation
- `worker_threads` - Multi-threading support
- `string_decoder` - Text encoding utilities
- `path` - Path manipulation
- `util` - TextDecoder utilities

## Critical Patterns
- **Memory Management**: WASM instances require explicit `.free()` calls
- **Encoding Normalization**: All text converted to UTF-16LE before hashing
- **Streaming**: Large files processed in configurable chunks
- **BOM Handling**: Automatic detection and stripping of byte order marks
- **Worker Safety**: All operations wrapped in try-catch for worker stability

## Performance Characteristics
- WebAssembly chromehash significantly faster than pure JS
- Streaming approach prevents memory exhaustion on large files
- Buffer reuse minimizes allocation overhead
- Worker threads enable parallel hash computation