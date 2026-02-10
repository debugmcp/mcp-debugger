# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/crypt.py
@source-hash: 208df2ff33c19056
@generated: 2026-02-09T18:09:36Z

## Purpose
Python wrapper for POSIX crypt library providing password hashing functionality with various encryption methods. Part of CPython's standard library but deprecated as of Python 3.13.

## Key Components

### Core Functions
- **`crypt(word, salt=None)` (L74-86)**: Main hashing function that creates one-way password hash. Auto-generates salt if none provided, delegates to native `_crypt.crypt()`.
- **`mksalt(method=None, *, rounds=None)` (L36-71)**: Generates cryptographic salt strings. Handles method-specific formatting including Blowfish rounds validation and SHA-2 rounds parameters.

### Method Management
- **`_Method` class (L27-34)**: Named tuple representing encryption methods with fields: name, ident, salt_chars, total_size. Provides custom `__repr__` for debugging.
- **`_add_method(name, *args, rounds=None)` (L92-107)**: Dynamically registers encryption methods by testing availability with empty password. Creates global `METHOD_*` constants.

### Supported Methods (L109-122)
Methods added in preference order (strongest first):
1. SHA512 (id='6', 16 salt chars, 106 total size)
2. SHA256 (id='5', 16 salt chars, 63 total size) 
3. BLOWFISH variants (id='2'+variant, 22 salt chars) - tries 'b', 'y', 'a', '' in order
4. MD5 (id='1', 8 salt chars, 34 total size)
5. Traditional CRYPT (no id, 2 salt chars, 13 total size)

## Dependencies
- **Native module**: `_crypt` - required, raises ImportError on Windows or if not built
- **Standard library**: `errno`, `string`, `warnings`, `random.SystemRandom`, `collections.namedtuple`

## Key Variables
- **`methods` (L90)**: List of available methods in preference order (strongest first)
- **`_saltchars` (L23)**: Valid salt characters (letters + digits + './')
- **`_sr` (L24)**: SystemRandom instance for cryptographically secure salt generation

## Architecture Notes
- Platform-aware: explicitly blocks Windows usage (L8-9)
- Graceful degradation: tests method availability and skips unsupported ones
- Modular Crypt Format support with legacy 2-character fallback
- Deprecated module with removal planned for Python 3.13 (L20)
- Dynamic method registration allows runtime capability detection