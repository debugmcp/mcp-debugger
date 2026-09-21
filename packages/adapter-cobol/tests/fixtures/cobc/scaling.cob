       >>source format free
identification division.
program-id. SCALING.
data division.
working-storage section.
01 LEAD-D PIC PP999.
01 TRAIL-D PIC 999PP.
01 LEAD-S PIC SPP999 SIGN LEADING SEPARATE.
01 TRAIL-S PIC S999PP SIGN TRAILING SEPARATE.
01 LEAD-P PIC PP999 COMP-3.
01 TRAIL-P PIC 999PP COMP-3.
01 LEAD-B PIC PP999 COMP.
01 TRAIL-B PIC 999PP COMP.
procedure division.
    display LEAD-D TRAIL-D LEAD-S TRAIL-S LEAD-P TRAIL-P
            LEAD-B TRAIL-B
    goback.
