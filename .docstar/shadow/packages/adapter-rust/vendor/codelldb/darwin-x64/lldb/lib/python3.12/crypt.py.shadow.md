# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/crypt.py
@source-hash: 208df2ff33c19056
@generated: 2026-02-09T18:09:24Z

## Python Crypt Module Wrapper

**Primary Purpose:** Provides a Python wrapper around POSIX crypt library functionality for password hashing with various cryptographic methods. The module is deprecated as of Python 3.13 (L20).

**Core Architecture:**
- Platform-specific import validation (L5-11) - raises ImportError on Windows or when _crypt extension unavailable
- Method registration system (L92-108) that dynamically tests available cryptographic methods
- Salt generation with configurable rounds for different hash algorithms

**Key Classes:**

### _Method (L27-34)
- Named tuple representing cryptographic methods with fields: name, ident, salt_chars, total_size
- Custom `__repr__` method for debugging display as `<crypt.METHOD_{name}>`

**Key Functions:**

### mksalt() (L36-71)
- Generates cryptographically secure salts for specified methods
- Handles method-specific parameters:
  - Blowfish (ident[0] == '2'): power-of-2 rounds validation (L52-61)
  - SHA-2 (ident '5'/'6'): rounds range 1000-999,999,999 (L62-66)
- Uses SystemRandom for secure salt character selection (L70)

### crypt() (L74-86)
- Main password hashing interface
- Auto-generates salt if None provided or _Method instance passed
- Delegates to native _crypt.crypt() for actual hashing

### _add_method() (L92-108)
- Internal method registration function
- Tests method availability by attempting empty string hash
- Handles platform-specific OSErrors (EINVAL, EPERM, ENOSYS)
- Validates result length against expected total_size

**Global State:**
- `methods` list (L90) - dynamically populated with available methods, ordered by strength
- `_saltchars` (L23) - ASCII letters + digits + './' for salt generation
- `_sr` (L24) - SystemRandom instance for cryptographic randomness

**Method Registration (L109-123):**
- SHA512 (strongest, tried first)
- SHA256
- Blowfish variants (b, y, a, legacy) - selects strongest available
- MD5 (legacy)
- CRYPT (traditional 2-char salt)

**Dependencies:**
- `_crypt` (native extension) - core hashing functionality
- `SystemRandom` - secure random number generation
- Standard library modules for string manipulation and warnings

**Critical Constraints:**
- Module unavailable on Windows platform
- Method availability depends on underlying libc support
- Rounds parameter validation varies by algorithm type
- Deprecated status affects long-term code sustainability