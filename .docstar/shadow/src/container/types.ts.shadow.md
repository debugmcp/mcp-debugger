# src/container/types.ts
@source-hash: 9126dc0f4cda0eaf
@generated: 2026-02-09T18:14:58Z

## Purpose
TypeScript type definitions file for dependency injection container configuration. Provides strongly-typed interfaces for configuring logging and session management components within the DI container.

## Key Interfaces

### ContainerConfig (L8-30)
Primary configuration interface for the dependency injection container, focused on logging configuration:
- `logLevel` (L12): Optional string for log level control ('debug', 'info', 'warn', 'error')
- `logFile` (L17): Optional path for persistent log file output
- `sessionLogDirBase` (L22): Optional base directory for session-specific logs
- `loggerOptions` (L27-29): Flexible key-value object for additional logger configuration

### SessionManagerConfig (L35-51)
Configuration interface specifically for SessionManager component:
- `sessionStore` (L39-42): Optional nested config for session storage with `maxSessions` and `sessionTimeout` parameters
- `defaultDapLaunchArgs` (L47-50): Optional DAP (Debug Adapter Protocol) launch configuration with `stopOnEntry` and `justMyCode` boolean flags

## Architecture Notes
- Pure type definition file with no runtime code
- Follows optional property pattern (all fields are optional with `?`)
- Uses generic object typing (`{[key: string]: unknown}`) for extensible logger options
- Separates concerns between general container config and session-specific config
- DAP integration suggests this is part of a debugging/development tool ecosystem