       IDENTIFICATION DIVISION.
       PROGRAM-ID. RTERROR.
       DATA DIVISION.
       WORKING-STORAGE SECTION.
       01  WS-TABLE.
           05 WS-CELL OCCURS 3 TIMES PIC 9(3) VALUE 7.
       01  WS-IDX          PIC 9(4) COMP VALUE 0.
       01  WS-SUM          PIC 9(6) VALUE 0.
       PROCEDURE DIVISION.
       0000-MAIN.
           MOVE 5 TO WS-IDX
           DISPLAY "about to index " WS-IDX
           ADD WS-CELL(WS-IDX) TO WS-SUM
           DISPLAY "COBOL_DEBUG_MARKER: sum=" WS-SUM
           STOP RUN.
