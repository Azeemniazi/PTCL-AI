ARG WHISPER_BASE_IMAGE=fedirz/faster-whisper-server:latest-cpu@sha256:760e5e43d427dc6cfbbc4731934b908b7de9c7e6d5309c6a1f0c8c923a5b6030
FROM ${WHISPER_BASE_IMAGE}

# Vexa omits vad_filter on its HTTP transcription requests.
RUN /root/faster-whisper-server/.venv/bin/python3 - <<'PY'
from pathlib import Path

router = Path("/root/faster-whisper-server/faster_whisper_server/routers/stt.py")
source = router.read_text()
start = source.index("def transcribe_file(")
before = "vad_filter: Annotated[bool, Form()] = False"
after = "vad_filter: Annotated[bool, Form()] = True"
end = source.index(") -> Response | StreamingResponse:", start)
signature = source[start:end]
if signature.count(before) != 1:
    raise RuntimeError("Unexpected Whisper transcription endpoint signature")
router.write_text(source[:start] + signature.replace(before, after) + source[end:])
PY

CMD ["/root/faster-whisper-server/.venv/bin/uvicorn", "--factory", "faster_whisper_server.main:create_app"]
