# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/hashlib.py
@source-hash: 6dbdebf270868b39
@generated: 2026-02-09T18:07:09Z

## hashlib.py - Python Hash Function Interface

Primary purpose: Provides a unified interface to various hash functions, supporting both built-in Python implementations and OpenSSL-backed implementations when available.

### Key Module-Level Variables

- `__always_supported` (L58-61): Tuple defining guaranteed available hash algorithms including MD5, SHA family, Blake2, SHA3, and SHAKE variants
- `algorithms_guaranteed` (L64): Set of algorithms always available regardless of platform
- `algorithms_available` (L65): Set that expands to include platform-specific algorithms
- `__builtin_constructor_cache` (L71): Cache for built-in hash constructors to avoid repeated imports
- `__block_openssl_constructor` (L78-80): Set of algorithms (blake2b, blake2s) where built-in implementations are preferred over OpenSSL

### Core Constructor Functions

- `__get_builtin_constructor(name)` (L82-123): Lazy-loads and caches built-in hash implementations from modules like `_sha1`, `_md5`, `_sha2`, `_blake2`, `_sha3`. Uses case-insensitive name matching and raises ValueError for unsupported algorithms.

- `__get_openssl_constructor(name)` (L126-141): Attempts to use OpenSSL implementations via `_hashlib` module, falling back to built-in constructors. Respects the `__block_openssl_constructor` preference.

- `__py_new(name, data, **kwargs)` (L144-149): Pure Python implementation of the `new()` function using only built-in constructors.

- `__hash_new(name, data, **kwargs)` (L152-166): Primary `new()` implementation that tries OpenSSL first, then falls back to built-in implementations.

### Public API

- `new(name, data, **kwargs)` (L171/177): Main factory function for creating hash objects. Points to either `__hash_new` or `__py_new` depending on `_hashlib` availability.

- `file_digest(fileobj, digest, _bufsize=262144)` (L195-238): Efficiently hashes file-like objects using optimized buffer reading. Supports zero-copy operations for BytesIO objects and uses readinto() for binary files.

### Module Initialization Logic

The module uses a sophisticated initialization pattern:

1. **OpenSSL Integration** (L169-178): Attempts to import `_hashlib` and configures OpenSSL-backed implementations
2. **Optional Features** (L180-192): Conditionally imports `pbkdf2_hmac` and `scrypt` if available
3. **Constructor Registration** (L241-248): Dynamically creates module-level constructor functions for each supported algorithm, with error logging for missing algorithms
4. **Cleanup** (L252-253): Removes internal variables from module namespace

### Architectural Patterns

- **Lazy Loading**: Hash implementations are imported only when first requested
- **Fallback Strategy**: OpenSSL implementations preferred but gracefully degrades to built-in Python implementations
- **Caching**: Constructor functions are cached to avoid repeated module imports and attribute lookups
- **Dynamic API Generation**: Constructor functions are programmatically added to module globals

### Critical Invariants

- Blake2 algorithms always use built-in implementations to access full feature set
- All algorithms in `__always_supported` must have corresponding built-in implementations
- The `new()` function must handle both string algorithm names and callable constructors
- File digest operations require binary mode file objects with `readinto()` support