from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import IndexModel, ASCENDING
from app.config import settings
import asyncio

class Database:
    client: AsyncIOMotorClient = None
    database = None

db = Database()

async def connect_to_mongo():
    """Create database connection"""
    try:
        print(f"Connecting to MongoDB at: {settings.mongodb_url}")
        db.client = AsyncIOMotorClient(settings.mongodb_url)
        db.database = db.client[settings.database_name]
        
        # Test the connection
        await db.client.admin.command('ping')
        print("MongoDB connection successful!")
        
        # Create indexes
        await create_indexes()
        print("Database indexes created successfully!")
    except Exception as e:
        print(f"MongoDB connection error: {e}")
        raise e

async def close_mongo_connection():
    """Close database connection"""
    if db.client:
        db.client.close()

async def create_indexes():
    """Create database indexes for better performance"""
    # Users collection indexes
    users_collection = db.database.users
    await users_collection.create_index([("user_id", ASCENDING)], unique=True)
    await users_collection.create_index([("phone_no", ASCENDING)], unique=True)
    await users_collection.create_index([("email", ASCENDING)], unique=True)
    await users_collection.create_index([("char_id", ASCENDING)], unique=True)
    
    # Documents collection indexes
    docs_collection = db.database.documents
    await docs_collection.create_index([("char_id", ASCENDING)])
    await docs_collection.create_index([("involved_users", ASCENDING)])
    
    # Messages collection indexes
    messages_collection = db.database.messages
    await messages_collection.create_index([("sender_id", ASCENDING)])
    await messages_collection.create_index([("receiver_id", ASCENDING)])
    await messages_collection.create_index([("created_at", ASCENDING)])
    
    # Payment distributions collection indexes
    payment_distributions_collection = db.database.payment_distributions
    await payment_distributions_collection.create_index([("document_id", ASCENDING)], unique=True)
    await payment_distributions_collection.create_index([("document_code", ASCENDING)])

async def get_database():
    return db.database