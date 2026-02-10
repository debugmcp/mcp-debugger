# scripts/
@generated: 2026-02-10T21:26:48Z

## Overall Purpose and Responsibility

The `scripts` directory serves as the operational automation hub for the MCP Debugger project, providing a comprehensive collection of build, test, deployment, and environment management utilities. This module orchestrates the complex lifecycle of a multi-language debugging tool that must operate across platforms, package managers, and containerized environments while maintaining strict protocol compliance and performance standards.

## Key Components and Relationships

### Build and Bundling Pipeline
- **`bundle.js`** - Core esbuild orchestrator that creates executable bundles with critical console silencing for MCP protocol compliance
- **`docker-build-if-needed.js`** - Intelligent Docker image builder with file change detection and NPM pack coordination
- **`prepare-pack.js`** - Package publishing automation that resolves workspace dependencies to concrete versions

### Testing and Validation Infrastructure
- **`validate-push.js`** - Pre-push validation using clean repository clones to simulate CI conditions
- **`test-docker-local.sh`** - Docker smoke testing with known regression state tracking
- **`test-mcp-integration.sh`** - MCP protocol compliance and Claude CLI integration validation
- **`act-test.sh`** - Local GitHub Actions testing wrapper

### Development Environment Management
- **`setup/`** subdirectory - Platform-specific environment configuration (Windows Rust debugging setup)
- **`sync-to-wsl.sh`** - Windows-to-WSL2 project synchronization with build automation
- **`install-claude-mcp.sh`** - Claude Code IDE integration installer

### Monitoring and Diagnostics
- **Memory monitoring suite**: `memdiag.ps1`, `memwatch.ps1` - Windows memory analysis and continuous monitoring
- **`analyze_logo.py`**, **`resize_logo.py`** - Asset optimization for marketplace compliance
- **`check-adapters.js`** - Debug adapter vendoring status verification
- **Process management**: `cleanup-test-processes.js`, `collect-stdio-logs.ps1`

### Quality Assurance Tools
- **`check-bundle-size.js`** - Bundle size validation against distribution thresholds
- **`safe-commit.sh`** - Git commit wrapper with mandatory personal information checks
- **`llm-env.ps1`** - PowerShell environment optimized for LLM/AI consumption

## Public API Surface

### Primary Entry Points
- **Build Pipeline**: `npm run bundle` → `bundle.js` → `docker-build-if-needed.js`
- **Testing**: `act-test.sh [ci|release|e2e]` for local GitHub Actions testing
- **Validation**: `validate-push.js --smoke` for pre-push CI simulation
- **Environment Setup**: `setup/windows-rust-debug.ps1` for platform configuration
- **Package Preparation**: `prepare-pack.js [prepare|restore]` for publishing workflow

### CLI Utilities
- **Logo optimization**: `analyze_logo.py [path]`, `resize_logo.py [input] [output]`
- **Memory diagnostics**: `memdiag.ps1 [-TopN count]`, `memwatch.ps1 [-IntervalSec n]`
- **Adapter management**: `check-adapters.js` for vendoring status
- **MCP integration**: `test-mcp-integration.sh` for protocol compliance

## Internal Organization and Data Flow

### Layered Architecture
1. **Platform Layer** - OS-specific scripts handle platform differences (PowerShell for Windows, Bash for Unix-like)
2. **Build Layer** - Coordinated build pipeline with dependency resolution and containerization
3. **Validation Layer** - Multi-tier testing from unit to integration to protocol compliance
4. **Operations Layer** - Deployment, monitoring, and maintenance automation

### Data Flow Patterns
- **Build artifacts** flow from source → bundling → Docker images → distribution packages
- **Test results** aggregate from individual adapters → integration tests → protocol compliance
- **Environment configuration** cascades from platform detection → toolchain installation → validation
- **Monitoring data** streams from system metrics → process analysis → log aggregation

## Important Patterns and Conventions

### Error Handling Strategy
- **Fail-fast validation** with immediate exit on security/protocol violations
- **Graceful degradation** for non-critical components (memory monitoring, optimization tools)
- **Comprehensive cleanup** with try-finally blocks and process lifecycle management

### Cross-Platform Design
- **Platform detection** with appropriate fallback mechanisms
- **Tool abstraction** hiding platform-specific command differences
- **Environment normalization** ensuring consistent behavior across development environments

### Protocol Compliance Focus
- **Console silencing** in bundles to prevent MCP protocol corruption
- **Strict JSON-RPC validation** in integration testing
- **Stdio transport protection** with runtime argument detection

### CI/CD Integration
- **Exit code semantics** for automation pipeline integration
- **Environment variable support** for configuration injection
- **Lock file coordination** to prevent build conflicts during parallel operations

The scripts directory represents a mature DevOps automation suite that handles the complexity of multi-language, multi-platform debugging tool development while maintaining the strict requirements of MCP protocol compliance and marketplace distribution.