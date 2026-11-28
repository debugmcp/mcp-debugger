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

- Node.js 22.18+ to build (tsup 9's floor; the shipped server runs on 22+)
- pnpm 12 (required — `workspace:*` protocol needs pnpm, not npm). The exact
  version is pinned via the `packageManager` field in `package.json`; pnpm
  10+ switches to it on its own, or run `corepack enable` to have corepack do
  it. Project-level pnpm settings (`overrides`, `allowBuilds`) live in
  `pnpm-workspace.yaml` — pnpm 11+ no longer reads a `pnpm` field in
  `package.json`. **Never commit a regenerated `pnpm-lock.yaml`** — a
  different pnpm version rewrites it destructively (dropping the security
  `overrides` block); if `pnpm install` modifies it, run
  `git checkout pnpm-lock.yaml` before committing.
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

4. **Check your changes** — follow the [Dev-Loop Gate](#dev-loop-gate) below for the local
   static checks and optional suite runs. CI builds and tests the pull request before merge.

5. **Commit your changes** using conventional commits (see below)

6. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

7. **Create a Pull Request** from your fork to our `main` branch

## Dev-Loop Gate

This is the canonical description of the local and CI checks. Other docs should link here
rather than restate it. Put a check where its result makes the decision: the push hook keeps
fast static checks so you can fix simple mistakes without waiting for a whole CI round; CI
runs the checks that decide whether a pull request can merge.

For any push that is not tags-only, `.husky/pre-push` runs these steps in order and stops at
the first failure. It runs no build or tests, and has no switch to skip checks or restore
the old suites.

1. **Lint** — `pnpm run lint`. ESLint over `src/**/*.ts`, `packages/*/src/**/*.ts`,
   `scripts/**/*.{js,mjs,cjs}`, and `tools/**/*.{js,mjs,cjs}` (the dev-proxy supervisor lives
   under `tools/`, and it starts, stops and proxies the backend — it is production tooling, not a
   probe script). `pnpm run lint:fix` runs the same globs with `--fix`. Experimental probes belong
   in `scripts/experiments/`, which `eslint.config.js` ignores.

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

4. **Documentation consistency** — `pnpm run check:docs`, checking relative links and counts
   against the code.

5. **Changelog fragment validation** — `pnpm run changelog:check`, checking existing fragments'
   names and contents. The PR-only requirement to add a fragment is a separate CI step.

6. **Full personal-path audit** — `pnpm run check:all-personal-paths`. Unlike the staged-only
   pre-commit check, this scans tracked files and unignored new files, catching personal paths
   in earlier commits or unstaged work as well.

CI's **Lint Code** job (`lint`) runs ESLint, `pnpm run typecheck:all` (with the existing
Dependabot exception), the full personal-path audit, documentation consistency and changelog
validation. Its **Require a changelog fragment** step also checks PRs for an entry when needed;
test-only changes are exempt automatically, and contributor-process changes use the
`no-changelog` label rather than a user-facing fragment. See [the fragment guide](changelog.d/README.md).

CI's **Build and Test** job (`build-and-test`) runs on Ubuntu and Windows. It runs
`pnpm run build:ci`, lint, the PyPI launcher unit tests, then `pnpm run test:ci-coverage`
(which itself builds and runs `vitest run --coverage --project unit --project integration`).
Branch protection requires the Linux **Build and Test** job and **Lint Code** to pass, and
the branch to be up to date with `main`. The Linux job includes both the unit and integration
suites. The project's merge bar additionally asks for every other CI job in the pull request's
run to pass, including the Windows build, container tests, per-language host lanes and MCP
conformance. See [GOVERNANCE.md — How changes land](GOVERNANCE.md#how-changes-land) for the full
bar and its Dependabot exception, and [the workflow](.github/workflows/ci.yml) for job selections.
A local hook result does not replace the pull request's checks.

For an answer before CI, build first with `pnpm run build`, then run `pnpm run test:unit`
and `pnpm run test:integration`, or target a file with
`npx vitest run tests/core/unit/session/session-manager-state.test.ts`.

A **tags-only push** is a release step and retains its existing gate: cargo environment setup
when available and the Docker buildx probe, lint, the committed-baseline guard, `typecheck:all`,
`npm run clean && npm run build`, then `npm run test:ci-no-python` (which builds again and runs
the unit project).
It does not run the three added branch-push audits.

After either push path succeeds, the hook runs advisory `docstar shadow .` and `docstar check`
if Docstar is installed. Neither command blocks the push.

The **pre-commit** hook runs the staged personal-paths check and refuses the commit if it fails,
showing the checker's own output. It also blocks accidentally staged build
artifacts (`.js`/`.d.ts`/`.js.map` under `src/` or
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
# Run ESLint (src/**, packages/*/src/**, scripts/**, tools/**)
npm run lint

# Fix auto-fixable issues over the same globs
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

Before pushing, follow the [Dev-Loop Gate](#dev-loop-gate) for static checks and optional local
suite runs. CI runs the merge checks; `npm test` alone does not cover them all.

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
   - Client and harness integrations (Claude Code, Codex, pi, ...) ship as documentation or
     inside the published `@debugmcp/mcp-debugger` package (its manifest keys and the shipped
     `skills/` directory), never as per-harness directories or manifest keys at the repository
     root — the root `package.json` is private and never reaches users

3. **Review Process**:
   - PRs require at least one review from @debugmcp
   - Address all review comments
   - Keep discussions professional and constructive
   - Be patient - reviews may take a few days

4. **After Approval**:
   - Squash commits if requested
   - Ensure CI passes
   - The project merges using "Squash and merge"; [GOVERNANCE.md](GOVERNANCE.md) says who merges and under what bar

## 📁 Project Structure

```
mcp-debugger/
├── packages/               # 19 monorepo workspace packages
│   ├── shared/            # Shared interfaces, types, adapter policies, utilities
│   ├── adapter-python/    # Python debug adapter (debugpy)
│   ├── adapter-ruby/      # Ruby debug adapter (rdbg/debug gem)
│   ├── adapter-javascript/# JavaScript/Node.js adapter (js-debug)
│   ├── adapter-rust/      # Rust adapter (CodeLLDB)
│   ├── adapter-go/        # Go adapter (Delve)
│   ├── adapter-java/      # Java adapter (JDI bridge)
│   ├── adapter-dotnet/    # .NET/C# adapter (netcoredbg)
│   ├── adapter-cpp/       # C/C++ adapter (CodeLLDB)
│   ├── adapter-cobol/     # COBOL adapter (GnuCOBOL + CodeLLDB behind a DAP shim)
│   ├── adapter-dart/      # Dart/Flutter adapter (the SDK's own debug adapters behind a stdio bridge)
│   ├── codelldb-common/   # Shared CodeLLDB infrastructure (Rust, C/C++ + COBOL adapters)
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
- **MCP Tools**: Implements the 29 MCP protocol tools

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
