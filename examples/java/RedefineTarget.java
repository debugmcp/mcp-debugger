/**
 * Test fixture for redefine_classes hot-reload testing.
 *
 * The test sets a breakpoint in main(), verifies getValue() returns 42,
 * then hot-swaps this class with RedefineTargetV2 (which returns 99)
 * and verifies the change took effect.
 */
public class RedefineTarget {

    static int getValue() {
        return 42;  // line 11 — will be hot-swapped to return 99
    }

    public static void main(String[] args) throws Exception {
        System.out.println("RedefineTarget starting...");
        Thread.sleep(2000);  // wait for breakpoint setup

        int val1 = getValue();              // line 19 — first breakpoint target
        System.out.println("val1 = " + val1);

        // After hot-reload, getValue() should return 99
        int val2 = getValue();              // line 23 — second breakpoint target
        System.out.println("val2 = " + val2);

        System.out.println("RedefineTarget done.");
    }
}
