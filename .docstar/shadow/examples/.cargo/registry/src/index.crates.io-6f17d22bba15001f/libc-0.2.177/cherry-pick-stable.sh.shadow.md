# examples/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/cherry-pick-stable.sh
@source-hash: c7d95e3cf2624115
@generated: 2026-02-09T18:14:23Z

## Purpose
Bash script for automated cherry-picking of commits from merged PRs labeled 'stable-nominated' into the current Git branch, specifically designed for the libc crate's stable backport workflow.

## Key Functionality

### Argument Parsing (L6-29)
- `DRY_RUN` flag controlled by `--dry-run/-d` option
- Help system with usage information (`--help/-h`)
- Strict error handling with `set -e` (L3)

### Core Cherry-Pick Logic (L36-102)
- **Branch Detection**: Gets current branch using `git branch --show-current` (L36)
- **PR Discovery**: Uses GitHub CLI to fetch merged PRs with 'stable-nominated' label, sorted by merge date (L44)
- **Commit Processing Loop** (L60-102):
  - Parses PR data as pipe-delimited: `pr_number|title|commit_sha`
  - **Duplicate Detection**: Checks if commit already exists in current branch (L66)
  - **Cherry-Pick Execution**: Uses `git cherry-pick -xe` with backport note insertion (L79-90)
  - **Message Amendment**: Inserts backport URL before cherry-pick note using sed (L85-87)

### Result Tracking (L52-54)
Three arrays track operation outcomes:
- `successful[]`: Successfully cherry-picked commits
- `failed[]`: Failed cherry-pick attempts  
- `skipped[]`: Already present commits

### Summary Reporting (L104-150)
Categorized summary with emoji indicators showing counts and details for each result type.

## Dependencies
- **Git**: Core VCS operations
- **GitHub CLI (`gh`)**: PR metadata retrieval
- **Standard Unix tools**: `sed`, `grep` for text processing

## Architecture Patterns
- **Fail-fast**: Exits on first script error (`set -e`)
- **Dry-run simulation**: Complete workflow preview without modifications
- **Order preservation**: Sorts PRs by merge date to minimize conflicts
- **Graceful degradation**: Continues processing after individual cherry-pick failures
- **Atomic operations**: Aborts failed cherry-picks to maintain clean state (L98)

## Critical Invariants
- Cherry-pick order follows original merge chronology
- Backport notes are inserted before existing cherry-pick metadata
- Failed operations don't leave repository in inconsistent state
- Script exits with error code if any cherry-picks fail