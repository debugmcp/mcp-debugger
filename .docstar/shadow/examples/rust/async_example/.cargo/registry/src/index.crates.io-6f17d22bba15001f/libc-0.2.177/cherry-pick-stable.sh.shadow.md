# examples/rust/async_example/.cargo/registry/src/index.crates.io-6f17d22bba15001f/libc-0.2.177/cherry-pick-stable.sh
@source-hash: c7d95e3cf2624115
@generated: 2026-02-09T18:06:52Z

## Purpose
Bash script for automatically cherry-picking commits from GitHub PRs labeled 'stable-nominated' to the current branch, with proper backport annotations following libc project conventions.

## Core Functionality

**Argument Processing (L6-29)**
- Supports `--dry-run/-d` flag for preview mode without making changes
- Provides `--help/-h` with usage information
- Exits with error on unknown arguments

**PR Discovery & Sorting (L41-44)**
- Uses GitHub CLI (`gh pr list`) to fetch merged PRs with 'stable-nominated' label
- Sorts by merge date (oldest first) to preserve chronological order and reduce conflicts
- Extracts PR number, title, and merge commit SHA in pipe-delimited format

**Cherry-pick Processing Loop (L60-102)**
- Processes each PR sequentially to maintain merge order
- Checks if commit already exists in current branch using `git branch --contains` (L66)
- Performs cherry-pick with `-xe` flags for extended commit messages
- Adds backport annotation in specific format: `(backport https://github.com/rust-lang/libc/pull/$pr_number)`
- Inserts backport line before existing cherry-pick note using sed (L85-87)
- Handles cherry-pick failures by aborting and tracking in failed array

**Result Tracking & Reporting**
- Maintains three arrays: `successful`, `failed`, `skipped` (L52-54)
- Provides detailed summary with counts and status indicators (L104-150)
- Exits with status 1 if any cherry-picks failed (L143)

## Key Dependencies
- GitHub CLI (`gh`) for PR data retrieval
- Git for cherry-pick operations and branch management
- Standard Unix utilities: `grep`, `sed`, `read`

## Critical Behavior Notes
- Preserves merge chronology by sorting PRs by merge date
- Follows libc project convention of placing backport notes before cherry-pick notes
- Dry-run mode shows exact commands that would be executed
- Automatically aborts failed cherry-picks to keep repository clean
- Skips commits already present in current branch to avoid duplicates