# .husky/
@generated: 2026-02-09T18:16:18Z

## Overview

The `.husky` directory serves as the core infrastructure for Husky, a popular Git hooks management system for JavaScript projects. This directory contains the essential components that enable automated Git hook execution and provide migration support for legacy configurations.

## Purpose and Responsibility

This module's primary responsibility is to manage the lifecycle and execution of Git hooks in modern JavaScript development workflows. It acts as both the active hook management system and a transitional bridge for users migrating from older Husky configurations. The directory ensures backward compatibility while guiding users toward current best practices.

## Key Components and Relationships

The directory is organized around a deprecation management strategy:

- **`_/` subdirectory**: Contains legacy compatibility infrastructure, specifically the transitional `husky.sh` script that handles deprecated hook configurations
- The underscore-prefixed subdirectory serves as a clear namespace separation between legacy and current functionality

These components work together to provide a graceful upgrade path, where legacy hook references are intercepted and converted into educational warnings rather than causing immediate failures.

## Public API Surface

**Primary Entry Points:**
- **Legacy Hook Interface**: `_/husky.sh` - Accessed via the deprecated pattern `. "$(dirname -- "$0")/_/husky.sh"`
- **Migration Communication**: Structured warning system that identifies specific deprecated elements and provides concrete remediation steps

**Interface Characteristics:**
- Shell script-based execution model
- Self-referential context awareness using `$0` variable
- Human-readable output focused on developer education
- Version-specific deprecation timelines (targeting v10.0.0 for breaking changes)

## Internal Organization and Data Flow

The directory follows a controlled deprecation architecture:

1. **Interception Layer**: Legacy Git hook configurations attempt to source functionality from the `_/` subdirectory
2. **Warning Generation**: Instead of executing hooks, the system generates structured deprecation notices
3. **Educational Output**: Users receive specific migration instructions identifying exact code lines to modify
4. **Timeline Communication**: Clear version-based deadlines inform users when legacy support will end

## Important Patterns and Conventions

- **Graceful Deprecation Management**: Proactive communication prevents breaking changes from surprising users
- **Self-Documenting Warnings**: Error messages include specific remediation steps rather than generic advice
- **Namespace Isolation**: Underscore-prefixed directories clearly separate transitional from permanent functionality
- **Version-Conscious Architecture**: Explicit version targeting enables predictable migration planning

## Architectural Context

The `.husky` directory represents a mature approach to developer tool evolution, prioritizing user experience during breaking changes. It demonstrates how infrastructure components can serve dual roles - maintaining current functionality while facilitating architectural transitions. This pattern ensures that Git hook automation remains reliable even as the underlying implementation modernizes.

The directory is designed for eventual simplification once legacy migration is complete, embodying a temporary complexity that serves long-term maintainability goals.