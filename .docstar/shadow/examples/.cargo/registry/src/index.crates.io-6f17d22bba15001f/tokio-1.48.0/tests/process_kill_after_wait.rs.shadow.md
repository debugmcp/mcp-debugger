# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/process_kill_after_wait.rs
@source-hash: f52b0e82b78edb11
@generated: 2026-02-09T18:12:20Z

**Primary Purpose:** Integration test for Tokio's process module to verify that killing a child process after it has already been waited on behaves correctly without errors.

**Key Test Function:**
- `kill_after_wait()` (L6-27): Async test that spawns a cross-platform shell command, kills it, waits for completion, then attempts to kill again to ensure no panic or error occurs

**Test Logic Flow:**
1. **Platform Detection** (L10-16): Creates appropriate shell command based on OS - `cmd /c` for Windows, `sh -c` for Unix-like systems
2. **Process Spawning** (L18): Spawns child process running `exit 2` command
3. **Initial Kill** (L20): Calls `start_kill()` to terminate the process
4. **Wait Operation** (L22): Awaits process completion using `wait()`
5. **Post-Wait Kill** (L24-26): Verifies that calling kill methods after wait completes successfully without errors

**Key Dependencies:**
- `tokio::process::Command`: Async process spawning and management
- Platform-specific shell commands for cross-platform compatibility

**Test Constraints:**
- Disabled on WASI targets (cannot run system commands)
- Disabled under Miri (memory sanitizer incompatibility)
- Requires "full" feature flag for complete Tokio functionality

**Critical Behavior Tested:** Ensures that Tokio's process kill operations are idempotent and safe to call multiple times, even after process completion, preventing potential runtime panics in real applications.