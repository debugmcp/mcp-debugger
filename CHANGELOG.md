# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-05-27

### Added

- Initial public release of `debug-mcp-server`.
- Core functionality for Python debugging using the Debug Adapter Protocol (DAP) via `debugpy`.
- MCP server implementation with tools for:
    - Creating and managing debug sessions (`create_debug_session`, `list_debug_sessions`, `close_debug_session`).
    - Debug actions: `set_breakpoint`, `start_debugging`, `step_over`, `step_into`, `step_out`, `continue_execution`.
    - State inspection: `get_stack_trace`, `get_scopes`, `get_variables`.
- Support for both STDIN/STDOUT and HTTP transport for MCP communication.
- Basic CLI to start the server with transport and logging options.
- Python "launcher" package (`debug-mcp-server-launcher`) for PyPI, to aid users in running the server and ensuring `debugpy` is available.
- Dockerfile for building and running the server in a containerized environment, including OCI labels.
- GitHub Actions CI setup for:
    - Building and testing on Ubuntu and Windows.
    - Linting with ESLint.
    - Publishing Docker image to Docker Hub on version tags.
    - Publishing Python launcher package to PyPI on version tags.
- Project structure including:
    - `LICENSE` (MIT).
    - `CONTRIBUTING.md` (basic template).
    - GitHub issue and pull request templates.
    - `README.md` with quick start, features, and usage instructions.
    - `docs/` directory with initial documentation (`quickstart.md`).
    - `examples/` directory with:
        - `python_simple_swap/`: A buggy Python script and a demo script showing how to debug it using MCP tools.
        - `agent_demo.py`: A minimal example of an LLM agent loop interacting with the server.
- Unit and integration tests for core functionality. (E2E tests for HTTP transport are currently skipped due to environment complexities).
- `pyproject.toml` for the Python launcher and `package.json` for the Node.js server.

### Changed

- Build output directory standardized to `dist/`.

### Known Issues

- E2E tests for HTTP transport (`tests/e2e/debugpy-connection.test.ts`) are temporarily skipped due to challenges with JavaScript environment setup (fetch/ReadableStream polyfills in Jest/JSDOM). These will be revisited.
- Placeholder URLs and names (e.g., for repository, Docker Hub user, author) in `package.json`, `pyproject.toml`, `Dockerfile`, `README.md`, and example scripts need to be updated with actual project details.
