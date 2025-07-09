#!/usr/bin/env python3
"""
Simple debugpy server for testing MCP Server debugpy connections.
This file simulates a minimal debugpy server that listens for DAP connections.
"""

import sys
import time
import signal
import socket
import json

def signal_handler(sig, frame):
    """Handle graceful shutdown"""
    print("Shutting down debugpy server...")
    sys.exit(0)

def send_dap_response(conn, request_id, command, body=None):
    """Send a DAP response"""
    response = {
        "seq": request_id + 1,
        "type": "response",
        "request_seq": request_id,
        "success": True,
        "command": command
    }
    if body:
        response["body"] = body
    
    message = json.dumps(response)
    header = f"Content-Length: {len(message)}\r\n\r\n"
    conn.sendall((header + message).encode())

def handle_connection(conn, addr):
    """Handle a single DAP connection"""
    print(f"Connection from {addr}")
    buffer = b""
    
    try:
        while True:
            data = conn.recv(1024)
            if not data:
                break
                
            buffer += data
            
            # Parse DAP messages (simplified)
            while b"\r\n\r\n" in buffer:
                header_end = buffer.find(b"\r\n\r\n") + 4
                header = buffer[:header_end].decode()
                
                # Extract content length
                content_length = 0
                for line in header.split("\r\n"):
                    if line.startswith("Content-Length:"):
                        content_length = int(line.split(":")[1].strip())
                        break
                
                if len(buffer) >= header_end + content_length:
                    # We have a complete message
                    message_bytes = buffer[header_end:header_end + content_length]
                    buffer = buffer[header_end + content_length:]
                    
                    try:
                        message = json.loads(message_bytes.decode())
                        command = message.get("command", "")
                        seq = message.get("seq", 0)
                        
                        print(f"Received command: {command}")
                        
                        # Handle basic DAP commands
                        if command == "initialize":
                            send_dap_response(conn, seq, "initialize", {
                                "supportsConfigurationDoneRequest": True,
                                "supportsFunctionBreakpoints": False,
                                "supportsConditionalBreakpoints": True,
                                "supportsEvaluateForHovers": True,
                                "supportsStepBack": False,
                                "supportsSetVariable": True,
                                "supportsRestartFrame": False,
                                "supportsStepInTargetsRequest": False,
                                "supportsModulesRequest": True,
                                "supportsRestartRequest": False,
                                "supportsExceptionOptions": True,
                                "supportsExceptionInfoRequest": True,
                                "supportsTerminateRequest": True
                            })
                        elif command == "launch":
                            send_dap_response(conn, seq, "launch")
                        elif command == "configurationDone":
                            send_dap_response(conn, seq, "configurationDone")
                        elif command == "threads":
                            send_dap_response(conn, seq, "threads", {
                                "threads": [{"id": 1, "name": "MainThread"}]
                            })
                        elif command == "disconnect":
                            send_dap_response(conn, seq, "disconnect")
                            break
                        else:
                            # Generic response for other commands
                            send_dap_response(conn, seq, command)
                    
                    except json.JSONDecodeError:
                        print(f"Failed to parse message: {message_bytes}")
                else:
                    # Need more data
                    break
                    
    except Exception as e:
        print(f"Connection error: {e}")
    finally:
        conn.close()
        print(f"Connection closed for {addr}")

def main():
    """Main server loop"""
    if len(sys.argv) > 1:
        port = int(sys.argv[1])
    else:
        port = 5678
    
    # Set up signal handler
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    # Create server socket
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server.bind(("127.0.0.1", port))
    server.listen(5)
    
    print(f"Debugpy test server listening on port {port}...")
    
    try:
        while True:
            conn, addr = server.accept()
            handle_connection(conn, addr)
    except KeyboardInterrupt:
        pass
    finally:
        server.close()
        print("Server closed")

if __name__ == "__main__":
    main()
