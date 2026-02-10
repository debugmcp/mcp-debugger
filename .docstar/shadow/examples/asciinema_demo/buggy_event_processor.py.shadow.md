# examples/asciinema_demo/buggy_event_processor.py
@source-hash: 8cbb4415058e9028
@generated: 2026-02-10T01:19:03Z

## Purpose
Event processing system demonstrating common copy/reference bugs in data transformation pipelines. Contains intentionally buggy logic for debugging demos.

## Core Functions

**process_events(events, important_threshold=5)** (L1-51)
- Primary event processing pipeline with shallow copy protection
- Creates shallow copies of input events to prevent mutation (L8)
- Processes events sequentially, applying transformations and classifications
- Returns tuple: (processed_events, high_priority_events)

**find_original_from_list(source_events_list, event_id_to_find)** (L53-57)
- Helper function to locate events by ID in a list
- Linear search implementation returning first match or None

## Key Processing Logic

**Event Enrichment** (L11-13)
- Auto-generates IDs (`event_{i}`) for events missing ID field
- Defaults missing values to 0

**Priority Classification** (L15-22)
- Events with value > threshold become high priority
- High priority events get "PRIORITY" status and value boost (+10 even, +5 odd)
- High priority events are copied separately to avoid reference issues

**Special Revert Logic** (L32-46)
- Events with `type: "special_revert"` trigger special handling
- Uses `find_original_from_list` to locate original event state
- Overwrites `processed_value` with original value * 2
- Adds `reverted_to_original_value` field

## Data Flow & Copy Strategy

**Input Protection**: Shallow copies created (L8) to prevent original list mutation
**Reference Management**: High priority events get additional copies (L16)
**Original State Access**: Special revert logic accesses original `events` parameter, not modified copies

## Demo Data & Verification

**initial_events_data** (L59-64)
- Test dataset with 4 events (A, B, C, D)
- Event C targets Event B for revert demonstration
- Event B has high value (10) triggering priority processing

**Verification Logic** (L87-98)
- Validates that Event C correctly uses Event B's original value (10)
- Expected C processed_value: 20 (original B value 10 * 2)
- Detects bug if C uses B's modified value instead

## Architectural Patterns

- **Copy-on-Entry**: Input protection via shallow copying
- **State Preservation**: Original list maintained for revert operations  
- **Linear Processing**: Sequential event transformation with side effects
- **Dual Output Streams**: Processed events + priority event subset

## Critical Invariants

- Original input events remain unmodified
- Special revert events must reference original state, not processed state
- High priority events exist in both output streams
- Event IDs must be unique for revert targeting to work correctly