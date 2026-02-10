# tests/core/unit/session/session-manager-memory-leak.test.ts
@source-hash: f0ec2d4174b06973
@generated: 2026-02-09T18:14:23Z

**Purpose:** Test suite that verifies SessionManager properly prevents memory leaks by cleaning up event listeners during session lifecycle operations. Tests event listener attachment/removal, cleanup on various termination scenarios, and edge cases.

**Test Structure:**
- Main describe block: "SessionManager - Memory Leak Prevention" (L10)
- Setup/teardown with mock dependencies and fake timers (L15-33)
- Three test suites covering different aspects of memory leak prevention

**Key Test Suites:**

**Event Listener Cleanup Tests (L35-208):**
- Tests listener removal on normal session close (L36-73)
- Verifies no accumulation across multiple sessions (L75-99) 
- Tests cleanup when proxy stop() fails (L101-124)
- Handles double close gracefully (L126-155)
- Tests cleanup on unexpected termination events (L157-181, L183-207)

**Cleanup Method Testing (L210-260):**
- Tests internal cleanup method directly (L211-233)
- Verifies proper logging during cleanup operations (L235-259)

**Edge Cases (L262-309):**
- Cleanup with no handlers attached (L263-271)
- Partial cleanup failure handling (L273-308)

**Dependencies & Imports:**
- Uses vitest testing framework (L5)
- SessionManager from main codebase (L6)
- Shared types: DebugLanguage, SessionState (L7)
- Test utilities: createMockDependencies (L8)

**Key Testing Patterns:**
- Fake timers for async operations control
- Event listener count verification via mockProxy.listenerCount()
- Session lifecycle: create → startDebugging → close
- Error simulation via mock function rejection
- Logging verification through spy functions

**Critical Events Monitored:**
Events tested for listener cleanup (L48-50): 'stopped', 'continued', 'terminated', 'exited', 'initialized', 'error', 'exit', 'adapter-configured', 'dry-run-complete'

**Memory Leak Prevention Strategy:**
Tests ensure event listeners are completely removed to prevent accumulation across sessions, even during error conditions or unexpected terminations.