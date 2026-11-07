// Picks the backend: Supabase when it is configured, otherwise the in-browser demo.
// Add ?demo=1 to the address to force demo mode on a live build.
export async function createBackend() {
  const url = import.meta.env.VITE_SUPABASE_URL, key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  let forceDemo = false;
  try { forceDemo = new URLSearchParams(location.search).has('demo'); } catch { /* ignore */ }
  if (url && key && !forceDemo) {
    const m = await import('./supabase.js');
    return m.create(url, key);
  }
  const m = await import('./local.js');
  return m.create();
}
