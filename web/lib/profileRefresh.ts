/** JSONB object key order is not meaningful; array order remains meaningful. */
function jsonValue(value: unknown): string | undefined {
  return JSON.stringify(value, (_key, item) => item && typeof item === "object" && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, item[key]]))
    : item);
}

/** Keeps locally saved preferences out of older background snapshots. Server-owned fields never enter the override map. */
export class ProfileRefreshGuard<T extends object> {
  private edits = 0;
  private requests = 0;
  private applied = 0;
  private epoch = 0;
  private pending = new Map<keyof T, { value: T[keyof T]; revision: number }>();

  constructor(private readonly editable: readonly (keyof T)[], private readonly presenceOnly: readonly (keyof T)[] = []) {}

  begin() {
    return { request: ++this.requests, edits: this.edits, epoch: this.epoch };
  }

  record(update: Partial<T>) {
    const revision = ++this.edits;
    for (const key of this.editable) {
      if (Object.hasOwn(update, key)) this.pending.set(key, { value: update[key] as T[keyof T], revision });
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
      const matches = this.presenceOnly.includes(key) && Boolean(server[key]) && Boolean(pending.value) || jsonValue(server[key]) === jsonValue(pending.value);
      if (pending.revision <= token.edits && matches) {
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
