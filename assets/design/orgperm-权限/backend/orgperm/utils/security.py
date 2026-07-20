import bcrypt
import jwt
from datetime import datetime, timedelta, timezone
from ..config import JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRE_HOURS


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=4)).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(user_id: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRE_HOURS)
    payload = {"sub": str(user_id), "exp": expire, "iat": datetime.now(timezone.utc)}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
