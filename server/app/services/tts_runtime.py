from __future__ import annotations

import asyncio
import io
import wave
from dataclasses import dataclass
from typing import Optional

import numpy as np

from app.core.settings import Settings
from app.services.markdown_tts import markdown_to_tts_text

from kokoro import KPipeline


@dataclass
class KokoroRuntime:
    pipeline: KPipeline
    sample_rate: int
    default_voice: str
    default_speed: float
    split_pattern: str

    _lock: asyncio.Lock

    async def synthesize_wav(
        self,
        text_markdown: str,
        voice: Optional[str] = None,
        speed: Optional[float] = None,
    ) -> bytes:
        """
        Takes markdown input, cleans for TTS, generates WAV bytes.
        """
        clean = markdown_to_tts_text(text_markdown)
        if not clean.strip():
            return _empty_wav(self.sample_rate)

        use_voice = voice or self.default_voice
        use_speed = float(speed) if speed is not None else self.default_speed

        async with self._lock:
            loop = asyncio.get_running_loop()
            return await loop.run_in_executor(
                None,
                self._synth_wav_sync,
                clean,
                use_voice,
                use_speed,
            )

    def _synth_wav_sync(self, clean_text: str, voice: str, speed: float) -> bytes:
        chunks: list[np.ndarray] = []

        generator = self.pipeline(
            clean_text,
            voice=voice,
            speed=speed,
            split_pattern=self.split_pattern,
        )

        for _i, (_gs, _ps, audio) in enumerate(generator):
            arr = np.asarray(audio)
            if arr.ndim > 1:
                arr = arr.reshape(-1)
            chunks.append(arr)

        if not chunks:
            return _empty_wav(self.sample_rate)

        audio_all = np.concatenate(chunks, axis=0)

        # Convert to int16 PCM
        if audio_all.dtype != np.int16:
            audio_all = np.clip(audio_all, -1.0, 1.0)
            audio_all = (audio_all * 32767.0).astype(np.int16)

        return _wav_bytes_from_int16(audio_all, self.sample_rate)


def _wav_bytes_from_int16(pcm: np.ndarray, sample_rate: int) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)  # int16
        wf.setframerate(sample_rate)
        wf.writeframes(pcm.tobytes())
    return buf.getvalue()


def _empty_wav(sample_rate: int) -> bytes:
    return _wav_bytes_from_int16(np.zeros(1, dtype=np.int16), sample_rate)


async def build_tts_runtime(settings: Settings) -> KokoroRuntime:
    pipeline = KPipeline(lang_code=settings.kokoro_lang_code)

    return KokoroRuntime(
        pipeline=pipeline,
        sample_rate=settings.kokoro_sample_rate,
        default_voice=settings.kokoro_voice,
        default_speed=settings.kokoro_speed,
        split_pattern=settings.kokoro_split_pattern,
        _lock=asyncio.Lock(),
    )
