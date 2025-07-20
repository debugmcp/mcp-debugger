"""Enhanced CLI for debug-mcp-server launcher."""

import sys
import os
import click
from typing import Optional

# Handle both package and direct execution
try:
    from .launcher import DebugMCPLauncher
    from .detectors import RuntimeDetector
except ImportError:
    from launcher import DebugMCPLauncher
    from detectors import RuntimeDetector

# Package version - should match pyproject.toml
__version__ = "0.11.1"

def print_runtime_status(runtimes: dict, verbose: bool = False):
    """Print the status of available runtimes."""
    print("\n🔍 Checking available runtimes...\n")
    
    # Node.js status
    if runtimes["nodejs"]["available"]:
        print(f"✅ Node.js: {runtimes['nodejs']['version']}")
        if verbose:
            if runtimes["nodejs"]["npx_available"]:
                print("   └─ npx: Available")
                if runtimes["nodejs"]["package_accessible"]:
                    print("   └─ @debugmcp/mcp-debugger: Accessible")
                else:
                    print("   └─ @debugmcp/mcp-debugger: Not installed (will download on first run)")
            else:
                print("   └─ npx: Not found")
    else:
        print("❌ Node.js: Not found")
    
    # Docker status
    if runtimes["docker"]["available"]:
        print(f"✅ Docker: {runtimes['docker']['version']}")
        if verbose:
            if "daemon not running" in runtimes["docker"]["version"]:
                print("   └─ Docker daemon is not running")
            elif runtimes["docker"]["image_exists"]:
                print("   └─ debugmcp/mcp-debugger:latest: Found locally")
            else:
                print("   └─ debugmcp/mcp-debugger:latest: Not found (will pull on first run)")
    else:
        print("❌ Docker: Not found")
    
    print()

def print_installation_help():
    """Print helpful installation instructions."""
    print("\n📋 Installation Instructions:\n")
    print("To use the npm version (recommended):")
    print("  • Install Node.js from https://nodejs.org")
    print("  • The launcher will handle the rest!\n")
    print("To use the Docker version:")
    print("  • Install Docker from https://docker.com")
    print("  • Start Docker Desktop")
    print("  • The launcher will pull the image automatically\n")

def check_debugpy():
    """Check if debugpy is installed (backward compatibility)."""
    try:
        import debugpy
        return True, debugpy.__version__
    except ImportError:
        return False, None
    except AttributeError:
        return True, "unknown"

@click.command(context_settings=dict(help_option_names=['-h', '--help']))
@click.argument('mode', default='stdio', type=click.Choice(['stdio', 'sse']))
@click.option('--port', '-p', type=int, help='Port for SSE mode (default: 3001)')
@click.option('--docker', is_flag=True, help='Force Docker mode')
@click.option('--npm', is_flag=True, help='Force npm/npx mode')
@click.option('--dry-run', is_flag=True, help='Show what command would be executed')
@click.option('--verbose', '-v', is_flag=True, help='Enable verbose output')
@click.version_option(__version__, '--version', '-V', prog_name='debug-mcp-server')
def main(mode: str, port: Optional[int], docker: bool, npm: bool, 
         dry_run: bool, verbose: bool):
    """
    Launch the debug-mcp-server in either stdio or sse mode.
    
    \b
    Examples:
      debug-mcp-server              # Launch in stdio mode (default)
      debug-mcp-server sse          # Launch in SSE mode
      debug-mcp-server sse -p 8080  # SSE mode with custom port
      debug-mcp-server --docker     # Force Docker mode
      debug-mcp-server --npm        # Force npm mode
    """
    
    # Check debugpy for backward compatibility
    debugpy_available, debugpy_version = check_debugpy()
    if not debugpy_available:
        print("⚠️  Warning: debugpy is not installed. It's required for Python debugging.", file=sys.stderr)
        print("   Install it with: pip install debugpy", file=sys.stderr)
        print()
    elif verbose:
        print(f"✅ debugpy {debugpy_version} is installed")
    
    # Check for conflicting options
    if docker and npm:
        print("❌ Error: Cannot specify both --docker and --npm", file=sys.stderr)
        return 1
    
    # Detect available runtimes
    print("🚀 debug-mcp-server Launcher")
    print("=" * 40)
    
    runtimes = RuntimeDetector.detect_available_runtimes()
    
    # Determine which runtime to use
    runtime = None
    if docker:
        if not runtimes["docker"]["available"]:
            print("\n❌ Error: Docker is not installed or not available", file=sys.stderr)
            print_installation_help()
            return 1
        if "daemon not running" in (runtimes["docker"]["version"] or ""):
            print("\n❌ Error: Docker daemon is not running", file=sys.stderr)
            print("   Please start Docker Desktop and try again.", file=sys.stderr)
            return 1
        runtime = "docker"
    elif npm:
        if not runtimes["nodejs"]["available"]:
            print("\n❌ Error: Node.js is not installed", file=sys.stderr)
            print_installation_help()
            return 1
        if not runtimes["nodejs"]["npx_available"]:
            print("\n❌ Error: npx is not available", file=sys.stderr)
            print("   This usually comes with Node.js. Try reinstalling Node.js.", file=sys.stderr)
            return 1
        runtime = "npx"
    else:
        # Auto-detect
        if verbose:
            print_runtime_status(runtimes, verbose=True)
        
        runtime = RuntimeDetector.get_recommended_runtime(runtimes)
        
        if not runtime:
            print("\n❌ No suitable runtime found!", file=sys.stderr)
            print_runtime_status(runtimes, verbose=False)
            print_installation_help()
            return 1
    
    # Display what we're going to do
    print(f"\n🎯 Mode: {mode.upper()}")
    if mode == "sse":
        actual_port = port or DebugMCPLauncher.DEFAULT_SSE_PORT
        print(f"🔌 Port: {actual_port}")
    print(f"🏃 Runtime: {runtime.upper()}")
    
    # Create launcher
    launcher = DebugMCPLauncher(verbose=verbose)
    
    # Prepare the command
    if runtime == "npx":
        if dry_run:
            cmd = ["npx", launcher.NPM_PACKAGE, mode]
            if mode == "sse" and port:
                cmd.extend(["--port", str(port)])
            print(f"\n🔍 Would execute: {' '.join(cmd)}")
            return 0
        
        # Check if we need to provide installation instructions
        if not runtimes["nodejs"]["package_accessible"]:
            print("\n📦 Package not installed locally. npx will download it automatically.")
            print("   This may take a moment on first run...\n")
        
        print("\n" + "─" * 40)
        print("Starting debug-mcp-server...")
        print("─" * 40 + "\n")
        
        return launcher.launch_with_npx(mode, port)
        
    elif runtime == "docker":
        if dry_run:
            cmd = ["docker", "run", "-it", "--rm"]
            if mode == "sse":
                actual_port = port or launcher.DEFAULT_SSE_PORT
                cmd.extend(["-p", f"{actual_port}:{actual_port}"])
            cmd.extend([launcher.DOCKER_IMAGE, mode])
            if mode == "sse" and port:
                cmd.extend(["--port", str(port)])
            print(f"\n🔍 Would execute: {' '.join(cmd)}")
            return 0
        
        print("\n" + "─" * 40)
        print("Starting debug-mcp-server...")
        print("─" * 40 + "\n")
        
        return launcher.launch_with_docker(mode, port)
    
    return 0

if __name__ == "__main__":
    sys.exit(main())
