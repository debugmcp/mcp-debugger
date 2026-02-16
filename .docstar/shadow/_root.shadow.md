# (root)/
@children-hash: 7aa9cda07e7adab7
@generated: 2026-02-16T09:13:59Z

## Overall Purpose and Responsibility

The root directory contains the **MCP Debugger** - a complete debugging infrastructure that transforms traditional language-specific debuggers into AI-accessible tools through the Model Context Protocol (MCP). This system enables AI agents to perform sophisticated debugging operations (breakpoints, variable inspection, step execution) across JavaScript, Python, Go, and Rust applications through standardized MCP tools, supporting both local development and containerized deployment environments.

## Key Components and System Architecture

### Core Application Infrastructure
- **`src/`** - Complete MCP server implementation with 16 debugging tools, multi-language adapter system, and sophisticated session management
- **`packages/`** - Pluggable Debug Adapter Protocol (DAP) architecture with language-specific adapters for JavaScript, Python, Go, and Rust, plus shared contracts and CLI distribution
- **`mcp_debugger_launcher/`** - Intelligent Python launcher providing unified deployment across Node.js and Docker environments with automatic runtime detection

### Development and Quality Infrastructure
- **`tests/`** - Comprehensive test pyramid from unit to e2e, validating all debugging workflows across the complete language matrix with stress testing and transport parity validation
- **`examples/`** - Educational demonstration suite with multi-language debugging scenarios, autonomous agent workflows, and rich terminal visualizations for documentation
- **`scripts/`** - Complete build automation including bundling, Docker management, testing orchestration, and cross-platform development tooling

### Configuration and Deployment
- **`docker/`** - Containerization infrastructure with integrated debugging capabilities and development workflow support
- **Build Configuration** - ESLint, Vitest, and bundling setup optimized for TypeScript/JavaScript with comprehensive coverage reporting and console output filtering

## Public API Surface and Entry Points

### Primary User Interfaces

**CLI Commands:**
- `npx mcp-debugger` - Main debugging interface with stdio/SSE transport modes and automatic language detection
- `mcp-debugger-wrapper.sh` - Bash wrapper for Claude Code integration with intelligent transport detection
- Python launcher via `mcp_debugger_launcher` package for unified deployment

**MCP Protocol Integration:**
- **16 MCP Tools** organized into session management, debugging control, and inspection categories
- **Multi-Transport Support** - Both stdio (Claude integration) and SSE (HTTP-based) protocols
- **Language Matrix** - Consistent debugging experience across JavaScript/TypeScript, Python, Go, and Rust

**Development APIs:**
- **Adapter System** - Pluggable architecture for extending language support through standardized interfaces
- **Session Management** - Complete debug session lifecycle with multi-session concurrency support
- **Configuration System** - Language-specific and environment-aware configuration with intelligent defaults

### Integration Points

**AI Agent Integration:**
- MCP tool calls for all debugging operations with structured responses and error handling
- Session-based workflow management enabling complex multi-step debugging procedures
- Real-time debugging event streaming for interactive AI debugging experiences

**Development Environment Integration:**
- Automatic toolchain discovery with caching and cross-platform compatibility
- IDE integration patterns with console output management for protocol compliance
- Docker-first deployment with development workflow optimization

## Internal Organization and Data Flow

### Execution Architecture

The system follows a **layered microkernel architecture**:

1. **Protocol Layer** - MCP server handling tool calls and managing transport protocols (stdio/SSE)
2. **Orchestration Layer** - Session management and multi-language adapter coordination
3. **Adaptation Layer** - Language-specific DAP adapters bridging to native debugging tools
4. **Runtime Layer** - Native debuggers (js-debug, debugpy, delve, CodeLLDB) executing actual debugging operations

### Development to Deployment Pipeline

1. **Development** - Multi-language source code with comprehensive testing across all supported languages
2. **Build Phase** - Sophisticated bundling with console silencing for MCP protocol compliance
3. **Package Distribution** - NPM packaging with intelligent launcher providing runtime selection
4. **Deployment** - Automatic environment detection selecting optimal execution strategy (npx vs Docker)

### Quality Assurance Strategy

- **Comprehensive Testing** - Complete test pyramid with 90%+ coverage across unit, integration, e2e, and stress testing
- **Cross-Language Validation** - All debugging operations tested against real language runtimes and debuggers
- **Production Simulation** - Docker-based testing matching production deployment patterns
- **Development Tools** - Rich visualization, automated demo recording, and educational examples

## Critical System Patterns

**Container-First Design:** All components transparently handle local vs containerized deployment through centralized environment detection and path resolution.

**Policy-Driven Architecture:** Language-specific behavior implemented through pluggable adapter policies enabling extensibility without core system modification.

**Protocol Safety:** Comprehensive console output management ensures MCP protocol compliance while maintaining debugging visibility.

**AI-First API Design:** All debugging operations exposed as structured MCP tools with consistent error semantics and recoverability hints for AI agent consumption.

**Educational Focus:** Extensive examples, documentation generation, and visualization tools support both AI agent learning and human developer understanding.

This directory represents a complete transformation of traditional debugging into AI-accessible infrastructure, enabling sophisticated debugging workflows through standardized protocols while maintaining the full power and language-specific features of native debugging tools.