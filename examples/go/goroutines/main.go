package main

import (
	"fmt"
	"sync"
	"time"
)

func main() {
	fmt.Println("Go Goroutines Debugging Example")
	
	// Example 1: Simple goroutines
	fmt.Println("\n=== Example 1: Simple Goroutines ===")
	simpleGoroutines()
	
	// Example 2: Goroutines with channels
	fmt.Println("\n=== Example 2: Goroutines with Channels ===")
	channelCommunication()
	
	// Example 3: Worker pool pattern
	fmt.Println("\n=== Example 3: Worker Pool ===")
	workerPool()
	
	fmt.Println("\nAll goroutines completed!")
}

func simpleGoroutines() {
	var wg sync.WaitGroup
	
	for i := 1; i <= 3; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			fmt.Printf("Goroutine %d: Starting\n", id)
			time.Sleep(time.Millisecond * 100)
			fmt.Printf("Goroutine %d: Finished\n", id)
		}(i)
	}
	
	wg.Wait()
}

func channelCommunication() {
	messages := make(chan string, 3)
	done := make(chan bool)
	
	// Producer goroutine
	go func() {
		messages <- "Hello"
		messages <- "from"
		messages <- "goroutines"
		close(messages)
	}()
	
	// Consumer goroutine
	go func() {
		for msg := range messages {
			fmt.Printf("Received: %s\n", msg)
			time.Sleep(time.Millisecond * 50)
		}
		done <- true
	}()
	
	<-done
}

func workerPool() {
	const numWorkers = 3
	const numJobs = 5
	
	jobs := make(chan int, numJobs)
	results := make(chan int, numJobs)
	
	// Start workers
	var wg sync.WaitGroup
	for w := 1; w <= numWorkers; w++ {
		wg.Add(1)
		go worker(w, jobs, results, &wg)
	}
	
	// Send jobs
	for j := 1; j <= numJobs; j++ {
		jobs <- j
	}
	close(jobs)
	
	// Wait for workers to finish
	go func() {
		wg.Wait()
		close(results)
	}()
	
	// Collect results
	for result := range results {
		fmt.Printf("Result: %d\n", result)
	}
}

func worker(id int, jobs <-chan int, results chan<- int, wg *sync.WaitGroup) {
	defer wg.Done()
	
	for job := range jobs {
		fmt.Printf("Worker %d: processing job %d\n", id, job)
		time.Sleep(time.Millisecond * 100)
		
		// Simulate some work
		result := job * 2
		
		results <- result
		fmt.Printf("Worker %d: finished job %d (result: %d)\n", id, job, result)
	}
}

