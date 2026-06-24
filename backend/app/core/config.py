import os
from dotenv import load_dotenv

# Resolve paths relative to this config file
CORE_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(os.path.dirname(CORE_DIR))
ENV_PATH = os.path.join(BACKEND_DIR, ".env")

# Load variables
load_dotenv(ENV_PATH)

class Settings:
    DATABASE_URL: str = os.getenv("DATABASE_URL")
    PROJECT_NAME: str = "Code Blue Hospital Flow Analytics API"
    API_V1_STR: str = "/api/v1"

settings = Settings()
