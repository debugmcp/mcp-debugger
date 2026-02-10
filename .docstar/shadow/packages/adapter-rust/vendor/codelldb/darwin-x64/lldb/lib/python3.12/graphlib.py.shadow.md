# packages/adapter-rust/vendor/codelldb/darwin-x64/lldb/lib/python3.12/graphlib.py
@source-hash: 7bd338c5a475d110
@generated: 2026-02-09T18:09:23Z

## Purpose
Implements topological sorting for directed graphs using Kahn's algorithm. Primary use case is dependency resolution where nodes represent tasks/objects and edges represent dependencies.

## Core Classes

### _NodeInfo (L9-24)
Internal data structure wrapping graph nodes with sorting metadata:
- `node`: The actual node value
- `npredecessors`: Count of unresolved dependencies (0 = ready, _NODE_OUT = passed out, _NODE_DONE = completed)
- `successors`: List of dependent nodes (may contain duplicates)

### CycleError (L26-38)
Exception raised when cycles are detected during preparation. Contains the detected cycle as a list in the second element of args, where first and last nodes are identical to show cyclicity.

### TopologicalSorter (L41-250)
Main sorting engine with state machine design:

**State Management:**
- `_node2info` (dict): Maps nodes to _NodeInfo instances
- `_ready_nodes` (list): Nodes with zero dependencies, None before prepare()
- `_npassedout` (int): Count of nodes returned by get_ready()
- `_nfinished` (int): Count of nodes marked done()

**Key Methods:**
- `add(node, *predecessors)` (L59-84): Builds graph by adding nodes and dependency edges. Can be called multiple times for same node to union dependencies.
- `prepare()` (L86-106): Finalizes graph, identifies initial ready nodes, detects cycles via _find_cycle()
- `get_ready()` (L108-132): Returns ready nodes as tuple, marks them as _NODE_OUT, clears ready list
- `done(*nodes)` (L151-196): Marks nodes complete (_NODE_DONE), decrements successor predecessor counts, adds newly ready successors
- `is_active()` (L134-146): Returns True if progress possible (unfinished work or ready nodes available)
- `static_order()` (L235-248): Convenience method providing generator of topologically sorted nodes

**Cycle Detection:**
- `_find_cycle()` (L198-233): DFS-based cycle detection using stack and seen set. Returns cycle path or None.

## State Machine Flow
1. **Building**: add() calls allowed, _ready_nodes is None
2. **Prepared**: prepare() called, _ready_nodes initialized, no more add() allowed
3. **Processing**: get_ready() → done() cycles until completion

## Key Invariants
- Nodes must be hashable
- prepare() must be called before get_ready()/done()/is_active()
- prepare() can only be called once
- Nodes returned by get_ready() must be marked done() before more progress
- Node states: npredecessors >= 0 (pending), _NODE_OUT (ready), _NODE_DONE (complete)

## Dependencies
- `types.GenericAlias` for type hinting support
- Built-in collections and iterators

## Constants
- `_NODE_OUT = -1`: Node has been returned by get_ready()  
- `_NODE_DONE = -2`: Node has been marked complete via done()