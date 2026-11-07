// Shared helpers for the Paystack edge functions.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.118.0';

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

export function env(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`${name} is not set. Add it with: supabase secrets set ${name}=...`);
  return v;
}

// Service-role client: can call the payment functions that the app itself cannot.
export function admin(): SupabaseClient {
  return createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
}

// The signed-in person making the request (from the app's Authorization header).
export async function caller(req: Request): Promise<{ id: string; email?: string } | null> {
  const auth = req.headers.get('Authorization');
  if (!auth) return null;
  const sb = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: auth } }, auth: { persistSession: false },
  });
  const { data } = await sb.auth.getUser();
  return data.user ? { id: data.user.id, email: data.user.email ?? undefined } : null;
}

export async function paystack(path: string, init: RequestInit = {}): Promise<any> {
  const res = await fetch('https://api.paystack.co' + path, {
    ...init,
    headers: { Authorization: `Bearer ${env('PAYSTACK_SECRET_KEY')}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.status === false) {
    throw new Error(body.message || `Paystack error ${res.status}`);
  }
  return body.data;
}

// Ask Paystack about a transaction and, if it succeeded, apply it (idempotent).
export async function confirmFromPaystack(ref: string): Promise<{ status: string; result?: unknown }> {
  const tx = await paystack('/transaction/verify/' + encodeURIComponent(ref));
  if (tx.status !== 'success') return { status: tx.status };
  const { data, error } = await admin().rpc('payment_confirmed', {
    p_ref: ref, p_amount_kobo: tx.amount, p_txn: String(tx.id), p_channel: tx.channel ?? '',
  });
  if (error) throw new Error(error.message);
  return { status: 'success', result: data };
}

export function handle(fn: (req: Request) => Promise<Response>) {
  return async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
    if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);
    try { return await fn(req); }
    catch (e) { console.error(e); return json({ error: (e as Error).message || 'Something went wrong.' }, 400); }
  };
}
