# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/hmac.py
@source-hash: 7facd1330e5487ed
@generated: 2026-02-09T18:07:46Z

## HMAC Implementation Module

**Purpose**: Pure Python implementation of RFC 2104 HMAC (Keyed-Hashing for Message Authentication) algorithm with dual backend support (OpenSSL C extension and pure Python fallback).

**Architecture**: Uses a dual-path approach - attempts optimized C implementation via `_hashopenssl`, falls back to pure Python implementation for unsupported digest algorithms or missing C extensions.

### Key Components

**HMAC Class (L27-166)**
- Main HMAC implementation class complying with RFC 2104 and RFC 4231
- Supports PEP 247 Cryptographic Hash Functions API
- `__slots__` optimization for memory efficiency (L34-36)
- Default blocksize of 64 bytes (512-bit) (L32)

**Key Methods:**
- `__init__(key, msg, digestmod)` (L38-64): Constructor with dual initialization paths
- `_init_hmac(key, msg, digestmod)` (L66-69): Fast C extension initialization 
- `_init_old(key, msg, digestmod)` (L71-108): Pure Python fallback implementation
- `update(msg)` (L117-120): Feed data into hash object
- `digest()` (L151-159): Return binary hash value
- `hexdigest()` (L161-165): Return hex string hash value
- `copy()` (L122-137): Create independent copy of HMAC object
- `_current()` (L139-149): Internal method for current hash state

**Factory Functions:**
- `new(key, msg, digestmod)` (L167-184): Public factory function, creates HMAC instance
- `digest(key, msg, digest)` (L187-219): Fast one-shot HMAC computation

### Dependencies
- `_hashlib`: OpenSSL C extension (optional, L8-10)
- `hashlib`: Pure Python hash library (L17)
- `_operator.compare_digest`: Timing-safe comparison (L12-14)

### Critical Constants
- `trans_5C`, `trans_36` (L19-20): XOR translation tables for HMAC padding (0x5C and 0x36)
- `digest_size = None` (L24): Module-level placeholder (actual size determined per instance)

### Key Algorithms
1. **Dual Backend Selection**: Tries C extension first, falls back to pure Python (L58-64)
2. **Key Padding**: Keys longer than blocksize are hashed, shorter keys are zero-padded (L97-104, L212-214)
3. **HMAC Computation**: Standard RFC 2104 algorithm using inner/outer hash construction with XOR padding
4. **Block Size Detection**: Attempts to use digest's native block_size, warns and defaults to 64 if unavailable (L84-95)

### Security Features
- Timing-safe digest comparison via `compare_digest`
- Proper key handling with length-based preprocessing
- Immutable operation semantics (digest/hexdigest don't modify state)

### Error Handling
- Type validation for keys (must be bytes/bytearray) (L52-53)
- Required digestmod parameter validation (L55-56)
- Graceful fallback from C extension to pure Python on UnsupportedDigestmodError