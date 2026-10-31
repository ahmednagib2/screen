import { defineBackground } from 'wxt/utils/define-background';

// Suppress benign Chrome debugger detach notices (e.g. when user clicks Cancel on Chrome's infobar)
if (typeof globalThis !== 'undefined' && globalThis.addEventListener) {
  globalThis.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    const msg = String(event?.reason?.message || event?.reason || '');
    if (msg.includes('Debugger is not attached') || msg.includes('DEBUGGER_DETACHED')) {
      event.preventDefault();
    }
  });
}

// Listener registration must stay synchronous at service worker start.
// WXT strips side-effect imports when it evaluates entrypoint options at build time, so main() stays empty.
import '@src/extension/index';
// The layer's test extension: checks, scenarios and the test panel's messages (developer-only).
import '@src/background/index';

export default defineBackground({ main() {} });
