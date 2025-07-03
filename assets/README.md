# MCP Debugger Visual Assets

## Logo Versions

### Root Logo
- **File**: `../logo.png`
- **Dimensions**: 1024x1024px
- **Purpose**: GitHub repository display, high-resolution usage
- **File size**: ~1MB

### Marketplace Logo
- **File**: `logo.png`
- **Dimensions**: 400x400px
- **Purpose**: Cline Marketplace, documentation, smaller displays
- **Requirements**: Must work on light and dark backgrounds
- **File size**: ~89KB (optimized)

## Generating Marketplace Logo

To regenerate the 400x400 version from the root logo:

```bash
python scripts/resize_logo.py
```

For custom sizes or paths:

```bash
python scripts/resize_logo.py input.png output.png
```

## Logo Guidelines

### Design Requirements
- **Contrast**: Must have sufficient contrast for visibility at small sizes
- **Clarity**: Any text or symbols should remain legible at 400x400px
- **Background compatibility**: Should work on both light and dark backgrounds
- **Format**: PNG with optimization enabled

### Quality Validation
After generating or updating the logo, verify:
- [ ] Output dimensions are exactly 400x400px
- [ ] File size is under 500KB for marketplace compliance
- [ ] Visual quality is maintained (no pixelation or artifacts)
- [ ] Logo is clearly visible on both light and dark backgrounds
- [ ] Any text remains readable at the smaller size

## Screenshots

Location for demo screenshots showcasing the debugger in action.

### Screenshot Guidelines
- **Format**: PNG or JPG
- **Dimensions**: Recommended 1920x1080 or 1280x720
- **Content**: Show key features in action
- **Naming**: Use descriptive names (e.g., `breakpoint-hit.png`, `variable-inspection.png`)

### Planned Screenshots
- [ ] Setting breakpoints in VS Code
- [ ] Hitting a breakpoint during debugging
- [ ] Inspecting variables
- [ ] Step over/into/out navigation
- [ ] Stack trace visualization

## Demo GIF

Location for animated demonstrations.

### GIF Guidelines
- **Format**: GIF (optimized for size)
- **Duration**: 10-30 seconds
- **Content**: Key workflow demonstrations
- **Size**: Keep under 10MB for documentation usage

## Asset Management

### Version Control
- All assets should be tracked in Git
- Use meaningful commit messages when updating assets
- Consider using Git LFS for larger files if needed

### Optimization
- Use tools like `pngcrush` or `optipng` for PNG optimization
- Keep file sizes reasonable for web usage
- Test assets in their intended contexts

### Updates
When updating the logo:
1. Replace the high-res version at the root
2. Run the resize script to update the marketplace version
3. Verify both versions meet requirements
4. Commit with message like: "Update logo for v0.9.0 release"

## Tools & Scripts

### Available Scripts
- `scripts/analyze_logo.py` - Analyze logo properties and suitability
- `scripts/resize_logo.py` - Resize logo to marketplace requirements

### Recommended Tools
- **Pillow/PIL**: Python image processing (already in use)
- **ImageMagick**: Command-line image manipulation
- **pngcrush**: PNG optimization
- **GIMP/Photoshop**: Manual editing when needed

## Licensing

All visual assets in this directory are subject to the project's main LICENSE file.
