# src/implementations/index.ts
@source-hash: ea404b38c0273e52
@generated: 2026-02-10T00:41:44Z

## Primary Purpose
Module index file that centralizes exports of all concrete implementation classes from the implementations package. Acts as the main entry point for consumers to import implementation classes without needing to know their specific file locations.

## Key Exports

### Core Implementation Classes (L4-6)
- **FileSystemImpl** - Concrete file system operations implementation
- **ProcessManagerImpl** - Process management implementation 
- **NetworkManagerImpl** - Network operations implementation

### Process Launcher Implementations (L9-14)
- **ProcessLauncherImpl** - Standard process launching implementation
- **DebugTargetLauncherImpl** - Debug-specific process launcher
- **ProxyProcessLauncherImpl** - Proxy-wrapped process launcher
- **ProcessLauncherFactoryImpl** - Factory for creating process launcher instances

## Architectural Pattern
Follows the barrel export pattern, providing a clean API surface by re-exporting implementation classes from their respective modules. This enables consumers to import all implementations from a single location while maintaining modular file organization.

## Dependencies
- `./file-system-impl.js` (L4)
- `./process-manager-impl.js` (L5) 
- `./network-manager-impl.js` (L6)
- `./process-launcher-impl.js` (L14)

## Usage Pattern
Typical consumer import: `import { FileSystemImpl, ProcessManagerImpl } from '@package/implementations'`