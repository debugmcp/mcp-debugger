       IDENTIFICATION DIVISION.
       PROGRAM-ID. shapes.
      * Every data shape the manifest parser must get right (issue #759
      * review): INDEXED BY, ODO under -std=ibm (odoslide), LOCAL-STORAGE
      * groups with subordinates and an ODO table, referenced EXTERNAL and
      * BASED items, an edited picture with a comma, a 35-character name,
      * a lower-case PROGRAM-ID, a two-record FD, and enough items for the
      * -t listing to cross its 55-line page.
       ENVIRONMENT DIVISION.
       INPUT-OUTPUT SECTION.
       FILE-CONTROL.
           SELECT REC-FILE ASSIGN TO "shapes.dat"
               ORGANIZATION IS LINE SEQUENTIAL.
       DATA DIVISION.
       FILE SECTION.
       FD  REC-FILE.
       01  REC-A.
           05  REC-A-KEY            PIC X(4).
           05  REC-A-BODY           PIC X(20).
       01  REC-B.
           05  REC-B-KEY            PIC X(4).
           05  REC-B-AMOUNT         PIC 9(6)V99.
           05  REC-B-FILL           PIC X(12).
       WORKING-STORAGE SECTION.
       01  WS-TABLE.
           05  WS-ENTRY OCCURS 5 TIMES INDEXED BY WS-IX.
               10  WS-AMOUNT        PIC 9(4).
               10  WS-CODE          PIC X(2).
       01  WS-COUNT                 PIC 9(2) VALUE 3.
       01  WS-ODO-TABLE.
           05  WS-ROW OCCURS 1 TO 9 TIMES DEPENDING ON WS-COUNT.
               10  WS-COL           PIC X(2).
       01  WS-EDITED                PIC ZZ,ZZ9.99 VALUE 1234.5.
       01  WS-A-VERY-LONG-DATA-NAME-OF-THIRTY-FIVE PIC X(3)
                                    VALUE 'ABC'.
       01  WS-EXT                   PIC X(10) EXTERNAL.
       01  WS-BASED                 PIC X(4) BASED.
       01  WS-FILLER-GROUP.
           05  WS-F01               PIC 9(2) VALUE 1.
           05  WS-F02               PIC 9(2) VALUE 2.
           05  WS-F03               PIC 9(2) VALUE 3.
           05  WS-F04               PIC 9(2) VALUE 4.
           05  WS-F05               PIC 9(2) VALUE 5.
           05  WS-F06               PIC 9(2) VALUE 6.
           05  WS-F07               PIC 9(2) VALUE 7.
           05  WS-F08               PIC 9(2) VALUE 8.
           05  WS-F09               PIC 9(2) VALUE 9.
           05  WS-F10               PIC 9(2) VALUE 10.
           05  WS-F11               PIC 9(2) VALUE 11.
           05  WS-F12               PIC 9(2) VALUE 12.
           05  WS-F13               PIC 9(2) VALUE 13.
           05  WS-F14               PIC 9(2) VALUE 14.
           05  WS-F15               PIC 9(2) VALUE 15.
           05  WS-F16               PIC 9(2) VALUE 16.
           05  WS-F17               PIC 9(2) VALUE 17.
           05  WS-F18               PIC 9(2) VALUE 18.
           05  WS-F19               PIC 9(2) VALUE 19.
           05  WS-F20               PIC 9(2) VALUE 20.
           05  WS-F21               PIC 9(2) VALUE 21.
           05  WS-F22               PIC 9(2) VALUE 22.
           05  WS-F23               PIC 9(2) VALUE 23.
           05  WS-F24               PIC 9(2) VALUE 24.
           05  WS-F25               PIC 9(2) VALUE 25.
           05  WS-F26               PIC 9(2) VALUE 26.
           05  WS-F27               PIC 9(2) VALUE 27.
           05  WS-F28               PIC 9(2) VALUE 28.
           05  WS-F29               PIC 9(2) VALUE 29.
           05  WS-F30               PIC 9(2) VALUE 30.
           05  WS-F31               PIC 9(2) VALUE 31.
           05  WS-F32               PIC 9(2) VALUE 32.
           05  WS-F33               PIC 9(2) VALUE 33.
           05  WS-F34               PIC 9(2) VALUE 34.
           05  WS-F35               PIC 9(2) VALUE 35.
           05  WS-F36               PIC 9(2) VALUE 36.
           05  WS-F37               PIC 9(2) VALUE 37.
           05  WS-F38               PIC 9(2) VALUE 38.
           05  WS-F39               PIC 9(2) VALUE 39.
           05  WS-F40               PIC 9(2) VALUE 40.
       01  WS-BIG.
           05  WS-LINE              PIC X(4) OCCURS 500 TIMES.
       LOCAL-STORAGE SECTION.
       01  LS-A                     PIC X(4).
       01  LS-G.
           05  LS-G1                PIC X(2).
           05  LS-G2                PIC X(2).
           05  LS-COUNT             PIC 9(1) VALUE 2.
           05  LS-TBL               PIC X(3)
               OCCURS 1 TO 3 TIMES DEPENDING ON LS-COUNT.
       PROCEDURE DIVISION.
       0000-MAIN.
           MOVE 1234 TO WS-AMOUNT(2).
           MOVE 'AB' TO WS-CODE(2).
           SET WS-IX TO 3.
           MOVE 'XY' TO WS-COL(2).
           MOVE 'AB' TO LS-G1.
           MOVE 'CD' TO LS-G2.
           MOVE 'QQQ' TO LS-TBL(2).
           MOVE 'external!' TO WS-EXT.
           ALLOCATE WS-BASED INITIALIZED.
           MOVE 'BSED' TO WS-BASED.
           MOVE 'k1' TO REC-A-KEY.
           MOVE 'k2' TO REC-B-KEY.
           MOVE 7 TO WS-F40.
           MOVE 'L499' TO WS-LINE(499).
           DISPLAY 'SHAPES ' WS-AMOUNT(2) ' ' WS-EDITED ' ' LS-G2 ' '
               WS-COL(2) ' ' WS-EXT ' ' WS-BASED ' ' WS-ENTRY(WS-IX).
           FREE WS-BASED.
           STOP RUN.
