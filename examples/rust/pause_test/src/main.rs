// Long-running program for testing pause_execution.
use std::thread;
use std::time::Duration;

fn main() {
    let mut counter: i32 = 0;
    loop {
        counter += 1;
        thread::sleep(Duration::from_millis(500));
    }
}
