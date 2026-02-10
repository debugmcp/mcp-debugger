# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/multiprocessing/shared_memory.py
@source-hash: 51301e70710220e1
@generated: 2026-02-09T18:11:19Z

This module provides cross-platform shared memory functionality for inter-process communication, part of Python's multiprocessing package. It implements two main abstractions for sharing data between processes via memory-mapped regions.

## Core Classes

**SharedMemory (L50-245)**: Primary shared memory abstraction that creates or attaches to named shared memory blocks. Supports both POSIX (`shm_open`) and Windows (`CreateFileMapping`) backends determined by `_USE_POSIX` flag (L24). Key functionality:
- Constructor handles creation vs attachment based on `create` parameter (L75)
- POSIX path (L85-120): Uses `_posixshmem.shm_open()` with auto-generated names via `_make_filename()` (L40)
- Windows path (L122-181): Uses `_winapi.CreateFileMapping()` with size probing for existing blocks
- Exposes memory via `buf` property returning memoryview (L205-207)
- Resource cleanup through `close()` (L223) and `unlink()` (L236) methods
- Integrates with resource tracker for cleanup (L120, L244)

**ShareableList (L249-533)**: High-level list-like container built on SharedMemory with fixed-size semantics. Complex binary layout stores:
- List length (8 bytes)
- Element offsets array ((N+1)*8 bytes) 
- Variable-size data area
- Format strings (N*8 bytes)
- Transform codes (N bytes)

Supports int, float, bool, str, bytes, None types via `_types_mapping` (L268-275). Uses struct packing with 8-byte alignment (`_alignment` L276).

## Key Dependencies

- Platform-specific: `_winapi` (Windows) or `_posixshmem` (POSIX) for low-level shared memory ops
- `mmap` module for memory mapping
- `resource_tracker` from parent package for cleanup coordination
- `struct` for binary serialization
- `secrets` for secure name generation

## Critical Architecture Decisions

- **Platform abstraction**: Single API with dual backends selected at import time (L19-24)
- **Name generation**: Cryptographically secure random names with platform-specific prefixes (L34-37, L40-47)
- **Resource management**: Explicit close/unlink pattern with destructor fallback (L185-189)
- **ShareableList immutability**: Fixed-size design prevents resizing operations, only element replacement
- **Binary layout**: Complex multi-section layout enables type-safe serialization with metadata preservation

## Important Constraints

- FreeBSD name length limit: 14 characters max (`_SHM_SAFE_NAME_LENGTH` L31)
- ShareableList format strings limited to 8 characters (L256-257)
- Windows requires explicit size probing for existing shared memory blocks (L159-180)
- POSIX requires explicit truncation for new blocks (L111-112)

The module handles cross-platform differences transparently while providing consistent Python APIs for both low-level memory sharing and high-level structured data containers.