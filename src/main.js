import '@fontsource-variable/archivo/wdth.css';
import '@fontsource/hanken-grotesk/400.css';
import '@fontsource/hanken-grotesk/500.css';
import '@fontsource/hanken-grotesk/600.css';
import '@fontsource/hanken-grotesk/700.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/ibm-plex-mono/600.css';
import './styles.css';
import { createBackend } from './backend/index.js';
import { start } from './app/app.js';
import { hideSplash } from './native.js';

// never leave the splash up for long, even if something goes wrong
setTimeout(hideSplash, 8000);

const app = document.getElementById('app');

function bootError(e) {
  console.error(e);
  hideSplash();
  app.innerHTML = `<div class="boot"><h1>Couldn't start</h1><p class="muted">${String((e && e.message) || e).replace(/[<>&]/g, '')}</p>
    <p class="muted">Check your connection and try again.</p><button class="btn" onclick="location.reload()">Try again</button></div>`;
}

(async () => {
  try {
    const B = await createBackend();
    await B.init();
    await start(B);
  } catch (e) { bootError(e); }
})();
