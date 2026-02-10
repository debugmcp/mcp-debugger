# packages/adapter-rust/vendor/codelldb/darwin-arm64/lldb/lib/python3.12/graphlib.py
@source-hash: 7bd338c5a475d110
@generated: 2026-02-09T18:07:07Z

## Primary Purpose
Graph topological sorting implementation providing both incremental and batch processing modes. Core module for dependency resolution and cycle detection in directed acyclic graphs.

## Key Classes and Functions

### _NodeInfo (L9-24)
Internal data structure representing graph nodes with tracking state:
- `node`: The actual node value being tracked
- `npredecessors`: Counter for remaining dependencies (0 = ready, -1 = output, -2 = done)
- `successors`: List of dependent nodes (allows duplicates)

### CycleError (L26-38)
Exception raised when cycles are detected during graph preparation. Contains the detected cycle as a list in the second element of `args` attribute, where first and last nodes are identical.

### TopologicalSorter (L41-250)
Main class providing topological sorting functionality with two usage patterns:

#### Core State Management
- `_node2info`: Maps nodes to _NodeInfo instances (L45)
- `_ready_nodes`: List of nodes ready for processing (L46)
- `_npassedout`/`_nfinished`: Counters for tracking processing state (L47-48)

#### Key Methods
- `add(node, *predecessors)` (L59-84): Builds graph by adding nodes and dependencies. Automatically creates predecessor nodes if not previously added.
- `prepare()` (L86-106): Finalizes graph and detects cycles. Must be called before processing. Sets `_ready_nodes` to nodes with zero predecessors.
- `get_ready()` (L108-132): Returns tuple of nodes ready for processing. Marks returned nodes as _NODE_OUT.
- `done(*nodes)` (L151-196): Marks nodes as completed (_NODE_DONE), decrements successor predecessor counts, adds newly ready nodes to `_ready_nodes`.
- `is_active()`/`__bool__` (L134-149): Checks if more processing is possible.
- `static_order()` (L235-248): Convenience method returning complete topological order iterator.

#### Cycle Detection
- `_find_cycle()` (L198-233): DFS-based cycle detection using stack and iterator stack for backtracking.

## State Constants
- `_NODE_OUT = -1`: Node has been returned by get_ready() but not yet marked done
- `_NODE_DONE = -2`: Node has been processed and marked done

## Usage Patterns
1. **Incremental**: `add()` → `prepare()` → `get_ready()` → `done()` cycle
2. **Batch**: `add()` → `static_order()` for complete ordering

## Critical Invariants
- Graph cannot be modified after `prepare()` is called
- Nodes must be marked done in same order as returned by `get_ready()`
- Successor predecessor counts must accurately reflect graph structure
- Node state transitions: initial(≥0) → _NODE_OUT → _NODE_DONE

## Dependencies
- `types.GenericAlias` for generic type support (L1, L250)