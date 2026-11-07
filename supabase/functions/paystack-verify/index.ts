// Checks a payment with Paystack right away (used when the app comes back from checkout,
// in case the webhook is slow). Body: { ref }   Auth: the student who made the payment.
import { admin, caller, confirmFromPaystack, handle, json } from '../_shared/common.ts';

Deno.serve(handle(async (req) => {
  const user = await caller(req);
  if (!user) return json({ error: 'Log in first.' }, 401);
  const { ref } = await req.json();
  const { data: p, error } = await admin().rpc('payment_for_provider', { p_ref: String(ref || '') });
  if (error) throw new Error(error.message);
  if (!p || p.studentId !== user.id) return json({ error: 'Payment not found.' }, 404);
  if (p.status !== 'pending') return json({ status: p.status });
  return json(await confirmFromPaystack(p.ref));
}));
