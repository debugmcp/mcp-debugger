@echo off
echo Moving session test files...

git mv tests/unit/session/session-manager-dap.test.ts tests/core/unit/session/
git mv tests/unit/session/session-manager-dry-run.test.ts tests/core/unit/session/
git mv tests/unit/session/session-manager-edge-cases.test.ts tests/core/unit/session/
git mv tests/unit/session/session-manager-error-recovery.test.ts tests/core/unit/session/
git mv tests/unit/session/session-manager-integration.test.ts tests/core/unit/session/
git mv tests/unit/session/session-manager-memory-leak.test.ts tests/core/unit/session/
git mv tests/unit/session/session-manager-multi-session.test.ts tests/core/unit/session/
git mv tests/unit/session/session-manager-paths.test.ts tests/core/unit/session/
git mv tests/unit/session/session-manager-state.test.ts tests/core/unit/session/
git mv tests/unit/session/session-manager-test-utils.ts tests/core/unit/session/
git mv tests/unit/session/session-manager-workflow.test.ts tests/core/unit/session/
git mv tests/unit/session/session-store.test.ts tests/core/unit/session/

echo Done!
