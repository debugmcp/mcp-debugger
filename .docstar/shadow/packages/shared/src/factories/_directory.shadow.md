# packages\shared\src\factories/
@generated: 2026-02-12T21:05:40Z

## Purpose
The `factories` directory provides the foundational factory pattern infrastructure for creating debug adapters across different programming languages. It establishes standardized interfaces and base implementations that ensure consistent adapter creation, validation, and compatibility checking throughout the debug system.

## Core Components

### AdapterFactory Base Class
- **Abstract factory implementation** serving as the template for all language-specific adapter factories
- **Metadata management** with immutable access patterns and defensive copying
- **Version compatibility system** with semantic version comparison utilities
- **Validation framework** with extensible hooks for custom validation logic

## Public API Surface

### Primary Entry Points
- **AdapterFactory class**: Abstract base class for concrete factory implementations
- **getMetadata()**: Access to adapter metadata with immutability guarantees
- **validate()**: Async validation pipeline with customizable implementation
- **isCompatibleWithCore()**: Core version compatibility verification
- **createAdapter()**: Abstract method requiring concrete implementation

### Factory Contract
All concrete factories must:
1. Extend `AdapterFactory` base class
2. Implement `createAdapter()` method for specific language adapters
3. Optionally override validation and compatibility checking logic
4. Provide `AdapterMetadata` during construction

## Internal Organization

### Data Flow Pattern
1. **Factory Construction**: Metadata injection and validation setup
2. **Compatibility Check**: Version validation against core debugger requirements  
3. **Factory Validation**: Custom validation logic execution
4. **Adapter Creation**: Language-specific adapter instantiation

### Design Patterns
- **Template Method**: Base class defines algorithm, subclasses implement specifics
- **Factory Method**: Abstract `createAdapter()` enforces consistent creation interface
- **Strategy Pattern**: Pluggable validation and compatibility checking
- **Defensive Programming**: Immutable metadata access and safe version handling

## Key Conventions
- **Permissive Defaults**: Base implementations favor "always valid" and "always compatible" behavior
- **Semantic Versioning**: Built-in version comparison with zero-padding for missing components
- **Async Validation**: All validation operations return promises for consistency
- **Metadata Immutability**: Defensive copying prevents external modification of factory configuration

## Integration Points
This module serves as the foundation for language-specific factory implementations, providing consistent interfaces for the broader debug adapter ecosystem while allowing customization for specific language requirements.