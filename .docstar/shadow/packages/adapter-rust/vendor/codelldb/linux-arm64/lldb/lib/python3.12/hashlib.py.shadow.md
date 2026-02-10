# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/hashlib.py
@source-hash: 6dbdebf270868b39
@generated: 2026-02-09T18:08:44Z

## hashlib.py - Python Hash Function Interface

**Primary Purpose**: Provides a unified interface to cryptographic hash functions, supporting both OpenSSL-backed implementations and Python built-in alternatives.

### Key Components

**Module Constants (L58-68)**
- `__always_supported` (L58-61): Tuple defining guaranteed hash algorithms including MD5, SHA family, BLAKE2, SHA3, and SHAKE
- `algorithms_guaranteed`/`algorithms_available` (L64-65): Sets exposing supported algorithms to users
- `__builtin_constructor_cache` (L71): Performance optimization cache for constructor functions

**Constructor Resolution System**
- `__get_builtin_constructor(name)` (L82-123): Lazy-loads Python built-in hash implementations from modules like `_sha1`, `_md5`, `_sha2`, `_sha3`, `_blake2`
- `__get_openssl_constructor(name)` (L126-141): Attempts OpenSSL implementation first, falls back to built-in
- `__block_openssl_constructor` (L78-80): Forces BLAKE2 variants to use built-in implementations due to OpenSSL limitations

**Public Interface Functions**
- `new(name, data, **kwargs)` (L144-167): Primary factory function, dynamically assigned to either `__py_new` or `__hash_new` based on OpenSSL availability
- `file_digest(fileobj, digest, _bufsize)` (L195-238): Efficiently hashes file contents with buffer optimization and zero-copy support for BytesIO objects

**Runtime Initialization (L169-252)**
- OpenSSL integration detection (L169-178): Sets up `_hashlib` module if available
- Optional feature imports: `pbkdf2_hmac` (L180-185) and `scrypt` (L188-192)
- Constructor registration loop (L241-248): Populates global namespace with named hash functions
- Cleanup (L251-252): Removes internal variables from module namespace

### Architecture Patterns

**Fallback Strategy**: OpenSSL preferred for performance, with built-in Python implementations as fallbacks
**Lazy Loading**: Hash modules imported only when first requested
**Caching**: Constructor functions cached after first resolution
**Preference Override**: BLAKE2 always uses built-in implementation despite OpenSSL availability

### Dependencies
- `_hashlib` (OpenSSL bindings) - optional
- Built-in hash modules: `_sha1`, `_md5`, `_sha2`, `_sha3`, `_blake2`
- `logging` for error reporting

### Critical Invariants
- All algorithms in `__always_supported` must be available through built-in implementations
- Constructor cache prevents repeated module imports
- File digest operations require binary mode file-like objects