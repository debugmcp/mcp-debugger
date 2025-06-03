# Roadmap for debug-mcp-server

This document outlines the planned features and improvements for `debug-mcp-server`.
This is a living document and may change based on community feedback and development progress.

## Short-Term (Next Releases)

- **Stabilize Core Python Debugging:**
    - Address any bugs found in the initial `0.1.0` release.
    - Improve error handling and diagnostics.
    - Resolve issues with E2E tests for HTTP transport.
- **Enhance Documentation:**
    - More detailed API documentation for each MCP tool.
    - More examples, including different agent frameworks.
    - Refine `README.md` and `docs/` based on user feedback.
- **Improve Developer Experience:**
    - Streamline local development setup.
    - Update GitHub Actions workflow for `::set-output` deprecation.
- **Asciinema Demo:**
    - Create and embed the asciinema demo in `README.md` as planned.

## Medium-Term

- **Node.js Debug Adapter:**
    - Implement a debug adapter for Node.js applications, similar to the Python one.
    - This would allow debugging JavaScript/TypeScript code using `mcp-debugger`.
- **Remote Attach for Dockerized Applications:**
    - Provide a way to easily attach the debugger to Python (or Node.js) applications running inside other Docker containers, not just scripts run by the MCP server itself.
    - This might involve a "debug sidecar" pattern or enhancements to the `start_debugging` tool.
- **Improved `debugpy` Management:**
    - More sophisticated auto-detection and installation of `debugpy` in various Python environments.
    - Potentially bundle `debugpy` or a specific version if licensing allows and it simplifies setup.
- **Enhanced Configuration Options:**
    - More granular control over logging.
    - Configuration for `debugpy` adapter settings (e.g., `justMyCode`).

## Long-Term / Vision

- **VS Code Extension:**
    - A dedicated VS Code extension to make it easier for developers to:
        - Use `mcp-debugger` with their LLM agents.
        - Test and develop agents that use debugging tools.
        - Visualize the agent's debugging process.
- **Support for More Languages:**
    - Extend debugging capabilities to other languages popular in AI/ML development (e.g., Java, Go, C#) by integrating with their respective DAP implementations.
- **Advanced Debugging Features:**
    - Conditional breakpoints with expressions.
    - Logpoints.
    - Data visualization for inspected variables.
- **Agent-Specific Debugging Tools:**
    - Tools tailored for common agent patterns (e.g., "debug this chain of thought up to step X").
- **Community Contributions:**
    - Foster a community and encourage contributions for new features, language adapters, and agent integrations.

## How to Contribute

We welcome contributions! Please see `CONTRIBUTING.md` for details on how to get started, report bugs, or suggest features. You can also check out issues labeled `good first issue` or `help wanted` in the GitHub repository.
