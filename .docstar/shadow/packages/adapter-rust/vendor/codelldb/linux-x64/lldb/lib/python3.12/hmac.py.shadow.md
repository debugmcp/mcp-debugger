# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/hmac.py
@source-hash: 7facd1330e5487ed
@generated: 2026-02-09T18:09:42Z

## Purpose
Python standard library implementation of HMAC (Keyed-Hashing for Message Authentication) algorithm per RFC 2104/4231. Provides both object-oriented and functional interfaces for computing message authentication codes.

## Key Classes and Functions

### HMAC Class (L27-165)
Primary class implementing RFC 2104 HMAC with PEP 247 cryptographic hash API compliance.

**Key Methods:**
- `__init__(key, msg=None, digestmod='')` (L38-64): Constructor with dual initialization paths
- `_init_hmac(key, msg, digestmod)` (L66-69): OpenSSL-optimized initialization when available
- `_init_old(key, msg, digestmod)` (L71-108): Pure Python fallback implementation
- `update(msg)` (L117-120): Feed data into hash object
- `digest()` (L151-159): Return binary hash value
- `hexdigest()` (L161-165): Return hex-encoded hash value
- `copy()` (L122-137): Create independent copy of HMAC state
- `_current()` (L139-149): Internal method for computing current hash state

**Key Attributes:**
- `blocksize = 64` (L32): Default block size for HMAC operations
- `__slots__` (L34-36): Memory optimization limiting instance attributes
- Dual storage: `_hmac` for OpenSSL backend, `_inner/_outer` for pure Python

### Module Functions

**new(key, msg=None, digestmod='')** (L167-184)
Factory function creating HMAC instances. Mirrors HMAC.__init__ signature.

**digest(key, msg, digest)** (L187-219)
Fast one-shot HMAC computation without object creation. Optimized for single-use scenarios.

## Architecture Patterns

### Dual Backend Strategy
- **OpenSSL Path**: Uses `_hashopenssl` module when available for performance (L58-62, L196-200)
- **Pure Python Path**: Fallback using manual HMAC computation with inner/outer hash states (L63-64, L201-219)

### Key Processing (L97-108, L212-214)
- Keys longer than block size are hashed to reduce length
- Keys shorter than block size are zero-padded
- Standard HMAC XOR operations using precomputed translation tables

## Dependencies
- `_hashlib`/`hashlib`: Hash function implementations
- `_hashopenssl`: Optional OpenSSL bindings for performance
- `_operator.compare_digest`: Timing-safe comparison (fallback only)

## Constants and Globals
- `trans_5C, trans_36` (L19-20): XOR translation tables for HMAC pad constants
- `digest_size = None` (L24): Module-level placeholder (actual size from hash instances)
- `compare_digest`: Timing-safe comparison function (L12-14)

## Critical Invariants
- `digestmod` parameter required as of Python 3.8 (enforced L55-56)
- Key must be bytes or bytearray (validated L52-53)
- Block size minimum of 16 bytes with warning for smaller values (L86-90)
- State preservation: `copy()` creates truly independent instances