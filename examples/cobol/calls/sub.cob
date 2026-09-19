       IDENTIFICATION DIVISION.
       PROGRAM-ID. CALLSUB.
       DATA DIVISION.
       LOCAL-STORAGE SECTION.
       01  LS-WORK         PIC S9(9) COMP VALUE 0.
       01  LS-TAG          PIC X(6) VALUE "LOCAL".
       LINKAGE SECTION.
       01  LK-ARG-REC.
           05 LK-A         PIC S9(9) COMP.
           05 LK-B         PIC S9(9) COMP.
           05 LK-SUM       PIC S9(9) COMP.
           05 LK-NAME      PIC X(10).
       PROCEDURE DIVISION USING LK-ARG-REC.
       0000-SUB-MAIN.
           ADD LK-A TO LK-B GIVING LS-WORK
           MOVE LS-WORK TO LK-SUM
           MOVE "CALLEE" TO LK-NAME
           GOBACK.
