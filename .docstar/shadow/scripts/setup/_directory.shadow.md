# scripts\setup/
@children-hash: 5d68200a35122218
@generated: 2026-02-15T09:01:21Z

## Directory Purpose

This directory contains Windows-specific setup automation for the mcp-debugger project, focusing on establishing a complete Rust development and debugging environment with proper toolchain configuration.

## Key Components

**windows-rust-debug.ps1** - The primary setup orchestrator that handles:
- Rust toolchain installation and configuration (stable-gnu as default)
- GNU toolchain setup via MSYS2/MinGW-w64 integration
- Critical debugging tool configuration (dlltool, gcc, ld, as)
- Example project compilation with fallback strategies
- Environment validation through smoke tests

## Public API Surface

### Main Entry Point
- **windows-rust-debug.ps1** - Primary setup script with configurable parameters:
  - `-UpdateUserPath`: Persists environment changes to user profile
  - `-SkipBuild`: Bypasses example project compilation
  - `-SkipTests`: Skips validation smoke tests

### Core Functions Exposed
- Environment validation and toolchain detection
- Automated dependency installation (MSYS2 via winget)
- PATH management with session and persistent options
- Robust command execution with proper error handling
- Example project building with GNU/MSVC fallback logic

## Internal Organization & Data Flow

1. **Environment Assessment**: Validates Windows environment and existing toolchains
2. **Dependency Resolution**: Installs/configures Rust toolchains, MSYS2, and MinGW tools
3. **Environment Configuration**: Sets up PATH entries and critical environment variables (DLLTOOL)
4. **Build Validation**: Compiles example Rust projects to verify toolchain functionality  
5. **Smoke Testing**: Runs pnpm/vitest tests to validate complete setup

## Key Patterns & Conventions

- **Graceful Degradation**: Non-critical failures (MSYS2 installation, GNU builds) don't halt setup
- **Dual Toolchain Strategy**: Prefers GNU toolchain for debugging but maintains MSVC compatibility
- **Robust Command Execution**: All external commands use proper argument escaping and environment handling
- **Sectioned Output**: Clear visual separation of setup phases with formatted headers
- **Environment Isolation**: Changes can be session-only or persisted based on user preference

## Integration Points

- **rustup**: Primary Rust toolchain management
- **MSYS2/MinGW-w64**: GNU toolchain provider for debugging capabilities
- **winget**: Automated package installation
- **pnpm/cargo**: Build system integration for validation
- **Windows Environment**: PATH and registry management for tool discovery

This setup module ensures Windows developers have a fully functional Rust debugging environment with proper GNU toolchain integration, essential for mcp-debugger's debugging capabilities.