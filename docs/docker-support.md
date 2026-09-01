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

**When running the Debug MCP Server in a Docker container, you should mount your project files to `/workspace` inside the container.** This is the default and recommended mount point. The container sets `MCP_WORKSPACE_ROOT=/workspace` and `MCP_CONTAINER=true` by default. `MCP_CONTAINER=true` enables container-mode behaviors such as path rewriting and pre-loading of known adapters, while `MCP_WORKSPACE_ROOT` is used for path resolution. The *mount* is optional -- the image creates an empty `/workspace` so volume-less runs (e.g. `kubectl debug` ephemeral containers) still have a valid workspace directory -- but the variable is not: in container mode `getWorkspaceRoot()` (`src/utils/container-path-utils.ts`) **throws** when `MCP_WORKSPACE_ROOT` is unset, so path resolution has no fallback to hide the mistake. (A few adapters do keep their own `MCP_WORKSPACE_ROOT || '/workspace'` fallback for narrower jobs — source-map derivation in the rust and cpp adapters, the default `cwd` in the javascript adapter -- but that never rescues the path-resolution throw.) The image supplies it twice over (a Dockerfile `ENV`, plus `scripts/docker-entry.sh` re-applying `${MCP_WORKSPACE_ROOT:-/workspace}` at startup), so this only bites if you override the entrypoint or point the variable at a path that isn't mounted.

### Why /workspace?

The Debug MCP Server resolves paths through centralized container path utilities (`src/utils/container-path-utils.ts`). When running in a container (`MCP_CONTAINER=true`), the server performs centralized container path rewriting: `resolvePathForRuntime()` rewrites paths to be under the workspace root (`MCP_WORKSPACE_ROOT`, which the image sets to `/workspace`; required in container mode -- see above). Non-workspace absolute paths (e.g., `/home/user/test.py`) are rewritten to fall under the workspace root rather than being rejected. `SimpleFileChecker` then validates existence and returns the resolved `effectivePath`, which the server passes downstream to the debug adapter. This means:
- Your project files must be mounted at `/workspace`
- The LLM should provide paths relative to the project root or as Linux-style absolute paths under `/workspace`
- The server rewrites paths to the container workspace root; it does not perform Windows-to-Linux path conversion (e.g., `C:\Users\...` paths will not be correctly translated inside the container)
- Debug adapter handles its own path resolution natively after receiving the rewritten path

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
        "mcp-debugger:local",
        "stdio"
      ],
      "autoApprove": [
        "create_debug_session",
        "list_supported_languages",
        "list_debug_sessions",
        "set_breakpoint",
        "list_breakpoints",
        "remove_breakpoint",
        "clear_breakpoints",
        "start_debugging",
        "restart_debugging",
        "attach_to_process",
        "detach_from_process",
        "expose_session",
        "unexpose_session",
        "close_debug_session",
        "step_over",
        "step_into",
        "step_out",
        "continue_execution",
        "pause_execution",
        "list_threads",
        "get_variables",
        "get_local_variables",
        "get_stack_trace",
        "get_scopes",
        "evaluate_expression",
        "get_source_context",
        "get_output",
        "redefine_classes"
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
- The Docker entrypoint (`scripts/docker-entry.sh`) runs `dist/bundle.cjs` and passes through command-line arguments (e.g., `stdio`). It does not hardcode `--log-level` or `--log-file`
- When using the debugger, provide paths relative to the project root (e.g., `examples/python/fibonacci.py` not `/workspace/examples/python/fibonacci.py`)
- Optional env flags pass through with `-e`, e.g. `-e DEBUG_MCP_BP_ADDRESSING=line` restricts breakpoint addressing features (default: all enabled; see the set_breakpoint section of the tool reference), `-e DEBUG_MCP_NO_REDACT=1` to disable the default masking of credential-shaped values in variable/evaluate/output results, or `-e DEBUG_MCP_VARIABLE_ACCESS=explicit` to require explicit variable names on get_variables/get_local_variables (see the Secret redaction and Least-privilege mode sections of the tool reference)

## Native (Rust / C / C++) support in Docker

The image vendors CodeLLDB for the image's own architecture — `linux-x64` or `linux-arm64`, selected from `TARGETARCH` at build time; the published image is built for both (one shared copy under `@debugmcp/codelldb-common`, resolved via `CODELLDB_PATH`) — and ships `g++`, so Rust and C/C++ debugging work inside the container (issue #328):

- **C/C++ source-file launch**: pass a lone `.c`/`.cpp` as the program and the adapter compiles it in-container with `-gdwarf-4 -O0` into `.debug-mcp/` next to the source.
- **Prebuilt binaries**: must be **Linux-compiled for the image's architecture** (x86-64 for the amd64 image, aarch64 for the arm64 one). Binaries compiled on a Windows/macOS host and mounted into the container are not debuggable by container LLDB — that's a binary-format fact, not a packaging gap. Cross-compile for Linux or compile in-container.
- **Attach by PID**: works for native processes inside the container. Attaching to a non-descendant process needs `--cap-add=SYS_PTRACE` when the host kernel sets `kernel.yama.ptrace_scope >= 1` (Kubernetes `kubectl debug --profile=general` grants the equivalent — see the [Kubernetes debugging recipe](kubernetes.md)).
- Rust remains **launch-only** (the rust adapter has no attach implementation).
- **Rust type summaries work out of the box** (issue #441): the image vendors the Rust toolchain's LLDB formatter scripts at `/opt/rust-sysroot/lib/rustlib/etc` and sets `CODELLDB_RUST_SYSROOT=/opt/rust-sysroot`, which the rust adapter translates into CodeLLDB's `lang.rust.sysroot` setting — so `&str`/`String`/`Vec` values render as values without any `rustc` in the image. Override with `-e CODELLDB_RUST_SYSROOT=/path/to/sysroot` (a sysroot root whose `lib/rustlib/etc` holds the formatters), or disable with `-e CODELLDB_RUST_SYSROOT=` to fall back to CodeLLDB's normal `rustc --print sysroot` lookup. Caveat: the vendored formatters track the Rust version pinned in the Dockerfile; a debuggee built by a much newer/older rustc may render some std types imperfectly.

## Ruby attach in Docker (attach-only)

The image ships the Ruby adapter **without a Ruby runtime**. Launching Ruby scripts in the container is therefore unavailable, but **attach works**: Ruby attach is a direct TCP connection to a running `rdbg --open` DAP socket, so no local Ruby is needed. `list_supported_languages` reports this per-mode (`ruby.modes.launch.available: false`, `ruby.modes.attach.available: true`).

To attach from the container, the rdbg target's socket must be reachable from inside it — e.g. run both on one docker network and attach by container name, or add `--add-host=host.docker.internal:host-gateway` and attach to a port on the host. See `docs/ruby/README.md` (Remote attach) for the full flow, and the [Kubernetes debugging recipe](kubernetes.md) for the in-pod sidecar variant of the same idea.

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

### Container lifecycle environment variables

Two environment variables control when a containerized server gives up and exits. Both are
passed through with `-e`:

- **`MCP_EXIT_ON_STDIN_CLOSE=1`** (`src/cli/stdin-watchdog.ts`) -- opt-in orphan
  self-defense for the **network transports** (`http`, `sse`), which otherwise have no
  reason to care about stdin. When set to `1` or `true`, the server watches its stdin for
  `end`/`close`/`error` and shuts down gracefully when it sees one, with a 5s backstop that
  force-exits if shutdown stalls. Intended for a supervisor that spawns the server with a
  stdin pipe (`tools/dev-proxy` does exactly this) and needs a parent-death signal that also
  works on Windows. Strictly opt-in: without the variable, a detached server whose stdin is
  closed keeps running. **In a container it is only safe with a stdin pipe attached.** The
  network-transport watchdog has no container or client-traffic exemption (unlike the
  `stdio` command's), so `docker run -d -e MCP_EXIT_ON_STDIN_CLOSE=1 ... http` -- where stdin
  is `/dev/null` and reports EOF immediately -- shuts the server down at startup. Pass `-i`
  (or omit the variable) for detached network-mode containers. It is unrelated to the
  `stdio`-mode exit policy described under
  [Troubleshooting](#common-docker-issues), which is always on and needs no variable.
- **`MCP_HTTP_STALE_SESSION_MS`** (`src/cli/http-command.ts`) -- idle window before an HTTP
  MCP session with no open SSE stream is reaped, closing its debug sessions and releasing
  any ptrace claim on the target. Defaults to 30 minutes (1800000); `0` disables reaping;
  invalid values log a warning and fall back to the default. Read only by `http` mode
  (the legacy `sse` command has no reaper). A short-lived diagnostic container wants a
  much tighter window -- see the
  [Kubernetes debugging recipe](kubernetes.md), which sets it to 5 minutes.

## Dockerfile Details

The Dockerfile is multi-stage. Every base image is pinned by digest, so read the
`FROM` lines in the [Dockerfile](../Dockerfile) for the exact versions rather than
trusting a version quoted here:

1. **`builder`** (a `node:*-slim` base) installs pnpm via corepack, builds the workspace
   packages, vendors the CodeLLDB engine for the target architecture, and bundles the
   server into `/app/dist/bundle.cjs`
2. **`rust-formatters`** (a `rust:*-slim` base) exists only to copy the Rust toolchain's
   LLDB formatter scripts out of `$(rustc --print sysroot)/lib/rustlib/etc` (issue #441)
3. The **runtime stage** (an `ubuntu:*` base) installs the debug toolchains the image
   ships -- Python 3 plus a hash-pinned debugpy, LLDB and `python3-lldb`, `g++`, and a
   headless JDK 21 -- then copies in the Node binary, the bundle, the runtime adapter
   packages, and the vendored CodeLLDB from the earlier stages
4. It sets the environment the server reads at runtime: `MCP_CONTAINER=true`,
   `MCP_WORKSPACE_ROOT=/workspace`, `CODELLDB_PATH`, `CODELLDB_RUST_SYSROOT`, and
   `DEBUG_MCP_DISABLE_LANGUAGES=go,dotnet` (no Delve, no netcoredbg in the image)
5. `tini` is PID 1, in front of the `scripts/docker-entry.sh` wrapper; the default
   command is `stdio`
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
   - Non-workspace absolute paths like `/home/user/test.py` are rewritten under the workspace root (e.g., `/workspace/home/user/test.py`), which is unlikely to exist -- use relative paths or paths already under `/workspace` instead

3. **Permission issues**: 
   - On Unix-based systems, you might need to adjust file permissions
   - Consider using `:rw` suffix for read-write access
   - Check that the Docker daemon has access to the host directories

### Common Docker Issues

1. **Container not terminating** (and `--rm` never firing):
   - In stdio mode, stdin *is* the MCP transport, so an EOF on it means the client is
     gone. Since issue #633 the server acts on that: on stdin `end`/`close`/`error` it
     stops all debug sessions (bounded to 5s) and exits 0, which is what lets
     `docker run --rm` remove the container. `SIGTERM`/`SIGINT` take the same path, so
     `docker stop` is still a clean shutdown.
   - There is exactly one exemption, in `src/cli/stdio-command.ts`: if `MCP_CONTAINER=true`
     **and** not a single byte has ever arrived on stdin, EOF is ignored and the server
     stays alive. That covers `docker run` *without* `-i`, where stdin is already closed
     before any client can speak. Once any client traffic has been seen, that case is
     ruled out and EOF always means exit.
   - Host mode has no exemption -- EOF on stdin always shuts the server down.
   - **So always pass `-i`.** Without it the container has no way to notice the client
     leaving, runs forever, and every session leaks a container. If you find containers
     piling up, check the `docker run` arguments for a missing `-i` first, then use
     `docker ps` / `docker stop <container_id>` to clean up the strays.

2. **Port already in use**:
   - If port 5679 is already in use, you can map to a different port:
   ```
   docker run -i --rm -p 5680:5679 mcp-debugger:local
   ```

3. **Build failures**:
   - Ensure Docker daemon is running
   - Check available disk space
   - Try clearing Docker cache: `docker system prune`

For more general troubleshooting, see [troubleshooting.md](./troubleshooting.md).
