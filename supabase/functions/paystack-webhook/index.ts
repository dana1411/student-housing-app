// Paystack calls this when a charge succeeds. Set the URL in Paystack > Settings > API Keys & Webhooks:
//   https://<project>.supabase.co/functions/v1/paystack-webhook
// Deployed with --no-verify-jwt (Paystack doesn't send a Supabase token); the request is
// trusted only if its x-paystack-signature matches HMAC-SHA512(body, secret key).
import { confirmFromPaystack, env, json } from '../_shared/common.ts';

async function sign(body: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-512' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function same(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);
  const body = await req.text();
  const got = req.headers.get('x-paystack-signature') || '';
  if (!same(await sign(body, env('PAYSTACK_SECRET_KEY')), got)) return json({ error: 'bad signature' }, 401);
  let event: any;
  try { event = JSON.parse(body); } catch { return json({ error: 'bad json' }, 400); }
  if (event.event === 'charge.success' && event.data?.reference) {
    try {
      // Re-check with Paystack instead of trusting the payload's amount alone.
      const r = await confirmFromPaystack(String(event.data.reference));
      return json({ ok: true, status: r.status });
    } catch (e) {
      console.error(e);
      return json({ error: (e as Error).message }, 500); // Paystack retries on failure
    }
  }
  return json({ ok: true, ignored: event.event });
});
