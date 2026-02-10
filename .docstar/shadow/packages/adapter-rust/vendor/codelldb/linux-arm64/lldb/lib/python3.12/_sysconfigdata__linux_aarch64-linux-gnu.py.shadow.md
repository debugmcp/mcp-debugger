# packages/adapter-rust/vendor/codelldb/linux-arm64/lldb/lib/python3.12/_sysconfigdata__linux_aarch64-linux-gnu.py
@source-hash: 42d803b0c9c75157
@generated: 2026-02-09T18:08:32Z

## System Configuration Data for Python 3.12 on ARM64 Linux

This file contains the complete build-time configuration variables for Python 3.12.7 compiled for aarch64-linux-gnu architecture. Generated and consumed by Python's `sysconfig` module.

**Primary Purpose**: Stores all compilation flags, paths, feature detection results, and build configuration used when Python was compiled, enabling runtime introspection of build settings.

**Key Structure**:
- **build_time_vars** (L2-1230): Single massive dictionary containing all configuration variables as key-value pairs

**Critical Configuration Categories**:

**Architecture & Platform** (L24, L621, L1031, L1164):
- Cross-compilation from x86_64 to aarch64-linux-gnu
- Target: `aarch64-unknown-linux-gnu`
- SOABI: `cpython-312-aarch64-linux-gnu`

**Compiler Configuration** (L11, L13, L19-21, L27-31):
- CC: `/usr/bin/aarch64-linux-gnu-gcc` (cross-compiler)
- Base flags: `-fno-strict-overflow -Wsign-compare`
- Optimization: `-DNDEBUG -g -O3 -Wall -fPIC`
- Shared library building enabled

**Installation Paths** (L16-17, L624-625, L644-645):
- Prefix: `/install`
- Binary dir: `/install/bin`
- Library dir: `/install/lib/python3.12`
- Include dir: `/install/include/python3.12`

**Feature Detection Results** (L132-619):
- Extensive HAVE_* flags for system capabilities
- Function availability (e.g., `HAVE_ACCEPT4`: 1)
- Header presence (e.g., `HAVE_UNISTD_H`: 1)
- Platform-specific features for Linux/ARM64

**Module Configuration** (L719-801, L802-1030):
- **MODBUILT_NAMES**: List of built-in modules
- **MODOBJS**: Object files for all compiled modules
- Module-specific flags and dependencies

**Key Build Variables**:
- **LDSHARED** (L640-641): Shared library linker command
- **CFLAGS** (L29-30): Complete C compilation flags  
- **LIBS** (L692): Required system libraries
- **VERSION** (L1208): Python version "3.12"

**Python-Specific Settings**:
- Shared library support enabled (L1105, L1125)
- Performance trampoline support (L1106)
- Built-in hashlib algorithms (L1075)
- Module loading configuration

This configuration enables the `sysconfig` module to provide accurate build information at runtime, supporting extension compilation, debugging, and system introspection.