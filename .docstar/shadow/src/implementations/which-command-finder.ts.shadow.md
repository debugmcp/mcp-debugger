# src/implementations/which-command-finder.ts
@source-hash: 436c6b566d7360dd
@generated: 2026-02-09T18:15:01Z

## Purpose
Production implementation of the CommandFinder interface using the 'which' npm package to locate executable commands in the system PATH.

## Key Components

### WhichCommandFinder Class (L10-51)
Implements the `CommandFinder` interface to provide command path resolution with optional caching.

**Constructor (L16):**
- `useCache: boolean = true` - Controls whether found command paths are cached

**Private Fields:**
- `cache: Map<string, string>` (L11) - Stores command name to path mappings for performance

**Key Methods:**
- `find(command: string): Promise<string>` (L24-43) - Locates executable path for given command name
  - Checks cache first if enabled (L26-28)
  - Uses `which` package for path resolution (L31)
  - Caches successful results (L34-36)
  - Converts `which` errors to `CommandNotFoundError` (L40-41)
- `clearCache(): void` (L48-50) - Empties the command path cache

## Dependencies
- `which` npm package (L4) - External command location utility
- `CommandFinder` interface and `CommandNotFoundError` (L5) - Core abstractions

## Architectural Patterns
- **Interface Implementation**: Concrete implementation of `CommandFinder` abstraction
- **Caching Strategy**: Optional in-memory cache with Map for performance optimization
- **Error Translation**: Converts external library errors to domain-specific exceptions
- **Dependency Injection**: Cache behavior configurable via constructor

## Key Behaviors
- Cache is consulted before external `which` calls when enabled
- All `which` package errors are uniformly converted to `CommandNotFoundError`
- Cache can be disabled for scenarios requiring fresh lookups
- Non-null assertion used on cache hits (L27) assuming cache integrity