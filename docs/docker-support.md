# Docker Support for Debug MCP Server

This guide explains how to use Docker with the Debug MCP Server, allowing you to run the server in a container alongside other MCP servers like the GitHub MCP Server.

## Building the Docker Image

We provide a Dockerfile and build scripts for creating a Docker container with all necessary dependencies pre-installed, including Node.js and Python with debugpy.

### Building with Scripts

#### On Windows:
```bash
.\docker-build.cmd
```

#### On Unix (Linux/macOS):
```bash
chmod +x docker-build.sh
./docker-build.sh
```

### Building Manually
```bash
docker build -t mcp-debugger:local .
```

## IMPORTANT: Mount Path Requirement

**When running the Debug MCP Server in a Docker container, you MUST mount your project files to `/workspace` inside the container.** This is a hard requirement - the containerized server expects all files to be debugged to be accessible under the `/workspace` directory.

### Why /workspace?

The Debug MCP Server uses a "hands-off" approach to path handling. When running in a container (`MCP_CONTAINER=true`), it simply prepends `/workspace/` to all incoming path arguments. This means:
- Your project files must be mounted at `/workspace`
- The LLM should provide paths relative to the mount point
- The server will transform these to absolute paths inside the container

## Running the Server with Docker

### Basic Usage

Once the image is built, you can run the server with volume mounts:

```bash
docker run -i --rm -v /path/to/your/project:/workspace:rw mcp-debugger:local
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
        "close_debug_session",
        "list_debug_sessions",
        "start_debugging",
        "get_stack_trace",
        "get_variables",
        "continue_execution",
        "get_scopes",
        "step_over",
        "step_into",
        "step_out",
        "set_breakpoint"
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
- The temp directory mount is optional but useful for log files
- When using the debugger, provide paths relative to the project root (e.g., `examples/test.py` not `/workspace/examples/test.py`)

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
docker run -i --rm -p 5678:5678 -v /path/to/project:/workspace:rw mcp-debugger:local
```

In the MCP settings:
```json
"args": [
  "run",
  "-i",
  "--rm",
  "-p",
  "5678:5678",
  "-v",
  "/path/to/project:/workspace:rw",
  "mcp-debugger:local"
]
```

## Dockerfile Details

The Dockerfile for the Debug MCP Server:

1. Uses Node.js 20-slim for building
2. Creates a bundled application in `/app`
3. Uses Python 3.11-alpine for runtime (smaller image)
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
