# scripts/
@generated: 2026-02-12T21:01:28Z

## Overview

The `scripts` directory serves as the operational backbone of the MCP Debugger project, containing build automation, development tooling, environment setup, and maintenance utilities. This comprehensive script collection orchestrates the entire development lifecycle from environment setup through production deployment.

## Primary Responsibilities

- **Build & Bundle Management**: Intelligent Docker builds, JavaScript bundling with console silencing, and package preparation for npm distribution
- **Development Environment**: Cross-platform setup automation, dependency validation, and toolchain management
- **Testing Infrastructure**: Comprehensive test orchestration including Docker smoke tests, MCP protocol validation, and CI simulation
- **Debug Adapter Management**: Vendoring status checking, cross-platform binary validation, and adapter lifecycle management
- **Quality Assurance**: Bundle size monitoring, memory diagnostics, security validation, and automated cleanup

## Key Entry Points

### Build & Deployment
- **`bundle.js`**: Primary bundling orchestrator with console silencing injection for MCP protocol compliance
- **`docker-build-if-needed.js`**: Intelligent Docker image builder with file change detection
- **`prepare-pack.js`**: NPM package preparation with workspace dependency resolution
- **`validate-push.js`**: Pre-push validation via clean repository simulation

### Development Environment  
- **`setup/windows-rust-debug.ps1`**: Complete Windows Rust debugging environment setup
- **`sync-to-wsl.sh`**: Windows-to-WSL project synchronization with build automation
- **`install-claude-mcp.sh`**: Claude Code IDE integration installer

### Testing & Validation
- **`test-docker-local.sh`**: Docker containerized smoke test runner
- **`test-mcp-integration.sh`**: MCP protocol compliance validation
- **`act-test.sh`**: GitHub Actions local testing wrapper

### Monitoring & Diagnostics
- **`memwatch.ps1`**: Continuous Windows memory monitoring with CSV logging
- **`memdiag.ps1`**: Comprehensive system memory analysis
- **`check-adapters.js`**: Debug adapter vendoring status validation

## Architecture Patterns

### Intelligent Automation
Scripts employ sophisticated decision-making logic:
- Docker builds only when source files change
- Bundle size validation with actionable feedback
- Multi-platform compatibility with graceful fallbacks
- Environment-aware execution (CI detection, platform detection)

### Cross-Platform Support
Comprehensive platform handling across Windows, Linux, macOS:
- Platform-specific implementations (PowerShell vs Bash)
- Consistent interfaces despite underlying differences
- Graceful degradation when platform features unavailable

### Development Workflow Integration
Scripts integrate seamlessly into development workflows:
- Pre-commit hooks for security validation (`safe-commit.sh`)
- Local GitHub Actions testing (`act-test.sh`) 
- NPM script integration for build processes
- IDE integration utilities (Claude Code, WSL synchronization)

## Critical Infrastructure Components

### Console Silencing Architecture
The bundle system implements sophisticated console output management to prevent MCP protocol corruption:
- Runtime detection of stdio/SSE transport modes
- Dynamic console method overriding based on CLI arguments
- Environment variable fallbacks for configuration

### Adapter Management System
Centralized debug adapter lifecycle management:
- Multi-platform binary validation (Windows, macOS, Linux ARM64/x64)
- Vendoring status tracking across JavaScript and Rust adapters
- Version management and dependency validation

### Memory Diagnostics Framework
Windows-specific memory analysis with multiple measurement strategies:
- Performance counter integration
- Process-level attribution
- Long-term monitoring with CSV export
- Memory leak detection capabilities

## Integration Points

### Docker Ecosystem
- Container build optimization with change detection
- Smoke test execution in isolated environments
- Volume mounting for log collection and analysis
- Multi-stage build support with caching

### NPM/Node.js Ecosystem
- Workspace dependency resolution for monorepo publishing
- ESBuild integration with advanced bundling features
- Package size monitoring for distribution optimization
- CI/CD integration with proper exit codes

### Git Workflow Integration  
- Pre-push validation through repository cloning
- Personal information security scanning
- Safe commit workflows with optional hook bypassing
- Branch-aware testing and validation

## Dependencies

### External Tools
- **Docker**: Container orchestration and isolated testing
- **Node.js/NPM/PNPM**: JavaScript runtime and package management
- **Rust/Cargo**: Native compilation and cross-platform binaries
- **Git**: Version control integration and repository operations
- **Python**: Debug adapter support and analysis utilities

### Platform-Specific Dependencies
- **Windows**: PowerShell, MSYS2/MinGW-w64, Windows SDK
- **Linux**: Bash, standard POSIX utilities, systemd integration
- **Cross-platform**: Act (GitHub Actions), Claude CLI, WSL2

This scripts collection represents a mature DevOps automation suite that handles the complexity of multi-platform debugging tool development while maintaining developer productivity and system reliability.