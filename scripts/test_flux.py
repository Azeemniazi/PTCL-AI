import requests
import json
import time

url = "http://127.0.0.1:8005/generate"
payload = {
    "prompt": "A modern digital telecom transmission tower at golden sunset, data center background, cinematic, photorealistic 8k",
    "width": 512,
    "height": 512,
    "steps": 4,
    "guidance_scale": 1.0,
    "seed": 42
}

print("Sending request to FLUX server at", url)
t0 = time.time()
resp = requests.post(url, json=payload, timeout=300)
elapsed = time.time() - t0
print(f"HTTP Status: {resp.status_code} in {elapsed:.2f}s")

if resp.status_code == 200:
    data = resp.json()
    b64 = data.get("b64_json", "")
    print(f"Success! Duration reported: {data.get('duration_ms')} ms")
    print(f"Dimensions: {data.get('width')}x{data.get('height')}")
    print(f"Base64 image length: {len(b64)} chars")
    
    # Save image to verify
    import base64
    img_bytes = base64.b64decode(b64)
    with open("/tmp/flux_test_image.png", "wb") as f:
        f.write(img_bytes)
    print(f"Saved test image to /tmp/flux_test_image.png ({len(img_bytes)} bytes)")
else:
    print("Error:", resp.text)
