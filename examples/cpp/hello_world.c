/* Simple C example exercising the C-dialect compile branch (issue #325). */
/* Compile: gcc -gdwarf-4 -O0 -o hello_c hello_world.c */
#include <stdio.h>

static int add(int a, int b) {
    return a + b;
}

int main(void) {
    int x = 5;
    int y = 7;
    int sum = add(x, y);
    printf("C_DEBUG_MARKER: sum=%d\n", sum);
    return 0;
}
