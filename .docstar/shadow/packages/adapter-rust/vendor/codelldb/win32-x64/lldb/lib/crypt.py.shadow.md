# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/crypt.py
@source-hash: 208df2ff33c19056
@generated: 2026-02-09T18:12:52Z

**Purpose:** Provides a Python wrapper around the POSIX crypt library for password hashing functionality, implementing support for multiple cryptographic methods including SHA-512, SHA-256, Blowfish, MD5, and traditional DES.

**Platform Compatibility:** 
- Explicitly blocks Windows execution (L8-9)
- Requires `_crypt` C extension module (L6-11)
- Deprecated for removal in Python 3.13 (L20)

**Key Classes:**
- `_Method` (L27-34): NamedTuple representing a cryptographic method with fields: name, ident, salt_chars, total_size. Provides custom repr for METHOD_ constants.

**Core Functions:**
- `mksalt(method=None, *, rounds=None)` (L36-71): Generates cryptographically secure salt strings. Handles method-specific formatting including Blowfish power-of-2 rounds validation and SHA-2 rounds constraints (1000-999,999,999).
- `crypt(word, salt=None)` (L74-86): Main hashing interface that wraps `_crypt.crypt()`. Auto-generates salt if not provided.

**Method Registration System:**
- `_add_method(name, *args, rounds=None)` (L92-107): Dynamic method registration that tests availability by attempting actual encryption. Creates global METHOD_* constants and populates `methods` list.
- Method registration order (L109-122): SHA512 → SHA256 → BLOWFISH variants → MD5 → CRYPT, with preference for stronger methods.

**Global State:**
- `methods` (L90): List of available methods, ordered by preference (strongest first)
- `_saltchars` (L23): Valid salt characters (ASCII letters + digits + './')
- `_sr` (L24): Secure random generator instance
- Dynamic METHOD_* constants created during initialization

**Architecture:**
- Graceful fallback when crypto methods unsupported by system libc
- Error handling for errno EINVAL/EPERM/ENOSYS during method testing
- Blowfish variant selection prioritizes newer, more secure versions ('b', 'y' over 'a', '')

**Dependencies:**
- `_crypt` (C extension), `errno`, `string`, `warnings`, `random.SystemRandom`, `collections.namedtuple`