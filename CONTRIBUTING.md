# Contributing to mcp-debugger

Thank you for your interest in contributing to mcp-debugger! We welcome contributions from the community and are grateful for your support.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Dev-Loop Gate](#dev-loop-gate)
- [Code Style](#code-style)
- [Testing](#testing)
- [Commit Messages](#commit-messages)
- [Pull Request Process](#pull-request-process)
- [Project Structure](#project-structure)
- [Questions](#questions)

## 📜 Code of Conduct

This project adheres to the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). All contributors are expected to follow it. Please be respectful and professional in all interactions.

## 🚀 Getting Started

### Prerequisites

- Node.js 22+
- pnpm 10 (required — `workspace:*` protocol needs pnpm, not npm). The exact
  version is pinned via the `packageManager` field in `package.json`; run
  `corepack enable` to pick it up automatically. **Never commit a regenerated
  `pnpm-lock.yaml`** — a different pnpm version rewrites it destructively
  (dropping the security `overrides` block); if `pnpm install` modifies it,
  run `git checkout pnpm-lock.yaml` before committing.
- Python 3.7+ (for debugging Python code)
- Go 1.18+ and Delve (for debugging Go code, optional)
- Rust toolchain (for debugging Rust code, optional — CodeLLDB auto-downloads during install)
- JDK 21+ (for debugging Java code, optional — JDI bridge compiles on first use; compile target code with `javac -g` for variable inspection)
- Docker (optional, for containerized development)
- Git

### Initial Setup

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/mcp-debugger.git
   cd mcp-debugger
   ```
3. **Add upstream remote**:
   ```bash
   git remote add upstream https://github.com/debugmcp/mcp-debugger.git
   ```
4. **Install dependencies**:
   ```bash
   pnpm install
   ```
5. **Build the project**:
   ```bash
   npm run build
   ```

## 💻 Development Workflow

1. **Sync with upstream**:
   ```bash
   git fetch upstream
   git checkout main
   git merge upstream/main
   ```

2. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/your-bug-fix
   ```

3. **Make your changes** following our code style guidelines

4. **Build and test** — run the [Dev-Loop Gate](#dev-loop-gate) below. It is the exact set of
   checks `.husky/pre-push` and CI enforce, so passing it locally means nothing downstream
   surprises you.

5. **Commit your changes** using conventional commits (see below)

6. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

7. **Create a Pull Request** from your fork to our `main` branch

## Dev-Loop Gate

This is the canonical description of the checks that gate a push. `.husky/pre-push` runs all five
steps in this order; CI's **Lint Code** job runs steps 1 and 3, and its **Build and Test** job
covers steps 4 and 5 via `pnpm run build:ci` and `pnpm run test:ci-coverage`. Other docs should
link here rather than restate it.

**Lint Code** also runs four PR-blocking checks that pre-push does not, so a clean local gate is
not a guarantee: `pnpm run check:all-personal-paths`, `pnpm run check:docs` (relative links that
no longer resolve, and counts that fell behind the code), `pnpm run changelog:check`, and a
"Require a changelog fragment" step on pull requests — a user-visible change needs a fragment
(test-only changes are exempt automatically; label a genuine no-op PR `no-changelog`). Running
those four before you push saves a CI round-trip.

1. **Lint** — `pnpm run lint`. ESLint over `src/**/*.ts`, `packages/*/src/**/*.ts`, and
   `scripts/**/*.{js,mjs,cjs}`. Note that `pnpm run lint:fix` is only `eslint src/**/*.ts --fix`,
   so it does not auto-fix findings under `packages/` or `scripts/`.

2. **A committed `tests/typecheck-baseline.json`** — pre-push refuses to go further while that
   file is modified but uncommitted. The ratchet validates your working tree locally but the
   pushed commit in CI, so an uncommitted baseline passes here and fails there.

3. **Type-check** — `pnpm run typecheck:all`, which is `typecheck` (the shipped sources, via
   `tsconfig.typecheck.json`) plus `typecheck:tests` (the per-file ratchet over the test trees).
   `src/` and `packages/*/src` must be strict-clean. The tests carry a recorded per-file error
   backlog that may only shrink, and the ratchet fails in **both** directions:
   - a count went **up** — you introduced type errors; fix them;
   - a count went **down**, or a test file was removed — that is progress, but the baseline is now
     stale: run `pnpm run typecheck:tests:update` and commit `tests/typecheck-baseline.json` in the
     same PR.

   `pnpm run typecheck:tests:raw` prints unfiltered `tsc` output for `tsconfig.spec.json` when you
   need to see the diagnostics themselves.

4. **Clean build** — `npm run clean && npm run build`, so no stale artifact can mask a compile
   error.

5. **Tests** — `npm run test:unit && npm run test:integration`. Deliberately *not* the full suite:
   the heavy `e2e` project (smoke, Docker, npx) runs in CI. (A tags-only push runs the reduced
   `npm run test:ci-no-python` instead.)

The **pre-commit** hook is much lighter and runs none of the above: it runs the personal-paths
check, blocks accidentally staged build artifacts (`.js`/`.d.ts`/`.js.map` under `src/` or
`packages/*/src/`) and `.tgz` tarballs, and runs an optional docstar check if docstar is installed.
No tests, no build.

## 🔒 Privacy Guidelines

**IMPORTANT**: Never commit personal information to the repository. This includes:

- Personal file paths (e.g., `C:\path\to\` or `/path/to/`)
- Personal email addresses (project emails like `admin@debugmcp.io` are okay)
- Cloud storage paths with personal folders
- Any other personally identifiable information

### Pre-commit Hook

We have a pre-commit hook that automatically checks for personal information patterns. If detected, your commit will be blocked with instructions on how to fix it.

### How to Handle Paths

When documenting or writing examples, always use generic paths like:
- `/path/to/project`
- `C:\path\to\project`
- `~/workspace/project`

### Testing the Privacy Check

You can manually run the privacy check:
```bash
# Check staged files (what pre-commit does)
npm run check:personal-paths

# Check all files in the repository
npm run check:all-personal-paths
```

## 🎨 Code Style

We use ESLint to maintain consistent code style. There is no Prettier setup in this repo —
`eslint.config.js` is the only style tool of record.

### Setup

```bash
# Run ESLint (src/**, packages/*/src/**, scripts/**)
npm run lint

# Fix auto-fixable issues — note this covers src/**/*.ts only
npm run lint:fix
```

### Guidelines

- Use TypeScript for all new code
- Follow the existing code structure and patterns
- Write self-documenting code with clear variable names
- Add JSDoc comments for public APIs
- Keep functions small and focused
- Use dependency injection patterns (see existing code)

### Editor Configuration

We recommend configuring your editor to:
- Apply ESLint auto-fixes on save
- Show ESLint warnings/errors inline
- Use the project's TypeScript version

Example VS Code settings:
```json
{
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib"
}
```

## Testing

The project includes a comprehensive test suite. Please ensure all tests pass before submitting a pull request. If you're adding a new feature, please include tests for it.

### Running Tests

The project uses **Vitest** as its test runner:

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit         # Unit tests only
npm run test:integration  # Integration tests only
npm run test:e2e         # End-to-end tests only

# Run tests with coverage
npm run test:coverage

# Run a specific test file (SessionManager specs live under tests/core/unit/session/)
npx vitest run tests/core/unit/session/session-manager-state.test.ts
```

Before pushing, run the full [Dev-Loop Gate](#dev-loop-gate) — `npm test` alone is not what CI
and the pre-push hook check.

### Test Architecture

Our tests follow a three-tiered approach:

1.  **Unit Tests**: Test individual components in isolation.
    *   Focus: Session management, debugger provider implementations, utility functions.
2.  **Integration Tests**: Test interactions between components.
    *   Focus: Complete debugging workflow tests, DAP message sequencing.
3.  **End-to-End (E2E) Tests**: Test the full system with actual `debugpy` servers.
    *   Focus: Full debugging scenarios from MCP request to `debugpy` interaction and back.

### Writing Tests

- Write tests for all new features and bug fixes
- Aim for >90% code coverage
- Use descriptive test names that explain what is being tested
- Follow the AAA pattern: Arrange, Act, Assert
- Mock external dependencies appropriately

## 📝 Commit Messages

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, semicolons, etc.)
- `refactor`: Code refactoring without changing functionality
- `perf`: Performance improvements
- `test`: Adding or modifying tests
- `build`: Build system or dependency changes
- `ci`: CI/CD configuration changes
- `chore`: Other changes that don't modify src or test files

### Examples

```bash
feat(debugger): add support for conditional breakpoints

Added ability to set breakpoints with conditions that are evaluated
at runtime. This allows for more precise debugging workflows.

Closes #123
```

```bash
fix(session): handle disconnect during stepping

Fixed race condition where disconnect during step operations
could leave the session in an invalid state.
```

## ✍️ Developer Certificate of Origin

By contributing to this project, you certify the [Developer Certificate of Origin (DCO) v1.1](https://developercertificate.org/): that you wrote the contribution or otherwise have the right to submit it under the project's MIT license, and that you understand the contribution is public and a record of it is maintained indefinitely.

Sign off each commit to make this certification explicit:

```bash
git commit -s -m "feat(scope): your change"
```

which appends a `Signed-off-by: Your Name <you@example.com>` trailer. If you forget, `git commit --amend -s` fixes the latest commit. We do not currently enforce sign-off in CI, but including it is expected for non-trivial contributions.

## 🚦 Pull Request Process

1. **Before submitting**:
   - Ensure all tests pass
   - Update documentation if needed
   - Add tests for new functionality
   - Run linting and fix any issues
   - Add a changelog fragment if the change is user-visible — a new file at
     `changelog.d/<issue-number>.<category>.md` holding the entry text. Do **not** edit
     `CHANGELOG.md` directly; fragments are collated into it at release time. See
     [`changelog.d/README.md`](changelog.d/README.md). CI requires one for changes under
     `src/`, `packages/`, or `tools/` (test-only changes are exempt; apply the
     `no-changelog` label for a PR that genuinely needs no entry).

2. **PR Guidelines**:
   - Use the PR template
   - Link related issues
   - Keep PRs focused on a single concern
   - Write clear descriptions
   - Add screenshots/demos for UI changes

3. **Review Process**:
   - PRs require at least one review from @debugmcp
   - Address all review comments
   - Keep discussions professional and constructive
   - Be patient - reviews may take a few days

4. **After Approval**:
   - Squash commits if requested
   - Ensure CI passes
   - Maintainer will merge using "Squash and merge"

## 📁 Project Structure

```
mcp-debugger/
├── packages/               # 17 monorepo workspace packages
│   ├── shared/            # Shared interfaces, types, adapter policies, utilities
│   ├── adapter-python/    # Python debug adapter (debugpy)
│   ├── adapter-ruby/      # Ruby debug adapter (rdbg/debug gem)
│   ├── adapter-javascript/# JavaScript/Node.js adapter (js-debug)
│   ├── adapter-rust/      # Rust adapter (CodeLLDB)
│   ├── adapter-go/        # Go adapter (Delve)
│   ├── adapter-java/      # Java adapter (JDI bridge)
│   ├── adapter-dotnet/    # .NET/C# adapter (netcoredbg)
│   ├── adapter-cpp/       # C/C++ adapter (CodeLLDB)
│   ├── codelldb-common/   # Shared CodeLLDB infrastructure (Rust + C/C++ adapters)
│   ├── codelldb-win32-x64/    # Prebuilt CodeLLDB binaries, one package per
│   ├── codelldb-linux-x64/    # platform, published with os/cpu fields so an
│   ├── codelldb-linux-arm64/  # install pulls only the matching payload
│   ├── codelldb-darwin-x64/
│   ├── codelldb-darwin-arm64/
│   ├── adapter-mock/      # Mock adapter for testing
│   └── mcp-debugger/      # Self-contained CLI bundle (npx distribution)
├── src/                    # Core server source code
│   ├── adapters/          # Adapter loading, registry, and per-session leases
│   ├── cli/               # Reusable CLI wiring (commands, setup, error handlers)
│   ├── container/         # Dependency injection
│   ├── dap-core/          # Pure DAP state/handler core
│   ├── errors/            # Debug error types
│   ├── factories/         # ProxyManager and SessionStore factories
│   ├── implementations/   # Concrete filesystem/process/network implementations
│   ├── interfaces/        # Interfaces for the injected dependencies
│   ├── proxy/             # DAP proxy components
│   ├── server/            # MCP tool layer: tool schemas, validation, dispatch, handlers/ (one module per tool family), resource and prompt handlers
│   ├── session/           # Session management (core -> data -> operations -> session-manager) plus the per-operation slices launch/ attach/ breakpoints/ execution/ inspection/ jvm/ mirror/
│   └── utils/             # Utility functions
├── tests/                 # Test files
│   ├── unit/             # Unit tests
│   ├── core/unit/        # Core unit tests (server, session, adapters, factories, utils)
│   ├── adapters/         # Adapter-specific tests
│   ├── integration/      # Integration tests
│   ├── e2e/              # End-to-end tests
│   └── test-utils/       # Shared test utilities
├── examples/              # Example scripts
├── docs/                  # Documentation
└── .github/               # GitHub templates and workflows
```

### Key Components

- **Session Manager**: Manages debugging session lifecycle
- **DAP Proxy**: Handles communication with debug adapters via DAP protocol
- **Adapter Registry**: Dynamically loads and manages language-specific adapters
- **Adapter Policies**: Language-specific behavior via policy pattern
- **MCP Tools**: Implements the 28 MCP protocol tools

## 🏃 Running the Demo

To see mcp-debugger in action:

1. **Build the project**:
   ```bash
   npm run build
   ```

2. **Run with a demo script**:
   ```bash
   # Start the server in STDIO mode (the default subcommand)
   node dist/index.js stdio

   # Or start in Streamable HTTP mode for remote/web clients
   node dist/index.js http -p 3001
   ```

   The `sse` subcommand still exists but is deprecated; use `http` instead.

3. **Example debugging session**:
   - Create a debug session
   - Set a breakpoint at line 10
   - Start debugging swap_vars.py
   - Step through and inspect variables
   - See the bug and fix it!

## ❓ Questions?

- **General questions**: Open a [Discussion](https://github.com/debugmcp/mcp-debugger/discussions)
- **Bug reports**: Open an [Issue](https://github.com/debugmcp/mcp-debugger/issues)
- **Direct contact**: admin@debugmcp.io

Thank you for contributing to mcp-debugger! 🙏
