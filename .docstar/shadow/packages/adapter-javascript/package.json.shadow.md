# packages\adapter-javascript\package.json
@source-hash: aafbc4c2cd0be74f
@generated: 2026-02-24T01:54:07Z

## JavaScript/TypeScript Debug Adapter Package Configuration

Node.js package for a JavaScript/TypeScript debug adapter skeleton within the MCP debugger ecosystem. This is scaffolding for Task 1 of the MCP debugger project.

### Package Identity & Distribution
- **Package**: `@debugmcp/adapter-javascript` v0.18.0 (L2-3)
- **Entry Point**: `dist/index.js` with TypeScript declarations at `dist/index.d.ts` (L6-7)
- **Module Type**: ES modules (`"type": "module"`) (L5)
- **Node Requirement**: >= 18 (L18-20)
- **Distribution**: Includes `dist/` and `vendor/js-debug/` directories (L8-11)

### Build System & Scripts
- **Primary Build**: TypeScript compilation (`tsc -b`) followed by JS debug adapter build (L22-23)
- **Post-build Hook**: Executes `scripts/build-js-debug.js` to generate vendor assets (L23)
- **CI Build**: Force rebuild with `-f` flag (L24)
- **Vendor Management**: Separate clean commands for TypeScript output and vendor directory (L26-27)
- **Testing**: Vitest with coverage support via v8 (L28-29)

### Dependencies & Architecture
- **Core Dependency**: `@debugmcp/shared` workspace package for shared MCP debugger utilities (L33)
- **Debug Protocol**: VSCode Debug Adapter Protocol implementation (L34)
- **Peer Dependency**: Enforces specific version alignment with shared package (L36-38)
- **Build Tools**: TypeScript, ESLint, file system utilities, and archive extraction (L39-48)

### Key Architectural Patterns
- **Workspace Integration**: Uses workspace protocol for internal dependencies
- **Vendor Bundling**: Custom build process packages external JS debug assets
- **Dual Export Strategy**: Supports both import and types resolution (L12-17)
- **Public Publishing**: Configured for npm public registry (L49-51)