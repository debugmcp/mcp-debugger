`scaling.cob` was translated with GnuCOBOL 3.1.2.0 (Ubuntu 24.04) and 3.2.0
(the repository's Linux Docker image). The `scaling/` directories preserve the generated
C, headers and symbol listing from:

```sh
COBC_GEN_DUMP_COMMENTS=1 cobc -C -g -fdump=ALL --save-temps -t scaling.lst -ftsymbols -o scaling.c ../scaling.cob
```

For `PP999`, both versions store three DISPLAY bytes, two packed bytes or two binary
bytes. 3.1.2 reports digits=5, scale=5; 3.2 reports digits=3, scale=5. For `999PP`,
both report digits=5, scale=-2. Separate signs add one DISPLAY byte. The listings retain
the original PICTURE text in both versions.
