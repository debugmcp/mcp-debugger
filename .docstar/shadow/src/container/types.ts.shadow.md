# src/container/types.ts
@source-hash: 9126dc0f4cda0eaf
@generated: 2026-02-10T00:41:43Z

**Primary Purpose**: Defines TypeScript interfaces for dependency injection container configuration in a debugging/session management system.

**Key Interfaces**:

- **ContainerConfig (L8-30)**: Main container configuration interface defining logging setup
  - `logLevel` (L12): Optional string for log verbosity control
  - `logFile` (L17): Optional path for persistent log file output
  - `sessionLogDirBase` (L22): Optional base directory for session-specific logs
  - `loggerOptions` (L27-29): Flexible key-value store for additional logger configuration

- **SessionManagerConfig (L35-50)**: Specialized configuration for session management component
  - `sessionStore` (L39-42): Optional configuration for session storage with capacity and timeout controls
  - `defaultDapLaunchArgs` (L47-50)**: DAP (Debug Adapter Protocol) launch parameters including entry point and code scope settings

**Architectural Patterns**:
- Uses optional properties throughout for flexible configuration
- Separates container-level concerns (logging) from domain-specific concerns (session management)
- Employs nested object structures for logical grouping of related settings
- Generic `unknown` type for extensible logger options provides type safety while allowing customization

**Dependencies**: Pure TypeScript interfaces with no external dependencies - designed for compile-time type checking and IDE support.

**Usage Context**: These types serve as contracts for dependency injection container initialization, particularly in debugging/development tool scenarios involving DAP integration.