# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/bsd/apple/mod.rs
@source-hash: be8da0a8b9c788f7
@generated: 2026-02-09T17:58:29Z

## Apple/Darwin Unix Platform Definitions

This module defines Apple-specific Unix types, constants, and system bindings for macOS, iOS, tvOS, and visionOS platforms within the BSD family.

### Core Purpose
- Provides low-level system interface definitions for Apple platforms (*-apple-* triples)
- Contains type aliases, constants, structs, and extern function declarations
- Bridges Rust code to macOS/iOS system APIs and kernel interfaces

### Key Type Definitions

**Basic Types (L8-50):**
- Platform-specific primitive type aliases (wchar_t, clock_t, time_t, etc.)
- Mach kernel types (mach_port_t, natural_t, integer_t, kern_return_t)
- VM management types (vm_offset_t, vm_size_t, vm_address_t)

**Enums:**
- `timezone` (L183): Empty debug enum for timezone handling
- `qos_class_t` (L193): Quality of service classes for thread scheduling
- `sysdir_search_path_directory_t` (L210): System directory search paths
- `sysdir_search_path_domain_mask_t` (L245): Domain masks for directory search

### Major Struct Groups

**Network Structures (L260-820):**
- IP multicast (ip_mreq, ip_mreq_source)  
- Socket addressing (sockaddr_in, sockaddr_dl, sockaddr_ctl, sockaddr_vm)
- Network interface information structures

**System Information (L608-1312):**
- Process information (proc_taskinfo, proc_bsdinfo, proc_taskallinfo)
- File system structures (statfs, statvfs)
- Threading structures (pthread_* types with custom implementations)
- Mach kernel structures (mach_task_basic_info, vm_statistics64)

**Packed Structures (L1314-1674):**
- Memory-layout sensitive structures using `#[repr(packed)]`
- IPC structures (semid_ds, shmid_ds) 
- Network interface structures (if_data64, if_msghdr2)

### Constants and Flags

**System Constants (L2748-4605):**
- File operation flags (O_*, F_*, AT_*)
- Error codes (E* constants)
- Signal definitions (SIG*)
- Network protocol constants (IPPROTO_*, AF_*, PF_*)
- Socket options and message flags

**Mach Kernel Constants (L4884-5170):**
- Host and task information flavors
- Thread policy and info constants
- Memory management flags
- Virtual memory page query flags

### External Function Declarations

**System Functions (L5268-6177):**
- POSIX compliance functions (aio_*, sem_*, shm_*)
- BSD extensions (chflags, fchflags, backtrace functions)
- Apple-specific APIs (copyfile, pthread extensions, mach_* functions)
- Process management (proc_* family functions)

**Deprecated Functions:**
- Mach kernel functions marked deprecated (L5378-6058) - redirects to `mach2` crate
- Some BSD functions deprecated in newer macOS versions

### Key Features

**Thread Management:**
- Comprehensive pthread extensions with Apple-specific QoS integration
- Mach thread policy and information structures
- JIT write protection APIs (L5508-5521)

**Memory Management:**  
- VM allocation/deallocation functions
- Memory statistics and zone management
- Copy-on-write file operations (clonefile, copyfile)

**Process Inspection:**
- Rich proc_* API for process information gathering
- Backtrace and symbol resolution support
- Process resource usage tracking

### Architectural Notes

**Platform Variants:**
- Some functions have different linkage for x86 vs ARM64 
- Conditional compilation for different Apple OS targets
- Architecture-specific constants (stack sizes, alignment)

**ABI Considerations:**
- Packed structures for binary compatibility
- Custom alignment macros (__DARWIN_ALIGN32)
- Version-specific function variants

This module serves as the foundational layer for all Apple platform system programming in Rust, providing comprehensive coverage of BSD and Mach kernel interfaces.