// Checks an agent's bank account with Paystack (the account name comes from the bank),
// and saves it as their payout account when asked. Body: { bank, acct, save }
import { admin, caller, handle, json, paystack } from '../_shared/common.ts';

let banks: { name: string; code: string }[] | null = null;
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

Deno.serve(handle(async (req) => {
  const user = await caller(req);
  if (!user) return json({ error: 'Log in first.' }, 401);
  const { bank, acct, save } = await req.json();
  const number = String(acct || '').replace(/\D/g, '');
  if (number.length !== 10) return json({ error: 'Enter the 10-digit account number.' }, 400);

  const sb = admin();
  if (!banks) banks = (await paystack('/bank?country=nigeria&perPage=200')).map((b: any) => ({ name: b.name, code: b.code }));
  const want = norm(String(bank || ''));
  const match = banks!.find((b) => norm(b.name) === want) || banks!.find((b) => norm(b.name).includes(want) || want.includes(norm(b.name)));
  if (!match) return json({ error: `We couldn't find ${bank} at Paystack. Pick another bank or contact support.` }, 400);

  const r = await paystack(`/bank/resolve?account_number=${number}&bank_code=${encodeURIComponent(match.code)}`);
  const name = String(r.account_name || '').toUpperCase();
  if (!name) return json({ error: 'The bank did not return a name for this account.' }, 400);

  if (save) {
    const { data, error } = await sb.rpc('set_payout_verified', { p_agent: user.id, p_bank: String(bank), p_acct: number, p_name: name });
    if (error) throw new Error(error.message);
    if (data && (data as any).error) return json({ error: (data as any).error }, 400);
  }
  return json({ name });
}));
