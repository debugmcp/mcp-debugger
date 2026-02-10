# examples/asciinema_demo/buggy_event_processor.py
@source-hash: 660c85e3de032b5d
@generated: 2026-02-09T18:14:58Z

## Primary Purpose
Event processing system that demonstrates copy vs. reference handling bugs. Processes a list of events, applies transformations based on thresholds and special revert logic, while highlighting potential data mutation issues.

## Key Functions

**`process_events(events, important_threshold=5)` (L1-52)**
- Main processing function that transforms event dictionaries
- Creates shallow copies of input events to avoid mutation (L8)
- Applies priority logic: events > threshold get "PRIORITY" status and value bonuses (L15-22)
- Handles special "special_revert" events that reference original values from other events (L32-46)
- Returns tuple of (processed_events, high_priority_events)

**`find_original_from_list(source_events_list, event_id_to_find)` (L54-58)**
- Utility function to locate events by ID from a source list
- Used by special_revert logic to find original event values
- Returns matching event dict or None

## Key Data Structures

**`initial_events_data` (L60-65)**
- Demo dataset with 4 events (A, B, C, D)
- Event C has `type: "special_revert"` that targets event B
- Event B has value=10, triggering priority processing

## Processing Logic Flow

1. **Copy Creation (L8)**: Shallow copy each event dict to prevent original mutation
2. **Default Assignment (L11-13)**: Set missing "id" and "value" fields
3. **Priority Processing (L15-22)**: High-value events get status="PRIORITY" and value bonuses
4. **Special Revert Handling (L32-46)**: Events with type="special_revert" use original values from referenced events
5. **Value Doubling (L24)**: All events get processed_value = value * 2

## Critical Bug Demonstration

The code intentionally demonstrates a reference vs. copy bug scenario:
- Event C (special_revert) should use Event B's *original* value (10) for calculations
- Event B gets modified during processing (10 → 20 if even)
- The `find_original_from_list` correctly uses the original `events` parameter, not `events_copy`
- Expected: C.processed_value = 20 (B's original 10 * 2)
- Bug would occur if using modified values instead of originals

## Dependencies
- No external dependencies
- Self-contained demo with verification logic (L67-99)

## Architectural Notes
- Defensive copying pattern to prevent side effects
- Separation of processed vs. high-priority event collections
- Built-in verification system to validate correct behavior
- Extensive commenting explaining the intended bug demonstration