# scripts/setup/
@generated: 2026-02-10T01:19:42Z

## Purpose and Responsibility

The `scripts/setup` directory provides platform-specific environment setup scripts for the mcp-debugger project. This module handles the complex task of configuring complete development and debugging environments, including Rust toolchain installation, cross-platform tooling setup, and validation of the debugging infrastructure.

## Key Components and Organization

Currently contains one primary component:

- **windows-rust-debug.ps1**: Comprehensive Windows PowerShell script that automates the entire Rust debugging environment setup for Windows platforms

## Public API Surface

### Main Entry Points

**windows-rust-debug.ps1**:
- **Parameters**:
  - `UpdateUserPath`: Persists environment changes to user profile
  - `SkipBuild`: Bypasses example project compilation for faster setup
  - `SkipTests`: Skips smoke test execution
- **Usage**: `.\windows-rust-debug.ps1 [-UpdateUserPath] [-SkipBuild] [-SkipTests]`

### Core Functionality

The setup scripts provide automated configuration of:
- Rust toolchain installation and management via rustup
- Platform-specific GNU/MSVC toolchain setup
- Cross-compilation target configuration
- Build tool validation and smoke testing
- Environment variable and PATH management

## Internal Organization and Data Flow

### Setup Workflow
1. **Environment Validation**: Checks for required base tools and platform compatibility
2. **Toolchain Installation**: Installs and configures Rust stable/GNU toolchains
3. **System Tool Configuration**: Sets up platform-specific build tools (dlltool, MinGW, etc.)
4. **Build Validation**: Compiles example projects to verify environment
5. **Smoke Testing**: Runs integration tests to validate debugging capabilities

### Key Utilities
- **Command Execution**: Robust command runners with error handling and environment support
- **Path Management**: Cross-session PATH manipulation with persistence options
- **Tool Detection**: Automated discovery and installation of missing dependencies
- **Build Orchestration**: Multi-target compilation with graceful fallbacks

## Important Patterns and Conventions

### Error Handling Strategy
- **Graceful Degradation**: Non-critical failures (like MSYS2 installation) don't abort setup
- **Fallback Mechanisms**: Multiple toolchain targets (GNU preferred, MSVC backup)
- **Comprehensive Validation**: Each major component is tested after installation

### Environment Management
- **Session Isolation**: Changes apply to current session by default
- **Optional Persistence**: User can choose to persist changes to profile
- **Tool Precedence**: Clear priority order for conflicting tools (rustup > system > MSYS2)

### Build Configuration
- **Multi-Target Support**: Handles both GNU and MSVC Windows targets
- **Example Validation**: Uses real Rust projects to verify debugging capabilities
- **Incremental Setup**: Supports partial runs via skip flags for development workflows

## Integration Points

This module serves as the foundation for:
- Development environment bootstrapping
- CI/CD pipeline setup phases  
- User onboarding automation
- Cross-platform debugging infrastructure deployment

The scripts ensure that developers and automated systems have consistent, validated environments for mcp-debugger development and testing across different platforms.