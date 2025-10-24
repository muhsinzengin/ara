#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Admin Pro WebRTC Signaling Server
WebSocket server for real-time WebRTC signaling between admin and clients
"""

import asyncio
import json
import logging
import threading
import time
from datetime import datetime
from typing import Dict, Set, Optional
import websockets
from websockets.exceptions import ConnectionClosedError

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global state
admin_connections: Set[websockets.WebSocketServerProtocol] = set()
client_connections: Dict[str, websockets.WebSocketServerProtocol] = {}
call_states: Dict[str, Dict] = {}  # call_id -> state info
call_recordings_ws: Dict[str, Dict] = {}  # call_id -> recording data for WebSocket

class SignalingServer:
    def __init__(self, host: str = '0.0.0.0', port: int = 8081):
        self.host = host
        self.port = port
        self.server = None

    async def handle_connection(self, websocket: websockets.WebSocketServerProtocol, path: str):
        """Handle WebSocket connections"""
        try:
            # Determine connection type from path
            if path == '/ws/admin':
                await self.handle_admin_connection(websocket)
            elif path.startswith('/ws/client/'):
                client_id = path.split('/')[-1]
                await self.handle_client_connection(websocket, client_id)
            else:
                logger.warning(f"Unknown path: {path}")
                await websocket.close(1003, "Unsupported path")

        except ConnectionClosedError:
            logger.info("Connection closed normally")
        except Exception as e:
            logger.error(f"Connection error: {e}")
            await websocket.close(1011, "Internal server error")

    async def handle_admin_connection(self, websocket: websockets.WebSocketServerProtocol):
        """Handle admin WebSocket connection"""
        logger.info("Admin connected")
        admin_connections.add(websocket)

        try:
            async for message in websocket:
                try:
                    data = json.loads(message)
                    await self.handle_admin_message(websocket, data)
                except json.JSONDecodeError:
                    logger.warning("Invalid JSON from admin")
                    await websocket.send(json.dumps({
                        'type': 'error',
                        'message': 'Invalid JSON'
                    }))

        finally:
            admin_connections.discard(websocket)
            logger.info("Admin disconnected")

    async def handle_client_connection(self, websocket: websockets.WebSocketServerProtocol, client_id: str):
        """Handle client WebSocket connection"""
        logger.info(f"Client connected: {client_id}")
        client_connections[client_id] = websocket

        try:
            async for message in websocket:
                try:
                    data = json.loads(message)
                    await self.handle_client_message(websocket, client_id, data)
                except json.JSONDecodeError:
                    logger.warning(f"Invalid JSON from client {client_id}")
                    await websocket.send(json.dumps({
                        'type': 'error',
                        'message': 'Invalid JSON'
                    }))

        finally:
            if client_id in client_connections:
                del client_connections[client_id]
            logger.info(f"Client disconnected: {client_id}")

    async def handle_admin_message(self, websocket: websockets.WebSocketServerProtocol, data: Dict):
        """Handle messages from admin"""
        msg_type = data.get('type')
        logger.info(f"Admin message: {msg_type}")

        if msg_type == 'accept_call':
            call_id = data.get('call_id')
            if call_id and call_id in call_states:
                call_states[call_id]['status'] = 'accepted'
                # Notify client
                client_id = call_states[call_id].get('client_id')
                if client_id and client_id in client_connections:
                    await client_connections[client_id].send(json.dumps({
                        'type': 'call_accepted',
                        'call_id': call_id
                    }))

        elif msg_type == 'offer':
            # Forward offer to client
            client_id = data.get('client_id')
            if client_id and client_id in client_connections:
                await client_connections[client_id].send(json.dumps({
                    'type': 'offer',
                    'offer': data.get('offer'),
                    'call_id': data.get('call_id')
                }))

        elif msg_type == 'ice_candidate':
            # Forward ICE candidate to client
            client_id = data.get('client_id')
            if client_id and client_id in client_connections:
                await client_connections[client_id].send(json.dumps({
                    'type': 'ice_candidate',
                    'candidate': data.get('candidate')
                }))

        elif msg_type == 'hangup':
            # Handle hangup
            call_id = data.get('call_id')
            if call_id and call_id in call_states:
                call_states[call_id]['status'] = 'ended'
                # Notify client
                client_id = call_states[call_id].get('client_id')
                if client_id and client_id in client_connections:
                    await client_connections[client_id].send(json.dumps({
                        'type': 'hangup',
                        'call_id': call_id
                    }))

        elif msg_type == 'save_recording':
            # Save call recording data
            call_id = data.get('call_id')
            recording_data = data.get('recording_data', {})
            if call_id:
                call_recordings_ws[call_id] = recording_data
                logger.info(f"Recording saved for call {call_id}")

        elif msg_type == 'transfer_call':
            # Transfer call to another admin
            call_id = data.get('call_id')
            target_admin_id = data.get('target_admin_id')
            if call_id and call_id in call_states:
                # Update call state
                call_states[call_id]['status'] = 'transferring'
                call_states[call_id]['transferred_from'] = data.get('from_admin_id')
                call_states[call_id]['transferred_to'] = target_admin_id

                # Notify target admin
                transfer_message = {
                    'type': 'call_transfer',
                    'call_id': call_id,
                    'customer_name': call_states[call_id].get('customer_name', 'Unknown'),
                    'client_id': call_states[call_id].get('client_id'),
                    'from_admin_id': data.get('from_admin_id')
                }

                # Send to all admins (target admin will handle it)
                for admin_ws in admin_connections:
                    try:
                        await admin_ws.send(json.dumps(transfer_message))
                    except Exception as e:
                        logger.error(f"Failed to notify admin about transfer: {e}")

                logger.info(f"Call {call_id} transferred to admin {target_admin_id}")

    async def handle_client_message(self, websocket: websockets.WebSocketServerProtocol, client_id: str, data: Dict):
        """Handle messages from client"""
        msg_type = data.get('type')
        logger.info(f"Client {client_id} message: {msg_type}")

        if msg_type == 'register':
            # Client registration
            call_id = data.get('call_id')
            if call_id:
                call_states[call_id] = {
                    'client_id': client_id,
                    'customer_name': data.get('customer_name', 'Unknown'),
                    'status': 'waiting',
                    'timestamp': datetime.now().isoformat()
                }
                # Notify all admins
                for admin_ws in admin_connections:
                    try:
                        await admin_ws.send(json.dumps({
                            'type': 'new_call',
                            'call_id': call_id,
                            'client_id': client_id,
                            'customer_name': data.get('customer_name', 'Unknown')
                        }))
                    except Exception as e:
                        logger.error(f"Failed to notify admin: {e}")

        elif msg_type == 'answer':
            # Forward answer to admin
            for admin_ws in admin_connections:
                try:
                    await admin_ws.send(json.dumps({
                        'type': 'answer',
                        'answer': data.get('answer'),
                        'call_id': data.get('call_id')
                    }))
                except Exception as e:
                    logger.error(f"Failed to forward answer: {e}")

        elif msg_type == 'ice_candidate':
            # Forward ICE candidate to admin
            for admin_ws in admin_connections:
                try:
                    await admin_ws.send(json.dumps({
                        'type': 'ice_candidate',
                        'candidate': data.get('candidate'),
                        'client_id': client_id
                    }))
                except Exception as e:
                    logger.error(f"Failed to forward ICE candidate: {e}")

    async def start(self):
        """Start the WebSocket server"""
        self.server = await websockets.serve(
            self.handle_connection,
            self.host,
            self.port,
            ping_interval=30,
            ping_timeout=10
        )
        logger.info(f"WebSocket server started on ws://{self.host}:{self.port}")

        # Keep the server running
        await self.server.wait_closed()

    def stop(self):
        """Stop the WebSocket server"""
        if self.server:
            self.server.close()
            logger.info("WebSocket server stopped")

async def main():
    """Main function"""
    server = SignalingServer()
    try:
        await server.start()
    except KeyboardInterrupt:
        logger.info("Shutting down...")
        server.stop()

if __name__ == '__main__':
    asyncio.run(main())
