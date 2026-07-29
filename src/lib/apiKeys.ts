// Real API key generation + hashing (Web Crypto SHA-256), shared between
// the tenant-facing API settings screen and the Super Admin platform-key
// screen. The raw key is only ever held in memory/shown once right after
// creation -- only its SHA-256 hex digest is ever persisted, and that's
// exactly what the api-v1 Edge Function re-computes to validate a request.

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function generateApiKey(): string {
  return `hck_${crypto.randomUUID().replace(/-/g, '')}`;
}
