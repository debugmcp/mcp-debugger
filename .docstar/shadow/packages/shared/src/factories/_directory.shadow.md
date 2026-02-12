# packages\shared\src\factories/
@generated: 2026-02-12T21:00:50Z

## Purpose
The `factories` directory provides the foundational factory pattern infrastructure for creating debug adapters across different programming languages in a standardized and extensible manner.

## Core Components

### AdapterFactory Base Class
- **Abstract factory implementation** serving as the template for all language-specific adapter factories
- **Standardized interface** enforcing consistent adapter creation patterns
- **Validation framework** with extensible hooks for compatibility and dependency checking
- **Version management utilities** for semantic version comparison and core compatibility

## Public API Surface

### Primary Entry Point
- **AdapterFactory** - Abstract base class that concrete language factories must extend

### Key Methods
- `createAdapter()` - Abstract method requiring implementation by concrete factories
- `getMetadata()` - Returns immutable adapter metadata
- `validate()` - Extensible validation with default permissive behavior
- `isCompatibleWithCore()` - Version compatibility checking with fallback support
- `compareVersions()` - Utility for semantic version comparison

## Internal Organization

### Factory Pattern Implementation
- **Template Method Pattern**: Base class provides structure, subclasses implement specifics
- **Defensive Programming**: Metadata immutability and safe version handling
- **Extensibility Points**: Protected methods and validation hooks for customization

### Data Flow
1. Factory instantiation with `AdapterMetadata`
2. Optional validation and compatibility checks
3. Adapter creation through abstract `createAdapter()` method
4. Version comparison utilities support compatibility decisions

## Architectural Patterns

### Design Philosophy
- **Permissive defaults** - factories are considered valid and compatible unless explicitly overridden
- **Immutable metadata** - defensive copying prevents accidental modification
- **Version-aware** - semantic version handling with graceful degradation
- **Clean separation** - factory logic distinct from adapter implementation details

### Extension Points
- Concrete factories override `createAdapter()` for language-specific implementation
- Custom validation logic through `validate()` method override
- Compatibility logic customization via `isCompatibleWithCore()` override

This directory establishes the foundational infrastructure that enables consistent, extensible debug adapter creation across the entire debug system.