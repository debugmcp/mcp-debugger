# NPM and PyPI Publishing Issues Summary

Date: 2025-07-15

## Current Status

### ✅ Docker Hub
- Successfully publishing to `debugmcp/mcp-debugger`
- Images available with tags: `latest`, `0.10`, `0.10.1-beta`

### ❌ npm Publishing
**Issue**: Package name `mcp-debugger` is already taken
- Owner: `stacyh2` 
- Published: 3 months ago (completely different project for API debugging)
- Error: "You do not have permission to publish 'mcp-debugger'"

### ❌ PyPI Publishing  
**Issue**: Token scope mismatch
- Package name in `pyproject.toml`: `debug-mcp-server-launcher`
- Error: "project-scoped token is not valid for project: 'debug-mcp-server-launcher'"
- This means the PYPI_TOKEN is scoped to a different project name

## Solutions

### For npm

#### Option 1: Use Scoped Package (Recommended)
```json
{
  "name": "@debugmcp/mcp-debugger"
}
```
- Requires creating npm organization "debugmcp"
- Install command: `npm install -g @debugmcp/mcp-debugger`
- Maintains brand consistency with GitHub org

#### Option 2: Alternative Package Names
- `debugmcp-server`
- `mcp-debugger-server`
- `mcp-debug-server`
- `debug-mcp`

### For PyPI

#### Option 1: Update pyproject.toml to Match Token Scope
Find out which project name the token is scoped to and update:
```toml
name = "actual-project-name-from-token"
```

#### Option 2: Create New PyPI Token
1. Go to PyPI account settings
2. Create a new API token
3. Either:
   - Create a project-scoped token for `debug-mcp-server-launcher`
   - Create an account-scoped token (can publish any project)
4. Update PYPI_TOKEN in GitHub secrets

## Immediate Actions Required

### 1. Fix npm Publishing
Update `package.json`:
```json
{
  "name": "@debugmcp/mcp-debugger",
  // ... rest of config
}
```

### 2. Fix PyPI Publishing
Either:
- Check PyPI account to see which project the current token is scoped to
- OR create a new token for `debug-mcp-server-launcher`

### 3. Update Documentation
After choosing new names, update:
- README.md installation instructions
- Release workflow GitHub release body
- Any other documentation referencing package names

## Alternative: Skip npm/PyPI for Now
If you want to get something working quickly:
1. Focus on Docker Hub (already working!)
2. Users can install via:
   - Docker: `docker pull debugmcp/mcp-debugger`
   - Direct from GitHub: `npm install github:debugmcp/mcp-debugger`
3. Fix npm/PyPI publishing later with proper names/tokens
