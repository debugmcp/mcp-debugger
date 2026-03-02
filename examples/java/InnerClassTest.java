/**
 * Test fixture for inner class breakpoints in JDI bridge.
 *
 * Compile:  javac -g InnerClassTest.java
 * Run:      java InnerClassTest
 *
 * Breakpoint target: line inside Inner.compute() (marked below).
 * Tests that ClassPrepareRequest with "$*" suffix and "$"-stripping
 * in handleClassPrepared correctly resolve breakpoints in inner classes.
 */
public class InnerClassTest {

    class Inner {
        int compute(int a, int b) {
            int result = a + b;     // BREAKPOINT HERE
            return result;
        }
    }

    public static void main(String[] args) throws Exception {
        InnerClassTest outer = new InnerClassTest();
        InnerClassTest.Inner inner = outer.new Inner();
        int sum = inner.compute(7, 8);
        System.out.println("Sum: " + sum);
    }
}
