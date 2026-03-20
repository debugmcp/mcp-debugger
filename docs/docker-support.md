# Docker Support for Debug MCP Server

This guide explains how to use Docker with the Debug MCP Server, allowing you to run the server in a container alongside other MCP servers like the GitHub MCP Server.

## Building the Docker Image

We provide a Dockerfile and build scripts for creating a Docker container with all necessary dependencies pre-installed, including Node.js and Python with debugpy.

### Building the Image
```bash
docker build -t mcp-debugger:local .
```

Or using the npm script:
```bash
npm run docker-build
```

## IMPORTANT: Mount Path Requirement

**When running the Debug MCP Server in a Docker container, you should mount your project files to `/workspace` inside the container.** This is the default and recommended mount point. The container sets `MCP_WORKSPACE_ROOT=/workspace` by default, which is used for path resolution. The `/workspace` directory is optional -- the server will still work from the image's default working directory, but path resolution will use whatever `MCP_WORKSPACE_ROOT` is set to.

### Why /workspace?

The Debug MCP Server resolves paths through centralized container path utilities. When running in a container (`MCP_CONTAINER=true`), paths are resolved against the configured workspace root (`MCP_WORKSPACE_ROOT`, default `/workspace/`) via `SimpleFileChecker`, and the server passes the resolved effective path onward. This means:
- Your project files must be mounted at `/workspace`
- The LLM can provide any path format (relative, absolute, Windows, Linux)
- The server does NO path interpretation or cross-platform conversion
- Debug adapter (debugpy) handles all path resolution natively

## Running the Server with Docker

### Basic Usage

Once the image is built, you can run the server with volume mounts:

```bash
docker run -i --rm -v /path/to/your/project:/workspace:rw mcp-debugger:local stdio
```

### Recommended Configuration for Claude

Here's the recommended configuration for your MCP settings file:

```json
{
  "mcpServers": {
    "mcp-debugger-docker": {
      "command": "docker",
      "args": [
        "run",
        "--rm",
        "-i",
        "-v",
        "/path/to/your/project:/workspace:rw",
        "-v",
        "/path/to/temp:/tmp:rw",
        "mcp-debugger:local",
        "stdio",
        "--log-level",
        "debug",
        "--log-file",
        "/tmp/mcp-debugger-docker.log"
      ],
      "autoApprove": [
        "create_debug_session",
        "list_debug_sessions",
        "list_supported_languages",
        "close_debug_session",
        "set_breakpoint",
        "start_debugging",
        "attach_to_process",
        "detach_from_process",
        "step_over",
        "step_into",
        "step_out",
        "continue_execution",
        "pause_execution",
        "get_variables",
        "get_local_variables",
        "get_stack_trace",
        "get_scopes",
        "evaluate_expression",
        "get_source_context"
      ],
      "disabled": false,
      "timeout": 60
    }
  }
}
```

### Important Notes:
- Replace `/path/to/your/project` with the actual path to the project you want to debug
- The `:rw` suffix allows read-write access (required for debugging)
- The temp directory mount is optional but useful for log files. Note: the current Docker entrypoint hardcodes `--log-level debug` and does not forward additional CLI flags from `docker run`
- When using the debugger, provide paths relative to the project root (e.g., `examples/test.py` not `/workspace/examples/test.py`)

## Rust support in Docker

> ⚠️ **Rust debugging is not supported inside the Docker image by default.** The container uses `DEBUG_MCP_DISABLE_LANGUAGES` to disable the Rust adapter, so the MCP tools will not advertise `rust` as an available language.

Why? CodeLLDB inside the container could not reliably interpret DWARF data for binaries compiled on the host (Windows/WSL/macOS). Rather than forcing every user to rebuild their projects with a matching Linux toolchain, we recommend running Rust sessions via the local/stdio, SSE, or packed deployments—where the debugger runs next to the toolchain that produced the binary. The Docker variant remains the best choice for Python and JavaScript debugging and now ships a slimmer image (no CodeLLDB payload).

If you need Rust debugging from a container, keep the host-based deployments and mount your compiled Linux binary directly; the Docker image intentionally refuses to start Rust sessions to avoid inconsistent experiences.

## Using Both Debug MCP Server and GitHub MCP Server with Docker

To use both servers together, configure them in your MCP settings:

```json
{
  "mcpServers": {
    "mcp-debugger-docker": {
      "command": "docker",
      "args": [
        "run",
        "--rm",
        "-i",
        "-v",
        "/path/to/your/project:/workspace:rw",
        "mcp-debugger:local",
        "stdio"
      ],
      "disabled": false,
      "autoApprove": [],
      "timeout": 60
    },
    "github": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "-e",
        "GITHUB_PERSONAL_ACCESS_TOKEN",
        "ghcr.io/github/github-mcp-server"
      ],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "your-github-token"
      },
      "disabled": false,
      "autoApprove": [],
      "timeout": 60
    }
  }
}
```

## Advanced Docker Configuration

### Multiple Project Mounts

If you need to debug files from multiple locations, you can mount multiple directories under `/workspace`:

```json
"args": [
  "run",
  "--rm",
  "-i",
  "-v",
  "/path/to/project1:/workspace/project1:rw",
  "-v",
  "/path/to/project2:/workspace/project2:rw",
  "mcp-debugger:local",
  "stdio"
]
```

Then reference files as `project1/file.py` or `project2/script.js`.

### Exposing debugpy Port

To expose the debugpy port for remote debugging:

```bash
docker run -i --rm -p 5679:5679 -v /path/to/project:/workspace:rw mcp-debugger:local stdio
```

In the MCP settings:
```json
"args": [
  "run",
  "-i",
  "--rm",
  "-p",
  "5679:5679",
  "-v",
  "/path/to/project:/workspace:rw",
  "mcp-debugger:local",
  "stdio"
]
```

## Dockerfile Details

The Dockerfile for the Debug MCP Server:

1. Uses Node.js 20-slim for building
2. Creates a bundled application in `/app`
3. Uses Ubuntu 24.04 for runtime
4. Installs Python 3 and debugpy
5. Sets necessary environment variables
6. The application runs from `/app`, keeping `/workspace` free for user mounts

This ensures all dependencies needed for both Node.js execution and Python debugging are available in the container.

## Troubleshooting

### Common Mount Path Issues

1. **"File not found" errors**:
   - Ensure your files are mounted to `/workspace`, not other paths like `/app/project`
   - Check that the mount syntax is correct: `-v /host/path:/workspace:rw`
   - Verify the host path exists and has proper permissions

2. **Path resolution problems**:
   - The server expects paths relative to `/workspace`
   - If you provide `test.py`, the server looks for `/workspace/test.py`
   - Absolute paths like `/home/user/test.py` won't work in container mode

3. **Permission issues**: 
   - On Unix-based systems, you might need to adjust file permissions
   - Consider using `:rw` suffix for read-write access
   - Check that the Docker daemon has access to the host directories

### Common Docker Issues

1. **Container not terminating**:
   - Use `docker ps` to list running containers
   - Use `docker stop <container_id>` to stop a container

2. **Port already in use**:
   - If port 5678 is already in use, you can map to a different port:
   ```
   docker run -i --rm -p 5679:5678 mcp-debugger:local
   ```

3. **Build failures**:
   - Ensure Docker daemon is running
   - Check available disk space
   - Try clearing Docker cache: `docker system prune`

For more general troubleshooting, see [troubleshooting.md](./troubleshooting.md).
