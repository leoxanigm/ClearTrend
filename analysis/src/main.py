from fastapi import FastAPI

app = FastAPI(title="Transcendence Analysis Service")


@app.get("/")
def root() -> dict[str, str]:
    return {"message": "Analysis service is running"}


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "analysis"}
