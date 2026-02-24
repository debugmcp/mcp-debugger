# mcp_debugger_launcher/
@children-hash: d827b2f48de20697
@generated: 2026-02-24T01:54:57Z

## Overall Purpose and Responsibility

The `mcp_debugger_launcher` is a Python package that provides intelligent runtime detection and process management for launching MCP (Model Context Protocol) debugging servers across multiple execution environments. It serves as a universal launcher that abstracts the complexity of running debug servers in either Node.js/npx or Docker environments through a unified CLI interface.

## Key Components and Relationships

### Core Architecture
The module is organized around three primary components working in concert:

1. **Project Configuration (`pyproject.toml`)**: Defines the package metadata, dependencies, and CLI entry point `debug-mcp-server`
2. **Launcher Package (`mcp_debugger_launcher/`)**: Core implementation with runtime detection, process management, and CLI interface
3. **Test Suite (`tests/`)**: Manual integration tests for system-level validation

### Component Interaction Flow
```
CLI Entry → Runtime Detection → Server Launcher → Process Management
    ↓             ↓                ↓                ↓
User Commands → Environment → Command Building → Subprocess Control
```

The launcher package orchestrates between its three internal modules:
- **`cli.py`**: Click-based command-line interface for user interaction
- **`detectors.py`**: Static utility class for discovering Node.js and Docker availability
- **`launcher.py`**: Core process lifecycle management with graceful shutdown

## Public API Surface

### Primary Entry Points
- **CLI Command**: `debug-mcp-server` (via setuptools entry point)
- **Package Import**: Direct Python module access through standard `__init__.py`
- **Main Function**: `mcp_debugger_launcher.cli:main` as the core orchestrator

### CLI Interface Features
- **Operation Modes**: stdio (default) and SSE server communication modes
- **Runtime Selection**: Automatic detection with manual override flags (`--docker`, `--npm`)
- **Configuration**: Configurable SSE port (default 3001), dry-run capability
- **Diagnostics**: Built-in runtime status reporting and installation guidance

### Key Dependencies and Configuration
- **Core Runtime Dependencies**: debugpy ≥1.8.14, click ≥8.0.0
- **Target Package**: "@debugmcp/mcp-debugger" (NPM) / "debugmcp/mcp-debugger:latest" (Docker)
- **Python Compatibility**: 3.8 through 3.11
- **Package Version**: 0.17.0

## Internal Organization and Data Flow

### Detection and Launch Pipeline
1. **Environment Assessment**: `RuntimeDetector` scans for Node.js/npx and Docker availability
2. **Runtime Recommendation**: Intelligent selection prioritizing npx over Docker
3. **Command Construction**: Runtime-specific command building with shared configuration
4. **Process Execution**: Subprocess management with signal handling and graceful shutdown

### Error Handling and Robustness
- **Defensive Programming**: Comprehensive try/except blocks with timeouts for external calls
- **Graceful Degradation**: Continues operation with helpful error messages when dependencies are missing
- **Resource Management**: Guaranteed cleanup via finally blocks and 5-second termination timeouts
- **Exit Code Standards**: Proper code propagation for scripting integration

## Important Patterns and Conventions

### Design Patterns
- **Static Utility Pattern**: `RuntimeDetector` provides stateless detection operations
- **Process Lifecycle Management**: Consistent subprocess handling across runtime environments
- **Command Builder Pattern**: Runtime-agnostic configuration with environment-specific execution
- **Manual Integration Testing**: Human-verified console output testing for complex system scenarios

### Development and Deployment
- **Build System**: Standard setuptools configuration with wheel support
- **Packaging**: Single package with LICENSE inclusion and MIT licensing
- **Development Status**: Alpha stage with focus on AI agent debugging workflows
- **Repository**: Hosted at github.com/debugmcp/mcp-debugger

The module provides a production-ready, intelligent launcher that bridges Python debugging infrastructure with external MCP server implementations, offering comprehensive diagnostics and multi-runtime support for development and production environments.