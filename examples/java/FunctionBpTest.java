/**
 * Function-breakpoint e2e fixture (issue #292).
 * Line numbers are asserted by mcp-server-smoke-java-function-bp.test.ts —
 * keep the layout stable: the first statement of compute(int) is line 20,
 * of compute(String) line 25, of helper() line 30 (method entry locations
 * map to the first statement, not the declaration line).
 */
public class FunctionBpTest {
    public static void main(String[] args) throws InterruptedException {
        System.out.println("FunctionBpTest starting");
        Thread.sleep(3000); // window for setting breakpoints while running
        int a = compute(3);
        int b = compute(7);
        String s = compute("hi");
        String g = helper();
        System.out.println("Result: " + (a + b) + " " + s + " " + g);
    }

    static int compute(int x) {
        int doubled = x * 2;
        return doubled;
    }

    static String compute(String s) {
        String up = s.toUpperCase();
        return up;
    }

    static String helper() {
        String msg = "helped";
        return msg;
    }
}
