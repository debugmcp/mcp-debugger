/**
 * Simple Java program for smoke-testing the Java debug adapter.
 *
 * Compile:  javac HelloWorld.java
 * Run:      java HelloWorld
 */
public class HelloWorld {

    static int add(int a, int b) {
        int result = a + b;     // line 10
        return result;          // line 11
    }

    static String greet(String name) {
        String greeting = "Hello, " + name + "!";  // line 15
        return greeting;                             // line 16
    }

    public static void main(String[] args) throws Exception {
        System.out.println("Starting...");         // line 20
        Thread.sleep(2000);                        // line 21 — pause for breakpoint setup
        int x = 10;                                // line 22
        int y = 20;                                // line 23
        int sum = add(x, y);                       // line 24
        String msg = greet("World");               // line 25
        System.out.println(msg);                   // line 26
        System.out.println("Sum: " + sum);         // line 27
    }
}
