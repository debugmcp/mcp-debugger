# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/multiprocessing/popen_spawn_posix.py
@source-hash: 97b5d25aa4795168
@generated: 2026-02-09T18:06:10Z

**Primary Purpose**: POSIX implementation of process spawning for Python's multiprocessing module using the "spawn" method. Creates new processes with fresh Python interpreters rather than forking existing ones.

**Core Components**:

- **_DupFd (L16-21)**: Simple file descriptor wrapper that provides a `detach()` method to return the underlying fd. Used for fd management during spawning.

- **Popen (L26-72)**: Main spawning process implementation inheriting from `popen_fork.Popen`. Key responsibilities:
  - Process spawning via fresh interpreter (method = 'spawn')
  - File descriptor tracking and management via `self._fds` list
  - Inter-process communication setup through pipes
  - Serialization of process data for child process initialization

**Key Methods**:

- **`__init__` (L30-32)**: Initializes empty fd tracking list before calling parent constructor
- **`duplicate_for_child` (L34-36)**: Registers file descriptors that need to be passed to child process
- **`_launch` (L38-72)**: Core spawning logic that:
  - Sets up resource tracker communication (L39-41)
  - Serializes preparation data and process object using reduction module (L42-49)
  - Creates bidirectional pipe communication (L51-56)
  - Spawns child process with `util.spawnv_passfds` (L58-59)
  - Establishes cleanup via finalizer (L68)

**Dependencies**:
- `popen_fork.Popen` (parent class)
- `spawn` module for command generation and preparation data
- `reduction` module for object serialization
- `util` module for process spawning and cleanup
- `resource_tracker` for resource management

**Architecture Pattern**: Template method pattern where parent class defines process lifecycle and this class implements spawn-specific launching behavior. Uses pipe-based IPC for sending serialized process data to child.

**Critical Flow**: Serializes process state → Creates pipes → Spawns child with passed fds → Child reads serialized data to reconstruct process state in fresh interpreter.