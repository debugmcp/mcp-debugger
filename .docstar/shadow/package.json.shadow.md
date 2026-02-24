# package.json
@source-hash: f07b9ac9af3afea4
@generated: 2026-02-24T01:54:11Z

**Purpose:** Monorepo root configuration for mcp-debugger, a runtime debugging tool for LLM agents that provides step-through debugging capabilities using the Debug Adapter Protocol (DAP).

**Key Configuration Sections:**

**Workspace Setup (L11-19):** 
- Defines packages/* structure for monorepo management
- No-hoist configuration for debugpy and node-inspector to prevent dependency conflicts

**Build System (L21-39):**
- Complex multi-stage build process with adapter vendoring (L22-27)
- Package-specific builds for shared components and adapters (L30-32) 
- TypeScript compilation pipeline with pre/post build hooks (L28-29)
- CI-specific build variant (L35-36)

**Testing Infrastructure (L44-89):**
- Comprehensive test suite covering unit, integration, e2e, stress, and Docker tests
- Python-specific testing with skip flags for CI environments (L55-58)
- Coverage analysis with multiple reporting formats (L70-83)
- Process cleanup hooks on all test commands (post* scripts)

**Development Tools (L90-109):**
- ESLint configuration for TypeScript and JavaScript
- Git workflow automation with safe-commit scripts (L94-95)
- GitHub Actions local testing via act runner (L99-105)
- Development proxy for debugging (L109)

**Runtime Configuration:**
- ES module type with Node.js 16+ requirement (L128-131)
- Binary entry point at dist/index.js (L130-134)
- Express server with Debug Adapter Protocol support

**Dependencies:**
- Core: MCP SDK, VSCode DAP, Commander CLI, Winston logging, Zod validation (L135-151)
- Optional language adapters for Go, JavaScript, Python, Rust, and mock debugging (L153-158)
- Dev tooling: Vitest testing, ESLint, TypeScript, coverage tools (L160-187)

**Architecture Notes:**
- Workspace-based monorepo with adapter plugins
- Build-time vendoring of adapters into main distribution
- Docker containerization support for deployment
- Multiple deployment channels (npm, Docker, npx)