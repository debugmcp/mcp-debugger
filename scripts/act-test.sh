#!/bin/bash
# Act test runner script for Linux/macOS
# This script simplifies running tests with Act locally

echo "MCP Debugger - Act Test Runner"
echo "=============================="
echo

show_help() {
    echo "Usage: ./act-test.sh [option]"
    echo
    echo "Options:"
    echo "  ci       - Run CI workflow tests (default)"
    echo "  release  - Run Release workflow tests"
    echo "  e2e      - Run only E2E tests"
    echo "  help     - Show this help message"
    echo
    echo "Examples:"
    echo "  ./act-test.sh ci"
    echo "  ./act-test.sh e2e"
    echo
    echo "Note: Make sure you've built the Docker image first:"
    echo "  docker build -t mcp-debugger:local ."
    echo
}

case "$1" in
    ci|"")
        echo "Running CI workflow tests..."
        act -j build-and-test --matrix os:ubuntu-latest
        ;;
    release)
        echo "Running Release workflow tests..."
        act -W .github/workflows/release.yml -j build-and-test
        ;;
    e2e)
        echo "Running only E2E tests in CI workflow..."
        act -j build-and-test --matrix os:ubuntu-latest -e '{"test_filter":"e2e"}'
        ;;
    help)
        show_help
        ;;
    *)
        echo "Invalid option: $1"
        show_help
        exit 1
        ;;
esac
