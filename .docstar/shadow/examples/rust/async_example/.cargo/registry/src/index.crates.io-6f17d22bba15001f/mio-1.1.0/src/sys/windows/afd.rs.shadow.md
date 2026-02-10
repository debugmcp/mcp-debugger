# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/mio-1.1.0/src/sys/windows/afd.rs
@source-hash: e833f92520149aec
@generated: 2026-02-09T18:03:22Z

**Purpose**: Windows-specific AFD (Ancillary Function Driver) interface for Winsock2 polling operations in the Mio library. Provides low-level async I/O primitives for Windows socket polling using native NT API calls.

**Core Components**:

- `Afd` struct (L21-23): Wrapper around a File handle to the Windows AFD driver (`\Device\Afd\Mio`)
- `AfdPollHandleInfo` struct (L27-31): C-compatible structure representing a single handle to poll with events mask and status
- `AfdPollInfo` struct (L36-42): C-compatible polling request containing timeout, handle count (fixed at 1), exclusivity flag, and handle array

**Key Methods**:

- `Afd::poll()` (L59-86): **UNSAFE** - Issues async poll request via `NtDeviceIoControlFile` with `IOCTL_AFD_POLL`. Returns `Ok(true)` for immediate completion, `Ok(false)` for pending operation, or error. Critical safety requirement: `iosb` parameter must remain valid until operation completes.

- `Afd::cancel()` (L97-113): **UNSAFE** - Cancels pending poll operation using `NtCancelIoFileEx`. Only operates on pending requests (STATUS_PENDING). Returns success for already completed or not found operations.

- `Afd::new()` (L175-219): **Conditional compilation** - Creates new AFD instance by opening `\Device\Afd\Mio`, associates with completion port, and configures file completion notification modes. Uses atomic token counter for handle identification.

- `AfdPollInfo::zeroed()` (L168-170): Creates zero-initialized polling structure.

**Event Constants** (L223-243): Bit flags for socket events:
- `POLL_RECEIVE` (0x01), `POLL_SEND` (0x04), `POLL_ACCEPT` (0x80), etc.
- `KNOWN_EVENTS`: Mask of all supported event types excluding `POLL_CONNECT`

**Dependencies**:
- Windows NT API (`NtDeviceIoControlFile`, `NtCancelIoFileEx`, `NtCreateFile`)
- `windows_sys` crate for Windows API bindings
- Completion port integration (behind `cfg_io_source` feature)

**Architecture Notes**:
- Uses raw NT API instead of Win32 for direct AFD access
- Thread-safe handle info via `Send` impl (L33)
- Token allocation reserves even numbers for AFD handles vs odd for other handle types
- Critical memory safety constraints around `IO_STATUS_BLOCK` lifetime during async operations

**Safety Invariants**:
- `IO_STATUS_BLOCK` must remain valid and untouched during pending operations
- No concurrent polling on same AFD instance
- Proper overlapped structure lifecycle management required