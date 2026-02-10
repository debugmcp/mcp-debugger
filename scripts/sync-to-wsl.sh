#!/bin/bash
#
# Sync MCP Debugger project from Windows to WSL2
# This script should be run from within WSL2
#
# Usage: ./scripts/sync-to-wsl.sh [--no-install] [--no-build] [--clean]
#

set -e  # Exit on error

# Configuration
# Auto-detect the Windows project path by finding where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# If running from /tmp (copied by .cmd wrapper), use a default or parameter
if [[ "$SCRIPT_DIR" == "/tmp" ]]; then
    # Try to detect from current directory or use parameter
    if [ -n "$1" ] && [ -d "$1" ]; then
        WINDOWS_PROJECT_PATH="$1"
    else
        # Default to common WSL mount paths
        echo "Please specify the Windows project path as first argument"
        echo "Usage: $0 /mnt/c/path/to/debug-mcp-server [options]"
        exit 1
    fi
else
    # Script is running from project directory
    WINDOWS_PROJECT_PATH="$(dirname "$SCRIPT_DIR")"
fi
WSL_PROJECT_PATH="$HOME/debug-mcp-server"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Parse arguments
NO_INSTALL=false
NO_BUILD=false
CLEAN_SYNC=false

for arg in "$@"; do
    case $arg in
        --no-install)
            NO_INSTALL=true
            shift
            ;;
        --no-build)
            NO_BUILD=true
            shift
            ;;
        --clean)
            CLEAN_SYNC=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [--no-install] [--no-build] [--clean]"
            echo "  --no-install  Skip npm install"
            echo "  --no-build    Skip npm run build"
            echo "  --clean       Remove destination before sync (full copy)"
            exit 0
            ;;
    esac
done

echo -e "${GREEN}MCP Debugger Windows to WSL2 Sync Script${NC}"
echo "================================================"

# 1. Check if Windows project exists
if [ ! -d "$WINDOWS_PROJECT_PATH" ]; then
    echo -e "${RED}Error: Windows project not found at: $WINDOWS_PROJECT_PATH${NC}"
    exit 1
fi

# 2. Check if rsync is installed
if ! command -v rsync &> /dev/null; then
    echo -e "${YELLOW}rsync not found. Installing...${NC}"
    sudo apt-get update -qq && sudo apt-get install -y rsync
fi

# 3. Clean sync if requested
if [ "$CLEAN_SYNC" = true ] && [ -d "$WSL_PROJECT_PATH" ]; then
    echo -e "${YELLOW}Removing existing WSL2 project (--clean mode)${NC}"
    rm -rf "$WSL_PROJECT_PATH"
fi

# 4. Create destination directory if it doesn't exist
mkdir -p "$WSL_PROJECT_PATH"

# 5. Sync project using rsync (much faster, only copies changes)
echo -e "${GREEN}Syncing project files using rsync...${NC}"
rsync -av --delete \
    --exclude='node_modules/' \
    --exclude='dist/' \
    --exclude='coverage/' \
    --exclude='logs/' \
    --exclude='sessions/' \
    --exclude='.npm/' \
    --exclude='*.log' \
    --exclude='*.tmp' \
    --exclude='.DS_Store' \
    --exclude='Thumbs.db' \
    --exclude='package-lock.json' \
    --exclude='integration_test_server_*.log' \
    "$WINDOWS_PROJECT_PATH/" "$WSL_PROJECT_PATH/"

# 6. Change to project directory
cd "$WSL_PROJECT_PATH"

# 7. Fix permissions (rsync doesn't preserve Windows permissions correctly)
echo -e "${GREEN}Fixing file permissions...${NC}"
# Only fix permissions if needed (much faster than fixing everything)
# Make shell scripts executable
chmod +x scripts/*.sh 2>/dev/null || true

# 8. Check if package-lock.json exists, if not we need to generate it
if [ ! -f "package-lock.json" ]; then
    echo -e "${YELLOW}package-lock.json not found (excluded from sync for speed)${NC}"
    if [ "$NO_INSTALL" = false ]; then
        echo -e "${GREEN}Will be regenerated during npm install${NC}"
    fi
fi

# 9. Install dependencies (unless --no-install)
if [ "$NO_INSTALL" = false ]; then
    echo -e "${GREEN}Installing npm dependencies...${NC}"
    npm install
else
    echo -e "${YELLOW}Skipping npm install (--no-install flag set)${NC}"
fi

# 10. Build project (unless --no-build)
if [ "$NO_BUILD" = false ]; then
    echo -e "${GREEN}Building project...${NC}"
    npm run build
else
    echo -e "${YELLOW}Skipping build (--no-build flag set)${NC}"
fi

echo -e "${GREEN}✓ Sync completed successfully!${NC}"
echo -e "Project is ready at: ${WSL_PROJECT_PATH}"

# Show next steps
echo ""
echo "Next steps:"
echo "  cd ~/debug-mcp-server"
echo "  docker build -t mcp-debugger:local ."
echo "  ./scripts/act-test.sh ci"
