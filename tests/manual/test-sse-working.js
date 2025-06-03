// Test SSE connection with proper session handling
import http from 'http';
import https from 'https';

const SSE_URL = 'http://localhost:3001/sse';

console.log('Testing SSE connection...');

// Function to parse SSE data
function parseSSEData(chunk) {
  const lines = chunk.toString().split('\n');
  const messages = [];
  
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = line.substring(6);
      try {
        messages.push(JSON.parse(data));
      } catch (e) {
        // Not JSON, ignore
      }
    }
  }
  
  return messages;
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
    console.log('Received SSE data:', chunk.toString());
    
    const messages = parseSSEData(chunk);
    
    for (const message of messages) {
      console.log('Parsed message:', message);
      
      if (message.method === 'connection/established' && message.params?.sessionId) {
        sessionId = message.params.sessionId;
        console.log('Got session ID:', sessionId);
        
        // Now test POST request with session ID
        setTimeout(() => {
          testPostRequest(sessionId);
        }, 1000);
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
  console.log('\n--- Testing POST request with session ID:', sessionId);
  
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
    console.log('POST response status:', res.statusCode);
    console.log('POST response headers:', res.headers);
    
    let responseData = '';
    res.on('data', (chunk) => {
      responseData += chunk;
    });
    
    res.on('end', () => {
      console.log('POST response body:', responseData);
      try {
        const parsed = JSON.parse(responseData);
        console.log('Parsed response:', JSON.stringify(parsed, null, 2));
      } catch (e) {
        console.log('Response is not JSON');
      }
      
      // Keep the connection open for a bit to see any SSE messages
      setTimeout(() => {
        console.log('\nTest completed. Press Ctrl+C to exit.');
      }, 2000);
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
