# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/secrets.py
@source-hash: 277000574358a6ec
@generated: 2026-02-09T18:07:54Z

**Purpose**: Python's `secrets` module providing cryptographically secure random number generation for security-sensitive applications like tokens, passwords, and authentication keys.

**Architecture**: Simple wrapper around `SystemRandom` with convenience functions for common security use cases. Uses OS entropy sources for cryptographic strength.

**Key Components**:

- **SystemRandom instance** `_sysrand` (L20): Core CSPRNG instance used by all functions
- **Random selection functions**:
  - `choice` (L23): Direct alias to `_sysrand.choice` for secure random selection
  - `randbits` (L22): Direct alias to `_sysrand.getrandbits` for random bit generation
  - `randbelow(exclusive_upper_bound)` (L25-29): Secure random integer in range [0, n) with input validation

**Token Generation Functions**:
- **`token_bytes(nbytes=None)`** (L33-45): Generates random byte strings, defaults to 32 bytes
- **`token_hex(nbytes=None)`** (L47-58): Generates hex-encoded random strings (2 chars per byte)
- **`token_urlsafe(nbytes=None)`** (L60-71): Generates Base64 URL-safe tokens with padding removed

**Constants**:
- `DEFAULT_ENTROPY = 32` (L31): Default byte count for token functions

**Imported Security Utilities**:
- `compare_digest` (L17): Timing-attack-resistant string comparison from `hmac`
- `SystemRandom` (L18): OS entropy-based random number generator

**Design Patterns**:
- Facade pattern: Wraps `SystemRandom` with domain-specific API
- Default parameter pattern: All token functions use reasonable defaults
- Composition over inheritance: Uses `SystemRandom` instance rather than extending

**Critical Security Properties**:
- All randomness sourced from OS entropy via `SystemRandom`
- No fallback to weaker PRNGs
- Input validation prevents invalid ranges
- URL-safe tokens strip padding to avoid issues with some parsers