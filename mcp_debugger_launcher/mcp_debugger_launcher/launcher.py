"""Core launcher logic for debug-mcp-server."""

import os
import sys
import subprocess
import signal
import time
from typing import Optional, List, Tuple, Dict, Mapping, Sequence
import shutil

class DebugMCPLauncher:
    """Handles the actual launching of debug-mcp-server."""
    
    NPM_PACKAGE = "@debugmcp/mcp-debugger"
    DOCKER_IMAGE = "debugmcp/mcp-debugger:latest"
    DEFAULT_SSE_PORT = 3001  # shared by http and (deprecated) sse modes
    PORTED_MODES = ("http", "sse")
    # Docker mode publishes the port on loopback unless told otherwise (issue
    # #676): the server's Host allowlist stops browsers (DNS rebinding), not a
    # direct client that sends `Host: localhost` by hand, so publishing on
    # every interface was real exposure.
    DEFAULT_BIND = "127.0.0.1"
    # The one server environment variable that must cross the container
    # boundary explicitly; the npx child simply inherits the environment.
    ALLOWED_HOSTS_ENV = "MCP_HTTP_ALLOWED_HOSTS"

    def __init__(self, verbose: bool = False):
        self.verbose = verbose
        self.process: Optional[subprocess.Popen] = None
        
    def log(self, message: str, error: bool = False):
        """Log a message if verbose mode is enabled."""
        if self.verbose or error:
            prefix = "ERROR: " if error else ""
            print(f"{prefix}{message}", file=sys.stderr if error else sys.stdout)
    
    def build_npx_command(self, mode: str = "stdio", port: Optional[int] = None,
                          extra_args: Sequence[str] = ()) -> List[str]:
        """Build the npx launch command.

        Single source of truth for both the real launch and --dry-run (issue
        #345). Deliberate asymmetry with Docker: --port is only forwarded when
        the caller supplied one, because the npx-run server applies its own
        default; Docker must always pin --port to match its -p mapping.

        `extra_args` are server flags the launcher does not know about
        (`--allowed-host`, `--log-level`, ...), forwarded verbatim after
        everything the launcher composes itself (issue #676), so a new server
        flag never needs a launcher release.
        """
        cmd = ["npx", self.NPM_PACKAGE, mode]
        if mode in self.PORTED_MODES and port:
            cmd.extend(["--port", str(port)])
        cmd.extend(extra_args)
        return cmd

    def build_docker_command(self, mode: str = "stdio", port: Optional[int] = None,
                             workspace_dir: Optional[str] = None,
                             extra_args: Sequence[str] = (),
                             bind: Optional[str] = None,
                             env: Optional[Mapping[str, str]] = None) -> List[str]:
        """Build the docker run command.

        Single source of truth for both the real launch and --dry-run (issue
        #345). `env` is the launcher's own environment (defaults to
        os.environ); `bind` is the host address the port is published on.
        """
        # -i (not -it): stdio transport runs against pipes, and allocating a
        # TTY against a non-TTY stdin fails ("the input device is not a TTY");
        # -i + --rm is also the pairing that lets the container exit and clean
        # up when the client disconnects (issue #633). The workspace mount is
        # what makes the caller's files debuggable inside the container.
        workspace = workspace_dir or os.getcwd()
        environment = os.environ if env is None else env
        cmd = ["docker", "run", "-i", "--rm", "-v", f"{workspace}:/workspace"]
        if mode in self.PORTED_MODES:
            actual_port = port or self.DEFAULT_SSE_PORT
            cmd.extend(["-p", f"{bind or self.DEFAULT_BIND}:{actual_port}:{actual_port}"])
            # The container does not inherit the launcher's environment, so
            # the allowlist the operator exported would silently stop at the
            # boundary (issue #676). Forward it as an explicit VAR=value so
            # --dry-run shows exactly what the server will see.
            allowed_hosts = environment.get(self.ALLOWED_HOSTS_ENV)
            if allowed_hosts:
                cmd.extend(["-e", f"{self.ALLOWED_HOSTS_ENV}={allowed_hosts}"])
        cmd.extend([self.DOCKER_IMAGE, mode])
        if mode in self.PORTED_MODES:
            # Always forward the port the -p mapping was built with, so the
            # in-container server listens on the mapped port even when the
            # caller relied on DEFAULT_SSE_PORT.
            cmd.extend(["--port", str(actual_port)])
        cmd.extend(extra_args)
        return cmd

    def launch_with_npx(self, mode: str = "stdio", port: Optional[int] = None,
                        extra_args: Sequence[str] = ()) -> int:
        """Launch the server using npx."""
        cmd = self.build_npx_command(mode, port, extra_args)

        self.log(f"Launching with command: {' '.join(cmd)}")
        
        try:
            # Set up signal handling for graceful shutdown
            signal.signal(signal.SIGINT, self._signal_handler)
            signal.signal(signal.SIGTERM, self._signal_handler)
            
            # Start the process
            self.process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
                universal_newlines=True
            )
            
            # Stream output in real-time
            if self.process.stdout:
                for line in self.process.stdout:
                    print(line, end='')
                
            # Wait for process to complete
            return_code = self.process.wait()
            return return_code
            
        except FileNotFoundError:
            self.log("npx command not found. Node.js may not be installed.", error=True)
            return 1
        except KeyboardInterrupt:
            self.log("\nShutting down...")
            return 0
        finally:
            self._cleanup()

    def launch_with_docker(self, mode: str = "stdio", port: Optional[int] = None,
                           extra_args: Sequence[str] = (), bind: Optional[str] = None) -> int:
        """Launch the server using Docker."""
        cmd = self.build_docker_command(mode, port, extra_args=extra_args, bind=bind)

        self.log(f"Launching with command: {' '.join(cmd)}")
        
        try:
            # Set up signal handling
            signal.signal(signal.SIGINT, self._signal_handler)
            signal.signal(signal.SIGTERM, self._signal_handler)
            
            # Check if image exists locally
            check_cmd = ["docker", "images", "-q", self.DOCKER_IMAGE]
            result = subprocess.run(check_cmd, capture_output=True, text=True)
            
            if not result.stdout.strip():
                print(f"Docker image '{self.DOCKER_IMAGE}' not found locally.")
                print("Pulling image... This may take a few minutes on first run.")
                pull_cmd = ["docker", "pull", self.DOCKER_IMAGE]
                subprocess.run(pull_cmd, check=True)
                print("Image pulled successfully!\n")
            
            # Start the container
            self.process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
                universal_newlines=True
            )
            
            # Stream output
            if self.process.stdout:
                for line in self.process.stdout:
                    print(line, end='')
                
            return_code = self.process.wait()
            return return_code
            
        except FileNotFoundError:
            self.log("Docker command not found. Docker may not be installed.", error=True)
            return 1
        except subprocess.CalledProcessError as e:
            self.log(f"Docker command failed: {e}", error=True)
            return e.returncode
        except KeyboardInterrupt:
            self.log("\nShutting down...")
            return 0
        finally:
            self._cleanup()
    
    def _signal_handler(self, signum, frame):
        """Handle shutdown signals gracefully."""
        if self.process:
            self.process.terminate()
            try:
                self.process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.process.kill()
    
    def _cleanup(self):
        """Clean up resources."""
        if self.process:
            if self.process.poll() is None:
                self.process.terminate()
                try:
                    self.process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    self.process.kill()
            self.process = None
