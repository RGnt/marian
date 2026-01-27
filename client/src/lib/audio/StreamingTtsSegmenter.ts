export class StreamingTtsSegmenter {
  private inCode = false;
  private rawBuf = "";
  private proseBuf = "";

  private firstSegmentEmitted = false;

  constructor(
    private minChars = 20,
    private maxChars = 240,
    private firstMinChars = 60
  ) {}

  feed(delta: string): string[] {
    if (!delta) return [];
    this.rawBuf += delta;

    while (true) {
      const idx = this.rawBuf.indexOf("```");
      if (idx === -1) {
        if (!this.inCode) this.proseBuf += this.rawBuf;
        this.rawBuf = "";
        break;
      }

      const before = this.rawBuf.slice(0, idx);
      const after = this.rawBuf.slice(idx + 3);

      if (!this.inCode) {
        this.proseBuf += before;
        this.proseBuf += "\nCheck the code below.\n";
        this.inCode = true;
      } else {

        this.inCode = false;
      }

      this.rawBuf = after;
    }

    return this.drain(false);
  }

  flushAll(): string[] {
    const out = this.drain(true);
    return out;
  }

  flushPartialForFastStart(): string[] {
    if (this.firstSegmentEmitted) return [];
    const trimmed = this.proseBuf.trim();
    if (trimmed.length < this.firstMinChars) return [];

    // Emit up to maxChars even without punctuation.
    const cut = Math.min(this.proseBuf.length, this.maxChars);
    const chunk = this.proseBuf.slice(0, cut);
    this.proseBuf = this.proseBuf.slice(cut);

    const out = chunk.trim() ? [chunk.trim()] : [];
    if (out.length) this.firstSegmentEmitted = true;
    return out;
  }

  private drain(force: boolean): string[] {
    const out: string[] = [];

    while (this.proseBuf.length) {
      const window = this.proseBuf.slice(0, this.maxChars);

      let cut = -1;

      // Find last punctuation/newline boundary in the window
      for (let i = window.length - 1; i >= 0; i--) {
        const ch = window[i];
        if (ch === "\n" || ".!?…;:".includes(ch)) {
          cut = i + 1;
          break;
        }
      }

      if (cut === -1) {
        if (this.proseBuf.length >= this.maxChars) cut = this.maxChars;
        else if (force) cut = this.proseBuf.length;
        else break;
      }

      const chunk = this.proseBuf.slice(0, cut);
      this.proseBuf = this.proseBuf.slice(cut);

      const trimmed = chunk.trim();
      if (!trimmed) continue;

      const threshold = this.firstSegmentEmitted ? this.minChars : this.firstMinChars;
      if (!force && trimmed.length < threshold) {
        // Put it back and wait for more
        this.proseBuf = chunk + this.proseBuf;
        break;
      }

      out.push(trimmed);
      this.firstSegmentEmitted = true;
    }

    return out;
  }
}
