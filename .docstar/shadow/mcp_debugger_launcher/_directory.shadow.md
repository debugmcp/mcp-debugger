# mcp_debugger_launcher/
@generated: 2026-02-09T18:16:35Z

## Overall Purpose and Responsibility

The `mcp_debugger_launcher` module is a comprehensive developer tool that provides a unified command-line interface for launching MCP (Model Context Protocol) debug servers across multiple runtime environments. It abstracts the complexity of deploying debug servers on both Node.js/npm and Docker platforms, offering intelligent runtime detection and automatic environment selection to simplify the debugging workflow for MCP applications.

## Key Components and Integration

### Core Architecture
The module consists of two main packages that work together:

**Main Package (`mcp_debugger_launcher/`)**:
- **`cli.py`** - Click-based command-line interface serving as the primary user entry point
- **`launcher.py`** - Core execution engine with `DebugMCPLauncher` class for subprocess management
- **`detectors.py`** - Runtime environment detection via `RuntimeDetector` class
- **`__init__.py`** - Package initialization for Python imports

**Test Package (`tests/`)**:
- **`test_launcher.py`** - Comprehensive integration test suite for validation and system readiness assessment

### Component Integration Flow
The components form a layered architecture with clear separation of concerns:
1. **CLI Layer** handles user interaction and command parsing
2. **Detection Layer** analyzes Node.js/Docker runtime availability
3. **Execution Layer** manages actual server launching with graceful shutdown
4. **Testing Layer** validates the entire system without side effects

## Public API Surface

### Primary Entry Points
- **`main()` function in `cli.py`** - Main command-line interface supporting:
  - Server modes: `stdio` and `sse` (with optional port configuration)
  - Runtime selection: `--docker`, `--npm` flags or automatic detection
  - Utility options: `--dry-run`, `--verbose`, version display

- **`main()` function in `test_launcher.py`** - Integration test orchestrator for system validation

### Key Classes and APIs
- **`DebugMCPLauncher`** - Core launcher class with methods:
  - `launch_with_npx()` - npm/npx execution path
  - `launch_with_docker()` - Docker containerized execution
  - Built-in signal handling and graceful shutdown

- **`RuntimeDetector`** - Static detection utilities:
  - `detect_available_runtimes()` - Comprehensive environment analysis
  - `get_recommended_runtime()` - Intelligent runtime selection logic

## Internal Organization and Data Flow

### Execution Pipeline
1. **Command Parsing** - CLI validates arguments and checks option compatibility
2. **Environment Detection** - System analyzes Node.js/npm and Docker availability
3. **Runtime Selection** - Automatic detection or user-forced selection via flags
4. **Command Construction** - Appropriate parameters prepared for target runtime
5. **Process Launch** - Subprocess execution with real-time output streaming
6. **Graceful Shutdown** - Signal handling with timeout-based resource cleanup

### Data Management
- Standardized runtime information dictionaries from detection layer
- Process management through subprocess.Popen instances with timeout patterns
- Signal-safe shutdown mechanisms with comprehensive error handling

## Important Patterns and Conventions

### Design Philosophy
- **Runtime Abstraction** - Unified interface hiding npm vs Docker deployment complexity
- **Fail-Fast Validation** - Early detection of conflicting options and missing dependencies
- **User Experience Focus** - Rich status reporting, installation guidance, and verbose logging
- **Defensive Programming** - Comprehensive error handling with timeout protection

### Technical Standards
- Hardcoded constants for package names (`@debugmcp/mcp-debugger`) and Docker images
- Consistent timeout patterns (5s version checks, 10s package validation)
- Real-time output streaming for transparency
- Signal handler registration for clean termination

### Testing Strategy
- Integration-focused validation without actual subprocess execution
- Comprehensive system readiness assessment
- Human-readable status reporting with clear guidance
- Validation of complete workflow from detection to command construction

## Dependencies and Environment Requirements

**Core Dependencies**:
- Click framework for CLI functionality
- Standard library modules (subprocess, signal, shutil) for system operations

**Runtime Requirements**:
- Node.js/npm OR Docker for actual server execution
- Optional debugpy for Python debugging compatibility

The module serves as a bridge between MCP development workflows and multiple deployment environments, providing a consistent interface that adapts to available runtime capabilities while maintaining robust error handling and user guidance.