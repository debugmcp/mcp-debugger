# mcp_debugger_launcher/
@generated: 2026-02-10T21:26:39Z

## Overall Purpose and Responsibility

The `mcp_debugger_launcher` directory provides a complete command-line solution for launching and debugging MCP (Model Context Protocol) servers across diverse runtime environments. This package abstracts the complexity of multi-environment deployment (Node.js/NPX and Docker) into a unified interface, offering both interactive CLI usage and programmatic integration capabilities for MCP application debugging workflows.

## Key Components and Integration

The directory follows a clean layered architecture with two primary modules working in concert:

### Core Launcher Package
- **CLI Interface** (`cli.py`): Click-based command parser with comprehensive mode and runtime selection options
- **Runtime Detection** (`detectors.py`): Intelligent environment discovery with preference-based recommendation system
- **Process Management** (`launcher.py`): Robust server lifecycle management with graceful shutdown and error handling
- **Package Structure** (`__init__.py`): Standard Python package initialization enabling flexible import patterns

### Testing Infrastructure (`tests/`)
- **Integration Validation** (`test_launcher.py`): Manual testing suite that validates real system dependencies and demonstrates proper usage patterns

The components integrate through a clear data flow: CLI commands trigger runtime detection, which informs the launcher's process management decisions, while the test suite validates this entire pipeline against actual system conditions.

## Public API Surface

### Primary Entry Points

**Command-Line Interface:**
- `main()` function supporting multiple execution modes:
  - `--stdio` (default): Standard input/output communication
  - `--sse [PORT]`: Server-sent events mode (default port 3001)
  - `--docker` / `--npm`: Force specific runtime selection
  - `--status`: Runtime availability diagnostics
  - `--dry-run`: Command preview without execution

**Programmatic Access:**
- `RuntimeDetector`: Environment discovery with comprehensive validation
- `DebugMCPLauncher`: Process lifecycle management for both NPX and Docker runtimes
- Import fallbacks supporting both package installation and direct script execution

### Supported Runtimes
- **NPX**: `@debugmcp/mcp-debugger` package (preferred when available)
- **Docker**: `debugmcp/mcp-debugger:latest` image (fallback option)

## Internal Organization and Data Flow

### Runtime Selection Strategy
1. **Explicit Selection**: User-specified runtime flags take precedence
2. **Intelligent Detection**: Automatic preference for NPX when Node.js ecosystem is complete
3. **Graceful Fallback**: Docker selection when daemon is available
4. **Guided Failure**: Helpful installation instructions when no runtimes are functional

### Process Management Patterns
- **Signal Handling**: SIGINT/SIGTERM support for graceful shutdown
- **Resource Cleanup**: 5-second timeout protection with guaranteed process termination  
- **Real-time Feedback**: Live stdout/stderr streaming during server execution
- **Error Isolation**: Runtime-specific error handling with actionable user guidance

### Testing and Validation
The integrated test suite employs manual verification patterns rather than automated assertions, validating actual system dependencies and providing human-readable verification of launcher behavior. This approach ensures the launcher works correctly in real deployment environments rather than just passing mocked unit tests.

## Key Conventions and Patterns

### Error Handling Philosophy
- Exit code 1 for configuration or runtime failures
- Graceful degradation with specific installation guidance
- Timeout protection on all external command executions
- Structured diagnostic output for troubleshooting workflows

### Development Integration
- Support for both standalone CLI usage and library integration
- Clean separation between detection, execution, and interface concerns
- Verbose logging capabilities across all components
- Consistent resource management and cleanup patterns

The `mcp_debugger_launcher` directory delivers a production-ready solution that bridges the gap between MCP server development and debugging workflows, providing developers with a reliable, cross-platform tool for launching debug servers regardless of their local runtime environment preferences.