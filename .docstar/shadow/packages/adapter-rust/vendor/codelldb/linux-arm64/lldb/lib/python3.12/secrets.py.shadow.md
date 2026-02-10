# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/secrets.py
@source-hash: 277000574358a6ec
@generated: 2026-02-09T18:08:58Z

## Primary Purpose
Python's cryptographically secure random number generation module for secrets management, providing secure alternatives to the standard `random` module for authentication tokens, passwords, and other security-sensitive applications.

## Key Components

### Global Singleton and Aliases
- `_sysrand` (L20): SystemRandom instance used as the cryptographically secure entropy source
- `randbits` (L22): Direct alias to `_sysrand.getrandbits` for generating random bits
- `choice` (L23): Direct alias to `_sysrand.choice` for secure random selection from sequences

### Core Functions
- `randbelow(exclusive_upper_bound)` (L25-29): Generates cryptographically secure random integer in range [0, n) with input validation
- `token_bytes(nbytes=None)` (L33-45): Generates random byte strings with configurable length (defaults to 32 bytes)
- `token_hex(nbytes=None)` (L47-58): Produces hexadecimal-encoded random strings by converting token_bytes output
- `token_urlsafe(nbytes=None)` (L60-71): Creates URL-safe Base64-encoded tokens with padding removal

### Constants
- `DEFAULT_ENTROPY = 32` (L31): Default byte count for token generation functions

## Dependencies
- `base64`: For URL-safe Base64 encoding in token_urlsafe
- `hmac.compare_digest`: Timing-attack-resistant string comparison (re-exported)
- `random.SystemRandom`: OS-provided cryptographically secure random number generator

## Architectural Patterns
- **Facade Pattern**: Simplifies access to SystemRandom functionality with domain-specific token generation methods
- **Composition over Inheritance**: Uses SystemRandom instance rather than subclassing
- **Layered Token Generation**: token_hex and token_urlsafe build upon token_bytes foundation

## Security Invariants
- All randomness sourced from OS entropy pool via SystemRandom
- Token functions guarantee cryptographic strength suitable for secrets
- No fallback to pseudo-random generators if OS entropy unavailable
- Input validation prevents negative/zero bounds in randbelow