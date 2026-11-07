// Starts a Paystack transaction for a pending payment and returns the checkout page URL.
// Body: { ref, callback? }   Auth: the student who started the checkout.
import { admin, caller, handle, json, paystack } from '../_shared/common.ts';

Deno.serve(handle(async (req) => {
  const user = await caller(req);
  if (!user) return json({ error: 'Log in first.' }, 401);
  const { ref, callback } = await req.json();
  const { data: p, error } = await admin().rpc('payment_for_provider', { p_ref: String(ref || '') });
  if (error) throw new Error(error.message);
  if (!p || p.studentId !== user.id) return json({ error: 'Payment not found.' }, 404);
  if (p.status !== 'pending') return json({ error: 'This payment is already ' + p.status + '.' }, 409);
  if (!(p.chargeKobo > 0)) return json({ error: 'Nothing to charge.' }, 400);

  const tx = await paystack('/transaction/initialize', {
    method: 'POST',
    body: JSON.stringify({
      email: p.email || user.email,
      amount: p.chargeKobo,
      reference: p.ref,
      currency: 'NGN',
      callback_url: typeof callback === 'string' && /^https:\/\//.test(callback) ? callback : undefined,
      metadata: { kind: p.kind, student: p.studentId },
    }),
  });
  return json({ url: tx.authorization_url, ref: p.ref });
}));
