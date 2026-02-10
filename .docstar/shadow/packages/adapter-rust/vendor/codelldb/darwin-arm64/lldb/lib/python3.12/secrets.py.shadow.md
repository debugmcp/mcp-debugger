# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/secrets.py
@source-hash: 277000574358a6ec
@generated: 2026-02-09T18:07:12Z

**Primary Purpose**
Provides cryptographically secure random number generation and token creation utilities for security-sensitive applications like authentication tokens and secrets management. Part of Python's standard library implementing PEP 506.

**Key Components**

**Global SystemRandom Instance (L20)**
- `_sysrand = SystemRandom()`: Central cryptographically secure random number generator
- Uses OS entropy sources for true randomness vs pseudo-random

**Core Random Functions**
- `randbits` (L22): Alias to `_sysrand.getrandbits` for generating random bits
- `choice` (L23): Alias to `_sysrand.choice` for secure random selection
- `randbelow(exclusive_upper_bound)` (L25-29): Returns random int in range [0, n) with input validation

**Token Generation Functions**
- `token_bytes(nbytes=None)` (L33-45): Generates raw random bytes, defaults to 32 bytes
- `token_hex(nbytes=None)` (L47-58): Returns hex-encoded random string (2 chars per byte)  
- `token_urlsafe(nbytes=None)` (L60-71): Returns Base64 URL-safe encoded token with padding stripped

**Constants & Imports**
- `DEFAULT_ENTROPY = 32` (L31): Default byte count for token functions
- `compare_digest` (L17): Imported from hmac for timing-attack resistant comparison
- `SystemRandom` (L18): Imported and re-exported for direct access

**Dependencies**
- `base64`: For URL-safe Base64 encoding in token_urlsafe
- `hmac.compare_digest`: For secure string comparison
- `random.SystemRandom`: Core cryptographic random number generator

**Architecture Notes**
- All functions delegate to single SystemRandom instance for consistency
- Token functions build on each other: token_hex() calls token_bytes(), token_urlsafe() calls token_bytes()
- Input validation only in randbelow() - other functions accept None gracefully
- URL-safe tokens strip Base64 padding for cleaner appearance