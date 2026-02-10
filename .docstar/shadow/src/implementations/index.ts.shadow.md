# src/implementations/index.ts
@source-hash: ea404b38c0273e52
@generated: 2026-02-09T18:14:58Z

**Primary Purpose:**
Central export hub for all concrete implementation classes in the implementations module. Acts as a single entry point for accessing various system-level implementation classes.

**Key Exports:**

**Core System Implementations (L4-6):**
- `FileSystemImpl` - Concrete file system operations implementation
- `ProcessManagerImpl` - Process management implementation  
- `NetworkManagerImpl` - Network operations implementation

**Process Launcher Implementations (L9-14):**
- `ProcessLauncherImpl` - Standard process launching implementation
- `DebugTargetLauncherImpl` - Debug-enabled process launcher
- `ProxyProcessLauncherImpl` - Proxy-wrapped process launcher
- `ProcessLauncherFactoryImpl` - Factory for creating process launcher instances

**Dependencies:**
- `./file-system-impl.js` (L4)
- `./process-manager-impl.js` (L5) 
- `./network-manager-impl.js` (L6)
- `./process-launcher-impl.js` (L14)

**Architectural Pattern:**
Follows barrel export pattern to provide clean, centralized access to implementation classes. Separates core system implementations from specialized process launcher variants, suggesting a layered architecture where process launching has multiple specialized implementations.