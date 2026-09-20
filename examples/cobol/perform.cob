       IDENTIFICATION DIVISION.
       PROGRAM-ID. PERFORMS.
      * PERFORM shapes the debugger must step the COBOL way (issue #759, M3):
      * a PERFORM inside an IF branch, PERFORM ... TIMES, a nested PERFORM,
      * and a PERFORM that is the last statement of a performed paragraph.
       DATA DIVISION.
       WORKING-STORAGE SECTION.
       01  WS-FLAG         PIC X VALUE "Y".
       01  WS-COUNT        PIC 9(4) COMP VALUE 0.
       01  WS-TIMES        PIC 9(4) COMP VALUE 0.
       01  WS-NESTED       PIC 9(4) COMP VALUE 0.
       01  WS-LAST         PIC 9(4) COMP VALUE 0.
       PROCEDURE DIVISION.
       0000-MAIN.
           IF WS-FLAG = "Y"
               PERFORM 1000-YES
           ELSE
               PERFORM 1500-NO
           END-IF
           DISPLAY "after-if count=" WS-COUNT
           PERFORM 2000-BUMP 3 TIMES
           DISPLAY "after-times times=" WS-TIMES
           PERFORM 3000-OUTER
           DISPLAY "after-outer nested=" WS-NESTED
           PERFORM 4000-TAIL
           DISPLAY "COBOL_DEBUG_MARKER: last=" WS-LAST
           STOP RUN.
       1000-YES.
           ADD 1 TO WS-COUNT.
       1500-NO.
           ADD 100 TO WS-COUNT.
       2000-BUMP.
           ADD 1 TO WS-TIMES.
       3000-OUTER.
           ADD 1 TO WS-NESTED
           PERFORM 3100-INNER.
       3100-INNER.
           ADD 10 TO WS-NESTED.
       4000-TAIL.
           ADD 1 TO WS-LAST
           PERFORM 4100-TAIL-END.
       4100-TAIL-END.
           ADD 10 TO WS-LAST.
