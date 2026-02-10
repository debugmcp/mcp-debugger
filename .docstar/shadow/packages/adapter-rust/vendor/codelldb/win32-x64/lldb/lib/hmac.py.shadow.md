# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/hmac.py
@source-hash: 7facd1330e5487ed
@generated: 2026-02-09T18:14:25Z

## Purpose
Python implementation of HMAC (Hash-based Message Authentication Code) algorithm following RFC 2104 and RFC 4231. Provides cryptographic message authentication using keyed hashing. Part of LLDB's Python distribution for CodeLLDB adapter.

## Key Classes and Functions

### HMAC Class (L27-166)
Main RFC 2104 compliant HMAC implementation with PEP 247 cryptographic hash API support.

**Attributes:**
- `blocksize = 64` (L32): Default block size for 512-bit HMAC
- `__slots__` (L34-36): Memory optimization defining allowed attributes
- `digest_size`, `block_size`: Instance-specific sizes from underlying hash

**Key Methods:**
- `__init__(key, msg, digestmod)` (L38-64): Constructor with dual initialization paths
- `_init_hmac(key, msg, digestmod)` (L66-69): OpenSSL-backed fast path initialization
- `_init_old(key, msg, digestmod)` (L71-108): Pure Python fallback implementation
- `update(msg)` (L117-120): Feed data into hash object
- `digest()` (L151-159): Return raw HMAC bytes
- `hexdigest()` (L161-165): Return hex-encoded HMAC string
- `copy()` (L122-137): Create independent copy of HMAC state
- `_current()` (L139-149): Internal method returning current hash state

### Module Functions
- `new(key, msg, digestmod)` (L167-184): Factory function creating HMAC instances
- `digest(key, msg, digest)` (L187-219): Fast one-shot HMAC computation

## Architecture and Dependencies

**Import Strategy (L6-16):**
- Conditional OpenSSL import with fallback to pure Python
- `_hashopenssl` provides optimized C implementations when available
- Falls back to `hashlib` and manual HMAC computation

**Translation Tables (L19-20):**
- `trans_5C`, `trans_36`: Pre-computed XOR translation tables for HMAC padding constants
- Used in key preprocessing for inner/outer hash computations

## Implementation Patterns

**Dual Path Design:**
- OpenSSL path: Uses `_hashopenssl.hmac_new()` for performance
- Fallback path: Manual HMAC implementation using separate inner/outer hash objects
- Automatic fallback on `UnsupportedDigestmodError`

**Digest Module Handling:**
- Accepts string names, callable constructors, or PEP 247 modules
- Dynamic constructor creation via lambda functions (L75, L77, L205, L207)

**Key Processing:**
- Keys longer than block size are hashed to fit
- Keys padded to block size with null bytes
- XOR with HMAC constants (0x36 for inner, 0x5C for outer padding)

## Critical Constraints

- `digestmod` parameter required as of Python 3.8 (L47-49, L55-56)
- Key must be bytes or bytearray (L52-53)
- Block size validation with warnings for sizes < 16 (L86-90)
- Memory-efficient `__slots__` usage prevents dynamic attribute addition