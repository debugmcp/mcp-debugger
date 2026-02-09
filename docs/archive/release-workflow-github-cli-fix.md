# Release Workflow GitHub CLI Fix

## Date: January 21, 2025

## Issue
The GitHub release creation step was failing with: `Error: Resource not accessible by integration`

This was caused by:
1. Using the deprecated `actions/create-release@v1` action
2. Missing permissions for the `GITHUB_TOKEN` to create releases

## Solution
Updated the release workflow to use GitHub CLI (`gh`) instead of the deprecated action.

### Changes Made

1. **Added permissions** to the `create-release` job:
   ```yaml
   permissions:
     contents: write  # Grant permission to create releases
   ```

2. **Replaced deprecated action** with GitHub CLI:
   - Removed: `actions/create-release@v1`
   - Added: GitHub CLI commands using `gh release create`

3. **Fixed PyPI package name** in release notes:
   - Changed from: `pip install mcp-debugger`
   - Changed to: `pip install debug-mcp-server-launcher`

### Benefits of GitHub CLI Approach

- **Native to GitHub**: Pre-installed on all GitHub Actions runners
- **No setup required**: Automatically authenticated with `GITHUB_TOKEN`
- **Actively maintained**: Unlike the deprecated create-release action
- **Better error handling**: Clear error messages
- **More flexible**: Full control over release creation options

### How It Works

1. Creates a `release_notes.md` file with the formatted release body
2. Detects if the version is a prerelease (contains `-beta` or `-alpha`)
3. Uses `gh release create` with appropriate flags
4. Automatically uses the `GITHUB_TOKEN` for authentication

This approach is more reliable and future-proof than using third-party or deprecated actions.
