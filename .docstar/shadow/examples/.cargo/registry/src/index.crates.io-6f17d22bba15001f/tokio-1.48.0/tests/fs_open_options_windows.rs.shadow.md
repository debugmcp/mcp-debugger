# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.48.0/tests/fs_open_options_windows.rs
@source-hash: eae02a644078164b
@generated: 2026-02-09T18:12:09Z

**Purpose**: Windows-specific unit tests for Tokio's filesystem OpenOptions API, validating Windows-only configuration methods through Debug output inspection.

**Platform Constraints**: Windows-only compilation (`#![cfg(windows)]` L3), excludes WASI targets (L2). Requires "full" feature flag.

**Dependencies**:
- `tokio::fs::OpenOptions` (L5) - Core filesystem options API being tested
- `windows_sys::Win32::Storage::FileSystem` (L6) - Windows API constants for file operations

**Test Functions**:
- `open_options_windows_access_mode()` (L10-13) - Validates `access_mode(0)` sets internal field correctly
- `open_options_windows_share_mode()` (L17-20) - Tests `share_mode(0)` configuration  
- `open_options_windows_custom_flags()` (L24-31) - Verifies `custom_flags()` with `FILE_FLAG_DELETE_ON_CLOSE` constant
- `open_options_windows_attributes()` (L35-41) - Tests `attributes()` with `FILE_ATTRIBUTE_HIDDEN` constant
- `open_options_windows_security_qos_flags()` (L45-51) - Validates `security_qos_flags()` with `SECURITY_IDENTIFICATION` constant

**Testing Strategy**: All tests use Debug formatting hack (L11, L18, L25, L36, L46) to inspect internal OpenOptions state since fields are private. Tests verify specific numeric values appear in debug output rather than testing actual file operations.

**Architecture Notes**: Tests focus on Windows-specific OpenOptions extensions that don't exist in cross-platform std::fs::OpenOptions. Uses windows_sys crate constants to ensure correct Windows API integration.