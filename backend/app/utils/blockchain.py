import hashlib
import json
from datetime import datetime, timezone
from typing import List, Dict

class SimpleBlockchain:
    def __init__(self):
        self.chain = []
        self.create_genesis_block()
    
    def create_genesis_block(self):
        genesis_block = {
            "index": 0,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "data": "Genesis Block",
            "previous_hash": "0",
            "hash": "0"
        }
        self.chain.append(genesis_block)
    
    def get_latest_block(self):
        return self.chain[-1]
    
    def calculate_hash(self, block: Dict) -> str:
        block_string = json.dumps(block, sort_keys=True)
        return hashlib.sha256(block_string.encode()).hexdigest()
    
    def add_block(self, data: Dict) -> str:
        latest_block = self.get_latest_block()
        new_block = {
            "index": len(self.chain),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "data": data,
            "previous_hash": latest_block["hash"]
        }
        new_block["hash"] = self.calculate_hash(new_block)
        self.chain.append(new_block)
        return new_block["hash"]

# Global blockchain instance
blockchain = SimpleBlockchain()

async def add_to_blockchain(document_id: str, file_paths: List[str]) -> str:
    """Add document information to blockchain"""
    
    # Create document hash from file paths and content
    document_data = {
        "document_id": document_id,
        "files": file_paths,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "type": "document_finalization"
    }
    
    # Add to blockchain
    block_hash = blockchain.add_block(document_data)
    
    return block_hash

async def verify_blockchain_integrity() -> bool:
    """Verify blockchain integrity"""
    for i in range(1, len(blockchain.chain)):
        current_block = blockchain.chain[i]
        previous_block = blockchain.chain[i-1]
        
        # Verify current block hash
        if current_block["hash"] != blockchain.calculate_hash(current_block):
            return False
        
        # Verify link to previous block
        if current_block["previous_hash"] != previous_block["hash"]:
            return False
    
    return True
