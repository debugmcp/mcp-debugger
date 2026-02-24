# tsconfig.spec.json
@source-hash: 667b8e1463cc7f01
@generated: 2026-02-24T01:54:06Z

TypeScript configuration file specifically tailored for test/spec execution, extending the base tsconfig.json with test-specific compiler settings.

## Key Configuration Sections

**Base Extension (L2)**: Inherits from `./tsconfig.json` for consistent baseline settings across development and test environments.

**Compiler Options (L3-28)**: 
- **Module System (L6-7)**: ES2022 modules with Node resolution for modern JavaScript features
- **Output Configuration (L4-5)**: Root directory set to current path, compiled output to `./dist`
- **Target & Library (L8-9)**: ES2022 target with corresponding standard library
- **Module Interoperability (L10-11)**: Enables synthetic default imports and ES module interop for mixed module systems
- **Type Definitions (L14)**: Includes Vitest globals and Node types for test framework integration
- **Strict Mode (L15-17)**: Full TypeScript strict checking with consistent file naming enforcement
- **Path Mapping (L18-27)**: Monorepo-style path aliases for `@debugmcp` packages and `@/*` src shorthand

**File Inclusion (L29-37)**:
- **Included Patterns (L30-32)**: Source files (`src/**/*`) and test files (`tests/**/*`)
- **Excluded Patterns (L34-36)**: Standard exclusions for node_modules, build output, and coverage reports

## Architectural Context

This configuration supports a monorepo structure with multiple `@debugmcp` packages (shared, adapter-mock, adapter-python), enabling cross-package imports during test execution. The ES2022 target suggests modern Node.js runtime requirements for the test environment.