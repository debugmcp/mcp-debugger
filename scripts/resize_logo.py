"""Resize logo for Cline Marketplace requirements."""
from PIL import Image
import os
import sys

def resize_logo(input_path="logo.png", output_path="assets/logo.png", size=(400, 400)):
    """
    Resize logo to marketplace requirements.
    
    Args:
        input_path: Path to source logo
        output_path: Path to save resized logo
        size: Target size tuple (width, height)
    """
    # Ensure output directory exists
    output_dir = os.path.dirname(output_path)
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir)
        print(f"Created directory: {output_dir}")
    
    # Open and resize the image
    try:
        img = Image.open(input_path)
        print(f"Original size: {img.size[0]}x{img.size[1]}px")
        
        # Use LANCZOS for high-quality downsampling
        resized = img.resize(size, Image.Resampling.LANCZOS)
        
        # Save with optimization
        resized.save(output_path, "PNG", optimize=True)
        
        # Verify the result
        saved_size = os.path.getsize(output_path) / 1024  # KB
        verify_img = Image.open(output_path)
        
        print(f"\nResize complete!")
        print(f"New size: {verify_img.size[0]}x{verify_img.size[1]}px")
        print(f"File size: {saved_size:.1f}KB")
        print(f"Saved to: {output_path}")
        
        return True
        
    except Exception as e:
        print(f"Error resizing logo: {e}")
        return False

if __name__ == "__main__":
    # Allow custom paths via command line
    input_path = sys.argv[1] if len(sys.argv) > 1 else "logo.png"
    output_path = sys.argv[2] if len(sys.argv) > 2 else "assets/logo.png"
    
    success = resize_logo(input_path, output_path)
    sys.exit(0 if success else 1)
