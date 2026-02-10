# packages/shared/src/factories/adapter-factory.ts
@source-hash: a47e35af38792bbe
@generated: 2026-02-09T18:14:05Z

## Purpose
Abstract base class for creating debug adapter factories in a TypeScript debugging framework. Provides standardized infrastructure for language-specific adapter factory implementations while ensuring version compatibility and validation.

## Key Components

### AdapterFactory Class (L25-95)
Abstract base class implementing `IAdapterFactory` interface. Serves as template for concrete adapter factory implementations.

**Constructor (L30)**: Takes `AdapterMetadata` parameter, stored as protected readonly field for factory configuration.

**getMetadata() (L36-38)**: Returns shallow copy of factory metadata to prevent external mutation.

**validate() (L45-51)**: Async validation method with default implementation returning valid state. Designed to be overridden for environment-specific validation checks.

**isCompatibleWithCore() (L58-65)**: Version compatibility checker comparing core version against `metadata.minimumDebuggerVersion`. Falls back to always-compatible if no minimum version specified.

**compareVersions() (L73-86)**: Protected semantic version comparison utility using numeric part-by-part comparison with zero-padding for missing parts.

**createAdapter() (L94)**: Abstract method requiring implementation by concrete factories. Takes `AdapterDependencies` and returns `IDebugAdapter` instance.

## Dependencies
- `IDebugAdapter` from debug-adapter interface
- `AdapterDependencies`, `IAdapterFactory`, `AdapterMetadata`, `FactoryValidationResult` from adapter-registry interface

## Architecture Patterns
- **Template Method**: Base class provides common functionality while requiring specific implementation of `createAdapter()`
- **Factory Pattern**: Encapsulates adapter creation logic
- **Metadata-driven**: Uses `AdapterMetadata` to configure factory behavior
- **Version Management**: Built-in semantic version compatibility checking

## Key Invariants
- Metadata is immutable after construction (readonly protection)
- Version comparison handles missing version parts as zero
- Default validation always passes unless overridden
- Compatibility defaults to true when no minimum version specified