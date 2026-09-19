       IDENTIFICATION DIVISION.
       PROGRAM-ID. CPYMAIN.
       DATA DIVISION.
       WORKING-STORAGE SECTION.
       COPY "wsrec.cpy".
       01  WS-DONE         PIC X VALUE "N".
       PROCEDURE DIVISION.
       0000-MAIN.
           PERFORM 9000-FROM-COPYBOOK
           MOVE "Y" TO WS-DONE
           COPY "stmts.cpy".
           DISPLAY "COBOL_DEBUG_MARKER: price=" CP-PRICE
           STOP RUN.
       COPY "procpara.cpy".
