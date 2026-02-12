# (root)/
@generated: 2026-02-12T21:02:43Z

## Overall Purpose and Responsibility

The root directory contains the complete MCP (Model Context Protocol) Debug Server project - a comprehensive multi-language debugging platform that enables AI agents and development tools to perform sophisticated debugging operations across JavaScript/TypeScript, Python, Go, and Rust through standardized MCP protocol tools. This project bridges the gap between AI-driven development workflows and real debugging capabilities by providing a batteries-included debugging solution that operates both as a standalone CLI tool and as a protocol-compliant MCP service.

## Key Components and Architecture

### Core Application Structure
- **`src/`**: Complete MCP server implementation with 16 standardized debugging tools, multi-language adapter orchestration, and Debug Adapter Protocol (DAP) proxy system
- **`packages/`**: Monorepo containing modular debugging framework with shared abstractions (`shared`), language-specific adapters (`adapter-*`), and primary distribution package (`mcp-debugger`)
- **`mcp_debugger_launcher/`**: Cross-platform launcher providing intelligent runtime detection and unified execution across Node.js/npm and Docker environments

### Development and Testing Infrastructure  
- **`tests/`**: Comprehensive five-tier testing architecture from unit tests through end-to-end workflows, with complete cross-platform validation and stress testing
- **`examples/`**: Educational demonstration suite featuring working implementations across all supported languages, TUI visualization tools, and autonomous AI agent debugging simulations
- **`scripts/`**: Complete DevOps automation including intelligent build systems, cross-platform environment setup, memory diagnostics, and CI/CD integration

### Distribution and Deployment
- **`docker/`**: Containerization infrastructure with multi-service orchestration supporting both production deployment and development debugging workflows
- **Configuration Files**: Modern tooling setup including flat-config ESLint, Vitest with sophisticated console filtering, and cross-platform build automation

## How Components Work Together

### Debugging Workflow Orchestration
The system operates through a sophisticated multi-layer architecture:

1. **Entry Point Layer**: CLI interface (`mcp-debugger-wrapper.sh`, launcher modules) intelligently detects runtime environment and routes execution to appropriate transport mode (stdio/SSE)

2. **Protocol Layer**: MCP server (`src/server.ts`) exposes standardized debugging tools while managing console output to prevent protocol corruption, with sophisticated session management and adapter discovery

3. **Adapter Orchestration**: Centralized adapter registry (`packages/shared`) provides unified interfaces that language-specific adapters implement, enabling consistent debugging experiences across JavaScript, Python, Go, and Rust

4. **Debug Communication**: DAP proxy system (`src/proxy/`) manages Debug Adapter Protocol communication with language-specific debuggers (js-debug, debugpy, Delve, CodeLLDB) while maintaining session isolation

5. **Resource Management**: Comprehensive dependency injection container (`src/container/`) orchestrates the complete application dependency graph with automatic cleanup and graceful shutdown

### Cross-Language Integration
All components follow consistent patterns enabling seamless multi-language debugging:
- **Unified Interfaces**: Shared abstractions ensure consistent behavior across language adapters
- **Factory Registration**: Dynamic adapter discovery with environment validation and capability detection  
- **Protocol Compliance**: Standardized MCP tool responses regardless of underlying debug adapter implementation
- **Path Resolution**: Container-aware file system operations handling host vs container path mapping

## Public API Surface and Entry Points

### Primary Distribution Interface
- **`@modelcontextprotocol/debugger`**: Main npm package supporting `npx` execution with complete multi-language debugging capabilities
- **CLI Modes**: 
  - `--transport stdio`: MCP protocol communication via standard input/output (default for AI agents)
  - `--transport sse`: Server-Sent Events for web-based integrations
  - `check-rust-binary`: Binary analysis and validation utilities

### Core MCP Tools (16 standardized debugging operations)
- **Session Management**: `create_debug_session`, `list_debug_sessions`, `close_debug_session`
- **Debug Control**: `start_debugging`, `attach_to_process`, step operations (`step_into`, `step_over`, `step_out`)
- **Breakpoint Management**: `set_breakpoint`, `list_breakpoints`, `remove_breakpoint`
- **Runtime Inspection**: `get_variables`, `get_stack_trace`, `evaluate_expression`
- **Language Discovery**: `list_supported_languages` with dynamic adapter detection

### Development and Integration Points
- **Cross-Platform Launcher**: `mcp_debugger_launcher` provides unified interface across Node.js/Docker execution environments
- **Educational Resources**: `examples/` directory offers complete learning progression from basic debugging through advanced multi-language scenarios
- **Testing Framework**: Comprehensive testing infrastructure supporting both component-level validation and complete debugging workflow verification
- **Docker Integration**: Complete containerization with development workspace support and remote debugging capabilities

### Configuration and Customization
- **Language Adapter Policies**: Customizable debugging behavior through strategy patterns
- **Transport Configuration**: Flexible communication modes supporting both AI agent integration and human developer workflows  
- **Environment Detection**: Automatic adaptation to containerized vs native execution environments
- **Resource Management**: Configurable session limits, timeout handling, and cleanup strategies

## Critical Design Patterns

### AI Agent Integration
- **Protocol Integrity**: Console output permanently silenced to prevent MCP protocol corruption
- **Standardized Responses**: All operations return structured JSON for reliable AI consumption
- **Error Recovery**: Comprehensive typed error hierarchy with actionable recovery strategies

### Production Readiness  
- **Multi-Environment Support**: Seamless operation across development, containerized, and CI/CD environments
- **Resource Safety**: Automatic cleanup with leak detection and orphan process prevention
- **Cross-Platform Compatibility**: Unified behavior across Windows, Linux, and macOS with platform-specific optimizations

### Developer Experience
- **Zero Configuration**: Intelligent environment detection with automatic adapter discovery
- **Rich Diagnostics**: Comprehensive logging, memory monitoring, and debugging visualization tools
- **Educational Progression**: Complete learning resources from basic concepts through advanced debugging workflows

This project represents a complete debugging ecosystem that transforms complex debug adapter orchestration into simple, standardized MCP tools accessible to AI agents while maintaining production-grade reliability and comprehensive multi-language support.