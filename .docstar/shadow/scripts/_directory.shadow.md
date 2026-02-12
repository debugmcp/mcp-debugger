# scripts/
@generated: 2026-02-12T21:06:08Z

## Purpose
The `scripts` directory contains automation and utility tools for the mcp-debugger project's development workflow. This module provides build automation, testing infrastructure, deployment helpers, and environment setup tools that support the project's complex multi-platform debugging capabilities.

## Key Components and Integration

### Build and Packaging Pipeline
- **bundle.js** - Core bundling orchestrator using esbuild, creates standalone executables with console silencing for MCP protocol compliance
- **prepare-pack.js** - Monorepo package preparation that resolves workspace dependencies for npm distribution
- **docker-build-if-needed.js** - Intelligent Docker image builder with file change detection and NPM pack coordination
- **docker-build.sh** - Simple Docker build wrapper for development workflows

### Testing and Validation Infrastructure  
- **validate-push.js** - Pre-push validation that simulates CI environments through clean repository clones
- **test-mcp-integration.sh** - MCP protocol compliance testing with Claude CLI integration verification
- **test-docker-local.sh** - Docker smoke testing with state-aware regression tracking
- **check-adapters.js** - Debug adapter vendoring status verification across multiple platforms
- **check-bundle-size.js** - Build artifact size monitoring to ensure distribution suitability

### Development and Debugging Tools
- **act-test.sh** - Local GitHub Actions testing wrapper for CI workflow validation
- **test-ipc.js** - IPC communication testing for proxy bootstrap functionality
- **safe-commit.sh** - Security-enforced Git commit wrapper with personal information checks
- **cleanup-test-processes.js** - Cross-platform orphaned process cleanup for test environments

### Environment and System Management
- **setup/** subdirectory - Platform-specific development environment configuration
- **experiments/** subdirectory - Controlled testing utilities for DAP validation
- **start-sse-server.sh** - SSE mode server launcher with dependency validation
- **sync-to-wsl.sh** - Windows-to-WSL project synchronization with optimization
- **install-claude-mcp.sh** - Automated Claude CLI MCP server configuration

### Analysis and Diagnostics
- **analyze_logo.py** / **resize_logo.py** - Logo processing utilities for marketplace compliance
- **memdiag.ps1** / **memwatch.ps1** - Windows memory analysis and monitoring tools
- **clean-coverage.js** - Docker-aware coverage directory cleanup with permission handling
- **collect-stdio-logs.ps1** - Diagnostic log collection via Docker container execution

### Environment Optimization
- **llm-env.ps1** - PowerShell environment that optimizes command output for LLM/AI consumption
- Various platform-specific utilities for cross-platform development support

## Public API Surface

### Main Entry Points
- **bundle.js** - `bundle()` function for creating distribution bundles
- **validate-push.js** - Can be imported or executed via CLI for pre-push validation
- **docker-build-if-needed.js** - Intelligent Docker building with environment variable configuration
- **prepare-pack.js** - `prepare`/`restore` commands for workspace dependency resolution

### Key Workflows
- **Build Pipeline**: bundle.js → docker-build-if-needed.js → check-bundle-size.js
- **Testing Pipeline**: act-test.sh → test-docker-local.sh → validate-push.js
- **Environment Setup**: setup/ scripts → start-sse-server.sh → install-claude-mcp.sh

## Internal Organization and Data Flow

The directory follows a layered architecture:

1. **Foundation Layer** - Environment setup and validation tools
2. **Build Layer** - Compilation, bundling, and packaging automation
3. **Testing Layer** - Multi-tier testing from unit to integration to E2E
4. **Deployment Layer** - Docker, distribution, and external tool integration
5. **Diagnostics Layer** - Monitoring, analysis, and debugging support tools

## Important Patterns and Conventions

- **Cross-Platform Support** - Most tools handle Windows/Unix differences gracefully
- **Docker-First Development** - Many tools assume or provide Docker-based workflows
- **MCP Protocol Awareness** - Build tools understand stdout pollution concerns
- **Environment Variable Configuration** - Extensive use of env vars for CI/development mode switching
- **Graceful Degradation** - Tools provide fallbacks and skip modes for different environments
- **State-Aware Testing** - Testing infrastructure understands known regressions and expected failures
- **Security-First** - Multiple layers of validation for personal information and commit safety

This scripts directory serves as the operational backbone of the mcp-debugger project, providing comprehensive automation that enables reliable development, testing, and deployment across complex multi-platform debugging scenarios.