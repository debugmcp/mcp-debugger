# .husky/_/husky.sh
@source-hash: 21122903fca7209a
@generated: 2026-02-09T18:14:50Z

**Purpose**: Legacy Husky shell script that displays a deprecation warning for outdated Git hook configurations.

**Core Functionality**:
- Single echo statement (L1-9) that outputs a multi-line deprecation notice
- Warns users about incompatible syntax that will fail in Husky v10.0.0
- Instructs removal of specific shebang and sourcing lines from hook files

**Key Message Elements**:
- Identifies deprecated status of the current approach
- References the calling script via `$0` variable (L3)
- Specifies exact lines to remove: shebang `#!/usr/bin/env sh` and source command `. "$(dirname -- "$0")/_/husky.sh"` (L5-6)
- Provides clear migration timeline (v10.0.0 failure warning on L8)

**Context**: Part of Husky's Git hooks management system transition, serving as a bridge script to guide users away from legacy hook setup patterns. The script itself performs no actual hook functionality - it exists solely to communicate the deprecation to users who haven't migrated their configurations.

**Dependencies**: None - pure shell script with basic echo functionality.

**Architectural Note**: This is a transitional utility designed to be eventually removed, representing a breaking change communication mechanism in the Husky ecosystem.