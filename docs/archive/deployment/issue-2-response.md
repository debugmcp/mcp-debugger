# Response for Issue #2: npx Support

Hi @adrianlzt! 🎉

Great news - we've implemented npx support for mcp-debugger! Thank you for this feature request.

## What's been implemented:

### ✅ npx Support
You can now run the debugger without local installation:
```bash
npx @debugmcp/mcp-debugger
```

### 📦 Published to npm
Since `mcp-debugger` was already taken on npm (as you noted), we've published the package under the scoped name `@debugmcp/mcp-debugger`:
- npm: https://www.npmjs.com/package/@debugmcp/mcp-debugger
- Version: 0.10.1-beta (and future releases)

### 🔧 Fixed the dist/ issue
- Added a `prepare` script that automatically builds the project during npm install
- This ensures the dist/ folder is created when installing via npm/npx

## Installation Options

You now have multiple ways to use mcp-debugger:

**1. Using npx (no installation required):**
```bash
npx @debugmcp/mcp-debugger
```

**2. Global npm installation:**
```bash
npm install -g @debugmcp/mcp-debugger
mcp-debugger
```

**3. Docker (bonus!):**
```bash
docker pull debugmcp/mcp-debugger:latest
docker run -it debugmcp/mcp-debugger
```

**4. From GitHub directly:**
```bash
npm install -g github:debugmcp/mcp-debugger
```

## Additional Notes
- We've set up automated publishing via GitHub Actions for all releases
- The package includes proper bin configuration pointing to the built files
- All future releases will be available immediately via npx

Thanks again for the suggestion! This makes the debugger much more accessible to users who want to try it quickly without a full installation.

Closing this issue as completed. Feel free to reopen if you encounter any issues with the npx functionality!
