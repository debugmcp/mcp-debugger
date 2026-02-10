# scripts/setup/windows-rust-debug.ps1
@source-hash: 4fc508e579628c67
@generated: 2026-02-09T18:15:06Z

## Primary Purpose
Windows PowerShell setup script that prepares a Windows machine for Rust debugging with mcp-debugger. Installs required Rust toolchains, ensures GNU toolchain tools (particularly dlltool.exe) are accessible, builds bundled Rust examples, and runs smoke tests.

## Key Components

### Parameters (L24-28)
- `UpdateUserPath`: Permanently modifies user PATH and DLLTOOL environment variables
- `SkipBuild`: Skips building Rust examples
- `SkipTests`: Skips running smoke tests

### Core Functions

**Write-Section (L33-37)**: Utility for formatted section headers with cyan highlighting.

**Invoke-CommandChecked (L39-74)**: Robust process execution wrapper with proper argument escaping, environment variable support, and error handling. Returns stdout on success, throws on non-zero exit codes.

**Get-Msys2Root (L81-91)**: Discovers MSYS2 installation by checking `$env:MSYS2_ROOT`, then common paths (`C:\msys64`, `C:\tools\msys64`).

**Install-Msys2ViaWinget (L93-105)**: Automated MSYS2 installation via Windows Package Manager with standard agreements acceptance.

**Ensure-Msys2 (L107-117)**: Ensures MSYS2 is available, installing via winget if needed.

**Test-MingwTools (L119-134)**: Validates presence and functionality of essential MinGW tools: `x86_64-w64-mingw32-gcc`, `ld`, `as`, `dlltool`.

**Ensure-MingwToolchain (L136-156)**: Ensures MinGW-w64 toolchain is installed via MSYS2 pacman, validates dlltool.exe availability.

**Ensure-PathEntry (L158-189)**: Manages PATH modifications for both current session and persistent user PATH. Performs case-insensitive duplicate checking.

**Build-ExampleProject (L191-229)**: Builds Rust projects with GNU toolchain preference, falling back to MSVC if GNU build fails. Uses environment-aware cargo commands.

## Main Execution Flow

### Prerequisites Validation (L231-246)
- Verifies rustup availability
- Installs stable-gnu and stable-msvc toolchains with minimal profiles
- Sets stable-gnu as default
- Validates rustup's bundled dlltool.exe location

### Toolchain Configuration (L248-274)
- Prioritizes MSYS2 MinGW dlltool over rustup's bundled version
- Updates PATH and DLLTOOL environment variables
- Provides user instructions for manual persistence if `-UpdateUserPath` not used

### Example Building (L276-285)
- Builds `hello_world` and `async_example` projects from `../../examples/rust/`
- Skipped if `-SkipBuild` specified

### Smoke Testing (L287-299)
- Runs `pnpm vitest run tests/e2e/mcp-server-smoke-rust.test.ts`
- Gracefully handles pnpm unavailability
- Skipped if `-SkipTests` specified

## Dependencies
- Windows OS (validated L76-79)
- rustup (required)
- winget (for automatic MSYS2 installation)
- pnpm (optional, for smoke tests)
- MSYS2/MinGW-w64 (installed automatically)

## Critical Patterns
- Error-first approach with `-Stop` preference and strict mode
- Graceful fallbacks (MSVC when GNU fails, rustup dlltool when MSYS2 unavailable)
- Environment variable precedence (MSYS2 tools preferred over rustup bundled)
- Case-insensitive PATH management for Windows compatibility