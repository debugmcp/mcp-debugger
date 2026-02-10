# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/hmac.py
@source-hash: 7facd1330e5487ed
@generated: 2026-02-09T18:08:46Z

## Purpose
Python standard library HMAC implementation following RFC 2104/4231 with OpenSSL optimization fallback. Part of the LLDB Python distribution for cryptographic hash-based message authentication.

## Key Classes and Functions

### HMAC Class (L27-166)
Primary HMAC implementation supporting PEP 247 Cryptographic Hash Functions API.

**Key attributes:**
- `blocksize = 64` (L32): Default 512-bit block size
- `__slots__` (L34-36): Memory optimization for `_hmac`, `_inner`, `_outer`, `block_size`, `digest_size`

**Core methods:**
- `__init__(key, msg, digestmod)` (L38-64): Constructor with dual initialization paths
- `_init_hmac(key, msg, digestmod)` (L66-69): OpenSSL-optimized path using `_hashopenssl.hmac_new`
- `_init_old(key, msg, digestmod)` (L71-108): Fallback pure Python implementation
- `update(msg)` (L117-120): Feed data into hash object
- `digest()` (L151-159): Returns HMAC as bytes
- `hexdigest()` (L161-165): Returns HMAC as hex string
- `copy()` (L122-137): Deep copy with state preservation
- `_current()` (L139-149): Internal state snapshot for digest operations

### Module Functions
- `new(key, msg, digestmod)` (L167-184): Factory function, returns HMAC instance
- `digest(key, msg, digest)` (L187-219): Fast one-shot HMAC computation with OpenSSL optimization

## Dependencies
- `_hashlib`/`_hashopenssl`: OpenSSL bindings with fallback handling (L7-15)
- `hashlib`: Pure Python hash implementations (L17)
- `compare_digest`: Timing attack resistant comparison (L12/L14)

## Architecture Patterns

**Dual Implementation Strategy:**
- Primary: OpenSSL-accelerated via `_hashopenssl.hmac_new` when available
- Fallback: Pure Python using inner/outer hash pattern with XOR padding tables

**XOR Translation Tables (L19-20):**
- `trans_5C`: Outer pad (0x5C XOR) lookup table
- `trans_36`: Inner pad (0x36 XOR) lookup table

**State Management:**
- OpenSSL path: Single `_hmac` object handles all operations
- Pure Python path: Separate `_inner`/`_outer` hash objects with manual HMAC construction

## Critical Invariants
- `digestmod` parameter required as of Python 3.8 (L47-49, L55-56)
- Key must be bytes/bytearray (L52-53)
- Block size validation with runtime warnings for suspicious values (L86-95)
- Key length > block size triggers key hashing (L97-98, L212-213)
- Zero-padding applied to normalize key length (L104, L214)