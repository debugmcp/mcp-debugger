# scripts/
@children-hash: 6670c59ed347d0a1
@generated: 2026-02-15T09:01:48Z

## Purpose
Build automation, development tooling, and deployment orchestration hub for the mcp-debugger project. This directory provides comprehensive scripting infrastructure for cross-platform development, testing, packaging, and deployment workflows.

## Key Components & Integration

### Build & Bundle Management
- **bundle.js** - Core bundling orchestrator using esbuild, creates production artifacts with console silencing for MCP protocol compliance
- **docker-build-if-needed.js** - Intelligent Docker image builder with file change detection and NPM pack operation coordination
- **docker-build.sh** - Simple Docker wrapper for development workflows
- **prepare-pack.js** - NPM package preparation with workspace dependency resolution

### Testing Infrastructure
- **test-*.sh/.js** scripts - Comprehensive test execution including Docker smoke tests, MCP integration validation, and IPC communication testing
- **act-test.sh** - GitHub Actions local testing wrapper using Act CLI
- **validate-push.js** - Pre-push validation that simulates CI environment in clean repository clones

### Development Environment Setup
- **setup/** subdirectory - Windows-specific Rust debugging environment configuration with GNU toolchain integration
- **install-claude-mcp.sh** - Automated Claude Code IDE integration setup
- **sync-to-wsl.sh** - Cross-platform development synchronization for WSL2 environments

### Diagnostic & Monitoring Tools  
- **memdiag.ps1/memwatch.ps1** - Windows memory analysis and continuous monitoring utilities
- **analyze_logo.py/resize_logo.py** - Logo marketplace compliance and asset optimization
- **collect-stdio-logs.ps1** - Docker-based diagnostic log collection

### Utility & Safety Scripts
- **check-adapters.js** - Debug adapter vendoring status validation across multiple platforms
- **safe-commit.sh** - Git commit wrapper with mandatory personal information checks
- **cleanup-test-processes.js** - Cross-platform orphaned process cleanup for test environments
- **llm-env.ps1** - PowerShell environment optimization for LLM/AI agent consumption

## Public API Surface

### Primary Entry Points
- **bundle.js** - `node scripts/bundle.js` - Production bundling with MCP protocol safety
- **docker-build-if-needed.js** - Conditional Docker image building with intelligent change detection
- **validate-push.js** - Pre-push validation with configurable test execution (`--smoke`, `--no-tests`, `--verbose`)
- **act-test.sh** - Local GitHub Actions testing (`ci`, `release`, `e2e` commands)

### Development Workflow Commands
- **sync-to-wsl.sh** - WSL synchronization with dependency management (`--no-install`, `--no-build`, `--clean`)
- **safe-commit.sh** - Secure Git commits with bypass options (`--skip-tests`)
- **test-mcp-integration.sh** - MCP protocol compliance validation
- **cleanup-test-processes.js** - Test environment cleanup automation

### Asset & Package Management
- **prepare-pack.js** - NPM package preparation (`prepare`/`restore` commands)
- **check-bundle-size.js** - Bundle size monitoring with marketplace compliance thresholds
- **resize_logo.py** - Logo asset optimization for marketplace requirements

## Internal Organization & Data Flow

### Build Pipeline Flow
1. **Source bundling** (bundle.js) → **Package preparation** (prepare-pack.js) → **Docker containerization** (docker-build-if-needed.js)
2. **Asset optimization** (logo scripts) → **Size validation** (check-bundle-size.js) → **Adapter verification** (check-adapters.js)

### Testing & Validation Flow  
1. **Local validation** (validate-push.js) → **GitHub Actions simulation** (act-test.sh) → **Integration testing** (test-mcp-integration.sh)
2. **Environment cleanup** (cleanup-test-processes.js) → **Memory monitoring** (memdiag.ps1) → **Log collection** (collect-stdio-logs.ps1)

### Development Environment Flow
1. **Platform setup** (setup/windows-rust-debug.ps1) → **Synchronization** (sync-to-wsl.sh) → **IDE integration** (install-claude-mcp.sh)
2. **Commit safety** (safe-commit.sh) → **Push validation** (validate-push.js) → **CI execution**

## Important Patterns & Conventions

### Cross-Platform Compatibility
- Shell scripts (.sh) for Unix-like systems, PowerShell (.ps1) for Windows
- Node.js scripts (.js) for platform-neutral operations
- Python scripts (.py) for image processing and analysis

### Safety & Reliability
- Mandatory security checks in git operations (safe-commit.sh)
- Console output silencing for MCP protocol integrity (bundle.js)
- Graceful degradation with fallback strategies across all automation scripts
- Environment-aware execution (CI detection, platform detection)

### Developer Experience
- Comprehensive help systems and usage documentation in all CLI tools
- Colored output and progress indicators for user feedback
- Configurable behavior through flags and environment variables
- Fail-fast validation with clear error messages and remediation guidance

This directory serves as the operational backbone of the mcp-debugger project, providing robust automation that supports both development workflows and production deployment while maintaining safety, reliability, and cross-platform compatibility.