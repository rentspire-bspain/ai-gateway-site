# Voice lane status (2026-11-21)

Live today (browser-native, no server, no cost): mic dictation in both composers (Web Speech API), Voice toggle (speechSynthesis read-aloud), Talk hands-free loop (`modules/voice-convo.js`). `/modules/voice-convo.{js,css}` return 200.

## Not live (dependency, not a code bug)
Server-side voice (`voice-service/`: Kokoro TTS + faster-whisper STT) is staged but NOT deployed. Consequences:
- Firefox (no SpeechRecognition) and any browser without it cannot dictate; it now shows an honest message instead of a dead button. Server STT (`POST /stt`) would close this.
- Voice quality is the OS voice (speechSynthesis); Kokoro (`POST /tts`) would replace it.
- Chrome/Edge dictation sends audio to the browser vendor's cloud recognizer (privacy note; works offline = no).

Owner action to enable: deploy `voice-service/` as a Render Docker web service (2GB+ RAM, port 8000, `/health`), set `CORS_ORIGINS=https://ai.spaincos.com`, add a bearer token, then provide `VOICE_URL` to the frontend. No Perplexity API or credits involved. GPU instance only needed for the optional Qwen3-ASR upgrade.
