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
docker build -t debug-mcp-server .
```

## Running the Server with Docker

Once the image is built, you can run the server with:

```bash
docker run -i --rm debug-mcp-server
```

### Using with Claude's MCP Configuration

To use the Docker-based server with Claude, update your MCP settings file:

```json
{
  "mcpServers": {
    "debug-mcp-server": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "debug-mcp-server"
      ],
      "disabled": false,
      "autoApprove": [],
      "timeout": 60
    }
  }
}
```

## Using Both Debug MCP Server and GitHub MCP Server with Docker

To use both servers together, configure them in your MCP settings:

```json
{
  "mcpServers": {
    "debug-mcp-server": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "debug-mcp-server"
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

### Mapping Directories for Debugging Project Files

If you want to debug files on your local system, you need to mount them into the container:

```bash
docker run -i --rm -v /path/to/your/project:/app/project debug-mcp-server
```

In the MCP settings:
```json
"args": [
  "run",
  "-i",
  "--rm",
  "-v",
  "c:/path/to/your/project:/app/project",
  "debug-mcp-server"
]
```

### Exposing debugpy Port

To expose the debugpy port for remote debugging:

```bash
docker run -i --rm -p 5678:5678 debug-mcp-server
```

In the MCP settings:
```json
"args": [
  "run",
  "-i",
  "--rm",
  "-p",
  "5678:5678",
  "debug-mcp-server"
]
```

## Dockerfile Details

The Dockerfile for the Debug MCP Server:

1. Uses Node.js 16 as the base image
2. Installs Python 3 and debugpy
3. Builds the TypeScript project
4. Sets necessary environment variables
5. Exposes port 5678 for debugpy

This ensures all dependencies needed for both Node.js execution and Python debugging are available in the container.

## Troubleshooting

### Common Docker Issues

1. **Permission issues**: 
   - On Unix-based systems, you might need to use `sudo` with Docker commands
   - Or add your user to the `docker` group: `sudo usermod -aG docker $USER`

2. **Port already in use**:
   - If port 5678 is already in use, you can map to a different port:
   ```
   docker run -i --rm -p 5679:5678 debug-mcp-server
   ```

3. **Container not terminating**:
   - Use `docker ps` to list running containers
   - Use `docker stop <container_id>` to stop a container

For more general troubleshooting, see [troubleshooting.md](./troubleshooting.md).
