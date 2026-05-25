import subprocess
import os
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, ConfigDict

# Initialize the app
app = FastAPI()

# Define the request model with configuration to prevent namespace warnings
class TTSRequest(BaseModel):
    message: str
    model_name: str = "mms"
    model_config = ConfigDict(protected_namespaces=())

@app.post("/generate")
async def generate(req: TTSRequest):
    # Route mapping
    match req.model_name.lower():
        case "qwen3":
            worker_script = "workers/qwen3.py"
        case "vibevoice":
            worker_script = "workers/vibevoice-1_5p.py"
        case "speecht5":
            worker_script = "workers/speecht5.py"
        case "mms" | _:
            # Default to mms if input is unknown
            worker_script = "workers/mms.py"

    # Ensure the worker file exists
    if not os.path.exists(worker_script):
        raise HTTPException(status_code=500, detail=f"Worker script {worker_script} not found.")

    # In tts_service.py:
    # Change this line:
    output_file = f"clips/output_{req.model_name}.mp3"

    # Execution: Call the worker as a separate process
    try:
        # Passes the message and the desired output path to the worker
        subprocess.run(["python3", worker_script, req.message, output_file], check=True)
    except subprocess.CalledProcessError:
        raise HTTPException(status_code=500, detail="Worker script failed execution.")

    return {"status": "success", "file": output_file}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
