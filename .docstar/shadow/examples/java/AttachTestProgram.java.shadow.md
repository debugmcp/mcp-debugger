# examples/java/AttachTestProgram.java
@source-hash: c7080d55130ae9fe
@generated: 2026-02-09T18:14:53Z

**Primary Purpose**: Test program designed for debugger attachment scenarios, providing a long-running process with predictable behavior for debugging exercises.

**Core Structure**:
- `AttachTestProgram` class (L2-23): Main container class with single static entry point
- `main` method (L3-22): Entry point that runs an infinite counter loop with 1-second intervals

**Key Components**:
- Counter loop (L6-21): Infinite while loop incrementing a counter variable, printing status every second
- Sleep mechanism (L11-15): 1-second delay using `Thread.sleep()` with InterruptedException handling for clean termination
- Breakpoint target (L17-20): Conditional block at counter >= 5 threshold, explicitly marked as debugging target

**Execution Flow**:
1. Prints startup message indicating readiness for debugger attachment (L4)
2. Enters infinite loop incrementing counter and printing values (L7-9)
3. Sleeps 1 second per iteration with interruption handling (L12-15)
4. Executes threshold logic when counter reaches 5+ (L18-20)

**Debugging Features**:
- Predictable timing (1-second intervals) for attachment
- Clear breakpoint target location marked by comment (L17)
- Observable state changes through console output
- Graceful termination via thread interruption

**Dependencies**: Standard Java runtime only (`System`, `Thread`)

**Usage Context**: Likely used in IDE debugging tutorials, debugger testing, or educational scenarios demonstrating attach-to-process debugging workflows.