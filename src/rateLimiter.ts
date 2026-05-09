/**
 * Simple rate limiter for API calls.
 * Enforces max 50 calls per hour with user warnings.
 */

interface CallRecord {
  timestamp: number;
}

class RateLimiter {
  private calls: CallRecord[] = [];
  private readonly maxCallsPerHour = 50;
  private readonly hourInMs = 3600 * 1000;

  /**
   * Check if a call is allowed and record it if so.
   * Returns { allowed: boolean, remaining: number, resetAt: Date | null }
   */
  public checkAndRecord(): { allowed: boolean; remaining: number; resetAt: Date | null } {
    const now = Date.now();
    // Remove calls older than 1 hour
    this.calls = this.calls.filter((call) => now - call.timestamp < this.hourInMs);

    const remaining = this.maxCallsPerHour - this.calls.length;

    if (remaining <= 0) {
      // Calculate when the oldest call expires
      const oldestCall = this.calls[0];
      const resetAt = new Date(oldestCall.timestamp + this.hourInMs);
      return { allowed: false, remaining: 0, resetAt };
    }

    // Record this call
    this.calls.push({ timestamp: now });

    return {
      allowed: true,
      remaining: remaining - 1,
      resetAt: null,
    };
  }

  /**
   * Get current stats without recording.
   */
  public getStats(): { used: number; remaining: number; resetAt: Date | null } {
    const now = Date.now();
    this.calls = this.calls.filter((call) => now - call.timestamp < this.hourInMs);

    const used = this.calls.length;
    const remaining = this.maxCallsPerHour - used;
    const resetAt = this.calls.length > 0 ? new Date(this.calls[0].timestamp + this.hourInMs) : null;

    return { used, remaining, resetAt };
  }

  /**
   * Reset rate limiter (for testing).
   */
  public reset(): void {
    this.calls = [];
  }
}

export const rateLimiter = new RateLimiter();
