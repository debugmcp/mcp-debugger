// Long-running program for testing pause_execution.
package main

import "time"

func main() {
	counter := 0
	for {
		counter++
		time.Sleep(500 * time.Millisecond)
	}
}
