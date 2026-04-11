export class InboundMessageDedupe {
  private seen = new Map<string, number>();

  constructor(private readonly ttlMs: number) {}

  private prune(now: number) {
    for (const [messageId, expiresAt] of this.seen.entries()) {
      if (expiresAt <= now) {
        this.seen.delete(messageId);
      }
    }
  }

  seenBefore(messageId: string): boolean {
    const now = Date.now();
    this.prune(now);

    const expiresAt = this.seen.get(messageId);
    if (expiresAt != null && expiresAt > now) {
      return true;
    }

    this.seen.set(messageId, now + this.ttlMs);
    return false;
  }
}
