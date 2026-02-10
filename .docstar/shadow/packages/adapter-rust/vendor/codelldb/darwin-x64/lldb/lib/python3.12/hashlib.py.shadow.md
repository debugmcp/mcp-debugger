# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/hashlib.py
@source-hash: 6dbdebf270868b39
@generated: 2026-02-09T18:09:24Z

## hashlib.py - Python Standard Library Hash Function Interface

**Primary Purpose**: Provides a unified interface to multiple cryptographic hash functions, supporting both built-in Python implementations and OpenSSL-based implementations when available.

### Key Components

**Module Constants (L58-69)**:
- `__always_supported` (L58-61): Tuple of guaranteed available hash algorithms
- `algorithms_guaranteed` (L64): Set of always-supported algorithms
- `algorithms_available` (L65): Set of currently available algorithms (extended with OpenSSL algorithms if available)
- `__builtin_constructor_cache` (L71): Performance cache for constructor functions
- `__block_openssl_constructor` (L78-80): Set of algorithms preferring built-in over OpenSSL implementations

**Core Factory Functions**:
- `__get_builtin_constructor(name)` (L82-124): Returns built-in hash constructors, imports specific modules (_sha1, _md5, _sha2, _blake2, _sha3) on demand with caching
- `__get_openssl_constructor(name)` (L126-142): Returns OpenSSL-based constructors when available, falls back to built-in
- `__py_new(name, data, **kwargs)` (L144-149): Pure Python implementation of new() using built-in constructors
- `__hash_new(name, data, **kwargs)` (L152-166): Preferred new() implementation using OpenSSL when possible

**Public API**:
- `new(name, data, **kwargs)` (L171/177): Main factory function, assigned based on _hashlib availability
- `file_digest(fileobj, digest, _bufsize=2**18)` (L195-238): Efficiently hashes file-like objects using optimized I/O patterns

### Architectural Decisions

**Fallback Strategy**: The module implements a sophisticated fallback mechanism - OpenSSL implementations are preferred for performance, but built-in Python implementations are used when OpenSSL is unavailable or blocked.

**Dynamic Import Pattern** (L169-179): Conditionally imports `_hashlib` C extension and configures the entire module's behavior based on availability.

**Blake2 Preference** (L73-80): Explicitly prefers built-in blake2 implementations over OpenSSL versions due to feature limitations in OpenSSL's blake2 support.

**Performance Optimizations**:
- Constructor caching in `__builtin_constructor_cache`
- Zero-copy buffer handling in `file_digest()` for BytesIO objects (L213-216)
- Efficient chunked reading with reusable buffers for file objects (L230-237)

**Module Initialization** (L241-248): Dynamically populates global namespace with named constructor functions for all supported algorithms, with error handling for unavailable algorithms.

### Dependencies
- Internal modules: `_sha1`, `_md5`, `_sha2`, `_blake2`, `_sha3` (imported on demand)
- Optional: `_hashlib` (OpenSSL bindings)
- Standard library: `logging` (for error reporting)

### Usage Patterns
Supports both factory pattern (`hashlib.new('sha256')`) and direct constructors (`hashlib.sha256()`). All hash objects provide standard interface: `update()`, `digest()`, `hexdigest()`, `copy()`.