import secrets
import string
from datetime import datetime, timedelta
from typing import Optional

def generate_random_string(length: int = 8) -> str:
    """Generate random alphanumeric string"""
    return ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(length))

def calculate_payment_amount(duration_days: int, rate_per_day: float = 1.0) -> float:
    """Calculate payment amount based on duration"""
    return duration_days * rate_per_day

def calculate_split_amount(total_amount: float, split_percentage: float) -> tuple:
    """Calculate split amounts based on percentage"""
    user_amount = total_amount * (split_percentage / 100)
    other_amount = total_amount - user_amount
    return user_amount, other_amount

def format_file_size(size_bytes: int) -> str:
    """Format file size in human readable format"""
    if size_bytes == 0:
        return "0B"
    
    size_names = ["B", "KB", "MB", "GB"]
    i = 0
    while size_bytes >= 1024 and i < len(size_names) - 1:
        size_bytes /= 1024.0
        i += 1
    
    return f"{size_bytes:.1f}{size_names[i]}"

def validate_date_range(start_date: Optional[datetime], end_date: Optional[datetime]) -> bool:
    """Validate that end date is after start date"""
    if start_date and end_date:
        return end_date > start_date
    return True