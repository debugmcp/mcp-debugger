#!/usr/bin/env python3
"""
Optimize screenshot file sizes for web delivery.

This script ONLY optimizes file sizes - it does not alter the content.
All screenshots remain 100% authentic captures of real debugging sessions.
"""
import sys
from pathlib import Path
from PIL import Image


def optimize_screenshots():
    """Optimize all screenshots for web delivery while maintaining quality."""
    # Get the screenshots directory
    project_root = Path(__file__).parent.parent.parent
    screenshot_dir = project_root / "assets" / "screenshots"
    
    if not screenshot_dir.exists():
        print(f"Error: Screenshot directory not found: {screenshot_dir}")
        print("Please ensure you've captured screenshots first.")
        return 1
    
    print("MCP Debugger Screenshot Optimizer")
    print("=" * 60)
    print(f"Directory: {screenshot_dir}")
    print()
    
    # Expected screenshots
    expected_files = [
        "debugging-session.png",
        "variable-inspection.png", 
        "mcp-integration.png",
        "multi-session.png"
    ]
    
    total_original_size = 0
    total_optimized_size = 0
    
    for filename in expected_files:
        img_path = screenshot_dir / filename
        
        if not img_path.exists():
            print(f"⚠️  Missing: {filename}")
            continue
            
        print(f"Processing {filename}...")
        
        try:
            # Open and get original size
            img = Image.open(img_path)
            original_size = img_path.stat().st_size / 1024  # KB
            total_original_size += original_size
            
            # Get dimensions
            width, height = img.size
            print(f"  Dimensions: {width}x{height}")
            print(f"  Original size: {original_size:.1f} KB")
            
            # Optimize PNG
            img.save(
                img_path,
                "PNG",
                optimize=True,
                compress_level=9
            )
            
            # Get new size
            new_size = img_path.stat().st_size / 1024  # KB
            total_optimized_size += new_size
            reduction = (1 - new_size/original_size) * 100
            
            print(f"  Optimized size: {new_size:.1f} KB ({reduction:.1f}% reduction)")
            
            # Also create WebP version for modern browsers
            webp_path = img_path.with_suffix('.webp')
            img.save(webp_path, "WEBP", quality=90, method=6)
            webp_size = webp_path.stat().st_size / 1024
            print(f"  WebP version: {webp_size:.1f} KB")
            print()
            
        except Exception as e:
            print(f"  Error: {e}")
            print()
    
    # Summary
    print("=" * 60)
    print("Summary:")
    print(f"Total original size: {total_original_size:.1f} KB")
    print(f"Total optimized size: {total_optimized_size:.1f} KB")
    if total_original_size > 0:
        total_reduction = (1 - total_optimized_size/total_original_size) * 100
        print(f"Total reduction: {total_reduction:.1f}%")
    
    return 0


def verify_authenticity():
    """Remind users about authenticity requirements."""
    print()
    print("IMPORTANT: Screenshot Authenticity")
    print("-" * 60)
    print("✓ These optimizations ONLY reduce file size")
    print("✓ Image content remains 100% authentic")
    print("✓ No staging, mocking, or fake data allowed")
    print("✓ All screenshots must be from real debugging sessions")
    print()


if __name__ == "__main__":
    verify_authenticity()
    sys.exit(optimize_screenshots())
