/**
 * §9 "Oran sınırlama: giriş, şifre sıfırlama, dışa aktarma uçları".
 *
 * Bu basit bellek-içi (in-memory) sabit pencere limiter'dır — tek instance'lı dev/küçük
 * dağıtımlar için yeterlidir. Birden fazla sunucu instance'ına yatay ölçeklenince (V1.5+
 * veya yoğun kullanımda) paylaşılan bir depoya (örn. Redis / Upstash) taşınmalıdır; bu
 * dosyanın arayüzü o geçişi kolaylaştıracak şekilde sade tutulmuştur.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt };
  }

  if (existing.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt };
  }

  existing.count += 1;
  return { allowed: true, remaining: limit - existing.count, resetAt: existing.resetAt };
}

/** Sık kullanılan uçlar için hazır limit tanımları. */
export const RATE_LIMITS = {
  login: { limit: 10, windowMs: 15 * 60 * 1000 }, // 15 dk'da 10 deneme (IP bazlı)
  passwordReset: { limit: 5, windowMs: 60 * 60 * 1000 }, // saatte 5
  export: { limit: 20, windowMs: 60 * 60 * 1000 }, // saatte 20
} as const;
