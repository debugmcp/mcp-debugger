# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/hmac.py
@source-hash: 7facd1330e5487ed
@generated: 2026-02-09T18:07:08Z

## Primary Purpose
RFC 2104 HMAC (Hash-based Message Authentication Code) implementation with dual-path architecture: optimized OpenSSL backend when available, fallback to pure Python implementation.

## Key Classes and Functions

**HMAC Class (L27-166)**: Main RFC 2104/4231 compliant HMAC implementation
- `__init__(key, msg=None, digestmod='')` (L38-64): Constructor with dual initialization paths
- `_init_hmac(key, msg, digestmod)` (L66-69): OpenSSL backend initialization
- `_init_old(key, msg, digestmod)` (L71-108): Pure Python fallback with manual key padding/XOR
- `update(msg)` (L117-120): Feed data to underlying hash instance
- `copy()` (L122-137): Deep copy with backend-aware state duplication
- `digest()` (L151-159): Return binary HMAC value via `_current()` helper
- `hexdigest()` (L161-165): Return hex-encoded HMAC value

**Module Functions**:
- `new(key, msg=None, digestmod='')` (L167-184): Factory function, returns HMAC instance
- `digest(key, msg, digest)` (L187-219): One-shot HMAC computation with same dual-path logic

## Critical Dependencies
- `_hashlib/_hashopenssl`: OpenSSL bindings for performance (optional, L7-15)
- `hashlib`: Standard library hash functions for fallback (L17)
- `compare_digest`: Timing-safe comparison function (L12/L14)

## Architecture Patterns

**Dual Implementation Strategy**: Attempts OpenSSL backend first, gracefully falls back to pure Python on `UnsupportedDigestmodError` (L58-64, L196-200)

**HMAC Algorithm Implementation** (L71-108, L209-219):
- Key padding to block size with null bytes (L104, L214)
- XOR with ipad (0x36) and opad (0x5C) constants via translation tables (L19-20)
- Nested hash: `H(opad ∥ H(ipad ∥ key ∥ message))`

**State Management**: 
- OpenSSL path: Single `_hmac` object handles everything
- Pure Python path: Separate `_inner`/`_outer` hash objects maintain ipad/opad states

## Critical Constraints
- `digestmod` parameter required as of Python 3.8 (L47-49, L55-56)
- Key must be bytes/bytearray (L52-53)
- Block size validation with warnings for suspicious values <16 (L86-90)
- Maintains PEP 247 Cryptographic Hash Functions API compatibility

## Performance Optimizations
- Translation tables for XOR operations pre-computed (L19-20)
- `__slots__` for memory efficiency (L34-36)
- Direct `__new__` call in `copy()` to bypass expensive `__init__` (L127-128)
- One-shot `digest()` function avoids object creation overhead