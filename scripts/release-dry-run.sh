#!/usr/bin/env bash
# Release dry-run: validates that the release pipeline will succeed
# Run this BEFORE tagging: npm run release:dry-run
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'
FAIL=0

pass() { echo -e "${GREEN}✓${NC} $1"; }
fail() { echo -e "${RED}✗${NC} $1"; FAIL=1; }
warn() { echo -e "${YELLOW}!${NC} $1"; }

echo "═══════════════════════════════════════════"
echo "  mcp-debugger release dry-run"
echo "═══════════════════════════════════════════"
echo ""

# --- 1. Version consistency ---
echo "── Version consistency ──"
ROOT_VER=$(node -e "console.log(require('./package.json').version)")
SHARED_VER=$(node -e "console.log(require('./packages/shared/package.json').version)")
MOCK_VER=$(node -e "console.log(require('./packages/adapter-mock/package.json').version)")
PYTHON_VER=$(node -e "console.log(require('./packages/adapter-python/package.json').version)")
CLI_VER=$(node -e "console.log(require('./packages/mcp-debugger/package.json').version)")

echo "  Root:          $ROOT_VER"
echo "  shared:        $SHARED_VER"
echo "  adapter-mock:  $MOCK_VER"
echo "  adapter-python:$PYTHON_VER"
echo "  mcp-debugger:  $CLI_VER"

if [[ "$ROOT_VER" == "$SHARED_VER" && "$ROOT_VER" == "$MOCK_VER" && "$ROOT_VER" == "$PYTHON_VER" && "$ROOT_VER" == "$CLI_VER" ]]; then
  pass "All package versions match ($ROOT_VER)"
else
  fail "Package versions are inconsistent"
fi

# --- 2. CHANGELOG has this version with a date ---
echo ""
echo "── CHANGELOG ──"
if grep -q "## \[$ROOT_VER\] - [0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}" CHANGELOG.md; then
  pass "CHANGELOG has [$ROOT_VER] with date"
else
  fail "CHANGELOG missing [$ROOT_VER] entry with date"
fi

if head -20 CHANGELOG.md | grep -q "## \[Unreleased\]"; then
  pass "CHANGELOG has [Unreleased] section"
else
  fail "CHANGELOG missing [Unreleased] section at top"
fi

# --- 3. Build succeeds ---
echo ""
echo "── Build ──"
if npm run build > /dev/null 2>&1; then
  pass "Build succeeded"
else
  fail "Build failed"
fi

# --- 4. Unit tests pass ---
echo ""
echo "── Unit tests ──"
if npm run test:unit > /dev/null 2>&1; then
  pass "Unit tests passed"
else
  fail "Unit tests failed"
fi

# --- 5. npm pack dry-run for all published packages ---
echo ""
echo "── npm pack dry-run ──"
for pkg in @debugmcp/shared @debugmcp/adapter-mock @debugmcp/adapter-python @debugmcp/mcp-debugger; do
  if npm pack --dry-run -w "$pkg" > /dev/null 2>&1; then
    pass "npm pack $pkg"
  else
    fail "npm pack $pkg failed"
  fi
done

# --- 6. Check npm token and GitHub secrets ---
echo ""
echo "── npm authentication ──"

# Test local npm login
if npm whoami > /dev/null 2>&1; then
  NPM_USER=$(npm whoami)
  pass "Local npm login: $NPM_USER"
else
  warn "Not logged in to npm locally"
fi

# Test the GitHub secret NPM_TOKEN if gh is available
if command -v gh > /dev/null 2>&1; then
  # Check secret exists
  if gh secret list 2>/dev/null | grep -q "NPM_TOKEN"; then
    pass "GitHub secret NPM_TOKEN exists"

    # Fetch the token value isn't possible via gh, but we can check
    # if the user has it locally in an env var to validate it
    if [[ -n "${NPM_TOKEN:-}" ]]; then
      # Test token against npm registry
      NPM_TOKEN_USER=$(npm whoami --registry https://registry.npmjs.org 2>/dev/null \
        --//registry.npmjs.org/:_authToken="$NPM_TOKEN") || true
      if [[ -n "$NPM_TOKEN_USER" ]]; then
        pass "NPM_TOKEN is valid (user: $NPM_TOKEN_USER)"
      else
        fail "NPM_TOKEN is set but invalid/expired — regenerate at npmjs.com"
      fi
    else
      warn "Set NPM_TOKEN env var to validate the token locally"
      echo "       NPM_TOKEN=<your-token> npm run release:dry-run"
    fi
  else
    fail "GitHub secret NPM_TOKEN not found"
  fi

  # Check other required secrets exist
  for secret in DOCKER_USERNAME DOCKER_PASSWORD PYPI_TOKEN; do
    if gh secret list 2>/dev/null | grep -q "$secret"; then
      pass "GitHub secret $secret exists"
    else
      fail "GitHub secret $secret not found"
    fi
  done
else
  warn "gh CLI not available — skipping GitHub secrets check"
fi

# Check if packages already exist at this version (would be skipped during publish)
for pkg in @debugmcp/shared @debugmcp/adapter-mock @debugmcp/adapter-python @debugmcp/mcp-debugger; do
  if npm view "${pkg}@${ROOT_VER}" version > /dev/null 2>&1; then
    warn "${pkg}@${ROOT_VER} already published — will be skipped"
  fi
done

# --- 7. release.yml sanity checks ---
echo ""
echo "── release.yml checks ──"
if grep -q "setup-java" .github/workflows/release.yml; then
  pass "release.yml has Java setup"
else
  fail "release.yml missing Java setup (JDI bridge needs JDK 21)"
fi

if grep -q "setup-go" .github/workflows/release.yml; then
  pass "release.yml has Go setup"
else
  fail "release.yml missing Go setup"
fi

CHANGELOG_EXTRACT=$(grep 'RELEASE_REF#refs/tags/' .github/workflows/release.yml | head -1)
if echo "$CHANGELOG_EXTRACT" | grep -q 'tags/v}'; then
  pass "release.yml strips v-prefix for changelog extraction"
else
  fail "release.yml changelog extraction may not strip v-prefix"
fi

# --- 8. Git state ---
echo ""
echo "── Git state ──"
if git diff --quiet HEAD; then
  pass "Working tree clean"
else
  warn "Working tree has uncommitted changes"
fi

BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ "$BRANCH" == "main" ]]; then
  pass "On main branch"
else
  warn "On branch '$BRANCH' (not main)"
fi

# --- Summary ---
echo ""
echo "═══════════════════════════════════════════"
if [[ $FAIL -eq 0 ]]; then
  echo -e "${GREEN}All checks passed.${NC} Safe to tag and push."
  echo ""
  echo "  git tag v${ROOT_VER}"
  echo "  git push origin main --tags"
else
  echo -e "${RED}Some checks failed.${NC} Fix issues before releasing."
fi
echo "═══════════════════════════════════════════"
exit $FAIL
