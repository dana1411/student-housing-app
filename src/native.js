// Phone-app helpers (Capacitor). On the web these fall back to browser behaviour.
import { Capacitor } from '@capacitor/core';

export const isNative = Capacitor.isNativePlatform();
export const platform = Capacitor.getPlatform(); // 'web' | 'android' | 'ios'

const lazy = {};
const plugin = name => (lazy[name] = lazy[name] || import(`./native-plugins.js`).then(m => m[name]));

function blobToBase64(blob) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(',')[1]);
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
}

// Save or share a generated file (receipts, agreements).
export async function saveFile(filename, data) {
  const blob = data instanceof Blob ? data : new Blob([data]);
  if (!isNative) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return { status: 'saved' };
  }
  const { Filesystem, Directory } = await plugin('fs');
  const { Share } = await plugin('share');
  const safe = filename.replace(/[^\w.\- ]+/g, '_');
  const w = await Filesystem.writeFile({ path: safe, data: await blobToBase64(blob), directory: Directory.Cache });
  await Share.share({ title: safe, url: w.uri, dialogTitle: 'Save or share' });
  return { status: 'saved' };
}

// Open a web page (payment checkout). Returns a function that resolves when the page is closed (native only).
export async function openExternal(url, onClose) {
  if (!isNative) {
    const w = window.open(url, '_blank', 'noopener');
    if (!w) location.href = url;
    return;
  }
  const { Browser } = await plugin('browser');
  if (onClose) {
    const h = await Browser.addListener('browserFinished', () => { h.remove(); onClose(); });
  }
  await Browser.open({ url, presentationStyle: 'popover' });
}

export async function closeExternal() {
  if (!isNative) return;
  try { const { Browser } = await plugin('browser'); await Browser.close(); } catch { /* already closed */ }
}

// Android back button, status bar colour, resume refresh.
export async function initNative({ onBack, onResume }) {
  if (!isNative) return;
  try {
    const { App } = await plugin('app');
    App.addListener('backButton', () => { if (!onBack()) App.minimizeApp(); });
    App.addListener('resume', () => onResume && onResume());
  } catch { /* plugin missing */ }
  try {
    const { SplashScreen } = await plugin('splash');
    await SplashScreen.hide();
  } catch { /* ignore */ }
}

export async function setStatusBar(dark) {
  if (!isNative) return;
  try {
    const { StatusBar, Style } = await plugin('status');
    await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light });
    if (platform === 'android') await StatusBar.setBackgroundColor({ color: '#1B2A6B' });
  } catch { /* ignore */ }
}
