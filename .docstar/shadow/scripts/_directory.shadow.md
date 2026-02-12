# scripts/
@generated: 2026-02-11T23:48:04Z

## Overall Purpose and Responsibility
Comprehensive automation and development workflow orchestration for the MCP Debugger project. This directory provides essential build, test, deployment, and environment management scripts that support the entire development lifecycle across multiple platforms.

## Key Components and How They Relate

**Build and Bundle Management:**
- `bundle.js` - Core bundling orchestrator for MCP server and proxy components with console silencing
- `prepare-pack.js` - Workspace dependency resolution for npm publishing
- `docker-build-if-needed.js` - Intelligent Docker image building with change detection
- `check-bundle-size.js` - Bundle size validation for npm distribution constraints

**Testing and Validation Infrastructure:**
- `act-test.sh` - GitHub Actions local testing wrapper
- `validate-push.js` - Pre-push CI simulation in clean environments  
- `test-*.sh` scripts - Various integration and smoke testing automation
- `cleanup-test-processes.js` - Orphaned process cleanup for test stability

**Environment Setup and Diagnostics:**
- `setup/` subdirectory - Platform-specific environment configuration
- `*-env.ps1` scripts - Environment optimization for specific contexts (LLM consumption)
- Memory diagnostic tools (`memdiag.ps1`, `memwatch.ps1`)
- Logo and asset management utilities

**Development Workflow Support:**
- `safe-commit.sh` - Git commit wrapper with mandatory security checks
- `sync-to-wsl.sh` - Cross-platform development environment synchronization
- `start-sse-server.sh` - Runtime dependency validation and server launching

**Quality Assurance:**
- `check-adapters.js` - Debug adapter vendoring status validation
- Coverage collection and analysis tools
- Docker-based testing isolation

## Public API Surface

**Primary Entry Points:**
- `bundle.js` - Main application bundling with MCP protocol compliance
- `docker-build-if-needed.js` - Conditional Docker image building
- `validate-push.js` - Pre-push validation pipeline
- `safe-commit.sh` - Secure Git commit workflow
- `test-mcp-integration.sh` - End-to-end MCP protocol validation

**Development Commands:**
- `act-test.sh [ci|release|e2e]` - Local GitHub Actions testing
- `sync-to-wsl.sh [--clean|--no-install|--no-build]` - WSL development sync
- `start-sse-server.sh` - Server startup with dependency checks

**Analysis Tools:**
- `check-adapters.js` - Adapter status reporting
- `analyze_logo.py` - Asset suitability assessment
- Memory monitoring utilities for performance analysis

## Internal Organization and Data Flow

**Build Pipeline:**
Repository Changes → Bundle Creation → Size Validation → Docker Image → Testing → Deployment

**Testing Workflow:**
Local Development → Pre-commit Checks → CI Simulation → Integration Tests → Docker Smoke Tests

**Environment Management:**
Platform Detection → Dependency Installation → Configuration → Validation → Runtime Support

**Cross-Platform Strategy:**
- PowerShell scripts for Windows environments
- Bash scripts for Unix-like systems
- Node.js scripts for cross-platform core functionality
- Docker for environment isolation and reproducibility

## Important Patterns and Conventions

**Robust Automation:**
- Fail-fast error handling with meaningful exit codes
- Comprehensive dependency checking before operations
- Graceful degradation for non-critical components

**MCP Protocol Compliance:**
- Console output silencing to prevent protocol corruption
- Strict stdio handling for MCP transport compatibility
- Bundle optimization for "batteries included" npm distribution

**Security-First Development:**
- Mandatory personal information checks in commit workflows
- Safe file operations with backup/restore mechanisms
- Isolated testing environments to prevent contamination

**Developer Experience Focus:**
- Colored console output for visual feedback
- Comprehensive help documentation
- Intelligent default behaviors with override options
- Environment-aware execution (CI detection, platform detection)

The scripts directory serves as the central nervous system for the MCP Debugger project, orchestrating complex multi-platform development workflows while maintaining strict quality and security standards.