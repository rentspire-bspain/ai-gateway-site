# Voice service (staged, not deployed)

FastAPI service: `POST /tts` (Kokoro-82M, Apache 2.0) returns `audio/wav`; `POST /stt` (faster-whisper small, MIT, CPU int8) returns `{transcript, language}`; `GET /health`. Both calls time out at 30s and return JSON errors (400/413/500/504).

## Run locally
    docker build -t voice-service . && docker run -p 8000:8000 voice-service
    curl -X POST localhost:8000/tts -H 'content-type: application/json' -d '{"text":"Hello","voice":"af_heart"}' -o out.wav
    curl -F audio=@out.wav localhost:8000/stt

## Deploy on Render
- New Web Service, Docker runtime, root dir `ai-gateway-site/voice-service`, port 8000, health check `/health`.
- CPU works for Kokoro and whisper-small; use 2GB+ RAM (Standard plan). First request downloads models (cold start slow); consider a persistent disk mounted at `/root/.cache/huggingface`.
- Env: `CORS_ORIGINS=https://ai.spaincos.com`, optional `WHISPER_MODEL` (tiny/base/small).
- Upgrade path: for Qwen3-ASR use a GPU instance and swap `get_stt()`/`_transcribe()`; the `/stt` contract stays the same.
- Add auth (shared bearer token) before exposing publicly.

## Frontend switch (from speechSynthesis)
In `speakAnswer()` replace the `SpeechSynthesisUtterance` block:

    const r = await fetch(VOICE_URL + "/tts", {method:"POST", headers:{"content-type":"application/json"}, body: JSON.stringify({text: clean, voice:"af_heart"})});
    if (!r.ok) return fallbackToBrowserTTS(clean);
    const a = new Audio(URL.createObjectURL(await r.blob())); window._voiceAudio = a; a.play();

`stopSpeaking()` should also `_voiceAudio?.pause()`. For STT, record with MediaRecorder and POST as multipart field `audio` to `/stt`, then put `transcript` in the composer input.
