# packages/shared/src/factories/
@generated: 2026-02-10T01:19:34Z

## Module Purpose
The `factories` directory provides the foundational factory architecture for creating debug adapters across different programming languages. It establishes a standardized framework that ensures consistent adapter instantiation, validation, and compatibility management throughout the debug system.

## Core Architecture

### Factory Pattern Implementation
The module centers around the **AdapterFactory** abstract base class, which serves as the template for all language-specific adapter factories. This design enforces uniform creation patterns while allowing customization for different debugging environments.

### Key Components
- **AdapterFactory**: Abstract base class defining the factory contract
- **Metadata Management**: Standardized adapter metadata handling with immutability guarantees
- **Validation Framework**: Extensible validation system with sensible defaults
- **Version Compatibility**: Built-in semantic version comparison for core debugger compatibility
- **Factory Interfaces**: Type definitions ensuring consistent factory implementations

## Public API Surface

### Primary Entry Points
- **AdapterFactory constructor**: Initializes factory with adapter metadata
- **createAdapter()**: Abstract method requiring implementation by concrete factories
- **validate()**: Async validation hook with default "always valid" behavior
- **isCompatibleWithCore()**: Version compatibility checking with graceful fallbacks
- **getMetadata()**: Defensive metadata access preventing external mutations

### Factory Contract
Concrete implementations must:
1. Extend AdapterFactory base class
2. Implement the abstract `createAdapter()` method
3. Optionally override validation and compatibility logic
4. Provide appropriate AdapterMetadata during construction

## Internal Organization

### Data Flow Pattern
1. Factory instantiation with metadata
2. Optional validation and compatibility checks
3. Adapter creation through implemented `createAdapter()` method
4. Metadata access through defensive copying

### Design Principles
- **Permissive Defaults**: Validation and compatibility favor allowing operations
- **Extensibility**: Protected methods enable subclass customization
- **Immutability**: Metadata protection through defensive copying
- **Graceful Degradation**: Version checking with fallbacks for missing requirements

## Integration Points
This factory system integrates with the broader debug infrastructure by:
- Providing consistent adapter creation across language implementations
- Ensuring version compatibility between adapters and core debugger
- Offering standardized validation hooks for deployment safety
- Maintaining metadata integrity throughout the adapter lifecycle

The module serves as the foundational layer that other debug components depend on for reliable, type-safe adapter instantiation.