const EventSource = require('eventsource');

// Test SSE connection
const url = 'http://localhost:3001/sse';
console.log('Connecting to SSE endpoint:', url);

const es = new EventSource(url);

es.addEventListener('open', () => {
  console.log('SSE connection opened');
});

es.addEventListener('message', (event) => {
  console.log('Received message:', event.data);
  
  // Extract session ID from the connection established message
  try {
    const data = JSON.parse(event.data);
    if (data.method === 'connection/established') {
      const sessionId = data.params?.sessionId;
      if (sessionId) {
        console.log('Session ID:', sessionId);
        
        // Test POST request with session ID
        fetch('http://localhost:3001/sse', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Session-ID': sessionId
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'tools/list',
            id: 1
          })
        })
        .then(response => response.json())
        .then(data => {
          console.log('POST response:', data);
        })
        .catch(error => {
          console.error('POST error:', error);
        });
      }
    }
  } catch (error) {
    // Not all messages are JSON
  }
});

es.addEventListener('error', (error) => {
  console.error('SSE error:', error);
});

// Keep the script running
process.stdin.resume();
console.log('Press Ctrl+C to exit');
