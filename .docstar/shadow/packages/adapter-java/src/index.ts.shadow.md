# packages/adapter-java/src/index.ts
@source-hash: 71da5a1378549f96
@generated: 2026-02-10T00:41:19Z

**Primary Purpose:** Entry point and public API facade for the Java Debug Adapter package within the MCP Debugger ecosystem. Consolidates all public exports for external consumption by the adapter registry system.

**Key Exports:**
- `JavaAdapterFactory` (L9): Factory class for creating Java debug adapter instances, enables dynamic loading by the adapter registry
- `JavaDebugAdapter` (L10): Main adapter implementation for Java debugging sessions
- `JavaLaunchConfig` type (L11): TypeScript type definition for Java launch configuration parameters
- Java utilities (L12): Utility functions for Java-specific operations (wildcard export)
- `JdbParser` (L13): Parser for JDB (Java Debugger) output and command responses
- JDB event types (L14-19): TypeScript interfaces for debugger events (`JdbStoppedEvent`, `JdbStackFrame`, `JdbVariable`, `JdbThread`)
- `JdbWrapper` (L20): Wrapper class for managing JDB process interactions
- JDB configuration types (L21): TypeScript interfaces for JDB configuration (`JdbConfig`, `JdbBreakpoint`)

**Architecture Pattern:** Barrel export pattern - this file serves as the single entry point that re-exports the package's public API from various internal modules. Follows modular organization with separation of concerns:
- Main adapter logic in `java-debug-adapter.js`
- Factory pattern in `java-adapter-factory.js` 
- Utility functions organized under `utils/` directory
- Clean separation between implementation classes and TypeScript type definitions

**Dependencies:** All exports reference relative imports from internal modules, indicating this package is self-contained with no external runtime dependencies exposed at the API level.

**Critical Design Decisions:**
- Uses `.js` extensions in imports for ES module compatibility
- Separates concrete implementations from TypeScript types in exports
- Modular utility organization under dedicated `utils/` namespace
- Factory pattern enables dependency injection and dynamic instantiation