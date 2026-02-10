# scripts/setup/windows-rust-debug.ps1
@source-hash: 4fc508e579628c67
@generated: 2026-02-10T00:41:47Z

**Primary Purpose**: Windows-specific PowerShell setup script that configures a complete Rust debugging environment for mcp-debugger, including toolchain installation, GNU tooling configuration, and example project builds.

**Core Workflow**:
1. Validates Windows environment and installs required Rust toolchains (L232-241)
2. Configures dlltool.exe from rustup's GNU toolchain (L242-247)  
3. Ensures MSYS2 MinGW toolchain availability (L251-261)
4. Builds bundled Rust examples with GNU/MSVC fallback (L276-285)
5. Runs smoke tests via pnpm/vitest (L287-299)

**Key Functions**:
- `Write-Section` (L33-37): Outputs formatted section headers with cyan text
- `Invoke-CommandChecked` (L39-74): Robust command executor with proper argument escaping, environment variable support, and error handling
- `Get-Msys2Root` (L81-91): Locates MSYS2 installation from environment variable or standard paths
- `Install-Msys2ViaWinget` (L93-105): Automated MSYS2 installation using winget package manager
- `Ensure-Msys2` (L107-117): Orchestrates MSYS2 detection and installation
- `Test-MingwTools` (L119-134): Validates presence and functionality of required MinGW tools (gcc, ld, as, dlltool)
- `Ensure-MingwToolchain` (L136-156): Installs MinGW-w64 toolchain via pacman if missing
- `Ensure-PathEntry` (L158-189): Manages PATH entries for current session and optionally persists to user environment
- `Build-ExampleProject` (L191-229): Builds Rust projects with GNU target preference and MSVC fallback

**Parameters**:
- `UpdateUserPath` (L25): Persists PATH and DLLTOOL changes to user environment
- `SkipBuild` (L26): Bypasses example project compilation  
- `SkipTests` (L27): Skips smoke test execution

**Critical Dependencies**:
- rustup for Rust toolchain management
- MSYS2/MinGW-w64 for GNU toolchain (dlltool, gcc, ld, as)
- winget for automated MSYS2 installation
- pnpm for running smoke tests
- cargo for building Rust projects

**Environment Configuration**:
- Sets `DLLTOOL` environment variable to preferred dlltool.exe location
- Adds toolchain bin directories to PATH
- Configures stable-gnu as default Rust toolchain
- Targets x86_64-pc-windows-gnu for GNU builds with MSVC fallback

**Example Projects**: Builds hello_world and async_example from relative paths (L279-280)

**Error Handling**: Comprehensive error checking with graceful fallbacks for non-critical failures (MSYS2 installation, GNU builds, smoke tests)