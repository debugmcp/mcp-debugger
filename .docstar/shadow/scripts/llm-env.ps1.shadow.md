# scripts/llm-env.ps1
@source-hash: ca2203699fb9b652
@generated: 2026-02-09T18:15:16Z

**Purpose**: PowerShell script that optimizes console output for LLM consumption by overriding common development commands to show only failures and essential information while suppressing verbose output from passing tests.

**Core Architecture**: Function-based command interception pattern that wraps existing tools (npm, docker, git) with filtered output processors.

**Key Functions**:

- **npm (L16-147)**: Primary function override that intercepts npm test commands and applies TAP output filtering
  - Handles multiple test command patterns: `test`, `test:unit`, `test:int`, `test:e2e`
  - For general tests: Implements sophisticated TAP parsing with failure tracking and nested content depth management (L49-93)
  - For specific test types: Uses simpler failure-state tracking (L95-142)
  - Sets `CI=true` environment variable to prevent dynamic terminal updates
  - Preserves original npm functionality via `npm.cmd` for non-test commands

- **docker (L150-172)**: Overrides docker build commands to add `--progress=plain` flag for cleaner output
  - Automatically injects progress flag unless already specified
  - Passes through non-build commands unchanged

- **git-clone (L174-177)**: Wrapper for quiet git clone operations using `--quiet` flag

- **Show-LLMHelpers (L180-189)**: Documentation function that displays active overrides and usage instructions

**Output Filtering Strategy**:
- **TAP Processing**: Preserves TAP headers, test plans, and coverage reports while filtering passing test details
- **Failure Tracking**: Uses state machines (`$inFailure`, `$skipDepth`) to capture complete failure context including nested diagnostic information
- **Coverage Preservation**: Complex regex patterns (L57) to maintain coverage table formatting
- **Depth Management**: Tracks brace nesting to properly skip passing test file contents

**Dependencies**: 
- Requires `.cmd` and `.exe` versions of overridden commands to be available in PATH
- Relies on TAP reporter format for test output parsing
- Expects standard npm script names (`test:coverage`, `test:unit`, etc.)

**Critical Patterns**:
- Uses `@args` parameter expansion for proper argument forwarding
- Employs regex pattern matching for command detection and output filtering
- Implements stateful parsing for complex TAP output processing
- Color-coded console feedback for operation transparency

**Usage Model**: Intended to be dot-sourced (`. ./scripts/llm-env.ps1`) to modify current PowerShell session, creating an "LLM Mode" environment for development work.