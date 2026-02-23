# scripts/
@children-hash: 09a41af71651ce0f
@generated: 2026-02-23T15:26:46Z

## Purpose
This `scripts/` directory serves as the operational backbone of the MCP Debugger project, providing essential automation for development workflows, testing, deployment, and cross-platform setup. It contains comprehensive tooling for Docker integration, CI/CD pipeline support, bundle optimization, dependency management, and platform-specific configurations.

## Key Components & Integration

### Build & Bundle Management
- **bundle.js** - Primary bundling orchestrator using esbuild, creates production-ready bundles with console silencing for MCP protocol compliance
- **docker-build-if-needed.js** - Intelligent Docker image builder with file change detection and NPM pack operation coordination
- **prepare-pack.js** - Workspace dependency resolver for npm publishing, converting workspace:* references to concrete versions

### Testing & Validation Infrastructure
- **validate-push.js** - Pre-push CI simulation in clean repository clones
- **act-test.sh** - GitHub Actions local testing wrapper for CI workflows
- **test-docker-local.sh** - Docker containerized smoke testing with regression tracking
- **test-mcp-integration.sh** - MCP protocol compliance validation and Claude CLI integration testing
- **cleanup-test-processes.js** - Cross-platform orphaned process cleanup for test environments

### Development Environment Setup
- **setup/** subdirectory - Windows Rust debugging environment automation with GNU toolchain configuration
- **sync-to-wsl.sh** - Windows-to-WSL2 project synchronization with optimized file transfer
- **install-claude-mcp.sh** - Automated MCP server registration with Claude Code IDE

### Debug Adapter Management
- **check-adapters.js** - Comprehensive debug adapter vendoring status reporting across multiple platforms
- **analyze_logo.py** / **resize_logo.py** - Logo optimization utilities for marketplace requirements

### Runtime & Deployment Support
- **docker-entry.sh** - Container entrypoint with proper logging and environment setup
- **start-sse-server.sh** - SSE mode server launcher with dependency validation
- **safe-commit.sh** - Git commit wrapper with mandatory security checks
- **collect-stdio-logs.ps1** - Docker-based diagnostic log collection

### System Monitoring & Diagnostics
- **memdiag.ps1** / **memwatch.ps1** - Windows memory analysis and monitoring tools
- **llm-env.ps1** - PowerShell environment optimizations for AI/LLM consumption
- **clean-coverage.js** - Cross-platform coverage directory cleanup with permission handling

## Public API Surface

### Main Entry Points
- **bundle.js** - `node scripts/bundle.js` for production bundling
- **validate-push.js** - Pre-push validation with `--smoke`, `--no-tests`, `--verbose` options
- **docker-build-if-needed.js** - Conditional Docker builds respecting `FORCE_REBUILD` environment
- **sync-to-wsl.sh** - WSL synchronization with `--clean`, `--no-install`, `--no-build` flags

### CI/CD Integration Points
- **act-test.sh** - Local GitHub Actions testing (`ci`, `release`, `e2e`, `help` commands)
- **test-docker-local.sh** - Docker smoke testing with known regression handling
- **check-bundle-size.js** - Bundle size validation with 8MB warning / 15MB error thresholds

### Developer Utilities
- **safe-commit.sh** - Enhanced git commit with personal information scanning
- **check-adapters.js** - Debug adapter status reporting across 5 platforms
- **cleanup-test-processes.js** - Test environment cleanup for Unix systems

## Internal Organization & Data Flow

### Build Pipeline Flow
1. **Source bundling** (bundle.js) → Console silencing injection → Production artifacts
2. **Docker coordination** (docker-build-if-needed.js) → File change detection → Conditional rebuilds
3. **Package preparation** (prepare-pack.js) → Workspace resolution → NPM-ready packages

### Testing Integration
- **Local validation** (validate-push.js) → Clean environment simulation → CI preview
- **Protocol testing** (test-mcp-integration.sh) → MCP compliance → External tool integration
- **Platform testing** (test-docker-local.sh) → Containerized validation → Regression tracking

### Environment Management
- **Cross-platform setup** (setup/, sync-to-wsl.sh) → Toolchain configuration → Development readiness
- **Runtime preparation** (docker-entry.sh, start-sse-server.sh) → Environment validation → Service launch

## Important Patterns & Conventions

### Error Handling Strategy
- **Graceful degradation** in development tools (warnings vs failures)
- **Fail-fast validation** in CI/deployment scripts
- **Cross-platform compatibility** with platform-specific fallbacks

### Configuration Management
- **Environment variable overrides** for CI/local development flexibility
- **Hardcoded paths** for container deployment consistency
- **Flag-based behavior modification** for flexible script execution

### Integration Architecture
- **Docker-first deployment** with comprehensive container support
- **NPM workspace awareness** with monorepo dependency management
- **Protocol compliance enforcement** through console silencing and validation testing
- **Cross-platform support** with Windows/Unix/WSL2 specific handling

This scripts directory provides complete automation coverage for the MCP Debugger project lifecycle, from initial setup through development, testing, bundling, and deployment, with particular emphasis on cross-platform compatibility and MCP protocol compliance.