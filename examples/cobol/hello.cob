       IDENTIFICATION DIVISION.
       PROGRAM-ID. HELLO.
       ENVIRONMENT DIVISION.
       DATA DIVISION.
       WORKING-STORAGE SECTION.
       01  WS-ALPHA        PIC X(12) VALUE "HELLO".
       01  WS-U            PIC 9(5) VALUE 12345.
       01  WS-SCALED       PIC S9(5)V99 VALUE -123.45.
       01  WS-BINARY       PIC S9(9) COMP VALUE -123456789.
       01  WS-PACKED       PIC S9(7)V99 COMP-3 VALUE -12345.67.
       01  WS-COMP5        PIC S9(9) COMP-5 VALUE 987654321.
       01  WS-DOUBLE       COMP-2 VALUE 3.14159.
       01  WS-GROUP.
           05 WS-ID        PIC 9(4) VALUE 42.
           05 WS-NAME      PIC X(20) VALUE "ALICE".
           05 WS-STATUS    PIC X VALUE "A".
              88 WS-STATUS-ACTIVE VALUE "A".
              88 WS-STATUS-CLOSED VALUE "C" "X".
       01  WS-TABLE.
           05 WS-ENTRY OCCURS 5 TIMES.
              10 WS-AMOUNT PIC 9(4).
       01  WS-COUNT        PIC 9 VALUE 3.
       01  WS-ODO.
           05 WS-ITEM OCCURS 1 TO 9 TIMES DEPENDING ON WS-COUNT
                                                    PIC X.
       01  WS-RAW          PIC X(8) VALUE "00001234".
       01  WS-ALT REDEFINES WS-RAW PIC 9(8).
       01  WS-TOTAL        PIC S9(7)V99 COMP-3 VALUE 0.
       01  WS-IDX          PIC 9(4) COMP VALUE 0.
       PROCEDURE DIVISION.
       0000-MAIN.
           PERFORM 1000-INIT
           PERFORM 2000-COMPUTE
           PERFORM 3000-REPORT
           STOP RUN.
       1000-INIT.
           MOVE "ABC" TO WS-ODO
           PERFORM VARYING WS-IDX FROM 1 BY 1 UNTIL WS-IDX > 5
               COMPUTE WS-AMOUNT(WS-IDX) = WS-IDX * 100
           END-PERFORM.
       2000-COMPUTE.
           MOVE 0 TO WS-TOTAL
           PERFORM VARYING WS-IDX FROM 1 BY 1 UNTIL WS-IDX > 5
               ADD WS-AMOUNT(WS-IDX) TO WS-TOTAL
           END-PERFORM
           ADD WS-SCALED TO WS-TOTAL.
       3000-REPORT.
           DISPLAY "COBOL_DEBUG_MARKER: total=" WS-TOTAL
           DISPLAY "name=" WS-NAME " id=" WS-ID.
