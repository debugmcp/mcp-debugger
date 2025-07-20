"""Core launcher logic for debug-mcp-server."""

import os
import sys
import subprocess
import signal
import time
from typing import Optional, List, Tuple, Dict
import shutil

class DebugMCPLauncher:
    """Handles the actual launching of debug-mcp-server."""
    
    NPM_PACKAGE = "@debugmcp/mcp-debugger"
    DOCKER_IMAGE = "debugmcp/mcp-debugger:latest"
    DEFAULT_SSE_PORT = 3001
    
    def __init__(self, verbose: bool = False):
        self.verbose = verbose
        self.process: Optional[subprocess.Popen] = None
        
    def log(self, message: str, error: bool = False):
        """Log a message if verbose mode is enabled."""
        if self.verbose or error:
            prefix = "ERROR: " if error else ""
            print(f"{prefix}{message}", file=sys.stderr if error else sys.stdout)
    
    def launch_with_npx(self, mode: str = "stdio", port: Optional[int] = None) -> int:
        """Launch the server using npx."""
        cmd = ["npx", self.NPM_PACKAGE, mode]
        
        if mode == "sse" and port:
            cmd.extend(["--port", str(port)])
            
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
        except subprocess.CalledProcessError as e:
            self.log(f"Process failed with error: {e}", error=True)
            return e.returncode
        except KeyboardInterrupt:
            self.log("\nShutting down...")
            return 0
        finally:
            self._cleanup()
    
    def launch_with_docker(self, mode: str = "stdio", port: Optional[int] = None) -> int:
        """Launch the server using Docker."""
        cmd = ["docker", "run", "-it", "--rm"]
        
        if mode == "sse":
            actual_port = port or self.DEFAULT_SSE_PORT
            cmd.extend(["-p", f"{actual_port}:{actual_port}"])
            
        cmd.extend([self.DOCKER_IMAGE, mode])
        
        if mode == "sse" and port:
            cmd.extend(["--port", str(port)])
            
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
