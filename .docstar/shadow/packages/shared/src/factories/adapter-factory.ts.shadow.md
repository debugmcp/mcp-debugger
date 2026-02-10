# packages/shared/src/factories/adapter-factory.ts
@source-hash: a47e35af38792bbe
@generated: 2026-02-10T00:41:07Z

## Purpose
Abstract factory base class for creating debug adapters across different languages, providing standardized interface and compatibility validation.

## Core Components

### AdapterFactory Class (L25-95)
- **Abstract base class** implementing `IAdapterFactory` interface
- **Constructor** (L30): Takes `AdapterMetadata` parameter, stored as protected readonly
- **Key responsibility**: Enforce consistent adapter creation patterns across language implementations

### Public Methods
- **getMetadata()** (L36-38): Returns defensive copy of adapter metadata
- **validate()** (L45-51): Async validation with default "always valid" implementation
- **isCompatibleWithCore()** (L58-65): Version compatibility checking with fallback to "always compatible"
- **createAdapter()** (L94): Abstract method - must be implemented by concrete factories

### Version Management
- **compareVersions()** (L73-86): Semantic version comparison utility
  - Handles variable-length version strings
  - Returns standard comparison result (-1, 0, 1)
  - Uses integer parsing with zero-padding for missing parts

## Dependencies
- **Interfaces**: `IDebugAdapter`, `IAdapterFactory`, `AdapterMetadata`, `AdapterDependencies`, `FactoryValidationResult`
- **Module pattern**: ES6 imports from relative interface files

## Architectural Patterns
- **Template Method**: Concrete validation and compatibility overrides expected
- **Factory Pattern**: Abstract `createAdapter` forces implementation
- **Defensive Programming**: Metadata copying, version fallbacks
- **Extensibility**: Protected methods and validation hooks for subclassing

## Key Design Decisions
- Default implementations favor permissive behavior (always valid, always compatible)
- Metadata immutability through defensive copying
- Version checking only if `minimumDebuggerVersion` specified
- Clean separation between factory logic and adapter creation