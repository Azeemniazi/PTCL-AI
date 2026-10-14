import os
import io
import time
import base64
import torch
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from PIL import Image

# CPU Threading Optimization for Intel Xeon 32 vCPUs
NUM_THREADS = int(os.environ.get('FLUX_THREADS', '16'))
torch.set_num_threads(NUM_THREADS)
os.environ['OMP_NUM_THREADS'] = str(NUM_THREADS)
os.environ['MKL_NUM_THREADS'] = str(NUM_THREADS)

app = FastAPI(title='CloudCore FLUX.2 Klein 4B Engine')

MODEL_PATH = '/opt/ai-stack/models/Image/FLUX.2-klein-4B'
pipe = None
model_ready = False
model_load_time = 0.0
import threading

infer_lock = threading.Lock()

def load_model():
    global pipe, model_ready, model_load_time
    if pipe is not None:
        return pipe
    with infer_lock:
        if pipe is not None:
            return pipe
        print(f'Loading FLUX.2-klein-4B from {MODEL_PATH} into RAM...')
        t0 = time.time()
        from diffusers import Flux2KleinPipeline, FluxPipeline
        dtype = torch.bfloat16
        try:
            p = Flux2KleinPipeline.from_pretrained(MODEL_PATH, torch_dtype=dtype)
        except Exception as e:
            print(f'Flux2KleinPipeline failed ({e}), falling back to FluxPipeline...')
            p = FluxPipeline.from_pretrained(MODEL_PATH, torch_dtype=dtype)
        p.to('cpu')
        pipe = p
        model_ready = True
        model_load_time = time.time() - t0
        print(f'Model loaded into RAM in {model_load_time:.2f}s!')
        return pipe

@app.on_event("startup")
def on_startup():
    threading.Thread(target=load_model, daemon=True).start()

class GenerateRequest(BaseModel):
    prompt: str
    negative_prompt: str | None = None
    width: int = 512
    height: int = 512
    steps: int = 4
    guidance_scale: float = 1.0
    seed: int | None = None

@app.get('/health')
def health():
    return {
        'status': 'ok',
        'model': 'FLUX.2-klein-4B',
        'ready': model_ready,
        'device': 'cpu',
        'threads': NUM_THREADS,
        'load_time_sec': round(model_load_time, 2)
    }

@app.post('/generate')
def generate(req: GenerateRequest):
    if not req.prompt or not req.prompt.strip():
        raise HTTPException(status_code=400, detail='Prompt cannot be empty.')
    try:
        pipeline = load_model()
        
        # Determine seed
        seed = req.seed if req.seed is not None and req.seed > 0 else int(time.time() * 1000) % 10000000
        generator = torch.Generator('cpu').manual_seed(seed)
        
        # Boundaries for CPU performance and quality
        steps = max(1, min(req.steps or 4, 12))
        guidance = req.guidance_scale if req.guidance_scale is not None else 1.0
        
        # Dimensions must be multiples of 16 for latent patchifier
        w = max(256, min(req.width, 1024))
        h = max(256, min(req.height, 1024))
        w = (w // 16) * 16
        h = (h // 16) * 16
        
        print(f'Generating: "{req.prompt[:50]}" (steps={steps}, size={w}x{h}, seed={seed})')
        t0 = time.time()
        
        # Run inference with mutual exclusion
        with infer_lock:
            result = pipeline(
                prompt=req.prompt,
                num_inference_steps=steps,
                guidance_scale=guidance,
                width=w,
                height=h,
                generator=generator
            ).images[0]
        
        duration_ms = int((time.time() - t0) * 1000)
        print(f'Generated in {duration_ms}ms')
        
        # Encode to PNG Base64
        buf = io.BytesIO()
        result.save(buf, format='PNG')
        b64 = base64.b64encode(buf.getvalue()).decode('utf-8')
        
        return {
            'b64_json': b64,
            'seed': seed,
            'width': w,
            'height': h,
            'duration_ms': duration_ms,
            'format': 'png'
        }
    except Exception as e:
        print(f'Generation error: {e}')
        raise HTTPException(status_code=500, detail=str(e))
