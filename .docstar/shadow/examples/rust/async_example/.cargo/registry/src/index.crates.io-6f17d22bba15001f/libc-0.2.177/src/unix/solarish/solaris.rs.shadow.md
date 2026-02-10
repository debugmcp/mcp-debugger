# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/src/unix/solarish/solaris.rs
@source-hash: 4045113ee68a9e29
@generated: 2026-02-09T18:02:33Z

## Purpose
Solaris-specific system bindings for the libc crate, providing type definitions, constants, and external function declarations that are specific to the Solaris variant of the Unix family.

## Key Type Definitions

**Primitive Types (L7-9)**
- `door_attr_t`, `door_id_t`, `lgrp_affinity_t`: Basic type aliases for Solaris door API and locality group operations

**Enums (L11-18)**
- `lgrp_rsrc_t`: Locality group resource types (CPU, MEM, TYPES) used for NUMA-aware programming

**Core Structures (L20-58)**
- `aiocb` (L21-34): Asynchronous I/O control block with Solaris-specific fields including result pointer and state tracking
- `shmid_ds` (L36-52): Shared memory segment descriptor with Solaris extensions like gransize and allocated fields
- `xrs_t` (L54-57): Simple structure for external resource specification

**Door API Structures (L60-84)**
- `door_desc_t__d_data__d_desc` (L62-65): Packed descriptor data for door operations
- `door_desc_t__d_data` (L67-70): Union containing descriptor or reserved space
- `door_desc_t` (L72-75): Door descriptor combining attributes and data
- `door_arg_t` (L77-84): Door argument structure for inter-process communication

**System Structures (L86-99)**
- `utmpx` (L86-98): Extended user accounting structure with Solaris-specific fields and padding

## Trait Implementations (L101-141)
Conditional `PartialEq`, `Eq`, and `Hash` implementations for `utmpx` when "extra_traits" feature is enabled. The `PartialEq` implementation (L103-121) performs field-by-field comparison with special handling for the `ut_host` array.

## Constants

**Compatibility Constants (L143-149)**
- `O_DIRECT`, `SIGINFO`: Deprecated constants maintained for backward compatibility with Nix crate

**System Limits (L151-153)**
- `_UTMP_*_LEN`: Length constants for utmpx structure fields

**File/Network Constants (L155-169)**
- Port source types, address family aliases, TCP keep-alive options, file descriptor duplication flags

**Privilege System (L172-192)**
- Process privilege flags and combined `PRIV_USER` mask for Solaris privilege management

## External Functions (L194-238)
- `fexecve` (L196): Execute program from file descriptor
- `mincore` (L198): Determine memory residence
- Door API functions (L200-217): Inter-process communication primitives
- `fattach` (L219): Attach STREAMS-based file descriptor
- Thread/process utilities (L221-238): pthread attributes, access control, pseudo-terminal operations

## Architecture Notes
- Uses libc crate's macro system (`s!`, `e!`, `s_no_extra_traits!`) for consistent structure definitions
- Maintains backward compatibility through deprecated constant definitions
- Leverages conditional compilation for optional trait implementations
- Follows Solaris system call and data structure conventions