# packages/adapter-javascript/tests/unit/javascript-debug-adapter.runtime.edge.test.ts
@source-hash: b1265c8d96a6455d
@generated: 2026-02-09T18:14:05Z

**Purpose**: Unit test suite for JavascriptDebugAdapter's private runtime configuration methods, focusing on edge cases and TypeScript runtime detection/argument handling.

**Test Structure**:
- **Test Suite (L22-203)**: "JavascriptDebugAdapter private runtime helpers (edge coverage)"
- **Setup/Teardown (L25-33)**: Mock restoration and adapter initialization with stubbed dependencies
- **Dependencies Stub (L9-16)**: Minimal AdapterDependencies with mocked logger functions

**Key Test Groups**:

**determineRuntimeExecutable Tests (L35-60)**:
- Tests private method for selecting appropriate runtime executable
- **Non-TS case (L36-39)**: Returns 'node' for non-TypeScript projects
- **TS with tsx (L41-45)**: Returns tsx path when available, mocks `detectTsRunners`
- **TS with ts-node only (L47-52)**: Falls back to 'node' (hooks handled separately)
- **TS with no runners (L54-59)**: Warns and returns 'node' when no TS runners found

**determineRuntimeArgs Tests (L62-170)**:
- Tests private method for building runtime argument arrays
- **Non-TS deduplication (L63-77)**: Tests argument normalization and duplicate removal
- **TS with tsx override (L79-87)**: Preserves user args only, no additional hooks
- **TS with ts-node override (L89-105)**: Handles ts-node-specific args without duplication
- **TS with tsx present (L107-115)**: No hooks added when tsx is available
- **TS with ts-node + ESM/paths (L117-144)**: Comprehensive test adding all necessary hooks (ts-node/register, transpile-only, ESM loader, tsconfig-paths)
- **TS with ts-node minimal (L146-169)**: Only core ts-node hooks when ESM/paths not needed

**Utility Tests (L172-202)**:
- **Adapter metadata (L173-179)**: Tests module name, install command, default config
- **Executable resolution (L181-185)**: Tests default executable and search paths
- **Path resolution with override (L187-201)**: Tests cached vs preferred path behavior

**Helper Functions**:
- **norm() (L18-20)**: Normalizes file paths by replacing backslashes with forward slashes
- **countPair() (L68-74, L97-103, L132-138)**: Utility for counting flag-value pairs in argument arrays
- **has() (L157-162)**: Checks for presence of flag-value pairs in arrays

**Dependencies**:
- Vitest for testing framework
- Path utilities for cross-platform path handling
- Mocks typescript-detector and config-transformer utilities
- Tests private methods using `(adapter as any)` type assertion

**Testing Patterns**:
- Extensive use of vi.spyOn for mocking external dependencies
- Focus on argument deduplication and TypeScript runtime configuration
- Edge case coverage for various TypeScript runner combinations