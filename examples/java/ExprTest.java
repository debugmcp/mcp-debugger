/**
 * Test fixture for expression evaluation in JDI bridge.
 *
 * Compile:  javac -g ExprTest.java
 * Run:      java ExprTest
 *
 * Breakpoint at line 31 (marked below) exercises all expression types.
 */
public class ExprTest {

    int instanceField = 42;
    String name = "test";
    int[] numbers = {10, 20, 30};
    int[][] matrix = {{1, 2}, {3, 4}};
    boolean flag = true;

    int add(int a, int b) {
        return a + b;
    }

    String greet(String who) {
        return "Hello, " + who;
    }

    void run() {
        int x = 10;
        double pi = 3.14;
        String msg = "hello";
        Integer boxed = 42;
        // BREAKPOINT HERE — line 31
        System.out.println("x=" + x + " pi=" + pi + " msg=" + msg + " boxed=" + boxed);
    }

    public static void main(String[] args) {
        new ExprTest().run();
    }
}
