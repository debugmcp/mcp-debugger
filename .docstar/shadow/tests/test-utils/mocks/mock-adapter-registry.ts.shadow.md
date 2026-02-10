# tests/test-utils/mocks/mock-adapter-registry.ts
@source-hash: 3e0350ca0ec215f2
@generated: 2026-02-09T18:14:39Z

## Purpose
Comprehensive mock factory for `IAdapterRegistry` interface testing, providing realistic adapter behaviors and test utilities for debugging framework components.

## Core Functions

### `createMockAdapterRegistry()` (L13-140)
Primary mock factory returning fully-featured `IAdapterRegistry` implementation with:
- **Supported languages**: Python and Mock adapters with realistic metadata (L14-40)
- **Complete adapter creation**: Returns mock `IDebugAdapter` with all lifecycle, DAP protocol, and EventEmitter methods (L49-124)
- **Critical mock**: `buildAdapterCommand` (L72-76) returns realistic command structure for adapter spawning
- **State management**: All methods return sensible defaults (ready state, connected, etc.)

### Specialized Mock Variants
- **`createMockAdapterRegistryWithErrors()`** (L146-157): Error simulation variant - no supported languages, rejected adapter creation
- **`createMockAdapterRegistryWithLanguages(languages)`** (L163-192): Customizable language support with dynamic adapter info generation

## Test Utilities

### Verification Helpers
- **`expectAdapterRegistryLanguageCheck()`** (L197-204): Verifies `isLanguageSupported` call patterns
- **`expectAdapterCreation()`** (L209-220): Validates adapter creation with expected parameters (sessionId, executablePath)
- **`resetAdapterRegistryMock()`** (L225-232): Bulk reset of all mock functions via introspection

## Key Dependencies
- **Vitest**: Mock framework (`vi.fn()` throughout)
- **@debugmcp/shared**: `IAdapterRegistry`, `AdapterInfo`, `DebugLanguage` interfaces

## Mock Architecture
- **Realistic data**: Pre-configured adapter info with proper metadata structure
- **Behavioral accuracy**: Language checking logic mirrors real implementation patterns
- **Complete interface coverage**: All `IAdapterRegistry` and `IDebugAdapter` methods mocked
- **Flexible configuration**: Multiple factory functions for different test scenarios

## Usage Patterns
Designed for unit testing adapter registry consumers, debug session management, and error handling paths. The comprehensive mock coverage ensures tests can verify both happy path and error scenarios without real adapter dependencies.