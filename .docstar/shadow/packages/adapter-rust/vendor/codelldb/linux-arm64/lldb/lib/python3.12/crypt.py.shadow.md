# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/crypt.py
@source-hash: 208df2ff33c19056
@generated: 2026-02-09T18:08:38Z

## Purpose
Wrapper module for POSIX crypt library functionality with salt generation and password hashing using various cryptographic methods. Provides a Python interface to system-level password hashing with automatic method selection and salt generation.

## Key Components

### Core Functions
- **`crypt(word, salt=None)`** (L74-86): Main hashing function that takes a password and optional salt, returns one-way hash. Auto-generates salt using strongest available method if none provided.
- **`mksalt(method=None, *, rounds=None)`** (L36-71): Generates cryptographically secure salts for specified methods. Handles method-specific round parameters and validation.

### Method System
- **`_Method`** (L27-34): Named tuple subclass representing crypt methods with fields `name`, `ident`, `salt_chars`, `total_size`. Custom `__repr__` for debugging.
- **`_add_method(name, *args, rounds=None)`** (L92-107): Dynamically registers crypt methods by testing availability on the system. Creates global `METHOD_*` constants and populates `methods` list.

### Available Methods (L109-122)
Methods are tested in order of strength and added if supported:
- SHA512 (METHOD_SHA512): Strongest, 106 total chars
- SHA256 (METHOD_SHA256): Strong, 63 total chars  
- BLOWFISH (METHOD_BLOWFISH): Tries variants 'b', 'y', 'a', '' in order
- MD5 (METHOD_MD5): Legacy, 34 total chars
- CRYPT (METHOD_CRYPT): Traditional 2-char method, 13 total chars

### Platform Handling
- **Import logic** (L5-11): Gracefully handles missing `_crypt` module with platform-specific error messages for Windows vs other systems.
- **Deprecation warning** (L20): Module deprecated for removal in Python 3.13.

### Internal State
- **`methods`** (L90): List of available methods, populated dynamically in order of preference
- **`_saltchars`** (L23): Character set for salt generation (letters + digits + './')
- **`_sr`** (L24): SystemRandom instance for cryptographically secure salt generation

## Key Patterns
- **Method validation**: Each method tests actual system support by attempting encryption
- **Round parameter handling**: Method-specific validation (powers of 2 for Blowfish, ranges for SHA variants)
- **Fallback strategy**: Methods list maintains preference order with strongest-available selection
- **Modular Crypt Format**: Supports both traditional 2-char and modern `$id$` format salts

## Dependencies
- `_crypt`: System crypt library (platform-dependent)
- `errno`, `string`, `warnings`: Standard library modules
- `SystemRandom`: For cryptographically secure salt generation