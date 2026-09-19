       IDENTIFICATION DIVISION.
       PROGRAM-ID. PAUSE.
       DATA DIVISION.
       WORKING-STORAGE SECTION.
       01  WS-TICK         PIC 9(9) VALUE 0.
       01  WS-ONE          PIC 9 VALUE 1.
       PROCEDURE DIVISION.
       0000-MAIN.
           DISPLAY "pause-test started"
           PERFORM UNTIL WS-TICK > 300
               ADD 1 TO WS-TICK
               CALL "C$SLEEP" USING WS-ONE
           END-PERFORM
           DISPLAY "COBOL_DEBUG_MARKER: ticks=" WS-TICK
           STOP RUN.
