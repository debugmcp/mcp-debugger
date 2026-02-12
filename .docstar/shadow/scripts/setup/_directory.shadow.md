# scripts/setup/
@generated: 2026-02-11T23:47:40Z

## Overall Purpose and Responsibility

The `scripts/setup` directory contains platform-specific environment setup automation for the mcp-debugger project. This module is responsible for bootstrapping complete development and debugging environments across different operating systems, ensuring all necessary toolchains, dependencies, and configurations are properly installed and configured.

## Key Components and Architecture

**Windows Setup Infrastructure (`windows-rust-debug.ps1`)**:
- PowerShell-based automation for Windows environments
- Comprehensive Rust toolchain management with GNU/MSVC dual-target support
- MSYS2/MinGW-w64 integration for native Windows debugging capabilities
- Automated dependency resolution and installation via winget/pacman
- Environment persistence and PATH management

**Core Setup Workflow**:
1. **Environment Validation**: Verifies platform requirements and existing installations
2. **Toolchain Installation**: Installs and configures Rust toolchains (stable-gnu primary, MSVC fallback)
3. **Debugging Tools Setup**: Configures GNU toolchain (dlltool, gcc, ld, as) for debugging support
4. **Dependency Management**: Ensures MSYS2 and MinGW-w64 availability through automated installation
5. **Validation Testing**: Builds example projects and runs smoke tests to verify setup

## Public API Surface

**Primary Entry Points**:
- `windows-rust-debug.ps1`: Main Windows setup script with configurable parameters
  - `-UpdateUserPath`: Persists environment changes to user profile
  - `-SkipBuild`: Bypasses example project compilation for faster setup
  - `-SkipTests`: Skips validation testing for minimal installations

**Key Utility Functions**:
- `Invoke-CommandChecked`: Robust command execution with error handling and environment support
- `Ensure-Msys2`: Automated MSYS2 detection and installation orchestration
- `Ensure-MingwToolchain`: MinGW-w64 toolchain installation and validation
- `Build-ExampleProject`: Multi-target Rust project building with fallback support

## Internal Organization and Data Flow

**Dependency Chain**:
```
Platform Detection → Rust Toolchain → GNU Tools → MSYS2/MinGW → Environment Config → Validation
```

**Configuration Management**:
- Environment variable setup (DLLTOOL, PATH modifications)
- Toolchain preference ordering (GNU primary, MSVC secondary)
- Persistent vs. session-only configuration options

**Error Handling Strategy**:
- Graceful degradation for non-critical components
- Comprehensive validation at each setup stage
- Fallback mechanisms for toolchain selection

## Important Patterns and Conventions

**Cross-Platform Preparation**: Directory structure designed to accommodate additional platform-specific setup scripts (Linux, macOS) following the Windows PowerShell model.

**Robust Automation**: 
- Idempotent operations that can be safely re-run
- Comprehensive error checking with meaningful diagnostics
- Automatic detection of existing installations to avoid conflicts

**Development Workflow Integration**:
- Validates setup through actual project builds
- Integrates with existing npm/pnpm test infrastructure
- Supports both minimal and full development environment configurations

**Target Use Cases**:
- New developer onboarding
- CI/CD environment preparation  
- Debugging environment standardization across development teams
- Automated testing infrastructure setup