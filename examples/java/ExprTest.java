/**
 * Test fixture for expression evaluation in JDI bridge.
 *
 * Compile:  javac -g ExprTest.java
 * Run:      java ExprTest
 *
 * Breakpoint at line 37 (marked below) exercises all expression types.
 * Also tests instanceof with interface hierarchies (Issue 14 fix).
 */

interface Greeter { String greet(String who); }
interface FormalGreeter extends Greeter {}

public class ExprTest implements FormalGreeter {

    int instanceField = 42;
    String name = "test";
    int[] numbers = {10, 20, 30};
    int[][] matrix = {{1, 2}, {3, 4}};
    boolean flag = true;
    Greeter greeterRef = this;

    int add(int a, int b) {
        return a + b;
    }

    public String greet(String who) {
        return "Hello, " + who;
    }

    void run() {
        int x = 10;
        double pi = 3.14;
        String msg = "hello";
        Integer boxed = 42;
        // BREAKPOINT HERE — line 37
        System.out.println("x=" + x + " pi=" + pi + " msg=" + msg + " boxed=" + boxed);
    }

    public static void main(String[] args) {
        new ExprTest().run();
    }
}
