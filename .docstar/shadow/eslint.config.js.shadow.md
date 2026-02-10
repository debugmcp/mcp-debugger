# eslint.config.js
@source-hash: d42dea4d9d647c40
@generated: 2026-02-09T18:15:13Z

## ESLint Configuration File

**Purpose**: Defines modern ESLint flat configuration for a TypeScript/JavaScript project with comprehensive rules for different file types and directories.

### Configuration Structure
- **Global Ignores (L7-30)**: Excludes build artifacts, TypeScript declaration files, test utilities, and experimental code from linting
- **TypeScript Recommended Config (L33)**: Applies `typescript-eslint` recommended rules to TypeScript files
- **Custom TypeScript Rules (L36-48)**: Configures `@typescript-eslint/no-unused-vars` to ignore variables/parameters prefixed with underscore
- **JavaScript Configuration (L51-61)**: Sets up Node.js globals and modern ECMAScript for JS/MJS/CJS files
- **TypeScript Project Files (L64-72)**: Applies Node.js globals to source and test TypeScript files

### Environment-Specific Rules
- **Test Files (L75-84)**: More lenient rules for test code, with `no-floating-promises` as error to catch unhandled promises
- **Mock Files (L87-94)**: Very permissive rules for test mocks, disabling type safety restrictions
- **Script Utilities (L97-105)**: Relaxed rules for maintenance scripts, allowing unused variables and require imports

### Key Dependencies
- `@eslint/js`: JavaScript recommended configuration
- `globals`: Environment-specific global variables
- `typescript-eslint`: TypeScript-specific linting rules

### Architecture Pattern
Uses ESLint flat configuration format with cascading rule precedence - general rules first, then increasingly specific overrides for different file types and directories.