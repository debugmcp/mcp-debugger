# packages/adapter-javascript/tests/unit/config-transformer.edge.test.ts
@source-hash: 05cd4b9e975baebc
@generated: 2026-02-10T00:41:07Z

## Edge Case Unit Tests for Config Transformer

This test file validates the fault tolerance and edge case handling of the `config-transformer.js` utility functions, specifically focusing on malformed JSON parsing scenarios that could occur in real-world environments.

### Test Target Functions
- `isESMProject` - Determines if a project uses ES modules based on package.json/tsconfig.json
- `hasTsConfigPaths` - Checks if TypeScript path mappings are configured
- `determineOutFiles` - Returns file patterns for output detection
- `setDefaultFileSystem` - Dependency injection for filesystem operations

### Mock Infrastructure
- **MockFileSystem (L14-39)**: Test double implementing FileSystem interface with configurable behavior
  - `setExistsMock()` (L18-20): Controls which file paths appear to exist
  - `setReadFileMock()` (L22-24): Controls file content returned for specific paths
  - `existsSync()` (L26-31): Delegates to mock or returns false
  - `readFileSync()` (L33-38): Delegates to mock or returns empty string

### Test Setup
- **beforeEach (L46-52)**: Initializes fresh MockFileSystem, injects it via `setDefaultFileSystem`, sets default behavior (no files exist)
- **afterEach (L54-57)**: Restores NodeFileSystem to prevent test pollution
- **Constants**: Uses `proj-edge` directory structure with `src` subdirectory

### Test Cases
1. **Malformed package.json (L59-68)**: Verifies `isESMProject` gracefully handles invalid JSON in program directory without throwing
2. **Malformed tsconfig.json for ESM detection (L70-78)**: Tests `isESMProject` resilience against corrupted tsconfig in project root
3. **Malformed tsconfig.json for paths (L80-88)**: Ensures `hasTsConfigPaths` fails safely on invalid JSON
4. **Default output patterns (L90-94)**: Validates `determineOutFiles` fallback behavior when no user configuration provided

### Key Testing Patterns
- **Fault tolerance**: All tests verify functions return false/defaults instead of throwing on malformed JSON
- **Path-specific mocking**: Uses exact path matching to simulate realistic file system states
- **Extension awareness**: Uses `.js` extensions to avoid forcing ESM detection through file extensions