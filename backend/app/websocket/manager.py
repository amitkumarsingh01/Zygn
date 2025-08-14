from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException
from typing import Dict, List
import json
from app.auth.utils import verify_token
from app.database import get_database
from bson import ObjectId

websocket_router = APIRouter()

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        self.active_connections[user_id] = websocket

    def disconnect(self, user_id: str):
        if user_id in self.active_connections:
            del self.active_connections[user_id]

    async def send_personal_message(self, message: dict, user_id: str):
        if user_id in self.active_connections:
            websocket = self.active_connections[user_id]
            try:
                await websocket.send_text(json.dumps(message))
            except:
                # Connection might be closed, remove it
                self.disconnect(user_id)

    async def broadcast(self, message: dict, user_ids: List[str]):
        for user_id in user_ids:
            await self.send_personal_message(message, user_id)

connection_manager = ConnectionManager()

@websocket_router.websocket("/chat/{token}")
async def websocket_endpoint(websocket: WebSocket, token: str, db=Depends(get_database)):
    try:
        # Verify token
        user_id = verify_token(token)
        user = await db.users.find_one({"user_id": user_id})
        if not user:
            await websocket.close(code=1008, reason="User not found")
            return
        
        await connection_manager.connect(websocket, user_id)
        
        try:
            while True:
                data = await websocket.receive_text()
                message_data = json.loads(data)
                
                # Handle different message types
                if message_data.get("type") == "ping":
                    await websocket.send_text(json.dumps({"type": "pong"}))
                
        except WebSocketDisconnect:
            connection_manager.disconnect(user_id)
            
    except Exception as e:
        await websocket.close(code=1008, reason="Authentication failed")