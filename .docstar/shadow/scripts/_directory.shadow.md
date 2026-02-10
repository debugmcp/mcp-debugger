# scripts/
@generated: 2026-02-10T01:20:09Z

## Purpose and Responsibility

The `scripts` directory provides comprehensive build automation, development tooling, and operational utilities for the MCP (Model Context Protocol) Debugger project. This module serves as the central command and control hub for development workflows, CI/CD operations, environment setup, and quality assurance processes.

## Key Components and Integration

### Build and Bundle Management
- **bundle.js**: Core esbuild orchestrator that creates production bundles with console silencing for MCP protocol compliance
- **docker-build-if-needed.js**: Intelligent Docker image builder with file change detection and conditional rebuilding
- **prepare-pack.js**: NPM workspace dependency resolver for publishing operations

### Environment Setup and Validation
- **setup/** subdirectory: Platform-specific environment configuration (Windows Rust debugging setup)
- **check-adapters.js**: Debug adapter vendoring status validator for JavaScript and Rust components
- **install-claude-mcp.sh**: Automated MCP server configuration for Claude Code integration

### Testing and Quality Assurance
- **test-docker-local.sh**: Docker-based smoke testing with known regression tracking
- **test-mcp-integration.sh**: MCP protocol compliance and Claude CLI integration validation
- **validate-push.js**: Pre-push validation that simulates CI environment in clean repository clones
- **test-ipc.js**: Inter-process communication testing for proxy components

### Development Utilities
- **act-test.sh**: Local GitHub Actions workflow testing via Act CLI
- **safe-commit.sh**: Git commit wrapper with mandatory security checks and optional hook bypass
- **sync-to-wsl.sh**: Windows-to-WSL project synchronization with build automation

### Monitoring and Diagnostics
- **memwatch.ps1**: Continuous Windows memory monitoring with CSV logging
- **memdiag.ps1**: Comprehensive Windows memory diagnostic analysis
- **cleanup-test-processes.js**: Cross-platform orphaned process cleanup
- **collect-stdio-logs.ps1**: Docker-based diagnostic log collection

### Asset and Maintenance Tools
- **analyze_logo.py / resize_logo.py**: Logo analysis and marketplace compliance tooling
- **check-bundle-size.js**: Build artifact size monitoring with threshold enforcement
- **clean-coverage.js**: Cross-platform coverage directory cleanup with Docker fallback

## Public API Surface

### Primary Entry Points
- **Development Workflow**: `act-test.sh`, `safe-commit.sh`, `validate-push.js`
- **Build Operations**: `bundle.js`, `docker-build-if-needed.js`, `prepare-pack.js`  
- **Environment Setup**: `setup/windows-rust-debug.ps1`, `install-claude-mcp.sh`
- **Testing**: `test-docker-local.sh`, `test-mcp-integration.sh`
- **Monitoring**: `memwatch.ps1`, `memdiag.ps1`

### Specialized Utilities
- **Logo Processing**: `analyze_logo.py`, `resize_logo.py`
- **System Management**: `cleanup-test-processes.js`, `clean-coverage.js`
- **Diagnostics**: `collect-stdio-logs.ps1`, `check-bundle-size.js`

## Internal Organization and Data Flow

### Build Pipeline Integration
Scripts coordinate through shared artifacts and conventions:
- Bundle creation → Size validation → Docker image building
- Workspace dependency resolution → Package preparation → Publishing
- Source code changes → Conditional rebuilds → Testing validation

### Environment Management
Cross-platform support with platform-specific implementations:
- Windows: PowerShell scripts for memory monitoring and Rust setup
- Unix/Linux: Shell scripts for process management and WSL integration
- Docker: Containerized testing and log collection

### Quality Gates
Multi-layered validation approach:
- Pre-commit: Security scanning and optional test bypass
- Pre-push: Clean environment validation mimicking CI
- Build-time: Bundle size monitoring and adapter checking
- Runtime: Protocol compliance and integration testing

## Important Patterns and Conventions

### Error Handling Strategy
- **Fail-fast validation**: Critical checks exit immediately on failure
- **Progressive fallbacks**: Multiple strategies for complex operations (Docker cleanup, bundle creation)
- **Environment awareness**: CI detection affects behavior and exit codes

### Cross-Platform Compatibility
- **Platform detection**: Automatic OS/architecture identification
- **Tool abstraction**: Wrapper scripts provide consistent interfaces across platforms
- **Graceful degradation**: Non-critical failures don't abort primary workflows

### Development Experience
- **Colored output**: ANSI escape codes for visual feedback
- **Progress reporting**: Detailed status messages and completion indicators
- **Help integration**: Built-in documentation and usage examples
- **Configuration flexibility**: Environment variables and CLI flags for customization

This directory serves as the operational backbone enabling consistent development workflows, reliable builds, and comprehensive testing across the entire MCP Debugger ecosystem.