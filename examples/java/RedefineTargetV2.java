/**
 * Modified version of RedefineTarget for hot-reload testing.
 *
 * This file is compiled separately and its .class file replaces the original
 * RedefineTarget.class via redefine_classes. The only change is getValue()
 * returns 99 instead of 42.
 *
 * IMPORTANT: The class name must remain "RedefineTarget" (not "RedefineTargetV2")
 * so the bytecode matches the loaded class. This file is named V2 only for
 * organizational purposes — it is compiled as RedefineTarget.class.
 */
public class RedefineTarget {

    static int getValue() {
        return 99;  // changed from 42 to 99
    }

    public static void main(String[] args) throws Exception {
        System.out.println("RedefineTarget starting...");
        Thread.sleep(2000);

        int val1 = getValue();
        System.out.println("val1 = " + val1);

        int val2 = getValue();
        System.out.println("val2 = " + val2);

        System.out.println("RedefineTarget done.");
    }
}
