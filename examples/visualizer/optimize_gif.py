#!/usr/bin/env python3
"""
Optimize GIF size while maintaining quality
"""
import subprocess
from pathlib import Path

def optimize_gif():
    """Optimize the demo GIF"""
    
    if not subprocess.run(['which', 'gifsicle'], capture_output=True).returncode == 0:
        print("Error: gifsicle not installed")
        print("Install with:")
        print("  macOS:  brew install gifsicle")
        print("  Linux:  sudo apt-get install gifsicle")
        print("  Windows: Download from https://www.lcdf.org/gifsicle/")
        return
        
    input_gif = Path(__file__).parent.parent.parent / "assets" / "demo.gif"
    
    if not input_gif.exists():
        print(f"Error: {input_gif} not found")
        print("Make sure you've run convert_to_gif.py first")
        return
        
    # Create backup
    backup = input_gif.with_suffix('.original.gif')
    subprocess.run(['cp', str(input_gif), str(backup)])
    print(f"Created backup: {backup}")
    
    # Try different optimization levels
    print("\nTrying optimization levels...")
    
    # Level 1: Basic optimization
    print("\n1. Basic optimization (--optimize=3)...")
    subprocess.run([
        'gifsicle',
        '--batch',
        '--optimize=3',
        str(input_gif)
    ])
    
    size1 = input_gif.stat().st_size / (1024 * 1024)
    print(f"   Size: {size1:.2f} MB")
    
    if size1 < 10:
        print("   ✓ Under 10MB with basic optimization!")
        cleanup_backup(backup, input_gif)
        return
    
    # Level 2: Reduce colors
    print("\n2. Reducing colors (128 colors)...")
    subprocess.run(['cp', str(backup), str(input_gif)])  # Restore original
    subprocess.run([
        'gifsicle',
        '--batch',
        '--optimize=3',
        '--colors', '128',
        str(input_gif)
    ])
    
    size2 = input_gif.stat().st_size / (1024 * 1024)
    print(f"   Size: {size2:.2f} MB")
    
    if size2 < 10:
        print("   ✓ Under 10MB with reduced colors!")
        cleanup_backup(backup, input_gif)
        return
    
    # Level 3: Add lossy compression
    print("\n3. Adding lossy compression...")
    subprocess.run(['cp', str(backup), str(input_gif)])  # Restore original
    subprocess.run([
        'gifsicle',
        '--batch',
        '--optimize=3',
        '--colors', '128',
        '--lossy=30',
        str(input_gif)
    ])
    
    size3 = input_gif.stat().st_size / (1024 * 1024)
    print(f"   Size: {size3:.2f} MB")
    
    if size3 < 10:
        print("   ✓ Under 10MB with lossy compression!")
    else:
        print("\n4. Maximum compression...")
        subprocess.run(['cp', str(backup), str(input_gif)])  # Restore original
        subprocess.run([
            'gifsicle',
            '--batch',
            '--optimize=3',
            '--colors', '64',
            '--lossy=50',
            '--scale', '0.9',  # Slightly reduce dimensions
            str(input_gif)
        ])
        
        size4 = input_gif.stat().st_size / (1024 * 1024)
        print(f"   Size: {size4:.2f} MB")
    
    cleanup_backup(backup, input_gif)

def cleanup_backup(backup, optimized):
    """Compare and optionally remove backup"""
    original_size = backup.stat().st_size / (1024 * 1024)
    new_size = optimized.stat().st_size / (1024 * 1024)
    
    print(f"\nOptimization complete!")
    print(f"Original: {original_size:.2f} MB")
    print(f"Optimized: {new_size:.2f} MB")
    print(f"Saved: {original_size - new_size:.2f} MB ({(1 - new_size/original_size)*100:.0f}%)")
    
    response = input("\nKeep backup file? (y/n): ")
    if response.lower() != 'y':
        backup.unlink()
        print("Backup removed")

if __name__ == "__main__":
    optimize_gif()
