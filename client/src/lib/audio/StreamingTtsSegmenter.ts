/**
 * Purpose: Segment streaming text into speakable chunks for TTS playback.
 * How: Tracks code blocks, accumulates prose, and emits chunks based on
 * punctuation and length thresholds.
 */
export class StreamingTtsSegmenter {
  private inCode = false;
  private rawBuf = "";
  private proseBuf = "";

  private firstSegmentEmitted = false;

  /**
   * Purpose: Create a segmenter with length thresholds.
   * How: Stores thresholds used to decide when to emit chunks.
   * @param minChars - Minimum characters for subsequent segments.
   * @param maxChars - Maximum characters per segment.
   * @param firstMinChars - Minimum characters for the first segment.
   */
  constructor(
    private minChars = 20,
    private maxChars = 240,
    private firstMinChars = 60
  ) {}

  /**
   * Purpose: Feed a new delta of text into the segmenter.
   * How: Appends to the buffer, handles fenced code blocks, and emits any
   * complete prose chunks that meet thresholds.
   * @param delta - New text fragment.
   * @returns string[] - Newly available speech chunks.
   */
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

  /**
   * Purpose: Flush all remaining buffered prose.
   * How: Forces the internal drain to emit any buffered text.
   * Parameters: None.
   * @returns string[] - All remaining speech chunks.
   */
  flushAll(): string[] {
    const out = this.drain(true);
    return out;
  }

  /**
   * Purpose: Emit an early partial chunk to reduce perceived latency.
   * How: If enough prose has accumulated for the first segment, emits up to
   * maxChars without requiring punctuation.
   * Parameters: None.
   * @returns string[] - Early speech chunk(s), if available.
   */
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

  /**
   * Purpose: Drain buffered prose into speech chunks.
   * How: Finds punctuation boundaries or forces a cut when needed, enforcing
   * minimum-length thresholds.
   * @param force - Whether to emit even without meeting thresholds.
   * @returns string[] - Emitted speech chunks.
   */
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
