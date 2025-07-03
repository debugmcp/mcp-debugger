"""Analyze the logo image properties."""
from PIL import Image
import os

def analyze_logo(path):
    """Analyze logo properties for marketplace suitability."""
    if not os.path.exists(path):
        print(f"Error: Logo not found at {path}")
        return
    
    img = Image.open(path)
    
    print(f"Logo Analysis for: {path}")
    print(f"Size: {img.size[0]}x{img.size[1]}px")
    print(f"Mode: {img.mode}")
    print(f"Format: {img.format}")
    print(f"Has transparency: {img.mode in ['RGBA', 'LA']}")
    
    # Check file size
    file_size = os.path.getsize(path) / 1024  # KB
    print(f"File size: {file_size:.1f}KB")
    
    # Visual assessment notes
    print("\nSuitability for 400x400px resize:")
    if img.size[0] == img.size[1]:
        print("✓ Square aspect ratio - good for resizing")
    else:
        print("⚠ Non-square aspect ratio - may need cropping")
    
    if img.size[0] >= 800:
        print("✓ High resolution - should resize well")
    else:
        print("⚠ Low resolution - may lose quality")

if __name__ == "__main__":
    import sys
    path = sys.argv[1] if len(sys.argv) > 1 else "logo.png"
    analyze_logo(path)
