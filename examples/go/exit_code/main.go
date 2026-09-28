// exit_code: a tiny program whose exit status is chosen by its first argument.
//
// Used by the Go exit-code integration test (issue #753): Delve never sends a
// DAP `exited` event and only prints "Process N has exited with status S" to
// the console, so mcp-debugger reads that line back. Its own module, pinned to
// go 1.21, so it builds and debugs on the oldest Go the CI Delve accepts.
//
//	go run . 7   -> prints one line, exits 7
//	go run .     -> prints one line, exits 0
package main

import (
	"fmt"
	"os"
	"strconv"
)

func main() {
	code := 0
	if len(os.Args) > 1 {
		parsed, err := strconv.Atoi(os.Args[1])
		if err != nil {
			fmt.Fprintf(os.Stderr, "exit_code fixture: not a number: %q\n", os.Args[1])
			os.Exit(2)
		}
		code = parsed
	}
	fmt.Printf("exit_code fixture: exiting with status %d\n", code)
	os.Exit(code)
}
