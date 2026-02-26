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

    public static void main(String[] args) {
        int x = 10;                        // line 20
        int y = 20;                        // line 21
        int sum = add(x, y);               // line 22
        String msg = greet("World");       // line 23
        System.out.println(msg);           // line 24
        System.out.println("Sum: " + sum); // line 25
    }
}
