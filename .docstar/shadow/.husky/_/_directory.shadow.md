# .husky/_/
@generated: 2026-02-09T18:16:02Z

## Overview

The `.husky/_/` directory serves as a transitional component within the Husky Git hooks management system, designed to facilitate migration away from legacy hook configurations. This directory acts as a deprecation bridge, warning users about outdated syntax patterns that will become incompatible in future versions.

## Purpose and Responsibility

This module's primary responsibility is change management and user communication during Husky's architectural evolution. It provides a controlled deprecation pathway for users who haven't migrated from legacy hook setup patterns, ensuring they receive clear guidance before breaking changes take effect.

## Key Components

- **husky.sh**: The sole component serving as a legacy compatibility shim that outputs deprecation warnings instead of executing hook functionality

## Public API Surface

- **Entry Point**: `husky.sh` - Called by legacy Git hook configurations that reference the old sourcing pattern
- **Interface**: Pure shell script with no parameters or return values
- **Output**: Human-readable deprecation notice with specific migration instructions

## Internal Organization and Data Flow

The directory follows a minimal architecture:
1. Legacy hook files attempt to source `husky.sh` via the deprecated pattern `. "$(dirname -- "$0")/_/husky.sh"`
2. Instead of providing hook functionality, `husky.sh` outputs a structured warning message
3. The warning identifies the specific deprecated elements (shebang and source lines) that need removal
4. Users receive clear timeline information about when the legacy approach will fail (v10.0.0)

## Important Patterns and Conventions

- **Graceful Deprecation**: Rather than immediately breaking, the script provides educational warnings
- **Self-Referential Communication**: Uses `$0` variable to identify the calling script context
- **Explicit Migration Guidance**: Specifies exact lines to remove rather than general advice
- **Version-Specific Warnings**: References concrete version numbers for breaking changes

## Architectural Context

This directory represents a temporary transition mechanism designed for eventual removal. It serves as a communication layer between Husky's legacy and modern hook management approaches, ensuring users can migrate their configurations without unexpected failures. The module embodies a pattern of proactive deprecation management in developer tooling.