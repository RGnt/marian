export async function recordAudioOnce(opts?: {
  mimeType?: string; // e.g. "audio/webm"
  maxMs?: number;
}): Promise<Blob> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const chunks: BlobPart[] = [];

  const recorder = new MediaRecorder(stream, {
    mimeType: opts?.mimeType,
  });

  return await new Promise<Blob>((resolve, reject) => {
    let done = false;

    const cleanup = () => {
      stream.getTracks().forEach((t) => t.stop());
    };

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    recorder.onerror = (e) => {
      if (done) return;
      done = true;
      cleanup();
      reject(e);
    };

    recorder.onstop = () => {
      if (done) return;
      done = true;
      cleanup();
      resolve(new Blob(chunks, { type: recorder.mimeType || "audio/webm" }));
    };

    recorder.start();

    const maxMs = opts?.maxMs ?? 10_000;
    window.setTimeout(() => {
      try { recorder.stop(); } catch {}
    }, maxMs);
  });
}
