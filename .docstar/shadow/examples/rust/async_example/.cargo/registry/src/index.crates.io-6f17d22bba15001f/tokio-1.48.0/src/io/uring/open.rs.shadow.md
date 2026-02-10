# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/src/io/uring/open.rs
@source-hash: 855acb7e7e87d0d7
@generated: 2026-02-09T18:02:42Z

**Purpose**: Tokio io_uring file opening operation wrapper that provides async file opening capabilities using Linux's io_uring interface.

**Core Structure**:
- `Open` struct (L10-15): Holds CString path for kernel operation duration. Contains `#[allow(dead_code)]` on path field due to kernel-only access pattern.

**Key Implementations**:
- `Completable` for Open (L17-24): Converts completion queue entry result to `crate::fs::File` by extracting file descriptor and wrapping with `from_raw_fd()` (L21)
- `Cancellable` for Open (L26-30): Provides cancellation support by wrapping self in `CancelData::Open`
- `Op<Open>` implementation (L32-53): Core factory method `open()` that constructs io_uring operation

**Critical Method - `Op<Open>::open()` (L34-52)**:
- Takes path and `UringOpenOptions`, converts path to CString via `cstr()` helper
- Combines flags: `O_CLOEXEC | access_mode | creation_mode | custom_flags` (L39-42)
- Creates `opcode::OpenAt` with `AT_FDCWD` for current directory context (L44-47)
- Wraps in unsafe `Op::new()` with safety comment about parameter validity (L49-50)

**Dependencies**:
- `io_uring` crate for low-level operations
- `crate::fs::UringOpenOptions` for configuration
- `crate::runtime::driver::op` for operation traits
- `super::utils::cstr` for path conversion

**Architecture Notes**:
- Follows Tokio's io_uring driver pattern with separate data holder and operation traits
- Path lifetime management crucial for kernel operation safety
- Uses `AT_FDCWD` for relative path resolution from current working directory