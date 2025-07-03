#!/usr/bin/env python3
"""
Demo runner that starts both MCP server and visualizer.

This script provides an easy way to run a complete demo by:
1. Starting the MCP debug server with proper logging
2. Launching the visualizer to display debug events
3. Handling graceful shutdown of both components
"""
import subprocess
import time
import sys
import os
import signal
import atexit
from pathlib import Path


# Track subprocesses for cleanup
server_proc = None
viz_proc = None


def cleanup():
    """Ensure processes are cleaned up."""
    global server_proc, viz_proc
    
    for proc in [viz_proc, server_proc]:
        if proc and proc.poll() is None:
            try:
                # Try graceful termination first
                proc.terminate()
                proc.wait(timeout=2)
            except subprocess.TimeoutExpired:
                # Force kill if needed
                proc.kill()
            except Exception:
                pass


# Register cleanup handlers
atexit.register(cleanup)
signal.signal(signal.SIGTERM, lambda *args: (cleanup(), sys.exit(0)))


def main():
    """Main demo runner function."""
    global server_proc, viz_proc
    
    # Paths
    project_root = Path(__file__).parent.parent.parent
    server_path = project_root / "dist" / "index.js"
    log_path = project_root / "logs" / "debug-mcp-server.log"
    visualizer_path = Path(__file__).parent / "live_visualizer.py"
    
    # Check if server is built
    if not server_path.exists():
        print("Error: MCP server not built!")
        print(f"Expected server at: {server_path}")
        print("\nPlease build the server first:")
        print("  npm run build")
        return 1
    
    # Clear the log file for a fresh start
    if log_path.exists():
        try:
            log_path.unlink()
            print(f"Cleared existing log file: {log_path}")
        except Exception as e:
            print(f"Warning: Could not clear log file: {e}")
    
    # Ensure log directory exists
    log_path.parent.mkdir(exist_ok=True)
    
    print("MCP Debugger Demo")
    print("=" * 60)
    print()
    
    # Start MCP server
    print("1. Starting MCP debug server...")
    print(f"   Server: {server_path}")
    print(f"   Log file: {log_path}")
    
    # Server command with enhanced logging
    server_cmd = [
        "node",
        str(server_path),
        "--log-level", "info",  # Use info level to capture structured logs
        "--log-file", str(log_path)
    ]
    
    try:
        # Start server with pipes to capture any errors
        server_proc = subprocess.Popen(
            server_cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1
        )
        
        # Give server time to start
        time.sleep(2)
        
        # Check if server is still running
        if server_proc.poll() is not None:
            # Server exited, show error
            stdout, stderr = server_proc.communicate()
            print("\nError: MCP server failed to start!")
            if stdout:
                print("STDOUT:", stdout)
            if stderr:
                print("STDERR:", stderr)
            return 1
            
        print("   ✓ Server started successfully")
        
    except Exception as e:
        print(f"\nError starting MCP server: {e}")
        return 1
    
    # Start visualizer
    print("\n2. Starting debug visualizer...")
    print(f"   Visualizer: {visualizer_path}")
    
    try:
        viz_proc = subprocess.Popen(
            [sys.executable, str(visualizer_path), str(log_path)],
            # Let visualizer control the terminal
            stdin=sys.stdin,
            stdout=sys.stdout,
            stderr=sys.stderr
        )
        
        print("\n3. Demo is running!")
        print("=" * 60)
        print()
        print("INSTRUCTIONS:")
        print("1. The visualizer is now running in this terminal")
        print("2. Open another terminal to interact with the MCP server")
        print("3. Use your MCP client to:")
        print("   - Create debug sessions")
        print("   - Set breakpoints")
        print("   - Start debugging")
        print("   - Step through code")
        print()
        print("Example MCP commands:")
        print("  - create_debug_session (language: python)")
        print("  - set_breakpoint (file: script.py, line: 10)")
        print("  - start_debugging (scriptPath: script.py)")
        print()
        print("Press Ctrl+C in this terminal to stop the demo")
        print("=" * 60)
        
        # Wait for visualizer to exit
        viz_proc.wait()
        
    except KeyboardInterrupt:
        print("\n\nDemo interrupted by user...")
    except Exception as e:
        print(f"\nError running visualizer: {e}")
        return 1
    finally:
        print("\nStopping demo...")
        cleanup()
        
    print("Demo stopped.")
    return 0


def print_usage():
    """Print usage information."""
    print("MCP Debugger Demo Runner")
    print()
    print("This script starts both the MCP debug server and the visualizer")
    print("to demonstrate real-time debugging visualization.")
    print()
    print("Prerequisites:")
    print("  1. Build the MCP server: npm run build")
    print("  2. Install Python dependencies: pip install -r requirements.txt")
    print()
    print("Usage:")
    print("  python demo_runner.py")
    print()
    print("Options:")
    print("  --help    Show this help message")


if __name__ == "__main__":
    # Check for help flag
    if len(sys.argv) > 1 and sys.argv[1] in ['--help', '-h', 'help']:
        print_usage()
        sys.exit(0)
        
    # Run the demo
    sys.exit(main())
