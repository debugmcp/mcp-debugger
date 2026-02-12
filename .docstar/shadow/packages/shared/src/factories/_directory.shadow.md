# packages/shared/src/factories/
@generated: 2026-02-11T23:47:36Z

## Purpose

The `factories` directory provides the foundational architecture for creating debug adapters across different programming languages in a standardized, extensible way. This module establishes the core factory pattern that ensures consistent adapter instantiation, validation, and version compatibility management throughout the debugging system.

## Core Architecture

### Factory Pattern Implementation
The directory centers around the **AdapterFactory** abstract base class, which serves as the template for all language-specific debug adapter factories. This design enforces a uniform interface while allowing language-specific customization through inheritance and method overrides.

### Key Components

**AdapterFactory Base Class**
- Abstract factory implementing `IAdapterFactory` interface
- Provides standardized lifecycle: validation → compatibility checking → adapter creation
- Encapsulates adapter metadata management with defensive copying
- Includes built-in semantic version comparison utilities

**Template Method Pattern**
- Abstract `createAdapter()` method forces concrete implementation
- Overridable `validate()` and `isCompatibleWithCore()` methods with sensible defaults
- Protected metadata access for subclass customization

## Public API Surface

### Main Entry Points
- **AdapterFactory constructor**: Accepts `AdapterMetadata` for factory configuration
- **getMetadata()**: Returns immutable copy of adapter configuration
- **validate()**: Async validation hook (default: always valid)
- **isCompatibleWithCore()**: Version compatibility verification
- **createAdapter()**: Abstract method for adapter instantiation

### Integration Points
The factory interfaces with the broader system through:
- `IDebugAdapter` interface for created adapters
- `AdapterMetadata` for factory configuration
- `AdapterDependencies` for runtime requirements
- `FactoryValidationResult` for validation feedback

## Internal Organization

### Data Flow
1. **Initialization**: Factory configured with adapter metadata
2. **Validation**: Optional async validation of factory state
3. **Compatibility**: Version checking against core debugger requirements
4. **Creation**: Language-specific adapter instantiation

### Design Patterns
- **Factory Pattern**: Standardized object creation interface
- **Template Method**: Base implementation with customization hooks
- **Defensive Programming**: Immutable metadata access, version fallbacks
- **Strategy Pattern**: Pluggable validation and compatibility strategies

## Key Conventions

### Version Management
- Semantic versioning with flexible comparison (`compareVersions` utility)
- Graceful handling of missing or malformed version strings
- Conservative compatibility defaults (permissive when uncertain)

### Error Handling
- Defensive metadata copying prevents external mutations
- Default implementations favor availability over strict validation
- Version parsing with integer conversion and zero-padding fallbacks

### Extensibility Points
- Protected metadata access for subclass customization
- Virtual validation and compatibility methods for override
- Abstract adapter creation forces language-specific implementation

This directory serves as the foundation for the plugin architecture, enabling consistent debug adapter management while supporting diverse language-specific requirements through controlled extensibility.