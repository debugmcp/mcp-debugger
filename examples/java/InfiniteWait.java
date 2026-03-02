/**
 * Simple Java program for testing attach-mode debugging.
 *
 * Launch with JDWP agent to allow debugger attach:
 *   java -agentlib:jdwp=transport=dt_socket,server=y,address=<port>,suspend=y \
 *        -cp . InfiniteWait
 *
 * With suspend=y the JVM pauses at startup, so the program just needs
 * meaningful code with local variables for the debugger to inspect.
 */
public class InfiniteWait {

    static int compute(int a, int b) {
        int result = a + b;  // line 14 — breakpoint target
        return result;        // line 15
    }

    static String format(String label, int value) {
        String text = label + ": " + value;  // line 19 — second breakpoint target
        return text;                          // line 20
    }

    public static void main(String[] args) throws Exception {
        System.out.println("Waiting for debugger...");
        // Sleep to allow time for debugger attach and class loading.
        // With suspend=y, JDI bridge sets breakpoints via ClassPrepareRequest;
        // after VM resume + class load, deferred breakpoints resolve automatically.
        Thread.sleep(2000);               // line 27 — pause for breakpoint setup
        int x = 42;                       // line 28
        int y = 58;                       // line 29
        int sum = compute(x, y);          // line 30 — calls compute
        String msg = format("Sum", sum);  // line 31 — calls format
        System.out.println(msg);
    }
}
