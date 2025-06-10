# Contributing to mcp-debugger

Thank you for your interest in contributing to mcp-debugger! We welcome contributions from the community and are grateful for your support.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Code Style](#code-style)
- [Testing](#testing)
- [Commit Messages](#commit-messages)
- [Pull Request Process](#pull-request-process)
- [Project Structure](#project-structure)
- [Questions](#questions)

## 📜 Code of Conduct

This project adheres to a Code of Conduct that all contributors are expected to follow. Please be respectful and professional in all interactions.

## 🚀 Getting Started

### Prerequisites

- Node.js 20.x or higher
- Python 3.7+ (for debugging Python code)
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
   npm install
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

4. **Build and test**:
   ```bash
   npm run build
   npm test
   npm run lint
   ```

5. **Commit your changes** using conventional commits (see below)

6. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

7. **Create a Pull Request** from your fork to our `main` branch

## 🎨 Code Style

We use ESLint and Prettier to maintain consistent code style.

### Setup

```bash
# Run ESLint
npm run lint

# Fix auto-fixable issues
npm run lint:fix

# Format code with Prettier (if configured)
npm run format
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
- Format on save using Prettier
- Show ESLint warnings/errors inline
- Use the project's TypeScript version

Example VS Code settings:
```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib"
}
```

## Testing

The project includes a comprehensive test suite. Please ensure all tests pass before submitting a pull request. If you're adding a new feature, please include tests for it.

### Running Tests

The easiest way to run tests is using our consolidated test runner script (located in `tests/runners/`). Note that `.cmd` scripts are for Windows and you might need to adapt or use a shell script for macOS/Linux if available.

```bash
# On Windows:
# Run all tests
tests\\runners\\run-tests.cmd all

# Run only unit tests
tests\\runners\\run-tests.cmd unit

# Run only integration tests
tests\\runners\\run-tests.cmd integration

# Run only end-to-end tests
tests\\runners\\run-tests.cmd e2e

# Run a specific test file (example)
tests\\runners\\run-tests.cmd unit tests/unit/session/session-manager.test.ts
```
*(For macOS/Linux, if a `run-tests.sh` is provided, usage would be similar, e.g. `bash tests/runners/run-tests.sh all`)*

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

## 🚦 Pull Request Process

1. **Before submitting**:
   - Ensure all tests pass
   - Update documentation if needed
   - Add tests for new functionality
   - Run linting and fix any issues
   - Update CHANGELOG.md if applicable

2. **PR Guidelines**:
   - Use the PR template
   - Link related issues
   - Keep PRs focused on a single concern
   - Write clear descriptions
   - Add screenshots/demos for UI changes

3. **Review Process**:
   - PRs require at least one review from @debugmcpdev
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
├── src/                    # Source code
│   ├── cli/               # CLI commands and setup
│   ├── container/         # Dependency injection
│   ├── dap-core/         # Debug Adapter Protocol core
│   ├── debugger/         # Debugger implementations
│   ├── proxy/            # DAP proxy components
│   ├── session/          # Session management
│   ├── tools/            # MCP tools
│   └── utils/            # Utility functions
├── tests/                 # Test files
│   ├── unit/             # Unit tests
│   ├── integration/      # Integration tests
│   └── e2e/              # End-to-end tests
├── examples/              # Example scripts
├── docs/                  # Documentation
└── .github/               # GitHub templates and workflows
```

### Key Components

- **Session Manager**: Manages debugging sessions lifecycle
- **DAP Proxy**: Handles communication with debugpy
- **MCP Tools**: Implements the MCP protocol tools
- **Debugger Providers**: Language-specific debugging logic

## 🏃 Running the Demo

To see mcp-debugger in action:

1. **Build the project**:
   ```bash
   npm run build
   ```

2. **Run with a demo script**:
   ```bash
   # Start the server
   node dist/index.js
   
   # In another terminal, use an MCP client to debug
   # the example swap_vars.py script
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
- **Direct contact**: debug@sycamore.llc

Thank you for contributing to mcp-debugger! 🙏
