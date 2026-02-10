# tests/jest-register.js
@source-hash: 0e859bb63243ea2f
@generated: 2026-02-10T00:41:58Z

## Purpose
Jest test environment setup file that configures TypeScript runtime compilation for E2E tests. Enables Jest to execute TypeScript files in setup scripts and test utilities without pre-compilation.

## Key Functionality
- **TypeScript Runtime Registration (L3-6)**: Registers ts-node with Jest to handle .ts/.tsx files on-the-fly
  - `transpileOnly: true`: Skips type checking for faster compilation during testing
  - `esm: true`: Enables ESModule support for modern TypeScript/JavaScript syntax

## Dependencies
- `ts-node`: TypeScript execution engine for Node.js runtime compilation

## Architectural Role
Acts as a Jest setup hook (likely referenced in jest.config.js setupFilesAfterEnv or similar) to bootstrap TypeScript support across the test suite. Critical for projects where test utilities, setup files, or helper modules are written in TypeScript but Jest needs to execute them directly.

## Usage Pattern
Loaded early in Jest's lifecycle to ensure all subsequent TypeScript imports are properly transpiled. The transpileOnly flag prioritizes execution speed over type safety during testing.