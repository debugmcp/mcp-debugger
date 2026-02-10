# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/psp.rs
@source-hash: 081cf4e5127ba10e
@generated: 2026-02-09T18:11:48Z

## PSP C Type Definitions

Primary purpose: Provides comprehensive C type definitions, constants, enums, structs, and function bindings for PlayStation Portable (PSP) system programming. This is part of the libc crate's PSP platform support layer.

### Key Dependencies and Architecture
- Imports from `crate::prelude::*` (L7) - essential for C type compatibility
- Requires external linker resolution via PSP SDK stub provider crate (L3-5)
- Extensive use of `extern "C"` function bindings for PSP system calls

### Core Type System
**Fundamental Types** (L9-16):
- Standard integer types: `intmax_t`, `uintmax_t`, `size_t`, `ptrdiff_t`, etc.
- PSP-specific pointer and size types matching system ABI

**Function Pointer Types** (L18-84):
- System callback handlers: `SceKernelVTimerHandler`, `SceKernelThreadEventHandler`, etc.
- Audio/video callbacks: `PowerCallback`, `GuCallback`, `SceMpegRingbufferCb`
- Network handlers: `SceNetAdhocctlHandler`, `HttpPasswordCB`

### System Enumerations (L88-1346)
**Graphics and Display** (L89-424):
- `AudioFormat`, `DisplayMode`, `DisplayPixelFormat` - audio/video configuration
- Massive `GeCommand` enum (L166-424) - Graphics Engine command constants for 3D rendering

**System Management** (L426-507):
- `SceSysMemPartitionId` - memory partition identifiers
- `SceKernelIdListType` - thread management object types
- `Interrupt`/`SubInterrupt` - hardware interrupt definitions

**Hardware Interfaces** (L510-1345):
- USB camera settings: `UsbCamResolution`, `UsbCamEffectMode`
- Network configuration: `ApctlState`, `HttpMethod`, `NetModule`
- Graphics rendering: `GuPrimitive`, `TexturePixelFormat`, `BlendOp`
- System utilities: `UtilityMsgDialogMode`, `SystemParamLanguage`

### Data Structures

**Transparent Wrappers** (L348-366):
- `SceUid(i32)` - Universal identifier type
- `SceMpeg`, `SceMpegStream` - MPEG decoder handles
- `Mp3Handle`, `RegHandle` - Audio and registry handles

**System Structures** (L368-2129):
- Network: `sockaddr` (L369), `in_addr` (L375)
- Input: `SceCtrlData` (L399), `SceCtrlLatch` (L407) - controller input data
- Graphics: `GeCallbackData` (L420), `GeListArgs` (L427) - Graphics Engine management
- Threading: `SceKernelThreadInfo` (L544), `SceKernelSemaInfo` (L582) - kernel objects
- Media: `SceMpegRingbuffer` (L804), `UmdInfo` (L797) - multimedia handling

**Complex Structures** (L2131-2370):
- Large context structures like `GeContext` (L2132) - 512 u32 array for GPU state
- Cryptographic contexts: `SceKernelUtilsSha1Context`, `SceKernelUtilsMd5Context`
- Vector/Matrix math types: `ScePspFVector4`, `ScePspFMatrix4` with 16-byte alignment
- Union types for flexible data access: `ScePspVector4`, `ScePspMatrix4`

### Constants and Function Bindings
**System Constants** (L2372-2559): Audio volumes, controller buttons, USB parameters, graphics flags
**Extensive System Call Bindings** (L2560-4131): 
- Audio: `sceAudioChReserve`, `sceAudioOutput*` functions
- Graphics: `sceGu*`, `sceGum*` - Graphics and matrix utility functions  
- Kernel: Thread, memory, synchronization primitives
- I/O: File system, device control operations
- Network: Socket, HTTP, SSL networking stack
- Multimedia: MPEG, JPEG, MP3 codec interfaces

### Critical Patterns
- Extensive use of `#[repr(C)]` and `#[repr(transparent)]` for ABI compatibility
- Pointer-heavy interfaces typical of C system APIs  
- Consistent error handling via i32 return codes
- Hardware-specific enums with explicit discriminants for register programming