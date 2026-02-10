# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/json/
@generated: 2026-02-09T18:16:10Z

## JSON Processing Library

This directory implements a complete JSON serialization/deserialization library that serves as a drop-in replacement for Python's standard `json` module. It is embedded within the LLDB debugger's vendored dependencies, providing JSON functionality for debugger data exchange and configuration.

## Overall Architecture

The module follows a layered architecture with performance-optimized dual implementations:

- **C Extension Layer**: Optional high-performance native implementations for critical operations
- **Pure Python Fallback**: Complete Python implementations ensuring compatibility when C extensions are unavailable
- **Public API Layer**: Clean interface matching Python's standard JSON module exactly

## Key Components & Relationships

### Core Processing Pipeline
1. **Scanner Module** (`scanner.py`) - Tokenizes JSON strings into individual tokens
2. **Decoder Module** (`decoder.py`) - Parses tokens into Python objects with error handling
3. **Encoder Module** (`encoder.py`) - Serializes Python objects to JSON strings/streams
4. **Main Module** (`__init__.py`) - Orchestrates the pipeline and provides the public API

### Public API Surface

**Primary Entry Points:**
- `dumps(obj, ...)` / `dump(obj, fp, ...)` - Object to JSON serialization
- `loads(s, ...)` / `load(fp, ...)` - JSON to object deserialization  
- `JSONEncoder` / `JSONDecoder` classes - Customizable encoding/decoding
- `JSONDecodeError` - Specialized exception for parse errors

**Command Line Interface:**
- `tool.py` - Standalone JSON validation and pretty-printing utility

## Internal Organization & Data Flow

### Serialization Flow
```
Python Object → JSONEncoder → _make_iterencode → String Escaping → JSON String
```

### Deserialization Flow  
```
JSON String → Scanner → Token Stream → JSONDecoder → Object Construction → Python Object
```

### Performance Optimizations
- **Cached Instances**: Pre-configured encoder/decoder instances for common cases
- **C Extension Integration**: Automatic fallback from native to Python implementations
- **Memory Efficiency**: Streaming approach for large objects, generator-based encoding
- **String Interning**: Memo patterns for string deduplication during parsing

## Important Patterns & Conventions

### Dual Implementation Strategy
Every performance-critical component maintains both C extension and pure Python implementations, with automatic fallback detection ensuring compatibility across environments.

### Position-Aware Parsing
All parsing functions return `(result, end_position)` tuples, enabling detailed error reporting with exact line/column information and supporting partial document parsing.

### Hook-Based Customization
Extensive hook system allows custom type conversion:
- `default()` functions for encoding unknown types
- `object_hook` for custom object construction during decoding
- Type-specific parsers for numbers, constants, and complex objects

### Unicode Compliance
Full Unicode support including UTF-16 surrogate pair handling, automatic encoding detection from byte order marks, and configurable ASCII-safe output modes.

## Integration Context

As part of LLDB's vendored dependencies, this JSON library provides:
- **Debugger Communication**: Structured data exchange between LLDB components
- **Configuration Management**: Parse/generate JSON configuration files
- **Data Serialization**: Convert debugger state and variables to portable formats
- **Protocol Support**: JSON-RPC or similar structured communication protocols

The library maintains complete compatibility with Python's standard `json` module while providing enhanced performance through optional C extensions, making it suitable for high-frequency debugging operations where JSON processing performance is critical.