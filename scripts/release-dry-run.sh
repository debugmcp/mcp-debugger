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
GO_VER=$(node -e "console.log(require('./packages/adapter-go/package.json').version)")
JAVA_VER=$(node -e "console.log(require('./packages/adapter-java/package.json').version)")
JS_VER=$(node -e "console.log(require('./packages/adapter-javascript/package.json').version)")
RUST_VER=$(node -e "console.log(require('./packages/adapter-rust/package.json').version)")
DOTNET_VER=$(node -e "console.log(require('./packages/adapter-dotnet/package.json').version)")
CLI_VER=$(node -e "console.log(require('./packages/mcp-debugger/package.json').version)")

echo "  Root:               $ROOT_VER"
echo "  shared:             $SHARED_VER"
echo "  adapter-mock:       $MOCK_VER"
echo "  adapter-python:     $PYTHON_VER"
echo "  adapter-go:         $GO_VER"
echo "  adapter-java:       $JAVA_VER"
echo "  adapter-javascript: $JS_VER"
echo "  adapter-rust:       $RUST_VER"
echo "  adapter-dotnet:     $DOTNET_VER"
echo "  mcp-debugger:       $CLI_VER"

if [[ "$ROOT_VER" == "$SHARED_VER" && "$ROOT_VER" == "$MOCK_VER" && "$ROOT_VER" == "$PYTHON_VER" && "$ROOT_VER" == "$GO_VER" && "$ROOT_VER" == "$JAVA_VER" && "$ROOT_VER" == "$JS_VER" && "$ROOT_VER" == "$RUST_VER" && "$ROOT_VER" == "$DOTNET_VER" && "$ROOT_VER" == "$CLI_VER" ]]; then
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

# --- 5. npm pack dry-run and provenance readiness ---
echo ""
echo "── npm pack dry-run ──"
PUBLISHED_PKGS=("shared" "adapter-mock" "adapter-python" "mcp-debugger")
for pkg_dir in "${PUBLISHED_PKGS[@]}"; do
  pkg_name=$(node -e "console.log(require('./packages/$pkg_dir/package.json').name)")
  if npm pack --dry-run -w "$pkg_name" > /dev/null 2>&1; then
    pass "npm pack $pkg_name"
  else
    fail "npm pack $pkg_name failed"
  fi

  # --provenance requires repository.url matching the GitHub repo
  REPO_URL=$(node -e "const p=require('./packages/$pkg_dir/package.json'); console.log(p.repository?.url || '')")
  if echo "$REPO_URL" | grep -q "github.com/debugmcp/mcp-debugger"; then
    pass "$pkg_name repository.url set (required for --provenance)"
  else
    fail "$pkg_name missing repository.url — npm --provenance will fail (E422)"
  fi
done

# --- 6. Check GitHub secrets ---
echo ""
echo "── Publishing credentials ──"

if command -v gh > /dev/null 2>&1; then
  # Check secrets exist (NPM_TOKEN = granular access token for npm publish)
  SECRETS_LIST=$(gh secret list 2>/dev/null || echo "")
  for secret in NPM_TOKEN DOCKER_USERNAME DOCKER_PASSWORD PYPI_TOKEN; do
    if echo "$SECRETS_LIST" | grep -q "^${secret}"; then
      pass "GitHub secret $secret exists"
    else
      fail "GitHub secret $secret not found"
    fi
  done

  # Trigger the validate-secrets workflow to actually test tokens against live APIs
  echo ""
  echo "  Triggering validate-secrets workflow on GitHub Actions..."
  if gh workflow run validate-secrets.yml 2>/dev/null; then
    sleep 3
    RUN_ID=$(gh run list --workflow=validate-secrets.yml --limit 1 --json databaseId --jq '.[0].databaseId' 2>/dev/null)
    if [[ -n "$RUN_ID" ]]; then
      echo "  Waiting for token validation (run $RUN_ID)..."
      # Wait for the run to complete
      gh run watch "$RUN_ID" > /dev/null 2>&1 || true

      # Report per-job results
      JOBS_JSON=$(gh run view "$RUN_ID" --json jobs --jq '.jobs[] | .name + "|" + .conclusion' 2>/dev/null)
      ALL_OK=true
      while IFS='|' read -r job_name job_result; do
        if [[ "$job_result" == "success" ]]; then
          pass "$job_name"
        elif [[ "$job_result" == "failure" ]]; then
          fail "$job_name"
          ALL_OK=false
        else
          warn "$job_name ($job_result)"
        fi
      done <<< "$JOBS_JSON"

      if [[ "$ALL_OK" != "true" ]]; then
        echo "       Details: gh run view $RUN_ID --log"
      fi
    else
      warn "Could not find workflow run — check manually: gh run list --workflow=validate-secrets.yml"
    fi
  else
    warn "Could not trigger validate-secrets workflow (push .github/workflows/validate-secrets.yml first)"
  fi
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
