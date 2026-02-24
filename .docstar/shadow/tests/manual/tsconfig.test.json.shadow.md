# tests\manual\tsconfig.test.json
@source-hash: 603348134a3d86eb
@generated: 2026-02-24T01:54:02Z

## Purpose
TypeScript configuration file specifically for manual testing scenarios, extending the main project configuration with test-specific compiler settings.

## Key Configuration Elements
- **Base Extension (L2)**: Inherits from root `../../tsconfig.json` for consistency
- **Output Directory (L5)**: Compiles test files to local `./build` directory  
- **Module System (L6-7)**: Uses NodeNext module and resolution for modern Node.js compatibility
- **Source Inclusion (L14-17)**: Includes both local test files (`./**/*.ts`) and main source files (`../../src/**/*.ts`)
- **Exclusions (L18-21)**: Excludes `node_modules` and build artifacts to prevent compilation conflicts

## Compiler Optimizations
- **Skip Library Checking (L8)**: Improves compilation performance by skipping type checking of declaration files
- **ES Module Interop (L9-11)**: Enables seamless interoperability between CommonJS and ES modules with synthetic default imports and JSON module resolution

## Architecture Notes
This configuration supports manual testing workflows that need to compile and run TypeScript test files alongside the main source code. The NodeNext module system ensures compatibility with modern Node.js environments and package.json module specifications.