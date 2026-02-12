# scripts\setup/
@generated: 2026-02-12T21:05:42Z

## Purpose and Responsibility

The `scripts/setup` directory provides platform-specific environment setup automation for the mcp-debugger project. This module handles the complex task of configuring complete development environments with proper toolchain installation, dependency management, and validation testing across different operating systems.

## Key Components

**windows-rust-debug.ps1** - The primary Windows setup orchestrator that:
- Installs and configures Rust toolchains (stable, GNU variants)
- Sets up MinGW-w64/MSYS2 toolchain for native debugging capabilities
- Builds example projects to validate environment setup
- Runs comprehensive smoke tests via pnpm/vitest

## Public API Surface

### Main Entry Points
- **windows-rust-debug.ps1** - Primary Windows setup script with parameters:
  - `-UpdateUserPath`: Persists environment changes to user profile
  - `-SkipBuild`: Bypasses example project compilation
  - `-SkipTests`: Skips smoke test execution

### Core Utilities
- `Invoke-CommandChecked`: Robust command execution with error handling
- `Build-ExampleProject`: Cross-toolchain Rust project builder with GNU/MSVC fallback
- `Ensure-Msys2`/`Ensure-MingwToolchain`: Automated dependency installation
- `Test-MingwTools`: Toolchain validation and verification

## Internal Organization and Data Flow

The setup process follows a structured pipeline:

1. **Environment Validation** - Checks Windows compatibility and existing installations
2. **Toolchain Installation** - Installs Rust (stable-gnu), MSYS2, MinGW-w64 via automated package managers
3. **Configuration** - Sets up environment variables (DLLTOOL), PATH entries, and toolchain preferences
4. **Validation** - Builds example projects (hello_world, async_example) with GNU target preference
5. **Testing** - Executes smoke tests to verify complete environment functionality

## Important Patterns and Conventions

- **Graceful Degradation**: Non-critical failures (MSYS2 installation, GNU builds) fall back to alternatives rather than failing completely
- **Cross-Toolchain Support**: Prioritizes GNU toolchain for debugging capabilities but maintains MSVC compatibility
- **Environment Persistence**: Optional user environment modification with session-scoped defaults
- **Comprehensive Error Handling**: All external commands wrapped with proper error checking and user feedback
- **Automated Dependency Resolution**: Uses platform package managers (winget, pacman) for reliable dependency installation

## Integration Points

This module integrates with:
- **rustup** for Rust toolchain management
- **MSYS2/MinGW-w64** for native debugging tools (dlltool, gcc, ld)
- **pnpm** for Node.js-based smoke testing
- **cargo** for Rust project building and validation
- **System PATH** and environment variable management for tool availability

The setup scripts serve as the foundation layer ensuring all downstream development and debugging workflows have properly configured environments with the necessary toolchains and dependencies.