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

    public static void main(String[] args) throws Exception {
        System.out.println("Waiting for debugger...");
        // Sleep to allow time for debugger to re-set breakpoints after class loading.
        // With suspend=y, KDA sets breakpoints before class loading (deferred);
        // after VM resume + class load, breakpoints may need to be re-sent.
        Thread.sleep(2000);               // line 22 — pause for breakpoint setup
        int x = 42;                       // line 23
        int y = 58;                       // line 24
        int sum = compute(x, y);          // line 25 — calls compute
        System.out.println("Sum: " + sum);
    }
}
