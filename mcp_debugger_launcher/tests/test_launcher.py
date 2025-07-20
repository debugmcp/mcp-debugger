#!/usr/bin/env python3
"""Test script for debug-mcp-server launcher."""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from detectors import RuntimeDetector
from launcher import DebugMCPLauncher

def test_runtime_detection():
    """Test runtime detection functionality."""
    print("Testing Runtime Detection")
    print("=" * 50)
    
    # Test individual checks
    print("\n1. Checking Node.js...")
    node_available, node_version = RuntimeDetector.check_nodejs()
    print(f"   Available: {node_available}")
    if node_version:
        print(f"   Version: {node_version}")
    
    print("\n2. Checking npx...")
    npx_available = RuntimeDetector.check_npx()
    print(f"   Available: {npx_available}")
    
    print("\n3. Checking Docker...")
    docker_available, docker_version = RuntimeDetector.check_docker()
    print(f"   Available: {docker_available}")
    if docker_version:
        print(f"   Version: {docker_version}")
    
    # Test full detection
    print("\n4. Full runtime detection...")
    runtimes = RuntimeDetector.detect_available_runtimes()
    print(f"   Node.js: {runtimes['nodejs']}")
    print(f"   Docker: {runtimes['docker']}")
    
    # Test recommendation
    recommended = RuntimeDetector.get_recommended_runtime(runtimes)
    print(f"\n5. Recommended runtime: {recommended}")
    
    return runtimes

def test_dry_run():
    """Test dry run functionality."""
    print("\n\nTesting Dry Run")
    print("=" * 50)
    
    launcher = DebugMCPLauncher(verbose=True)
    
    print("\n1. NPX command for stdio mode:")
    cmd = ["npx", launcher.NPM_PACKAGE, "stdio"]
    print(f"   {' '.join(cmd)}")
    
    print("\n2. NPX command for SSE mode with port:")
    cmd = ["npx", launcher.NPM_PACKAGE, "sse", "--port", "8080"]
    print(f"   {' '.join(cmd)}")
    
    print("\n3. Docker command for stdio mode:")
    cmd = ["docker", "run", "-it", "--rm", launcher.DOCKER_IMAGE, "stdio"]
    print(f"   {' '.join(cmd)}")
    
    print("\n4. Docker command for SSE mode with port:")
    cmd = ["docker", "run", "-it", "--rm", "-p", "8080:8080", launcher.DOCKER_IMAGE, "sse", "--port", "8080"]
    print(f"   {' '.join(cmd)}")

def test_cli_import():
    """Test that CLI module can be imported."""
    print("\n\nTesting CLI Import")
    print("=" * 50)
    
    try:
        import cli
        print(f"✅ CLI module imported successfully")
        print(f"   Version: {cli.__version__}")
        print(f"   Main function: {cli.main}")
        return True
    except Exception as e:
        print(f"❌ Failed to import CLI: {e}")
        return False

def main():
    """Run all tests."""
    print("Debug MCP Server Launcher Test Suite")
    print("*" * 50)
    
    # Run tests
    runtimes = test_runtime_detection()
    test_dry_run()
    cli_ok = test_cli_import()
    
    # Summary
    print("\n\nTest Summary")
    print("=" * 50)
    
    if runtimes["nodejs"]["available"] or runtimes["docker"]["available"]:
        print("✅ At least one runtime is available")
    else:
        print("❌ No runtimes available - launcher won't be able to start server")
    
    if cli_ok:
        print("✅ CLI module is working")
    else:
        print("❌ CLI module has issues")
    
    print("\nTo test the actual launcher, run:")
    print("  python -m mcp_debugger_launcher.cli --help")
    print("  python -m mcp_debugger_launcher.cli --dry-run")

if __name__ == "__main__":
    main()
