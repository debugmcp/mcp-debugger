# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/hashlib.py
@source-hash: 6dbdebf270868b39
@generated: 2026-02-09T18:09:42Z

## hashlib.py - Hash Function Interface Module

**Primary Purpose:** Provides a unified interface to cryptographic hash functions, supporting both built-in Python implementations and OpenSSL-backed versions with automatic fallback mechanisms.

### Core Architecture

**Constructor Selection Strategy (L82-179):**
- `__get_builtin_constructor(name)` (L82-124): Returns pure Python hash constructors with caching
- `__get_openssl_constructor(name)` (L126-142): Prefers OpenSSL implementations, falls back to builtin
- Dynamic selection based on `_hashlib` availability determines which backend is used

**Public Interface:**
- `new(name, data=b'', **kwargs)` (L144-167): Main factory function, dynamically assigned to either `__py_new` or `__hash_new`
- `file_digest(fileobj, digest, /, *, _bufsize=2**18)` (L195-238): Efficiently hashes file-like objects with buffer reuse
- Named constructors (L241-248): Direct access functions like `md5()`, `sha256()`, etc.

### Key Data Structures

**Algorithm Support (L58-66):**
- `__always_supported` (L58-61): Tuple of guaranteed algorithms
- `algorithms_guaranteed`/`algorithms_available` (L64-65): Sets tracking supported algorithms
- `__builtin_constructor_cache` (L71): Performance cache for constructor functions

**OpenSSL Integration (L73-80):**
- `__block_openssl_constructor` (L78-80): Forces builtin implementations for blake2 variants due to OpenSSL limitations

### Implementation Details

**Module Loading Strategy (L169-179):**
- Attempts to import `_hashlib` (OpenSSL backend)
- On failure, falls back to pure Python implementations
- Updates `algorithms_available` with OpenSSL-provided algorithms

**Constructor Caching Pattern (L82-124):**
- Lazy imports of hash modules (`_sha1`, `_md5`, `_sha2`, `_sha3`, `_blake2`)
- Populates cache with both lowercase and uppercase algorithm names
- Handles ImportError gracefully for missing extensions

**File Processing Optimization (L195-238):**
- Zero-copy processing for `io.BytesIO` objects using `getbuffer()`
- Buffer reuse with `bytearray` and `memoryview` for file objects
- Validates binary read mode before processing

### Dependencies
- Optional: `_hashlib` (OpenSSL binding)
- Optional: `_sha1`, `_md5`, `_sha2`, `_sha3`, `_blake2` (builtin hash modules)
- Standard: `logging` for error reporting

### Critical Constraints
- Blake2 implementations prefer builtin over OpenSSL due to feature limitations
- File objects must support binary reading mode for `file_digest()`
- Constructor cache ensures consistent instances across calls
- Algorithm availability depends on Python build configuration and OpenSSL version