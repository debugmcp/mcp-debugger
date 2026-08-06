// Panic example for mcp-debugger exception-breakpoint tests (issue #260).
//
// With the default breakOnExceptions ('uncaught'), the debugger should pause
// at the panic site with locals live; run to termination exits with code 101.

fn main() {
    println!("panic_example: starting");
    let ticket_id = 42;
    let stage = "pre-flight";
    let checked = validate(ticket_id, stage);
    // Unreachable when validate panics; keeps `checked` observable in locals.
    println!("panic_example: validated {}", checked);
}

fn validate(ticket_id: i32, stage: &str) -> i32 {
    let attempts = 3;
    println!("panic_example: validating ticket {} at {} ({} attempts)", ticket_id, stage, attempts);
    panic!("intentional panic for mcp-debugger tests (ticket {})", ticket_id); // line 18: panic site
}
