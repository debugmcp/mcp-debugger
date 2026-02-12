# scripts\setup/
@generated: 2026-02-12T21:00:58Z

## Overview

The `scripts/setup` directory contains platform-specific environment setup automation for the mcp-debugger project. This module handles the complex task of configuring complete Rust debugging environments across different operating systems, with particular focus on toolchain installation, cross-compilation setup, and validation testing.

## Primary Responsibilities

- **Cross-platform Environment Setup**: Automates installation and configuration of Rust toolchains, debugging tools, and build dependencies
- **Toolchain Management**: Orchestrates setup of multiple Rust targets (GNU, MSVC) with appropriate fallback mechanisms  
- **Development Environment Validation**: Builds example projects and runs smoke tests to verify correct installation
- **Path and Environment Configuration**: Manages system PATH updates and environment variables for optimal debugging experience

## Key Components

### Windows Setup (windows-rust-debug.ps1)
The primary entry point for Windows environment configuration, providing:

- **Rust Toolchain Installation**: Installs and configures stable-gnu and stable-msvc toolchains via rustup
- **GNU Tooling Integration**: Configures dlltool.exe, gcc, ld, and assembler from MSYS2/MinGW-w64
- **MSYS2 Management**: Automated detection, installation, and package management for GNU toolchain dependencies
- **Build Validation**: Compiles bundled example projects (hello_world, async_example) with fallback strategies
- **Environment Persistence**: Optional PATH and environment variable updates for user sessions

## Public API Surface

### Command-Line Interface
```powershell
.\windows-rust-debug.ps1 [-UpdateUserPath] [-SkipBuild] [-SkipTests]
```

**Parameters**:
- `UpdateUserPath`: Persists environment changes to user profile
- `SkipBuild`: Bypasses example project compilation
- `SkipTests`: Skips smoke test execution

### Core Functions
- `Invoke-CommandChecked`: Robust command execution with proper error handling and environment support
- `Build-ExampleProject`: Rust project compilation with GNU/MSVC target fallbacks
- `Ensure-MingwToolchain`: GNU toolchain installation and validation
- `Test-MingwTools`: Verification of required debugging tools availability

## Internal Organization

The setup process follows a structured workflow:

1. **Environment Validation**: Checks Windows compatibility and existing tool availability
2. **Toolchain Installation**: Installs Rust toolchains through rustup with target-specific configurations
3. **GNU Integration**: Configures MSYS2/MinGW-w64 toolchain for dlltool and cross-compilation support
4. **Build Testing**: Validates installation by compiling example Rust projects
5. **Smoke Testing**: Runs comprehensive tests via pnpm/vitest to ensure debugging capabilities

## Data Flow

```
User Invocation → Environment Check → Rust Installation → GNU Toolchain Setup → 
Example Builds → Smoke Tests → Environment Persistence (optional)
```

The module maintains state through environment variables (particularly `DLLTOOL`) and PATH modifications, with graceful degradation when optional components fail.

## Key Patterns

- **Graceful Fallbacks**: Non-critical failures (MSYS2 installation, GNU builds) don't halt the setup process
- **Multi-Target Support**: Prioritizes GNU toolchain but maintains MSVC compatibility
- **Idempotent Operations**: Safe to re-run without side effects
- **Comprehensive Validation**: Each installation step includes verification testing
- **User Choice**: Optional persistence of environment changes respects user preferences

## Dependencies

- **External Tools**: rustup, MSYS2/MinGW-w64, winget, pnpm, cargo
- **System Requirements**: Windows environment with PowerShell execution policy allowing scripts
- **Project Structure**: Assumes standard mcp-debugger project layout with examples in relative paths

This setup module serves as the foundation for cross-platform Rust debugging support, ensuring developers have properly configured environments for both development and debugging workflows.