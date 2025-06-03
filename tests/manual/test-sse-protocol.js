// Test SSE connection with proper MCP SDK protocol handling
import http from 'http';

const SSE_URL = 'http://localhost:3001/sse';

console.log('Testing SSE connection with MCP SDK protocol...');

// Function to parse SSE events
function parseSSEEvents(chunk) {
  const lines = chunk.toString().split('\n');
  const events = [];
  
  let currentEvent = {};
  for (const line of lines) {
    if (line.startsWith('event: ')) {
      currentEvent.event = line.substring(7);
    } else if (line.startsWith('data: ')) {
      currentEvent.data = line.substring(6);
    } else if (line === '' && currentEvent.event) {
      events.push({...currentEvent});
      currentEvent = {};
    }
  }
  
  return events;
}

// Establish SSE connection
const sseRequest = http.get(SSE_URL, {
  headers: {
    'Accept': 'text/event-stream',
    'Cache-Control': 'no-cache'
  }
}, (res) => {
  console.log('SSE connection established, status:', res.statusCode);
  console.log('Headers:', res.headers);
  
  let sessionId = null;
  
  res.on('data', (chunk) => {
    console.log('\nReceived SSE chunk:', chunk.toString());
    
    const events = parseSSEEvents(chunk);
    
    for (const event of events) {
      console.log('Parsed event:', event);
      
      // Handle endpoint event (MCP SDK SSE protocol)
      if (event.event === 'endpoint' && event.data) {
        // Extract session ID from the endpoint URL
        const match = event.data.match(/sessionId=([a-f0-9-]+)/);
        if (match) {
          sessionId = match[1];
          console.log('\nExtracted session ID:', sessionId);
          
          // Now test POST request with session ID
          setTimeout(() => {
            testPostRequest(sessionId);
          }, 1000);
        }
      }
    }
  });
  
  res.on('error', (err) => {
    console.error('SSE error:', err);
  });
});

sseRequest.on('error', (err) => {
  console.error('Connection error:', err);
});

// Function to test POST request
function testPostRequest(sessionId) {
  console.log('\n=== Testing POST request with session ID:', sessionId);
  
  const postData = JSON.stringify({
    jsonrpc: '2.0',
    method: 'tools/list',
    id: 1
  });
  
  const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/sse',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': postData.length,
      'X-Session-ID': sessionId
    }
  };
  
  const postReq = http.request(options, (res) => {
    console.log('\nPOST response status:', res.statusCode);
    console.log('POST response headers:', res.headers);
    
    let responseData = '';
    res.on('data', (chunk) => {
      responseData += chunk;
    });
    
    res.on('end', () => {
      console.log('\nPOST response body:', responseData);
      
      // Test is complete, but keep SSE connection open to see if we get the response via SSE
      console.log('\n=== Test completed. Waiting for SSE response...');
      console.log('Press Ctrl+C to exit.');
    });
  });
  
  postReq.on('error', (err) => {
    console.error('POST request error:', err);
  });
  
  postReq.write(postData);
  postReq.end();
}

// Keep script running
process.stdin.resume();
