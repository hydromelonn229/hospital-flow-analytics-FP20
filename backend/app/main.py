import sys
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.endpoints import router as api_router

# Ensure stdout handles Windows console cp1252/UTF-8 character streaming safely
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="High-performance asynchronous data aggregation engine to analyze hospital patient flows, outlier hospitals, and burnout financials.",
    version="1.0.0"
)

# Enable CORS for frontend cross-origin charts queries
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Permits all origins for easy development connection
    allow_credentials=True,
    allow_methods=["*"],  # Permits GET, POST, OPTIONS, etc.
    allow_headers=["*"],
)

# Register high-density endpoint routes under /api/v1 prefix
app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/", tags=["Health"])
def health_check():
    """
    Core API server health status check.
    """
    return {
        "status": "online",
        "project": settings.PROJECT_NAME,
        "docs_url": "/docs",
        "redoc_url": "/redoc"
    }

if __name__ == "__main__":
    import uvicorn
    # Allow running directly via python main.py
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
