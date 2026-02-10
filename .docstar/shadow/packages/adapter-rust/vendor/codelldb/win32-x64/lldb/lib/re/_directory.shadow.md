# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/re/
@generated: 2026-02-09T18:16:15Z

## Overview

This directory contains the complete implementation of Python's `re` (regular expression) module - the standard library's primary regex engine. It provides a comprehensive Perl-compatible regular expression system with full Unicode support, case-insensitive matching, and extensive pattern matching capabilities.

## Architecture and Component Relationships

The module follows a layered architecture with clear separation of concerns:

### Public API Layer
**`__init__.py`** serves as the main public interface, exposing all regex functionality through functions like `match()`, `search()`, `sub()`, `findall()`, `compile()`, and `split()`. It implements a sophisticated dual-caching system (LRU + FIFO) for compiled patterns and manages the complete regex workflow from user input to compiled patterns.

### Compilation Pipeline
The compilation process flows through three core modules:

1. **`_parser.py`** - Tokenizes and parses regex strings into Abstract Syntax Trees (AST), handling escape sequences, character classes, groups, quantifiers, and flags
2. **`_compiler.py`** - Converts parsed ASTs into optimized bytecode for the C extension, including prefix extraction and character set optimization
3. **`_constants.py`** - Provides opcodes, flags, character categories, and the central `error` exception class

### Supporting Data
**`_casefix.py`** contains auto-generated Unicode case-folding tables that handle complex case-insensitive matching for characters with multiple lowercase variants.

## Key Data Flow

1. **Pattern Input** → `__init__.py` public functions
2. **Parsing** → `_parser.py` converts strings to AST representation
3. **Compilation** → `_compiler.py` generates optimized bytecode
4. **Caching** → Compiled patterns stored in dual-cache system
5. **Execution** → Bytecode executed by `_sre` C extension

## Public API Surface

### Primary Functions
- **Matching**: `match()`, `fullmatch()`, `search()`
- **Substitution**: `sub()`, `subn()`  
- **Splitting**: `split()`
- **Finding**: `findall()`, `finditer()`
- **Compilation**: `compile()`
- **Utilities**: `escape()`, `purge()`

### Pattern Flags
Comprehensive flag system via `RegexFlag` enum supporting ASCII, IGNORECASE, LOCALE, MULTILINE, DOTALL, VERBOSE, UNICODE modes.

### Type System
Dynamic Pattern and Match types created from compiled regex objects, with full pickle support.

## Internal Organization

### Optimization Strategy
- **Prefix Extraction**: Literal and character set prefixes for fast matching
- **Character Set Optimization**: Bitmaps, ranges, and chunked representations
- **Caching**: Two-tier system balancing hit rates and latency
- **Width Analysis**: Min/max character bounds for efficient matching

### Flag Handling
Sophisticated flag management supporting:
- Global flags affecting entire patterns
- Local flags for subpatterns  
- Case-sensitive/insensitive mode switching
- Locale and Unicode-aware matching

### Error Handling
Centralized error system with detailed position information, line/column tracking for both string and bytes patterns.

## Critical Patterns

- **Lazy Compilation**: Patterns compiled on first use and cached
- **Recursive Descent Parsing**: Clean separation of tokenization and parsing phases  
- **Bytecode Generation**: Multi-pass compilation with optimization passes
- **Unicode Support**: Comprehensive character category handling with locale variants
- **Extension Points**: Template compilation and Scanner class for lexical analysis

## Dependencies

- **`_sre`**: Core C extension providing regex engine
- **`enum`**: Flag definitions
- **`functools`**: LRU caching infrastructure
- **`copyreg`**: Pickle support for compiled patterns

This module represents a complete, production-ready regular expression system with extensive optimization, comprehensive Unicode support, and a clean public API that abstracts the underlying compilation complexity.