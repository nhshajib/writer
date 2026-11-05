/** Keeps locally saved preferences out of older background snapshots. Server-owned fields never enter the override map. */
export class ProfileRefreshGuard<T extends object> {
  private edits = 0;
  private requests = 0;
  private applied = 0;
  private epoch = 0;
  private pending = new Map<keyof T, { value: T[keyof T]; revision: number; waiting: boolean }>();

  constructor(private readonly editable: readonly (keyof T)[]) {}

  begin() {
    return { request: ++this.requests, edits: this.edits, epoch: this.epoch };
  }

  /** Mark optimistic edits pending, then record again once the write resolves or rolls back. */
  record(update: Partial<T>, options: { pending?: boolean } = {}) {
    const revision = ++this.edits;
    for (const key of this.editable) {
      if (Object.hasOwn(update, key)) this.pending.set(key, { value: update[key] as T[keyof T], revision, waiting: options.pending === true });
    }
  }

  isCurrent(token: ReturnType<ProfileRefreshGuard<T>["begin"]>) {
    return token.epoch === this.epoch && token.request >= this.applied;
  }

  accept(server: T, token: ReturnType<ProfileRefreshGuard<T>["begin"]>): T | null {
    if (!this.isCurrent(token)) return null;
    this.applied = token.request;
    const next = { ...server };
    for (const [key, pending] of this.pending) {
      // Reads begun after a completed write are authoritative, including later
      // changes from another device. Do not wait indefinitely for a value echo.
      if (pending.revision <= token.edits && !pending.waiting) {
        this.pending.delete(key);
      } else {
        next[key] = pending.value;
      }
    }
    return next;
  }

  reset() {
    this.epoch++;
    this.pending.clear();
  }
}
