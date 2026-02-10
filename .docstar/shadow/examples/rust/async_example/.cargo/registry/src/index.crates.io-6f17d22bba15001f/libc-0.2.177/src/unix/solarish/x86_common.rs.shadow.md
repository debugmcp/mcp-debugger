# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/solarish/x86_common.rs
@source-hash: 4ae02d88622f7f08
@generated: 2026-02-09T18:02:23Z

## x86_common.rs - Solarish x86 Hardware Capability Constants

**Primary Purpose:** Defines hardware capability bit flags for x86 architecture on Solarish systems (Solaris/Illumos), used for runtime CPU feature detection through auxiliary vector (AT_SUN_HWCAP) interfaces.

### Key Constant Groups

**AT_SUN_HWCAP Constants (L2-28):**
- `AV_386_FPU` through `AV_386_AVX` - Primary hardware capability flags for x86 CPU features
- Covers CPU capabilities from basic FPU (0x00001) to AVX (0x20000000)
- Includes Intel features (SSE, AVX, AES), AMD-specific features (3DNow, SVM), and shared features (MMX, CMOV)
- Bit values follow power-of-2 progression for bitmasking operations

**Illumos-Specific Extensions (L30-68):**
- Conditional compilation block targeting `target_os = "illumos"`
- Additional AT_SUN_HWCAP flags: `AV_386_VMX`, `AV_386_AMD_SVM` (L31-32)
- AT_SUN_HWCAP2 secondary capability flags: `AV_386_2_F16C` through `AV_386_2_VAES` (L34-62)
- AT_SUN_FPTYPE floating-point information constants: `AT_386_FPINFO_*` (L64-67)

### Architecture Context

- Part of libc crate's Unix platform bindings
- Solarish-specific: shared between Solaris and Illumos systems
- x86-common: applies to both i386 and x86_64 architectures
- Uses `cfg_if!` macro for conditional compilation based on target OS

### Usage Pattern
These constants are typically used with `getauxval()` system calls or similar platform APIs to query hardware capabilities at runtime, enabling optimized code paths based on available CPU features.

### Dependencies
- Relies on `cfg_if` crate for conditional compilation
- Values must match system header definitions for ABI compatibility