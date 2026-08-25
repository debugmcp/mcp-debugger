/**
 * Hot-swap counterpart of RedefineTarget.java — getValue() returns 99, not 42.
 *
 * LINE LAYOUT MUST STAY IDENTICAL TO RedefineTarget.java: a redefine re-resolves
 * breakpoints by line number against the new line table, so drift silently rebinds
 * them. Class name stays "RedefineTarget"; "V2" is filename-only — stage before javac.
 */
public class RedefineTarget {

    static int getValue() {
        return 99;  // line 11 — hot-swapped counterpart of RedefineTarget's "return 42"
    }

    public static void main(String[] args) throws Exception {
        System.out.println("RedefineTarget starting...");
        Thread.sleep(2000);  // wait for breakpoint setup

        int val1 = getValue();
        System.out.println("val1 = " + val1);  // line 19 — first breakpoint target (val1 already assigned when paused here)

        // After hot-reload, getValue() should return 99
        int val2 = getValue();              // line 22 — second breakpoint target
        System.out.println("val2 = " + val2);

        System.out.println("RedefineTarget done.");
    }
}
