# scripts/setup/
@generated: 2026-02-10T21:26:19Z

## Overall Purpose

The `scripts/setup` directory contains platform-specific environment configuration scripts for the mcp-debugger project. This module is responsible for automating the complex setup process required for Rust debugging across different operating systems, ensuring all necessary toolchains, dependencies, and development tools are properly installed and configured.

## Key Components

**windows-rust-debug.ps1** - A comprehensive Windows PowerShell script that serves as the primary setup automation for Windows development environments. This script handles the complete configuration pipeline from toolchain installation through smoke testing.

## Public API Surface

**Main Entry Points:**
- `windows-rust-debug.ps1` - Primary Windows setup script with configurable parameters:
  - `-UpdateUserPath`: Persists environment changes to user profile
  - `-SkipBuild`: Bypasses example project compilation
  - `-SkipTests`: Skips smoke test execution

**Core Functions Available:**
- `Write-Section`: Standardized output formatting for setup progress
- `Invoke-CommandChecked`: Robust command execution with error handling
- `Build-ExampleProject`: Rust project compilation with fallback strategies

## Internal Organization and Data Flow

The setup process follows a structured pipeline:

1. **Environment Validation** - Checks Windows compatibility and prerequisites
2. **Toolchain Installation** - Installs and configures Rust toolchains (stable-gnu, stable-msvc)
3. **GNU Tooling Configuration** - Sets up dlltool.exe and MSYS2/MinGW-w64 toolchain
4. **Path Management** - Configures environment variables and PATH entries
5. **Project Compilation** - Builds example Rust projects with GNU/MSVC fallback
6. **Smoke Testing** - Validates setup through pnpm/vitest test execution

Data flows from environment detection through progressive toolchain setup, culminating in validation through actual project builds and test execution.

## Important Patterns and Conventions

**Error Handling Strategy**: Implements graceful degradation with fallback mechanisms - GNU toolchain failures fall back to MSVC, non-critical component failures (like MSYS2 installation) don't abort the entire setup process.

**Environment Management**: Follows a pattern of detection → installation → configuration → validation for each component, with optional persistence of changes to user environment.

**Cross-Platform Preparation**: The directory structure suggests this is part of a larger cross-platform setup system, with the Windows script serving as a template for similar platform-specific setup automation.

**Modular Design**: Functions are designed for reusability and independent operation, allowing for partial setup execution and easier maintenance.

## Dependencies and Integration

**External Dependencies:**
- rustup (Rust toolchain management)
- MSYS2/MinGW-w64 (GNU toolchain)
- winget (Windows package management)
- pnpm (Node.js package management)
- cargo (Rust build system)

**Integration Points**: The setup scripts integrate with the broader mcp-debugger project by preparing the environment for debugging Rust applications, ensuring all necessary toolchains are available for both development and testing workflows.