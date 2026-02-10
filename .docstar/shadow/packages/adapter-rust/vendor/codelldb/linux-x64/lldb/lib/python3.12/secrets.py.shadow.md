# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/secrets.py
@source-hash: 277000574358a6ec
@generated: 2026-02-09T18:09:54Z

**Primary Purpose**: Python standard library module providing cryptographically secure random number generation for security-sensitive applications like tokens, passwords, and authentication keys.

**Core Architecture**: 
- Uses `SystemRandom` (L18) as the underlying CSPRNG, which leverages OS entropy sources
- Global instance `_sysrand` (L20) provides thread-safe access to cryptographic randomness
- All functions delegate to this single SystemRandom instance for consistency

**Key Functions**:

- **`randbelow(exclusive_upper_bound)` (L25-29)**: Returns cryptographically secure random integer in range [0, n). Validates positive upper bound and uses internal `_randbelow` method.

- **`token_bytes(nbytes=None)` (L33-45)**: Generates random byte strings for cryptographic use. Defaults to 32 bytes (`DEFAULT_ENTROPY` L31) when nbytes is None. Direct wrapper around `_sysrand.randbytes()`.

- **`token_hex(nbytes=None)` (L47-58)**: Creates hex-encoded random strings by converting `token_bytes()` output to hexadecimal. Each byte becomes two hex digits.

- **`token_urlsafe(nbytes=None)` (L60-71)**: Generates URL-safe Base64 encoded random strings. Uses `base64.urlsafe_b64encode()` with padding removal for clean tokens suitable for URLs/HTTP headers.

**Exported Interface**: 
- Direct function exports: `choice`, `randbits` (L22-23) - aliases to SystemRandom methods
- Custom wrappers: `randbelow`, `token_bytes`, `token_hex`, `token_urlsafe`
- Imported utilities: `compare_digest` from hmac module for timing-attack-resistant comparison

**Dependencies**:
- `random.SystemRandom` (L18): OS-level entropy source
- `hmac.compare_digest` (L17): Constant-time string comparison
- `base64` (L15): URL-safe encoding for tokens

**Security Considerations**:
- All randomness is cryptographically secure (no pseudorandom fallbacks)
- Default 32-byte entropy provides 256 bits of security
- Token functions designed for security tokens, API keys, session identifiers

**Usage Patterns**: Module serves as high-level interface for security-critical random data generation, abstracting SystemRandom complexity while providing common token formats.