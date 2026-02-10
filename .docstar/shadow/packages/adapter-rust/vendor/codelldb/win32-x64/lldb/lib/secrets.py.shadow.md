# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/secrets.py
@source-hash: 277000574358a6ec
@generated: 2026-02-09T18:12:59Z

**Primary Purpose**: Cryptographically secure random number generation module for managing secrets, tokens, and authentication data. Provides a simplified interface to SystemRandom with token generation utilities.

**Core Architecture**:
- Built around a single SystemRandom instance (`_sysrand`, L20) for all operations
- Exposes convenience functions that delegate to the underlying SystemRandom methods
- Follows PEP 506 specification for secure random number generation

**Key Functions**:

**Random Number Generation**:
- `randbits` (L22): Direct alias to `_sysrand.getrandbits` for generating random integers with specified bit length
- `choice` (L23): Direct alias to `_sysrand.choice` for selecting random elements from sequences  
- `randbelow(exclusive_upper_bound)` (L25-29): Generates random integers in range [0, n), validates positive upper bound

**Token Generation Functions**:
- `token_bytes(nbytes=None)` (L33-45): Generates random byte strings, defaults to 32 bytes (DEFAULT_ENTROPY)
- `token_hex(nbytes=None)` (L47-58): Creates hexadecimal token strings by converting random bytes to hex
- `token_urlsafe(nbytes=None)` (L60-71): Produces URL-safe Base64 encoded tokens with padding stripped

**Dependencies**:
- `base64`: For URL-safe Base64 encoding in token_urlsafe
- `hmac.compare_digest`: Imported for constant-time string comparison (security utility)
- `random.SystemRandom`: Core cryptographically secure random number generator

**Key Constants**:
- `DEFAULT_ENTROPY = 32` (L31): Default byte count for token generation functions

**Security Pattern**: All randomness sourced from SystemRandom which uses OS-provided entropy sources, ensuring cryptographic strength suitable for security-sensitive applications.

**Token Generation Chain**: `token_bytes` → `token_hex` (via .hex()) and `token_urlsafe` (via base64 encoding), providing multiple output formats from the same secure byte generation.