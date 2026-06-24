from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

if not settings.DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is missing or empty. Please check your .env configuration.")

# Configure connection pooling via QueuePool
engine = create_engine(
    settings.DATABASE_URL,
    pool_size=10,            # Maintain up to 10 active connections
    max_overflow=20,         # Allow temporary spikes up to 30 total connections
    pool_timeout=30,         # Block up to 30 seconds for a free pool connection
    pool_recycle=1800        # Reset connection sockets after 30 minutes to prevent timeouts
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Dependency injection generator for endpoints
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
