#!/usr/bin/env python3
"""
Prepares environment for recording a clean demo
"""
import os
import shutil
from pathlib import Path

def prepare_environment():
    """Clean logs and prepare for recording"""
    project_root = Path(__file__).parent.parent.parent
    log_file = project_root / "logs" / "debug-mcp-server.log"
    
    # Clear existing logs
    if log_file.exists():
        log_file.unlink()
        print(f"✓ Cleared log file: {log_file}")
    
    # Ensure log directory exists
    log_file.parent.mkdir(exist_ok=True)
    
    # Clear any position tracking files
    position_file = Path('.visualizer_position')
    if position_file.exists():
        position_file.unlink()
        
    print("✓ Environment prepared for recording")
    print("\nNext steps:")
    print("1. Run: python demo_runner.py")
    print("2. In another terminal, start your recording tool")
    print("3. In a third terminal, use MCP client to execute debugging commands")
    print("\nTip: Do a quick test recording first to verify your setup!")

if __name__ == "__main__":
    prepare_environment()
