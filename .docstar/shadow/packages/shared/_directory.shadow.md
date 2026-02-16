# packages\shared/
@children-hash: f8de4a9f3c7bb9a2
@generated: 2026-02-16T08:25:18Z

## Overall Purpose and Responsibility

The `packages/shared` directory serves as the foundational shared library for a multi-language Debug Adapter Protocol (DAP) system. This module provides the core abstractions, type-safe contracts, and standardized patterns that enable unified debugging experiences across JavaScript, Python, Go, Rust, and other programming languages. It acts as the contract layer between IDE debugging clients and language-specific debug engines, ensuring consistent behavior and protocol compliance across the entire debugging ecosystem.

## Key Components and Integration

### Core Architecture Components
- **Source Code (`src/`)**: The primary implementation containing models, interfaces, and factories that define the debugging framework's architecture
- **Testing Infrastructure (`tests/`)**: Comprehensive quality assurance layer validating debug adapter policies and cross-platform compatibility
- **Build Configuration (`vitest.config.ts`)**: Test environment setup with coverage reporting and module resolution for the shared package

### Integration Patterns
The components work together to create a cohesive debugging framework:

1. **Abstraction Layer**: The `src/` directory provides policy-driven architecture where language-specific behaviors are encapsulated behind common interfaces
2. **Quality Validation**: The `tests/` directory ensures reliability through comprehensive unit testing of adapter policies and DAP protocol compliance
3. **Development Infrastructure**: Vitest configuration enables consistent testing and coverage reporting across the monorepo structure

## Public API Surface

### Primary Entry Points
- **Debug Adapter Contracts**: `IDebugAdapter`, `IAdapterRegistry`, and `IAdapterFactory` interfaces for pluggable adapter architecture
- **Session Management**: `DebugSession` model with dual-state tracking and comprehensive lifecycle management
- **Configuration System**: `GenericAttachConfig` and `CustomLaunchRequestArguments` for flexible debugging setup
- **Policy Framework**: `AdapterPolicy` base interface enabling language-specific behavior implementation

### Core Abstractions
- **External Dependencies**: Complete abstraction layer (`IFileSystem`, `IProcessManager`, `INetworkManager`) for service composition and testability
- **State Management**: Sophisticated tracking system supporting both session lifecycle and execution states with legacy compatibility
- **DAP Protocol Integration**: Re-exports and extensions of `@vscode/debugprotocol` types for standard compliance

## Internal Organization and Data Flow

### Development Workflow
1. **Implementation**: Core abstractions and models defined in `src/` provide the foundation for language-specific adapters
2. **Validation**: Comprehensive test suite in `tests/` ensures reliability and cross-platform compatibility
3. **Build Process**: Vitest configuration manages testing, coverage, and module resolution across the shared package

### Architecture Flow
- **Discovery**: Registry pattern enables dynamic adapter discovery based on language or configuration
- **Instantiation**: Factory pattern with dependency injection creates language-specific adapters
- **Execution**: Policy-driven architecture handles language-specific debugging behaviors while maintaining common interfaces
- **Quality Assurance**: Testing infrastructure validates protocol compliance, session management, and error handling

## Important Patterns and Conventions

### Design Principles
- **Type Safety First**: Extensive TypeScript interfaces and type guards ensure compile-time safety
- **Language Agnostic**: Generic interfaces with policy-based extension enable support for diverse programming languages
- **DAP Standard Compliance**: Built on VSCode Debug Adapter Protocol with proper re-exports and extensions
- **Testability**: Comprehensive dependency injection and mocking infrastructure for reliable testing
- **Cross-Platform Support**: Platform-specific behaviors abstracted through policy interfaces and validated through testing

### Development Standards
- **Monorepo Integration**: Configured for seamless integration with larger monorepo structure
- **Coverage-Driven**: Istanbul-based coverage reporting ensures comprehensive test validation
- **Module Resolution**: Clean import paths through alias configuration (`@` maps to `./src`)

This shared module serves as the backbone of a pluggable debug adapter framework, enabling new language support through interface implementation while providing robust testing infrastructure and standardized patterns for reliable cross-language debugging experiences.