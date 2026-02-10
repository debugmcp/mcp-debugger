# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/crypt.py
@source-hash: 208df2ff33c19056
@generated: 2026-02-09T18:07:01Z

**Primary Purpose**: Python wrapper for POSIX crypt library functionality, providing password hashing with various salt methods. Part of the deprecated CPython crypt module (deprecated as of Python 3.13).

**Key Components**:

- **_Method class (L27-34)**: Named tuple representing salt methods with fields for name, identifier, salt character count, and total hash size. Includes custom repr for METHOD_* display.

- **mksalt() function (L36-71)**: Generates cryptographically secure salt strings for specified methods. Handles method-specific requirements:
  - Blowfish variants (ident[0] == '2'): Validates rounds as power of 2 between 2^4 and 2^31
  - SHA-2 methods (ident '5'/'6'): Validates rounds between 1000-999,999,999
  - Traditional methods: No identifier prefix

- **crypt() function (L74-86)**: Main hashing interface that delegates to _crypt.crypt(). Auto-generates salt if none provided.

- **_add_method() function (L92-107)**: Runtime method registration that tests method availability by attempting empty string hash. Creates METHOD_* globals and populates methods list with working implementations.

**Dependencies**:
- **_crypt module**: Core C extension (platform-dependent import with Windows check L5-11)
- **SystemRandom**: For cryptographically secure salt generation (L16, L24)
- **Standard library**: errno, string, warnings, collections

**Architecture**:
- **methods list (L90)**: Global registry populated at module load via _add_method calls
- **Method registration (L109-122)**: Attempts to register SHA512, SHA256, Blowfish variants, MD5, and traditional CRYPT in order of preference
- **Salt character set (L23)**: ASCII letters, digits, '.', '/'

**Critical Constraints**:
- Module unavailable on Windows (L8-9)
- Deprecated in Python 3.13 (L20)
- Method availability depends on underlying libc support
- Blowfish rounds must be powers of 2
- SHA-2 rounds bounded by implementation limits