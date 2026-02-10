# tests/jest-register.js
@source-hash: 0e859bb63243ea2f
@generated: 2026-02-09T18:15:10Z

**Primary Purpose**: Jest test configuration file that registers TypeScript transpilation support for E2E testing environment.

**Core Functionality**:
- TypeScript Registration (L3-6): Configures ts-node to handle TypeScript files during Jest execution with transpile-only mode and ESM support enabled

**Key Dependencies**:
- `ts-node`: TypeScript execution engine for Node.js, enabling direct execution of .ts files

**Configuration Details**:
- `transpileOnly: true` (L4): Disables type checking for faster compilation during tests
- `esm: true` (L5): Enables ES modules support for modern JavaScript imports/exports

**Architectural Role**: 
Bootstrap configuration file that must be loaded before Jest runs E2E tests, ensuring TypeScript files in test setup and utilities can be executed without pre-compilation. Typically referenced in Jest's setupFilesAfterEnv or similar configuration.