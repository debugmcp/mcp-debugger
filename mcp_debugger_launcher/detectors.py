"""Runtime detection utilities for debug-mcp-server launcher."""

import subprocess
import shutil
import os
from typing import Tuple, Optional

class RuntimeDetector:
    """Detects available runtimes for running debug-mcp-server."""
    
    @staticmethod
    def check_nodejs() -> Tuple[bool, Optional[str]]:
        """Check if Node.js is installed and get version."""
        node_path = shutil.which("node")
        if not node_path:
            return False, None
            
        try:
            result = subprocess.run(
                ["node", "--version"],
                capture_output=True,
                text=True,
                timeout=5
            )
            if result.returncode == 0:
                version = result.stdout.strip()
                return True, version
        except (subprocess.TimeoutExpired, Exception):
            pass
            
        return False, None
    
    @staticmethod
    def check_npx() -> bool:
        """Check if npx is available."""
        return shutil.which("npx") is not None
    
    @staticmethod
    def check_npm_package(package_name: str) -> bool:
        """Check if an npm package is accessible via npx."""
        try:
            # Try to run the package with --version to check if it's accessible
            result = subprocess.run(
                ["npx", "--no-install", package_name, "--version"],
                capture_output=True,
                text=True,
                timeout=10
            )
            return result.returncode == 0
        except (subprocess.TimeoutExpired, Exception):
            return False
    
    @staticmethod
    def check_docker() -> Tuple[bool, Optional[str]]:
        """Check if Docker is installed and running."""
        docker_path = shutil.which("docker")
        if not docker_path:
            return False, None
            
        try:
            # Check Docker version
            result = subprocess.run(
                ["docker", "--version"],
                capture_output=True,
                text=True,
                timeout=5
            )
            if result.returncode != 0:
                return False, None
                
            version = result.stdout.strip()
            
            # Check if Docker daemon is running
            ping_result = subprocess.run(
                ["docker", "ping"],
                capture_output=True,
                text=True,
                timeout=5
            )
            
            # If ping doesn't work, try listing containers
            if ping_result.returncode != 0:
                list_result = subprocess.run(
                    ["docker", "ps"],
                    capture_output=True,
                    text=True,
                    timeout=5
                )
                if list_result.returncode != 0:
                    return True, f"{version} (daemon not running)"
                    
            return True, version
            
        except (subprocess.TimeoutExpired, Exception):
            return False, None
    
    @staticmethod
    def check_docker_image(image_name: str) -> bool:
        """Check if a Docker image exists locally."""
        try:
            result = subprocess.run(
                ["docker", "images", "-q", image_name],
                capture_output=True,
                text=True,
                timeout=5
            )
            return bool(result.stdout.strip())
        except (subprocess.TimeoutExpired, Exception):
            return False
    
    @staticmethod
    def detect_available_runtimes() -> dict:
        """Detect all available runtimes and return a summary."""
        runtimes = {
            "nodejs": {
                "available": False,
                "version": None,
                "npx_available": False,
                "package_accessible": False
            },
            "docker": {
                "available": False,
                "version": None,
                "image_exists": False
            }
        }
        
        # Check Node.js
        node_available, node_version = RuntimeDetector.check_nodejs()
        runtimes["nodejs"]["available"] = node_available
        runtimes["nodejs"]["version"] = node_version
        
        if node_available:
            runtimes["nodejs"]["npx_available"] = RuntimeDetector.check_npx()
            if runtimes["nodejs"]["npx_available"]:
                runtimes["nodejs"]["package_accessible"] = RuntimeDetector.check_npm_package(
                    "@debugmcp/mcp-debugger"
                )
        
        # Check Docker
        docker_available, docker_version = RuntimeDetector.check_docker()
        runtimes["docker"]["available"] = docker_available
        runtimes["docker"]["version"] = docker_version
        
        if docker_available and "daemon not running" not in (docker_version or ""):
            runtimes["docker"]["image_exists"] = RuntimeDetector.check_docker_image(
                "debugmcp/mcp-debugger:latest"
            )
        
        return runtimes
    
    @staticmethod
    def get_recommended_runtime(runtimes: dict) -> Optional[str]:
        """Get the recommended runtime based on availability."""
        # Prefer npx if everything is available
        if (runtimes["nodejs"]["available"] and 
            runtimes["nodejs"]["npx_available"]):
            return "npx"
            
        # Docker as fallback
        if (runtimes["docker"]["available"] and 
            "daemon not running" not in (runtimes["docker"]["version"] or "")):
            return "docker"
            
        return None
