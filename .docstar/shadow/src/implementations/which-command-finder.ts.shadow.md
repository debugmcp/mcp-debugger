# src/implementations/which-command-finder.ts
@source-hash: 436c6b566d7360dd
@generated: 2026-02-10T00:41:46Z

## Primary Purpose
Production implementation of the `CommandFinder` interface that locates executable commands in the system PATH using the 'which' npm package.

## Key Classes and Functions

### WhichCommandFinder (L10-51)
Concrete implementation of `CommandFinder` interface that provides command path resolution with optional caching.

**Constructor (L16):**
- `useCache: boolean = true` - Controls whether found command paths are cached for performance

**Key Methods:**
- `find(command: string): Promise<string>` (L24-43) - Core method that resolves command name to full executable path
- `clearCache(): void` (L48-50) - Utility method to clear the internal cache

**Internal State:**
- `cache: Map<string, string>` (L11) - Private cache mapping command names to resolved paths

## Dependencies
- `which` npm package - External library for command path resolution
- `CommandFinder` interface and `CommandNotFoundError` from `../interfaces/command-finder.js`

## Implementation Details

### Caching Strategy (L25-28, L34-36)
- Checks cache before external lookup when `useCache` is enabled
- Stores successful lookups in cache for subsequent requests
- Cache can be disabled via constructor parameter

### Error Handling (L39-42)
- Catches all errors from the `which` package
- Converts native errors to custom `CommandNotFoundError` type
- Maintains consistent error interface across different implementations

## Architectural Patterns
- **Strategy Pattern**: Implements `CommandFinder` interface, allowing different command resolution strategies
- **Caching Decorator**: Built-in caching layer around the external `which` library
- **Error Translation**: Abstracts third-party error types into domain-specific exceptions

## Key Characteristics
- Async/await pattern for command resolution
- Optional performance optimization through caching
- Clean separation between interface contract and implementation details
- Testability support via `clearCache()` method