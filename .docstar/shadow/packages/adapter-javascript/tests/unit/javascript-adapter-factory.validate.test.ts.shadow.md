# packages/adapter-javascript/tests/unit/javascript-adapter-factory.validate.test.ts
@source-hash: cc3ee9f5e0b4dce6
@generated: 2026-02-10T00:41:08Z

**Primary Purpose:** Unit test suite for `JavascriptAdapterFactory.validate()` method validation logic using Vitest. Tests ensure proper error/warning handling for Node.js version requirements, vendor file presence, and TypeScript runner availability.

**Test Structure:**
- Main test suite: `describe('JavascriptAdapterFactory.validate')` (L14-128)
- Setup/teardown with environment restoration (L18-32)
- Five test cases covering validation scenarios (L34-127)

**Key Helper Functions:**
- `norm(p)` (L6-8): Normalizes file paths by converting backslashes to forward slashes
- `isVendorPath(p)` (L10-12): Identifies vendor debug server paths ending with `/vendor/js-debug/vsDebugServer.js`

**Test Environment Management:**
- Preserves original `process.env.PATH` and `process.version` descriptor (L15-16, L20)
- `beforeEach` saves process.version descriptor for restoration (L18-21)
- `afterEach` restores PATH, process.version, and clears all mocks (L23-32)

**Test Scenarios:**
1. **Valid configuration** (L34-49): Node ≥14 + vendor present → `valid: true`, empty errors, warnings array exists
2. **Node version too old** (L51-69): Mocks Node v12.22.0 → `valid: false`, specific version error message
3. **Missing vendor** (L71-81): No js-debug vendor file → `valid: false`, build script error message  
4. **Missing TypeScript runner** (L83-96): No tsx/ts-node in PATH → `valid: true` but warning about TS runner
5. **TypeScript runner present** (L98-127): tsx in PATH (cross-platform) → `valid: true`, no TS runner warning

**Mock Strategy:**
- `fs.existsSync` mocked to simulate file presence/absence
- `process.version` mocked via property descriptor override
- `process.env.PATH` manipulated directly for runner detection testing

**Cross-Platform Considerations:**
- Windows-aware path handling in tsx detection test (L99-100)
- Platform-specific executable extensions (.cmd, .exe) tested (L108-111)
- Uses `path.delimiter` for PATH construction (L118-119)

**Dependencies:**
- Vitest testing framework
- Node.js fs and path modules  
- JavascriptAdapterFactory from `../../src/index.js`

**Key Validation Logic Tested:**
- Node.js version checking (≥14 requirement)
- js-debug vendor file existence verification
- TypeScript runner (tsx/ts-node) PATH detection
- Error vs warning classification for different failure modes