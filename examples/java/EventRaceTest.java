/**
 * Test fixture for verifying that ClassPrepareEvent does not resume a
 * thread stopped at a breakpoint when both events are in the same EventSet.
 *
 * The test sets breakpoints in both this class AND in LateLoadedHelper (which
 * is not loaded until main() references it). This causes a ClassPrepareRequest
 * for LateLoadedHelper. When main() hits its breakpoint, the ClassPrepareEvent
 * for LateLoadedHelper may arrive in the same EventSet — triggering the bug
 * where the breakpoint thread gets incorrectly resumed.
 *
 * Usage with suspendPolicy="thread" to reproduce the race condition.
 */
public class EventRaceTest {

    /**
     * This method is called BEFORE LateLoadedHelper is referenced.
     * Set a breakpoint here with suspendPolicy="thread".
     */
    static int compute(int a, int b) {
        int result = a + b;     // line 21 — breakpoint target
        return result;          // line 22
    }

    public static void main(String[] args) throws Exception {
        System.out.println("EventRaceTest starting...");
        Thread.sleep(2000);                        // wait for breakpoint setup

        // Call compute() — breakpoint should fire here
        int sum = compute(10, 20);                 // line 29
        System.out.println("Sum: " + sum);

        // Now reference LateLoadedHelper — triggers class loading
        // If a breakpoint was set in LateLoadedHelper, a ClassPrepareEvent fires
        String msg = LateLoadedHelper.greet("World");  // line 33
        System.out.println(msg);

        System.out.println("EventRaceTest done.");
    }
}
