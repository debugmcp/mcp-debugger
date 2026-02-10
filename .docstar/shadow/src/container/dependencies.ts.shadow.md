# src/container/dependencies.ts
@source-hash: 33a382c684f87d09
@generated: 2026-02-09T18:15:03Z

**Purpose:** Central dependency injection container that assembles and wires all application dependencies for production use. Acts as the composition root for the debug MCP application.

**Key Interface & Types:**
- `Dependencies` (L45-64): Complete dependency contract defining all required services - core implementations (filesystem, process/network managers, logger, environment), process launchers, factories, and adapter registry
- `BundledAdapterEntry` (L36-39): Type for globally registered adapters with language and factory constructor
- `ContainerConfig` imported from `./types.js`: Configuration interface for container setup

**Primary Function:**
- `createProductionDependencies(config)` (L71-170): Main factory function that instantiates and wires all dependencies
  - Creates logger with configurable options (L73-77)
  - Instantiates core services with concrete implementations (L80-83)
  - Builds process launcher hierarchy with dependency injection (L86-88)
  - Creates factories for proxy management and session storage (L91-97)
  - Configures adapter registry with dynamic loading enabled (L99-107)
  - Handles bundled adapter registration from global registry (L109-123)
  - Performs conditional container-mode adapter pre-registration (L127-156)

**Dependency Architecture:**
- Follows composition over inheritance pattern with interface segregation
- Implements layered dependency injection: core services → process launchers → factories → registry
- Process launchers form a hierarchy: `ProcessLauncherImpl` → `ProxyProcessLauncherImpl` → `DebugTargetLauncherImpl`
- Factory pattern used for `ProxyManagerFactory` and `SessionStoreFactory`

**Adapter System:**
- Global bundled adapter registration via `__DEBUG_MCP_BUNDLED_ADAPTERS__` key (L40, L109-123)
- Dynamic adapter loading in container mode with fire-and-forget imports (L127-156)
- Language-based adapter discovery with environment variable disabling support
- Supports mock, python, javascript, rust, go, and java adapters

**Critical Patterns:**
- Fire-and-forget dynamic imports to prevent blocking dependency creation (L134-147)
- Environment-based conditional loading (`MCP_CONTAINER` check at L127)
- Promise-aware error handling for async adapter registration (L114-118)
- Language filtering through `isLanguageDisabled()` utility (L129-132)

**Dependencies:**
- Core implementations from `../implementations/` 
- Shared interfaces from `@debugmcp/shared`
- Factory classes from `../factories/`
- Adapter registry from `../adapters/`
- Language configuration utilities