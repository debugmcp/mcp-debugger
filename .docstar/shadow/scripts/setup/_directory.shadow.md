# scripts/setup/
@generated: 2026-02-09T18:16:06Z

## Overall Purpose and Responsibility

The `scripts/setup` directory contains platform-specific setup scripts that prepare development environments for working with the mcp-debugger project. These scripts handle the complex task of ensuring all necessary toolchains, dependencies, and build tools are properly installed and configured for debugging Rust-based MCP (Model Context Protocol) servers.

## Key Components and Architecture

### Platform-Specific Setup Scripts
Currently contains `windows-rust-debug.ps1`, a comprehensive PowerShell script that handles Windows-specific Rust debugging setup. The architecture is designed to be extensible for additional platforms (Linux, macOS) following the same pattern.

### Core Responsibilities
- **Toolchain Management**: Installs and configures Rust toolchains (stable-gnu, stable-msvc) with proper precedence
- **Build Tool Installation**: Ensures availability of MinGW-w64, MSYS2, and associated GNU toolchain components
- **Environment Configuration**: Manages PATH variables and environment setup for optimal debugging experience
- **Validation and Testing**: Builds example projects and runs smoke tests to verify setup integrity
- **Graceful Degradation**: Provides fallback mechanisms when preferred tools are unavailable

## Public API Surface

### Main Entry Points
- **windows-rust-debug.ps1**: Primary Windows setup script with configurable parameters:
  - `-UpdateUserPath`: Permanently modifies system environment
  - `-SkipBuild`: Bypasses example project compilation
  - `-SkipTests`: Skips smoke test execution

### Key Utilities
- **Invoke-CommandChecked**: Robust command execution wrapper used throughout the project
- **Environment Management Functions**: PATH manipulation, toolchain detection, and configuration utilities
- **Build Orchestration**: Automated building of Rust examples with toolchain fallbacks

## Internal Organization and Data Flow

### Setup Pipeline
1. **Prerequisites Validation** → Verify rustup, install required toolchains
2. **Toolchain Configuration** → Prioritize GNU tools, configure environment variables
3. **Dependency Installation** → Install MSYS2/MinGW-w64 if needed via winget
4. **Environment Setup** → Configure PATH and DLLTOOL variables
5. **Validation Phase** → Build examples and run smoke tests

### Tool Precedence Strategy
- MSYS2 MinGW tools preferred over rustup bundled equivalents
- GNU toolchain prioritized for debugging compatibility
- MSVC toolchain as fallback when GNU builds fail
- Automatic discovery of tool locations with multiple search paths

## Important Patterns and Conventions

### Error Handling
- Error-first approach with `-Stop` error action preference
- Graceful fallbacks with informative user messaging
- Validation of tool availability before usage

### Cross-Platform Preparation
- Modular design allowing easy addition of platform-specific scripts
- Consistent parameter patterns and behavior expectations
- Standardized validation and testing approaches

### Environment Management
- Case-insensitive PATH handling for Windows compatibility
- Session vs. persistent environment variable management
- User choice in permanent vs. temporary modifications

This setup system ensures developers can quickly establish a working Rust debugging environment regardless of their existing system configuration, with intelligent defaults and robust error recovery.