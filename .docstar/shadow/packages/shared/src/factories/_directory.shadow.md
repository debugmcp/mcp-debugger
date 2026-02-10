# packages/shared/src/factories/
@generated: 2026-02-09T18:16:05Z

## Purpose
The `factories` directory provides foundational infrastructure for creating debug adapter factories in a TypeScript debugging framework. It defines abstract base classes and standardized patterns that enable consistent, version-aware creation of language-specific debug adapters while ensuring compatibility and validation across the debugging ecosystem.

## Key Components

### AdapterFactory Abstract Base Class
- **Core Infrastructure**: Abstract base class implementing `IAdapterFactory` interface that serves as the template for all concrete adapter factory implementations
- **Metadata Management**: Encapsulates factory configuration through `AdapterMetadata`, providing immutable access to factory settings and capabilities  
- **Version Compatibility**: Built-in semantic version checking system that validates adapter compatibility with core debugger versions
- **Validation Framework**: Extensible validation infrastructure allowing concrete factories to implement environment-specific validation logic

## Public API Surface

### Primary Entry Points
- **AdapterFactory**: Main abstract base class for implementing concrete adapter factories
- **getMetadata()**: Access to factory metadata and capabilities
- **validate()**: Async validation method for environment checks
- **isCompatibleWithCore()**: Version compatibility validation
- **createAdapter()**: Abstract method requiring implementation for actual adapter instantiation

## Internal Organization and Data Flow

### Factory Pattern Implementation
1. **Configuration**: Factories are initialized with `AdapterMetadata` containing version requirements and capabilities
2. **Validation**: Multi-stage validation including version compatibility and environment-specific checks
3. **Creation**: Abstract `createAdapter()` method delegates actual adapter instantiation to concrete implementations
4. **Dependencies**: Adapter creation receives `AdapterDependencies` parameter for runtime configuration

### Version Management System
- **Semantic Versioning**: Built-in comparison utilities for handling version compatibility
- **Graceful Degradation**: Default compatibility behavior when version information is missing
- **Zero-padding Logic**: Robust version comparison handling missing version parts

## Important Patterns and Conventions

### Template Method Pattern
- Base class provides common infrastructure (metadata, validation, version checking)
- Concrete factories only need to implement adapter-specific creation logic
- Ensures consistent behavior across all adapter types

### Immutability and Safety
- Metadata protected through readonly access and defensive copying
- Factory state cannot be modified after construction
- Version comparison utilities handle edge cases gracefully

### Extensibility Design
- Abstract validation method allows custom validation logic per adapter type
- Metadata-driven configuration enables flexible factory behavior
- Clean separation between common infrastructure and adapter-specific implementation

## Role in Larger System
This directory serves as the foundation for the adapter factory subsystem, providing the scaffolding that enables the debugging framework to support multiple programming languages through a consistent, validated factory pattern. It ensures that all debug adapters are created through a standardized process that includes version compatibility checks and environment validation.