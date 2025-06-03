# Contributing to Debug MCP Server

First off, thank you for considering contributing to Debug MCP Server! We welcome any contributions that help make this project better.

## Development Workflow

1.  **Fork the repository** on GitHub.
2.  **Clone your fork** locally: `git clone https://github.com/YOUR_USERNAME/debug-mcp-server.git`
3.  **Create a new branch** for your feature or bug fix: `git checkout -b my-feature-branch`
4.  **Install dependencies**: `npm install`
5.  **Make your changes.** Ensure you follow the coding style (ESLint + Prettier, see Linting section).
6.  **Build the project**: `npm run build`
7.  **Test your changes** thoroughly (see Testing section).
8.  **Commit your changes**: `git commit -am "feat: Add some amazing feature"` (Try to follow [Conventional Commits](https://www.conventionalcommits.org/) if possible).
9.  **Push to your branch**: `git push origin my-feature-branch`
10. **Open a Pull Request** against the `main` branch of the original repository. Provide a clear description of your changes.

## Linting and Formatting

We use ESLint for linting and Prettier for code formatting. Please ensure your code adheres to these standards.

```bash
# Run ESLint
npm run lint

# Run Prettier (usually configured to run on save or as a pre-commit hook)
npm run format 
# (Assuming a "format" script exists or will be added to package.json, e.g., "prettier --write .")
```
It's highly recommended to set up your editor to auto-format with Prettier on save.

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

### Debugging Tests

Information on how to debug tests (e.g., using VS Code's Jest runner) can be added here.

## How to Run the Demo

The primary demo involves using the `debug-mcp-server` with an LLM agent that can make MCP calls.

1.  **Build the server** (if you made changes): `npm run build`
2.  **Run the server**:
    *   Using the Python launcher (after `pip install debug-mcp-server-launcher`): `debug-mcp-server`
    *   Or directly with Node: `node dist/index.js`
3.  **Configure your LLM agent/MCP client** to connect to the server (see `README.md` for MCP settings examples).
4.  **Use an example script** from the `/examples` directory, such as `examples/python/fibonacci.py` or `examples/python/simple_swap.py`.
5.  **Instruct your LLM** to perform debugging actions (e.g., "Set a breakpoint in `fibonacci.py` at line 10, then run it and show me the local variables when it hits the breakpoint.").

(Details for the Asciinema demo script from `examples/asciinema_demo/` can be added here once it's created.)

## Code Structure Overview

(A brief overview of the main directories like `src/`, `src/debugger/`, `src/session/`, `tests/` can be added here to help new contributors navigate the codebase.)

## Questions?

Feel free to open an issue if you have questions or need help with your contribution.
