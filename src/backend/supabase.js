// Live mode: Supabase (database, logins, files, live updates) and Paystack via edge functions.
import { createClient } from '@supabase/supabase-js';

const FN = /^[a-z_]+$/;
const clean = e => {
  const m = (e && (e.message || e.error_description || e.msg)) || 'Something went wrong. Try again.';
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'You seem to be offline. Check your connection and try again.';
  if (/Invalid login credentials/i.test(m)) return 'That email and password do not match.';
  if (/Email not confirmed/i.test(m)) return 'Confirm your email first. Check your inbox for the code.';
  if (/User already registered/i.test(m)) return 'There is already an account with this email. Log in instead.';
  if (/Token has expired or is invalid|otp_expired/i.test(m)) return 'That code is not right or has expired. Send a new code.';
  if (/rate limit|too many/i.test(m)) return 'Too many tries. Wait a minute and try again.';
  if (/Password should be/i.test(m)) return 'Use a password with at least 8 characters.';
  return m;
};
const fail = e => { throw new Error(clean(e)); };
const isEmail = s => /^\S+@\S+\.\S+$/.test(s);

export function create(url, key) {
  const sb = createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
  });
  let user = null;
  const listeners = new Set();
  const emit = () => listeners.forEach(f => { try { f(); } catch { /* ignore */ } });
  let channel = null;

  function subscribe() {
    if (channel) { sb.removeChannel(channel); channel = null; }
    if (!user) return;
    channel = sb.channel('pings-' + user)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pings', filter: `user_id=eq.${user}` }, () => emit())
      .subscribe();
  }

  async function invoke(name, body) {
    const { data, error } = await sb.functions.invoke(name, { body });
    if (error) {
      let msg = error.message;
      try { const j = await error.context.json(); if (j && j.error) msg = j.error; } catch { /* not json */ }
      fail({ message: msg });
    }
    if (data && data.error) fail({ message: data.error });
    return data;
  }

  const B = {
    mode: 'live',
    user: () => user,
    async init() {
      const { data } = await sb.auth.getSession();
      user = data.session ? data.session.user.id : null;
      subscribe();
      sb.auth.onAuthStateChange((_ev, s) => {
        const next = s ? s.user.id : null;
        if (next !== user) { user = next; subscribe(); emit(); }
      });
    },
    async state() {
      const { data, error } = await sb.rpc('get_state');
      if (error) fail(error);
      return data;
    },
    async call(fn, args = {}) {
      if (!FN.test(fn)) throw new Error('Unknown action.');
      const { data, error } = await sb.rpc(fn, { a: args || {} });
      if (error) fail(error);
      return data;
    },
    onChange(f) {
      listeners.add(f);
      // backup in case live updates are blocked on the network
      const t = setInterval(() => { if (document.visibilityState === 'visible') f(); }, 60000);
      const vis = () => { if (document.visibilityState === 'visible') f(); };
      document.addEventListener('visibilitychange', vis);
      return () => { listeners.delete(f); clearInterval(t); document.removeEventListener('visibilitychange', vis); };
    },
    auth: {
      // Sign-up sends a 6-digit code by email (the Supabase "Confirm signup" template must show {{ .Token }}).
      async signUp(d) {
        if (!isEmail(d.email)) throw new Error('Enter a valid email address.');
        const { error } = await sb.auth.signUp({
          email: d.email, password: d.password,
          options: { data: { role: d.role, name: d.name, phone: d.phone, dept: d.dept, school: d.school, biz: d.biz, btype: d.btype, rel: d.rel } }
        });
        if (error) fail(error);
        B._email = d.email;
        return { needsCode: true };
      },
      async verify({ code, email }) {
        const { error } = await sb.auth.verifyOtp({ email: email || B._email, token: code, type: 'signup' });
        if (error) fail(error);
      },
      async resend({ email } = {}) {
        const { error } = await sb.auth.resend({ type: 'signup', email: email || B._email });
        if (error) fail(error);
        return {};
      },
      async signIn({ id, password }) {
        if (!isEmail(id)) throw new Error('Log in with the email address on your account.');
        const { data, error } = await sb.auth.signInWithPassword({ email: id, password });
        if (error) fail(error);
        user = data.user.id; subscribe();
        return { id: user };
      },
      async signOut() { await sb.auth.signOut(); user = null; subscribe(); },
      async sendReset({ id }) {
        if (!isEmail(id)) throw new Error('Enter the email address on your account.');
        const { error } = await sb.auth.resetPasswordForEmail(id);
        if (error) fail(error);
        B._reset = id;
        return {};
      },
      // The "Reset password" email template must show {{ .Token }}.
      async doReset({ code, password }) {
        const { error } = await sb.auth.verifyOtp({ email: B._reset, token: code, type: 'recovery' });
        if (error) fail(error);
        const r = await sb.auth.updateUser({ password });
        if (r.error) fail(r.error);
        await sb.auth.signOut();
      },
      async changePassword({ current, next }) {
        const { data } = await sb.auth.getUser();
        const email = data.user && data.user.email;
        const chk = await sb.auth.signInWithPassword({ email, password: current });
        if (chk.error) throw new Error('Your current password is not right.');
        const r = await sb.auth.updateUser({ password: next });
        if (r.error) fail(r.error);
      }
    },
    // Photos go to the public "media" bucket; documents to the private bucket.
    async upload(file, { kind } = {}) {
      if (!user) throw new Error('Log in first.');
      const bucket = kind === 'doc' ? 'private' : 'media';
      const ext = (file.name && file.name.includes('.') ? file.name.split('.').pop() : (file.type || '').split('/')[1] || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
      const path = `${user}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await sb.storage.from(bucket).upload(path, file, { contentType: file.type || undefined, upsert: false });
      if (error) fail(error);
      return bucket === 'media' ? sb.storage.from('media').getPublicUrl(path).data.publicUrl : path;
    },
    async fileUrl(path) {
      const { data, error } = await sb.storage.from('private').createSignedUrl(path, 600);
      if (error) fail(error);
      return data.signedUrl;
    },
    // Paystack
    async providerCheckout(ref, callback) { return invoke('paystack-init', { ref, callback }); },
    async providerVerify(ref) { return invoke('paystack-verify', { ref }); },
    async resolveAccount(bank, acct, save) { return invoke('paystack-resolve', { bank, acct, save: !!save }); },
    async reset() { /* not available in live mode */ }
  };
  return B;
}
