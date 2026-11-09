"""Self-hosted voice service: Kokoro-82M TTS + faster-whisper STT."""
import asyncio, io, os, tempfile
import numpy as np
import soundfile as sf
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel

TIMEOUT = 30
SAMPLE_RATE = 24000
MAX_TEXT = 5000
MAX_AUDIO_BYTES = 25 * 1024 * 1024
WHISPER_MODEL = os.getenv("WHISPER_MODEL", "small")

app = FastAPI(title="ai.spaincos.com voice service")
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "https://ai.spaincos.com").split(","),
    allow_methods=["POST", "GET"], allow_headers=["*"],
)

_tts = {}
_stt = None


def get_tts(lang="a"):
    if lang not in _tts:
        from kokoro import KPipeline
        _tts[lang] = KPipeline(lang_code=lang)
    return _tts[lang]


def get_stt():
    global _stt
    if _stt is None:
        from faster_whisper import WhisperModel
        _stt = WhisperModel(WHISPER_MODEL, device="cpu", compute_type="int8")
    return _stt


class TTSRequest(BaseModel):
    text: str
    voice: str = "af_heart"


def _synth(text, voice):
    pipe = get_tts(voice[0] if voice else "a")
    chunks = [np.asarray(a) for _, _, a in pipe(text, voice=voice) if a is not None]
    if not chunks:
        raise ValueError("no audio generated")
    buf = io.BytesIO()
    sf.write(buf, np.concatenate(chunks), SAMPLE_RATE, format="WAV")
    return buf.getvalue()


def _transcribe(path):
    segments, info = get_stt().transcribe(path, vad_filter=True)
    return " ".join(s.text.strip() for s in segments).strip(), info.language


@app.get("/health")
def health():
    return {"status": "ok", "tts_loaded": bool(_tts), "stt_loaded": _stt is not None}


@app.post("/tts")
async def tts(req: TTSRequest):
    text = req.text.strip()
    if not text:
        raise HTTPException(400, "text is empty")
    if len(text) > MAX_TEXT:
        raise HTTPException(413, f"text exceeds {MAX_TEXT} characters")
    try:
        wav = await asyncio.wait_for(asyncio.to_thread(_synth, text, req.voice), TIMEOUT)
    except asyncio.TimeoutError:
        raise HTTPException(504, "TTS timed out")
    except Exception as e:
        raise HTTPException(500, f"TTS failed: {e}")
    return Response(wav, media_type="audio/wav")


@app.post("/stt")
async def stt(audio: UploadFile = File(...)):
    data = await audio.read()
    if not data:
        raise HTTPException(400, "empty upload")
    if len(data) > MAX_AUDIO_BYTES:
        raise HTTPException(413, "audio too large")
    suffix = os.path.splitext(audio.filename or "")[1] or ".webm"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=True) as f:
        f.write(data); f.flush()
        try:
            text, lang = await asyncio.wait_for(asyncio.to_thread(_transcribe, f.name), TIMEOUT)
        except asyncio.TimeoutError:
            raise HTTPException(504, "STT timed out")
        except Exception as e:
            raise HTTPException(500, f"STT failed: {e}")
    return {"transcript": text, "language": lang}
