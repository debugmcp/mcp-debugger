# tests\fixtures\javascript-e2e\tsconfig.json
@source-hash: 9463d2bf539ad9ea
@generated: 2026-02-24T01:54:02Z

**TypeScript Configuration for JavaScript E2E Test Environment**

This tsconfig.json configures TypeScript compilation for end-to-end testing scenarios in a JavaScript project. The configuration prioritizes compatibility and flexibility over strict type checking.

**Key Configuration Sections:**

- **Module System (L3, L6):** Uses NodeNext module system with NodeNext resolution, enabling modern ESM/CJS interoperability
- **Target & Compatibility (L4, L8, L9):** Targets ES2020 with ESM interop enabled and JSON module resolution for broad compatibility
- **Development Settings (L5, L7):** Source maps enabled for debugging, strict mode disabled for permissive testing
- **File Inclusion (L11):** Includes all TypeScript files recursively from the current directory

**Architectural Decisions:**

- **Permissive Type Checking:** `strict: false` allows gradual TypeScript adoption in JavaScript projects
- **Modern Module Support:** NodeNext configuration supports both ESM and CommonJS modules
- **Test-Optimized:** Configuration tailored for E2E test environments where type safety can be relaxed

This configuration is designed for testing scenarios where JavaScript and TypeScript code need to coexist with minimal friction.