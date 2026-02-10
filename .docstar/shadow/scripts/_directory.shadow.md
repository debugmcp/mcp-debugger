# scripts/
@generated: 2026-02-09T18:16:36Z

## Overall Purpose and Responsibility

The `scripts` directory serves as the operational backbone of the MCP debugger project, providing comprehensive tooling for development workflows, build automation, testing infrastructure, and deployment preparation. This collection orchestrates the complete lifecycle from development setup through CI/CD validation and production bundling.

## Key Components and How They Relate

### Development Environment Management
- **Setup Infrastructure**: Platform-specific environment preparation (Windows Rust debugging, toolchain configuration)
- **Environment Optimization**: LLM-friendly console output filtering (`llm-env.ps1`) and development workflow wrappers
- **Cross-Platform Sync**: WSL2 development environment synchronization (`sync-to-wsl.sh`) 

### Build and Bundle Pipeline
- **Intelligent Building**: Conditional Docker builds (`docker-build-if-needed.js`) and bundle size monitoring (`check-bundle-size.js`)
- **Production Bundling**: esbuild-based bundling (`bundle.js`) with console silencing for MCP protocol compliance
- **Package Preparation**: Workspace dependency resolution (`prepare-pack.js`) for npm publishing

### Testing and Validation Framework
- **Multi-Level Testing**: Unit, integration, e2e, and Docker smoke tests with platform-specific execution
- **Protocol Compliance**: MCP server validation (`test-mcp-integration.sh`) and IPC communication testing (`test-ipc.js`)
- **Pre-Push Validation**: Clean repository simulation (`validate-push.js`) to catch CI issues early
- **Memory Diagnostics**: Comprehensive Windows memory analysis and monitoring tools

### Debug Adapter Management  
- **Adapter Lifecycle**: Vendored adapter status checking (`check-adapters.js`) and version validation
- **Process Management**: Test cleanup utilities and orphaned process detection
- **Asset Processing**: Logo analysis and resizing for marketplace requirements

## Public API Surface

### Main Entry Points
- **Development Workflow**: `safe-commit.sh` (git commit wrapper), `llm-env.ps1` (console optimization), `act-test.sh` (local CI testing)
- **Build Commands**: `bundle.js` (production bundling), `docker-build.sh` (containerization), `prepare-pack.js` (publishing prep)
- **Validation Tools**: `validate-push.js` (pre-push checks), `check-bundle-size.js` (size monitoring), `test-mcp-integration.sh` (protocol testing)
- **Setup Scripts**: `install-claude-mcp.sh` (Claude integration), `start-sse-server.sh` (development server), platform setup in `setup/`

### Cross-Cutting Utilities
- **Process Management**: `cleanup-test-processes.js` (test cleanup), `memwatch.ps1`/`memdiag.ps1` (memory analysis)
- **Asset Pipeline**: `analyze_logo.py`/`resize_logo.py` (marketplace asset preparation)
- **Diagnostic Tools**: `collect-stdio-logs.ps1` (container debugging), experimental debugging targets in `experiments/`

## Internal Organization and Data Flow

### Development → Build → Test → Deploy Pipeline
1. **Environment Setup**: Platform-specific toolchain installation and configuration
2. **Development Support**: Safe commits, memory monitoring, process cleanup, LLM-optimized output
3. **Build Orchestration**: Conditional Docker builds, intelligent bundling, workspace dependency resolution  
4. **Multi-Layer Validation**: Local testing (act), protocol compliance, pre-push simulation, bundle analysis
5. **Deployment Preparation**: Asset optimization, package preparation, Claude MCP integration

### Key Data Flows
- **Build Artifacts**: TypeScript → dist/ → bundled artifacts → Docker images → validated packages
- **Test Orchestration**: Source changes → conditional rebuilds → multi-platform test execution → result aggregation
- **Debug Session Flow**: Process spawning → adapter validation → IPC communication → cleanup management
- **Asset Pipeline**: Raw logos → analysis → resizing → marketplace-ready assets

## Important Patterns and Conventions

### Intelligent Automation
- **Conditional Execution**: Build only when needed, skip tests in CI environments, graceful degradation on missing tools
- **Multi-Platform Support**: Windows PowerShell scripts, Unix shell scripts, Node.js cross-platform utilities
- **Error Recovery**: Comprehensive error handling with fallback mechanisms and user guidance

### Protocol-Aware Design
- **MCP Compliance**: Console silencing in bundles, transport mode detection, protocol validation
- **Debug Protocol Integration**: DAP proxy management, adapter lifecycle, IPC validation
- **CI/CD Integration**: GitHub Actions simulation, pre-push validation, Docker-based testing

### Development Experience Focus  
- **LLM-Optimized Output**: Filtered test results, structured logging, failure-focused reporting
- **Debugging Support**: Memory diagnostics, process tracking, protocol testing, experimental targets
- **Workflow Integration**: Safe commits with checks, environment synchronization, rapid iteration support

This scripts ecosystem provides a complete development infrastructure that scales from individual developer workflows to CI/CD automation, ensuring consistent builds, thorough validation, and seamless deployment preparation across all supported platforms.