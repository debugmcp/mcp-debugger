"""
Debugpy Server Fixture

This module provides a proper debugpy server implementation for testing the MCP server.
It demonstrates the correct pattern where:
1. This script starts debugpy in listening mode
2. The MCP server connects to this debugpy instance as a DAP client
"""
import sys
import os
import time
import argparse

try:
    import debugpy
    print(f"Debugpy imported successfully (version: {debugpy.__version__})")
except ImportError as e:
    print(f"Failed to import debugpy: {e}")
    sys.exit(1)

# Default configuration
DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 5679  # Using a different port to avoid conflicts

def start_debugpy_server(host=DEFAULT_HOST, port=DEFAULT_PORT, wait_for_client=True):
    """
    Start a debugpy server in listening mode
    
    Args:
        host: Host to listen on
        port: Port to listen on
        wait_for_client: Whether to wait for a client to connect
        
    Returns:
        True if server started successfully, False otherwise
    """
    print(f"Starting debugpy server at {host}:{port}")
    
    try:
        # Start the debugpy server - this is the correct usage pattern
        debugpy.listen((host, port))
        print("Debugpy server is listening!")
        
        # Enable wait_for_client to pause until the MCP server connects
        if wait_for_client:
            print("Waiting for client to connect...")
            debugpy.wait_for_client()
            print("Client connected to debugpy server!")
        
        return True
    except Exception as e:
        print(f"Error starting debugpy server: {e}")
        return False

def fibonacci(n):
    """A simple Fibonacci function for debugging"""
    print(f"Calculating Fibonacci for n={n}")
    
    if n <= 0:
        return 0
    elif n == 1:
        return 1
    
    a, b = 0, 1
    for _ in range(1, n):
        a, b = b, a + b
    
    result = b
    print(f"Fibonacci({n}) = {result}")
    return result

def run_fibonacci_test():
    """Run a simple fibonacci test with a breakpoint"""
    # Set a breakpoint programmatically
    debugpy.breakpoint()
    print("Hit breakpoint")
    
    # Run some simple code that can be debugged
    fibonacci(10)
    
    print("Script execution completed")
    return True

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Debugpy server for testing")
    parser.add_argument("--host", default=DEFAULT_HOST, help="Host to listen on")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help="Port to listen on")
    parser.add_argument("--no-wait", action="store_true", help="Don't wait for client connection")
    parser.add_argument("--run-test", action="store_true", help="Run the fibonacci test")
    
    args = parser.parse_args()
    
    success = start_debugpy_server(args.host, args.port, not args.no_wait)
    if not success:
        sys.exit(1)
    
    if args.run_test:
        run_fibonacci_test()
    else:
        # Keep the script running indefinitely
        print("Running in server mode. Press Ctrl+C to exit...")
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            print("Server stopped.")
    
    # Keep the script running for a bit to allow time for debugging
    print("Waiting before exit...")
    time.sleep(5)
    print("Exiting")
