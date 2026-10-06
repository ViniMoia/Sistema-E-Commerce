/** Cancellation saves work; revision fencing remains authoritative when a
 * transport completes after abort, or before the next effect is installed. */
export class AsyncRevision {
  private revision = 0;
  private controller?: AbortController;
  invalidate() { this.revision++; this.controller?.abort(); }
  begin() { this.invalidate(); const revision = this.revision; this.controller = new AbortController();
    return { signal: this.controller.signal, current: () => this.revision === revision }; }
}
