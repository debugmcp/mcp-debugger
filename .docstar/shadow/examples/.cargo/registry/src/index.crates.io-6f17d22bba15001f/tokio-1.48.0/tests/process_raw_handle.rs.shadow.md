# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/process_raw_handle.rs
@source-hash: 9c003770a8bf850d
@generated: 2026-02-09T18:12:21Z

**Purpose**: Windows-specific integration test verifying that Tokio's process spawning correctly exposes raw Windows process handles that can be used with Win32 APIs.

**Key Components**:
- Test function `obtain_raw_handle()` (L9-24): Async test that validates process handle integrity
- Uses `tokio::process::Command` to spawn a Windows `cmd` process with `/c pause` arguments (L11-14)
- Validates process ID consistency between Tokio's abstraction and raw Win32 handle (L18-23)

**Dependencies**:
- `tokio::process::Command`: Tokio's async process spawning
- `windows_sys::Win32::System::Threading::GetProcessId`: Win32 API for process ID retrieval

**Test Flow**:
1. Creates Command for `cmd /c pause` with kill_on_drop enabled (L11-14)
2. Spawns child process and retrieves Tokio process ID (L16-19)
3. Extracts raw Windows handle and calls Win32 GetProcessId (L21-22)
4. Asserts both IDs match, confirming handle validity (L23)

**Platform Constraints**:
- Windows-only via `#![cfg(windows)]` (L3)
- Requires "full" feature flag (L2)
- Excluded from Miri execution (L4)
- Uses unsafe Win32 API call with handle casting (L22)

**Architectural Notes**:
- Tests interoperability between Tokio's cross-platform process abstraction and platform-specific Windows handles
- Validates that raw_handle() returns usable Win32 HANDLE values
- Uses `pause` command to keep process alive during testing