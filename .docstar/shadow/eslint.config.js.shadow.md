# eslint.config.js
@source-hash: d42dea4d9d647c40
@generated: 2026-02-10T00:42:03Z

## ESLint Configuration for TypeScript/JavaScript Project

**Primary Purpose**: Modern flat-config ESLint setup for a TypeScript project with Node.js environment, supporting mixed TypeScript/JavaScript sources, tests, and build scripts.

### Configuration Structure

**Global Ignores (L7-30)**: Comprehensive exclusion patterns for build artifacts, TypeScript declarations, test utilities, and experimental code. Notably excludes `sessions/`, `coverage/`, and `scripts/experiments/**`.

**Core Configurations**:
- **TypeScript Rules (L33)**: Applies `typescript-eslint` recommended configuration
- **Unused Variables (L36-48)**: Custom rule allowing underscore-prefixed variables (`^_`) to bypass unused-vars checks in TypeScript files
- **JavaScript Files (L51-61)**: Standard ESLint recommended rules with Node.js globals and modern ECMAScript support

### Environment-Specific Rules

**Source Code (L64-72)**: TypeScript files in `src/` and `packages/*/src/` directories with Node.js globals

**Test Files (L75-84)**: Relaxed rules for `tests/**/*.ts`:
- `no-explicit-any`: warning instead of error
- `no-floating-promises`: error (prevents unhandled Promise issues)
- TypeScript strict rules downgraded to warnings

**Mock Files (L87-94)**: Maximum flexibility for `tests/test-utils/mocks/**/*.ts` - disables type safety rules entirely

**Build Scripts (L97-105)**: Lenient rules for `scripts/**/*` files, disabling unused-vars and TypeScript import restrictions

### Key Dependencies
- `@eslint/js`: Core JavaScript linting
- `typescript-eslint`: TypeScript-specific rules and parser  
- `globals`: Environment-specific global variable definitions

### Architectural Decisions
- Flat config format (ESLint 9.x style)
- File-pattern-based rule inheritance
- Progressive strictness: strictest for source code, most lenient for utilities
- Explicit floating promise detection in tests