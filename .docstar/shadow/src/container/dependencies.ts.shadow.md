# src/container/dependencies.ts
@source-hash: 22fb0900cdf60072
@generated: 2026-02-11T16:12:55Z

**Purpose**: Central dependency injection container that wires all application dependencies for production use. Creates and configures real implementations of core services, process launchers, and adapter registries.

**Key Components**:

- `Dependencies` interface (L45-64): Complete dependency container interface defining all injectable services including core implementations, process launchers, factories, and adapter registry
- `createProductionDependencies()` (L71-170): Main factory function that creates production-ready dependency container with real implementations

**Dependency Categories**:

1. **Core Services** (L80-83): Base infrastructure implementations
   - FileSystemImpl, ProcessManagerImpl, NetworkManagerImpl 
   - Logger with configurable levels/output
   - ProcessEnvironment for environment access

2. **Process Launchers** (L85-88): Hierarchical process management
   - ProcessLauncherImpl: Base process launching
   - ProxyProcessLauncherImpl: Wraps base launcher with proxy capabilities
   - DebugTargetLauncherImpl: Specialized for debug target processes

3. **Factories** (L90-97): Service factories for dynamic object creation
   - ProxyManagerFactory: Creates proxy managers with dependencies
   - SessionStoreFactory: Creates session storage instances

4. **Adapter System** (L99-155): Language adapter registration and loading
   - AdapterRegistry with dynamic loading enabled
   - Bundled adapter registration via global registry (L109-123)
   - Container-specific adapter pre-registration (L127-155)

**Key Dependencies**:
- `@debugmcp/shared`: Core interfaces and types
- Local implementations from `../implementations/`
- Factory classes for dynamic object creation
- Language configuration utilities

**Architecture Patterns**:
- Dependency Injection: Single factory creates entire dependency graph
- Factory Pattern: Separate factories for complex object creation
- Registry Pattern: Centralized adapter registration and discovery
- Environment-specific behavior: Container vs non-container deployment

**Configuration**:
- `ContainerConfig` input for logger and service configuration
- Dynamic adapter loading based on environment variables
- Language-specific adapter enabling/disabling via `isLanguageDisabled()`

**Critical Behaviors**:
- Adapter registration is fire-and-forget to avoid blocking startup
- Error handling with graceful degradation for missing adapters
- Validation disabled during registration, deferred to usage time
- Support for both bundled and dynamically loaded adapters