# (root)/
@children-hash: 6b387db28dd092a7
@generated: 2026-02-15T09:03:08Z

## Overall Purpose and Responsibility

The root directory contains a complete MCP (Model Context Protocol) debugging server ecosystem that enables AI agents to perform interactive debugging across multiple programming languages through standardized protocol interfaces. This system bridges traditional IDE debugging capabilities with AI-driven development workflows by exposing Debug Adapter Protocol (DAP) functionality through MCP tools, supporting Python, JavaScript/TypeScript, Go, and Rust debugging with both local and containerized deployment options.

## Key Components and System Architecture

### Core Distribution and Entry Points
- **mcp-debugger-wrapper.sh** - Production shell wrapper providing intelligent transport mode detection for Claude Code integration
- **src/** - Complete MCP server implementation with 16+ debugging tools, multi-transport support (stdio/SSE), and cross-language adapter system
- **mcp_debugger_launcher/** - Python CLI package providing intelligent runtime detection and deployment orchestration (Node.js/Docker)

### Multi-Language Debugging Ecosystem
- **packages/** - Comprehensive adapter framework with language-specific implementations:
  - Shared contracts and interfaces (`shared/`)
  - Language adapters for JavaScript, Python, Go, and Rust (`adapter-*`)
  - Batteries-included CLI distribution (`mcp-debugger`)
- **examples/** - Extensive demonstration suite with debugging scenarios, educational resources, and validation infrastructure across all supported languages

### Development and Testing Infrastructure
- **tests/** - Multi-layered testing covering unit, integration, and E2E validation with real debugger integration
- **scripts/** - Complete build automation, development tooling, and cross-platform deployment orchestration
- **docker/** - Containerization infrastructure supporting development workflows with integrated debugging capabilities

### Quality Assurance and Analysis
- **analyze-coverage*.js** - Coverage analysis tools identifying testing gaps and prioritizing improvements
- **eslint.config.js** & **vitest.config.ts** - Modern development tooling configuration supporting TypeScript monorepo structure

## Public API Surface and Integration Points

### Primary Entry Points
- **MCP Server**: Main distribution via `npx @debugmcp/mcp-debugger` with stdio (default) and SSE transport modes
- **Python Launcher**: `mcp_debugger_launcher` package providing intelligent deployment with runtime auto-detection
- **Shell Wrapper**: `mcp-debugger-wrapper.sh` for Claude Code IDE integration with automatic transport configuration

### Core MCP Tools API
The system exposes comprehensive debugging capabilities through MCP protocol:
- **Session Management**: `create_debug_session`, `list_debug_sessions`, `close_debug_session`
- **Debug Control**: `set_breakpoint`, `start_debugging`, `step_over/into/out`, `continue_execution`
- **Code Inspection**: `get_variables`, `get_stack_trace`, `evaluate_expression`, `get_source_context`
- **Language Discovery**: `list_supported_languages` with dynamic adapter detection

### Multi-Language Support
- **JavaScript/TypeScript**: Microsoft js-debug integration with ESM/CommonJS auto-configuration
- **Python**: Complete debugpy integration with virtual environment detection
- **Go**: Native Delve DAP support with comprehensive toolchain discovery
- **Rust**: CodeLLDB-based debugging with Cargo workspace integration
- **Extensible Architecture**: Plugin-based adapter system supporting future language additions

### Deployment and Distribution
- **NPM Package**: Global CLI installation with bundled language adapters
- **Docker Container**: Production-ready containerization with development workflow support
- **Python Package**: Intelligent launcher handling multiple deployment scenarios
- **Cross-Platform**: Windows, macOS, and Linux support with platform-specific optimizations

## Internal Organization and Data Flow

### Component Integration Flow
1. **Protocol Layer**: MCP server receives tool requests from AI agents via stdio/SSE transports
2. **Session Management**: Debug sessions coordinate multi-language debugging with state management
3. **Adapter System**: Language-specific adapters bridge MCP tools to native debuggers (js-debug, debugpy, delve, CodeLLDB)
4. **Process Management**: Robust lifecycle management with graceful shutdown and resource cleanup

### Development and Testing Pipeline
1. **Source Development**: TypeScript/ESM monorepo with shared contracts and language-specific implementations
2. **Quality Assurance**: Comprehensive testing from unit through E2E with real debugger integration
3. **Build and Bundle**: Production artifact creation with console silencing for MCP protocol integrity
4. **Distribution**: Multi-format packaging (npm, Docker, Python) with intelligent deployment selection

### Educational and Validation Framework
- **Progressive Examples**: From simple debugging scenarios to complex concurrent programming patterns
- **Comprehensive Testing**: Cross-language validation ensuring consistent debugging experiences
- **Documentation Generation**: Automated recording and visualization tools for user-facing materials

## Critical Design Patterns

### AI-First Architecture
- **Protocol Compliance**: Strict MCP adherence with console output silencing to prevent protocol corruption
- **Tool-Based Interface**: Debugging operations exposed as discrete MCP tools for AI agent consumption
- **Stateful Session Management**: Persistent debugging contexts supporting multi-step AI debugging workflows

### Production Reliability
- **Multi-Transport Support**: Robust communication via stdio and SSE with graceful degradation
- **Cross-Platform Compatibility**: Consistent behavior across operating systems and deployment environments
- **Resource Management**: Proper cleanup and lifecycle management preventing resource leaks
- **Error Handling**: Comprehensive typed error system with actionable diagnostic information

### Developer Experience
- **Zero Configuration**: Intelligent auto-detection of development environments and toolchains
- **Batteries-Included Distribution**: Self-contained packages eliminating external dependency issues
- **Comprehensive Documentation**: Live examples, testing infrastructure, and educational resources
- **Extensible Architecture**: Clear interfaces supporting community contributions and language additions

This root directory represents a complete, production-ready debugging ecosystem that transforms traditional IDE debugging capabilities into MCP tools accessible by AI agents, enabling sophisticated automated debugging workflows across the modern programming language landscape.