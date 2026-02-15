# packages\shared\src\factories/
@children-hash: 8a1a78f4e9ba0fe0
@generated: 2026-02-15T09:01:19Z

## Module Overview
The factories directory provides the abstract foundation for creating debug adapters across multiple programming languages. It implements a standardized factory pattern that ensures consistency, compatibility validation, and extensible adapter creation throughout the debugger ecosystem.

## Core Architecture

### Factory Pattern Foundation
- **AdapterFactory** serves as the abstract base class implementing `IAdapterFactory`
- Enforces consistent adapter creation patterns across all language-specific implementations
- Provides template method pattern with overridable validation and compatibility hooks

### Key Components Integration
- **Metadata Management**: Encapsulates adapter configuration and capabilities through `AdapterMetadata`
- **Version Compatibility**: Built-in semantic versioning support with `compareVersions()` utility
- **Validation Framework**: Extensible async validation system with sensible defaults
- **Creation Interface**: Abstract `createAdapter()` method ensures concrete implementation

## Public API Surface

### Primary Entry Points
- **AdapterFactory constructor**: Initializes factory with metadata configuration
- **getMetadata()**: Provides immutable access to factory capabilities and configuration
- **validate()**: Async validation hook for adapter prerequisites and environment checks
- **isCompatibleWithCore()**: Version compatibility verification against debugger core
- **createAdapter()**: Abstract factory method for concrete adapter instantiation

### Utility Functions
- **compareVersions()**: Semantic version comparison with flexible format handling

## Internal Organization

### Data Flow Pattern
1. Factory instantiation with metadata configuration
2. Optional validation and compatibility checking
3. Abstract adapter creation delegated to concrete implementations
4. Defensive copying ensures metadata immutability

### Design Patterns
- **Template Method**: Base validation and compatibility with override points
- **Factory Method**: Abstract creation forcing concrete implementation
- **Defensive Programming**: Immutable metadata access, fallback behaviors
- **Extensibility Framework**: Protected members and validation hooks

## Key Conventions
- **Default Permissiveness**: Base implementations favor "always valid" and "always compatible"
- **Version Safety**: Compatibility checking only when minimum versions specified
- **Separation of Concerns**: Factory logic distinct from adapter implementation details
- **Interface Compliance**: Strict adherence to `IAdapterFactory` contract

This module serves as the critical foundation ensuring consistent, reliable, and extensible debug adapter creation across the entire multi-language debugging system.