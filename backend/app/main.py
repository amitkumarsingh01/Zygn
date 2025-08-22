from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import os

from app.database import connect_to_mongo, close_mongo_connection
from app.config import settings

from app.auth.routes import auth_router
from app.users.routes import users_router
from app.documents.routes import documents_router
from app.messaging.routes import messaging_router
from app.payments.routes import payments_router
from app.wallet.routes import wallet_router
from app.websocket.manager import websocket_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await connect_to_mongo()
    
    # Create upload directories
    os.makedirs(f"{settings.upload_dir}/profile_pics", exist_ok=True)
    os.makedirs(f"{settings.upload_dir}/signatures", exist_ok=True)
    os.makedirs(f"{settings.upload_dir}/eye_scans", exist_ok=True)
    os.makedirs(f"{settings.upload_dir}/fingerprints", exist_ok=True)
    os.makedirs(f"{settings.upload_dir}/documents", exist_ok=True)
    os.makedirs(f"{settings.upload_dir}/govt_id_images", exist_ok=True)
    
    yield
    
    # Shutdown
    await close_mongo_connection()

app = FastAPI(
    title="Document Agreement System",
    description="Multi-user document agreement system with blockchain and AI verification",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://zygn.vercel.app",
        "https://zygn-git-main-aksml.vercel.app", 
        "https://zygn-aksml.vercel.app",
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "*"  # Keep wildcard for development
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# Additional CORS handling
@app.options("/{full_path:path}")
async def options_handler():
    return {"message": "CORS preflight handled"}

@app.middleware("http")
async def add_cors_headers(request, call_next):
    response = await call_next(request)
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, PATCH, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "*"
    response.headers["Access-Control-Allow-Credentials"] = "true"
    return response

# Note: We avoid custom multipart middleware to keep compatibility across Starlette versions.

# Static files
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Include routers
app.include_router(auth_router, prefix="/api/auth", tags=["Authentication"])
app.include_router(users_router, prefix="/api/users", tags=["Users"])
app.include_router(documents_router, prefix="/api/documents", tags=["Documents"])
app.include_router(messaging_router, prefix="/api/messaging", tags=["Messaging"])
app.include_router(payments_router, prefix="/api/payments", tags=["Payments"])
app.include_router(wallet_router, prefix="/api/wallet", tags=["Wallet"])
app.include_router(websocket_router, prefix="/ws", tags=["WebSocket"])

@app.get("/")
async def root():
    return {"message": "Document Agreement System API"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

@app.get("/test-cors")
async def test_cors():
    return {
        "message": "CORS test endpoint",
        "cors_enabled": True,
        "allowed_origins": [
            "https://zygn.vercel.app",
            "https://zygn-git-main-aksml.vercel.app",
            "https://zygn-aksml.vercel.app"
        ]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8005,
        reload=True,
        log_level="info"
    )