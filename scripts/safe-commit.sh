#!/bin/bash
# Safe commit wrapper that always runs personal information checks
# even when skipping other verification steps

echo "🔍 Running mandatory personal information check..."
node scripts/check-personal-paths.cjs

if [ $? -ne 0 ]; then
    echo ""
    echo "❌ Personal information check failed!"
    echo "   This check cannot be skipped for security reasons."
    echo ""
    echo "💡 To fix: Replace personal paths with generic ones"
    echo "💡 Examples: /path/to/project, ~/workspace/project"
    exit 1
fi

echo "✅ Personal information check passed!"

# Check if user wants to skip other checks
if [ "$1" = "--skip-tests" ] || [ "$SKIP_TESTS" = "true" ]; then
    echo "⚡ Skipping other pre-commit checks (tests, build artifacts)"
    echo "   Use this only when you need to commit quickly!"
    # Commit with --no-verify to skip the normal pre-commit hook
    shift  # Remove --skip-tests from arguments
    git commit --no-verify "$@"
else
    # Run normal commit with all hooks
    git commit "$@"
fi