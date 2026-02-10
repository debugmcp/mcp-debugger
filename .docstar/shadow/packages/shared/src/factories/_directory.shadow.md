# packages/shared/src/factories/
@generated: 2026-02-10T21:26:13Z

## Purpose
The `factories` directory provides the core infrastructure for creating and managing debug adapters across different programming languages. It establishes a standardized factory pattern that ensures consistent adapter creation, validation, and compatibility checking throughout the debugging system.

## Core Architecture

### Factory Pattern Implementation
The directory centers around the **AdapterFactory** abstract base class, which serves as the foundational template for all language-specific debug adapter factories. This design enforces a consistent creation pattern while allowing customization for different debugging environments.

### Key Components

#### AdapterFactory Base Class
- **Central abstraction** implementing the `IAdapterFactory` interface
- **Template method pattern** with extensible validation and compatibility hooks
- **Metadata management** with defensive copying for immutability
- **Version compatibility** system with semantic version comparison utilities

#### Public API Surface
- `getMetadata()`: Retrieve adapter metadata safely
- `validate()`: Async validation with customizable override points
- `isCompatibleWithCore()`: Version compatibility verification
- `createAdapter()`: Abstract factory method requiring concrete implementation

## Internal Organization

### Data Flow
1. **Factory instantiation** with required `AdapterMetadata`
2. **Validation phase** through extensible `validate()` method
3. **Compatibility checking** against core debugger version requirements
4. **Adapter creation** via concrete `createAdapter()` implementation

### Design Patterns
- **Abstract Factory**: Enforces consistent adapter creation interface
- **Template Method**: Provides default behavior with customization points
- **Defensive Programming**: Metadata immutability and version fallback handling
- **Extensibility First**: Protected methods and validation hooks for inheritance

## Integration Points
The factory system integrates with the broader debugging infrastructure through:
- **Interface contracts** with `IDebugAdapter` and related types
- **Metadata system** for adapter capability declaration
- **Dependency injection** through `AdapterDependencies`
- **Validation framework** via `FactoryValidationResult`

## Key Conventions
- Default implementations favor permissive behavior (always valid/compatible)
- Version checking only activates when `minimumDebuggerVersion` is specified
- Clean separation between factory orchestration and actual adapter instantiation
- Consistent error handling and validation patterns across all factory implementations

This directory serves as the **foundational layer** for the entire debug adapter ecosystem, providing the structural guarantees and patterns that enable reliable, extensible debugging capabilities across multiple programming languages.