# packages/mcp-debugger/
@generated: 2026-02-11T23:47:55Z

## Overall Purpose and Responsibility

The `packages/mcp-debugger` directory provides a **complete standalone CLI distribution system** for the MCP debugger that transforms development source code into production-ready, protocol-compliant debugging tools. This package serves as the primary distribution mechanism for end-users, handling the complex orchestration of multi-language debug adapters, build automation, and MCP transport protocol compliance.

## Key Components and Architecture

### Build Pipeline (`scripts/`)
- **Production Bundling**: `bundle-cli.js` orchestrates complete TypeScript-to-distribution pipeline
- **Multi-Stage Process**: Handles proxy bundling, CLI compilation, vendor asset collection, and npm packaging
- **Platform Management**: Manages debug adapter binaries across platforms (JavaScript, Rust/CodeLLDB)
- **Asset Coordination**: Sources shared components from monorepo while creating self-contained distributions

### CLI Entry System (`src/`)
- **Protocol-Compliant Bootstrap**: `cli-entry.ts` implements critical console silencing for MCP transport compatibility
- **Static Adapter Bundling**: `batteries-included.ts` ensures all language adapters are included via global registry pattern
- **Execution Orchestration**: Manages precise loading sequence through dynamic imports and environment coordination

## Data Flow and Integration

**Development to Distribution Pipeline:**
```
TypeScript Source → Bundle Scripts → CLI Entry → Adapter Registry → Distribution Artifacts
```

1. **Build Phase**: Scripts transform source and collect vendor dependencies into `dist/` directory
2. **Bootstrap Phase**: CLI entry establishes protocol compliance and environment setup
3. **Registration Phase**: Adapters populate global registry via import side-effects
4. **Runtime Phase**: Main system discovers adapters through coordinated bootstrap process

## Public API Surface

**Primary Distribution Artifacts:**
- `debugmcp-*.tgz` - Complete standalone CLI package for npm/npx distribution
- `dist/` directory - Runtime-ready distribution with all dependencies

**CLI Entry Points:**
- Main executable via `cli-entry.ts` with protocol-compliant stdout management
- Bundled language adapters: JavaScript, Python, Mock (via global registry)

**Build Automation:**
- `node scripts/bundle-cli.js` - Complete build pipeline execution

## Internal Organization Patterns

### Critical Execution Sequence
The directory enforces strict ordering to maintain MCP protocol compliance:
1. Console silencing (pre-import, prevents protocol contamination)
2. Adapter registration (import side-effects for bundle inclusion)
3. Dynamic bootstrap (coordinated environment setup)
4. Main system initialization

### Multi-Platform Distribution Strategy
- **Vendor Asset Management**: Handles platform-specific debug adapter binaries
- **Graceful Fallback**: Environment-driven platform selection with missing dependency handling
- **Self-Contained Packaging**: Bundles all runtime dependencies for standalone deployment

### Cross-Module Coordination
Uses loose coupling patterns (environment variables, global objects) to coordinate between build system, bootstrap process, and main implementation without tight dependency injection.

## Key Architectural Invariants

- **Protocol Compliance**: Console output must be silenced before any module imports
- **Static Inclusion**: All adapters must be registered via side-effects for bundler inclusion
- **Bootstrap Coordination**: Environment flags enable communication between bootstrap and main systems
- **Distribution Completeness**: All runtime dependencies must be bundled for standalone operation

This directory serves as the critical bridge between the MCP debugger's development ecosystem and end-user CLI distribution, handling the complex requirements of protocol compliance, multi-platform support, and dependency bundling in a cohesive, maintainable system.