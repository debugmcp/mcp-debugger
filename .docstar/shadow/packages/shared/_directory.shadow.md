# packages\shared/
@children-hash: 41c6c4e435d61acb
@generated: 2026-02-24T01:55:51Z

## Shared Components Package for MCP Debug Adapter Framework

The `packages/shared` directory provides the foundational type definitions, interfaces, and utilities for a multi-language debug adapter system built on the Debug Adapter Protocol (DAP). This package serves as the central contract layer that enables extensible debugging across Python, JavaScript, Rust, Go, and other languages within the MCP (Model Control Protocol) debugger ecosystem.

## Core Architecture and Components

### Main Source Module (`src/`)
The heart of the package containing the complete abstraction framework:

- **Interface Definitions**: Type-safe contracts implementing policy patterns for language-specific behaviors, including core `IDebugAdapter` interface, language-specific `AdapterPolicy` implementations, and registry patterns for dynamic adapter discovery
- **Data Models**: Comprehensive state management layer with session lifecycle tracking, configuration models, and runtime constructs (breakpoints, variables, stack frames)
- **Factory Foundation**: Abstract factory patterns ensuring consistent adapter creation with metadata validation and version compatibility
- **Unified Export Hub**: Facade pattern providing single entry point with over 200 exported types and utilities

### Testing Infrastructure (`tests/`)
Comprehensive validation suite ensuring reliability across language implementations:

- **Unit Test Coverage**: Language-specific adapter policy validation for JavaScript/Node.js and Rust/CodeLLDB debugging
- **Protocol Compliance**: DAP command processing and response handling verification
- **Cross-Platform Testing**: Platform-specific behavior validation with extensive mocking capabilities

### Build Configuration
Modern TypeScript toolchain optimized for monorepo ESM development:

- **ES2022/NodeNext**: Modern JavaScript features with full Node.js ESM compatibility
- **Dual Exports**: CJS/ESM support with TypeScript declaration generation
- **Testing Framework**: Vitest with Istanbul coverage and comprehensive path alias resolution

## Public API Surface and Integration

### Primary Entry Points

**Package Interface**: Published as `@debugmcp/shared` with main entry at `./dist/index.js`, providing unified access to:
- Debug adapter abstractions and language-specific policies
- Session management and data models
- Factory and registry patterns for dynamic adapter loading
- External dependency abstractions for testability
- Complete VS Code Debug Protocol re-exports

**Core Dependencies**: Built on `@vscode/debugprotocol` for DAP compliance, ensuring standard tooling compatibility across the debugging ecosystem.

### Integration Architecture

The package enables a layered debugging architecture where:
1. **Configuration Layer**: Validates and transforms debug parameters
2. **Policy Layer**: Applies language-specific behaviors through pluggable adapters
3. **Session Layer**: Manages dual-state tracking (lifecycle + execution status)
4. **Transport Layer**: Handles DAP protocol communication with debug clients

## Internal Organization and Data Flow

### Component Relationships
- **Interfaces** define contracts and extensible behaviors
- **Models** provide immutable data structures and state management
- **Factories** enable consistent instantiation with dependency injection
- **Tests** validate cross-language compatibility and protocol compliance

### Key Data Flow Patterns
- **Session Lifecycle**: Configuration → Validation → Factory Creation → Policy Application → Runtime Management
- **Adapter Integration**: Registry → Factory → Policy → Adapter instance with full dependency injection
- **State Management**: Dual-state model separating session lifecycle from execution status

## Design Patterns and Conventions

### Extensibility Framework
- Language-agnostic base interfaces with clear extension points
- Policy pattern enabling customization without breaking common APIs
- Comprehensive TypeScript definitions with runtime validation
- Backward compatibility through deprecated interface maintenance

### Quality Assurance
- Defensive programming with immutable metadata access
- Comprehensive error handling and fallback behaviors
- Cross-platform compatibility through system abstractions
- Strict DAP compliance for standard IDE integration

This shared package forms the foundation that enables the MCP debugger to support multiple programming languages through a unified, type-safe, and extensible architecture while maintaining clear separation between generic DAP transport logic and language-specific implementation details.