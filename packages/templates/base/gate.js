// Appio PWA install gate. Runs before the React bundle loads. In a
// browser tab: renders a full-screen install landing so visitors are
// pushed through Add-to-Home-Screen. In standalone / iframe / preview
// bypass: loads the real app bundle instead.
//
// This file is served as /gate.js so the strict CSP (`script-src 'self'`)
// allows it without needing an `unsafe-inline` relaxation or per-request
// nonces. The hashed React bundle URL is passed in via the
// `data-entry` attribute on the <script> tag, avoiding any build-time
// string substitution inside this file.

(function () {
  var currentScript = document.currentScript;
  var entryJs = currentScript && currentScript.dataset && currentScript.dataset.entry;

  // Appio editor preview: the iframe in /build renders inside a faux
  // phone frame that covers ~44px at the top (notch) and ~34px at the
  // bottom (home indicator). Marking the root element lets the base
  // template's CSS carve those areas out so app chrome doesn't hide
  // behind the frame. Set BEFORE React mounts so the inset applies to
  // the initial paint.
  try {
    if (new URLSearchParams(window.location.search).get('preview') === '1') {
      document.documentElement.setAttribute('data-preview', '');
    }
  } catch (e) { /* no-op */ }

  // Service worker registration runs unconditionally — PWA install
  // prompts (and beforeinstallprompt) only fire when a controlling SW
  // is active, so the gate needs it registered even before any app JS.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(function () {});
  }

  var mql = window.matchMedia;
  var isStandalone =
    (mql && (mql('(display-mode: standalone)').matches
          || mql('(display-mode: minimal-ui)').matches
          || mql('(display-mode: fullscreen)').matches))
    || window.navigator.standalone === true;

  var inIframe = false;
  try { inIframe = window.self !== window.top; } catch (e) { inIframe = true; }

  // Creator/preview bypass: appending ?__appio_preview=1 lets the Appio
  // editor open the live URL in a new tab without the gate. Persisted
  // in sessionStorage so in-app navigation keeps the bypass.
  var bypass = false;
  try {
    var params = new URLSearchParams(window.location.search);
    if (params.get('__appio_preview') === '1') {
      sessionStorage.setItem('appio_bypass_gate', '1');
      params.delete('__appio_preview');
      var clean = window.location.pathname +
        (params.toString() ? '?' + params.toString() : '') +
        window.location.hash;
      history.replaceState(null, '', clean);
    }
    bypass = sessionStorage.getItem('appio_bypass_gate') === '1';
  } catch (e) {}

  // Native shell bypass: Capacitor injects window.Capacitor before any
  // web JS runs. Inside a native shell the install gate is meaningless
  // (the app is already installed) and would block the user forever
  // since the Share → Add to Home Screen flow doesn't exist in WKWebView.
  var inNativeShell = typeof window.Capacitor !== 'undefined';

  if (isStandalone || inIframe || bypass || inNativeShell) {
    mountApp();
    return;
  }

  renderGate();

  function injectDesktopStyles() {
    // Desktop landing styles. Mobile gate CSS lives in the template's
    // inline <style>; these rules are desktop-only and kept here to
    // avoid duplicating them across base + agent templates.
    var css =
      '.appio-landing{position:fixed;inset:0;z-index:2147483647;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px;background:linear-gradient(160deg,var(--color-primary,#6366f1) 0%,var(--color-primary-light,#8b5cf6) 100%);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;overflow-y:auto;}' +
      '.appio-landing-card{background:#fff;border-radius:24px;padding:40px;display:flex;gap:48px;align-items:center;max-width:860px;width:100%;box-shadow:0 24px 72px rgba(0,0,0,0.28);}' +
      '.appio-landing-left{flex:1;min-width:0;}' +
      '.appio-landing-right{flex-shrink:0;text-align:center;}' +
      '.appio-landing-icon{position:relative;width:72px;height:72px;border-radius:18px;overflow:hidden;background:var(--color-primary,#6366f1);color:#fff;font-size:30px;font-weight:700;margin-bottom:20px;box-shadow:0 6px 18px rgba(0,0,0,0.1);}' +
      '.appio-landing-icon .appio-gate-icon-fallback{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;}' +
      '.appio-landing-icon img{position:relative;z-index:1;width:100%;height:100%;display:block;object-fit:cover;}' +
      '.appio-landing-title{font-size:32px;font-weight:700;color:#111827;margin-bottom:10px;line-height:1.15;}' +
      '.appio-landing-subtitle{font-size:15px;color:#6b7280;margin-bottom:24px;line-height:1.5;max-width:360px;}' +
      '.appio-landing-url{display:flex;align-items:center;gap:0;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;margin-top:16px;max-width:420px;}' +
      '.appio-landing-url-text{flex:1;padding:10px 14px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;color:#374151;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
      '.appio-landing-copy{flex-shrink:0;background:#f9fafb;border:none;border-left:1px solid #e5e7eb;padding:10px 16px;font-size:13px;font-weight:600;color:#374151;cursor:pointer;}' +
      '.appio-landing-copy:hover{background:#f3f4f6;}' +
      '.appio-landing-qr{padding:10px;background:#fff;border:1px solid #e5e7eb;border-radius:12px;display:inline-block;margin-bottom:12px;}' +
      '.appio-landing-qr img{display:block;}' +
      '.appio-landing-qr-fallback{width:220px;height:220px;display:flex;align-items:center;justify-content:center;color:#9ca3af;font-size:13px;}' +
      '.appio-landing-qr-caption{font-size:13px;color:#374151;line-height:1.5;max-width:220px;}' +
      '.appio-landing-qr-caption strong{color:#111827;font-weight:600;display:block;margin-bottom:2px;}' +
      '.appio-landing-qr-caption span{color:#6b7280;font-size:12px;}' +
      '@media (max-width:760px){.appio-landing-card{flex-direction:column-reverse;padding:28px;gap:24px;}.appio-landing-left,.appio-landing-right{text-align:center;width:100%;}.appio-landing-icon{margin-left:auto;margin-right:auto;}.appio-landing-subtitle{margin-left:auto;margin-right:auto;}}';
    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  }

  function mountApp() {
    if (!entryJs) return;
    var s = document.createElement('script');
    s.type = 'module';
    s.src = entryJs;
    document.body.appendChild(s);
  }

  function renderGate() {
    var ua = navigator.userAgent || '';
    var isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
    var isAndroid = /Android/.test(ua);
    var isMobile = isIOS || isAndroid || /Mobile/.test(ua);

    var appName = (document.title || 'this app').trim();
    var appInitial = (appName.charAt(0) || 'A').toUpperCase();
    var deviceWord = isMobile ? 'phone' : 'device';

    var body =
      '<div class="appio-gate-icon">' +
        '<span class="appio-gate-icon-fallback">' + escapeHtml(appInitial) + '</span>' +
        '<img src="/icon-192.png" alt="" onerror="this.style.display=\'none\';" />' +
      '</div>' +
      '<div class="appio-gate-title">Install ' + escapeHtml(appName) + '</div>' +
      '<div class="appio-gate-subtitle">' +
        'Add this app to your ' + deviceWord + '\u2019s home screen to continue.' +
      '</div>';

    var container = document.getElementById('appio-gate-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'appio-gate-container';
      document.body.appendChild(container);
    }

    if (isMobile) {
      if (isIOS) body += iosSteps();
      else body += androidInstall();
      container.innerHTML =
        '<div class="appio-gate">' +
          '<div class="appio-gate-card">' + body + '</div>' +
          '<div class="appio-gate-footer">Made with <a href="https://appio.app" target="_blank" rel="noopener">Appio</a></div>' +
        '</div>';
      if (!isIOS) wireAndroidInstall();
    } else {
      injectDesktopStyles();
      container.innerHTML = renderDesktopLanding(appName, appInitial);
      wireDesktopInstall();
      wireCopyUrl();
    }

    window.addEventListener('appinstalled', function () {
      setTimeout(function () { window.location.reload(); }, 400);
    });
  }

  function iosSteps() {
    var shareIcon =
      '<svg class="appio-gate-share-icon" viewBox="0 0 16 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
        '<path d="M8 1v11M4 5l4-4 4 4" stroke="#3b82f6" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>' +
        '<path d="M2 8v7a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V8" stroke="#3b82f6" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>' +
      '</svg>';
    return (
      '<div class="appio-gate-steps">' +
        '<div class="appio-gate-step">' +
          '<div class="appio-gate-step-num">1</div>' +
          '<div class="appio-gate-step-text">Tap the <strong>Share</strong> button ' + shareIcon + ' in Safari\u2019s toolbar.</div>' +
        '</div>' +
        '<div class="appio-gate-step">' +
          '<div class="appio-gate-step-num">2</div>' +
          '<div class="appio-gate-step-text">Scroll and choose <strong>Add to Home Screen</strong>.</div>' +
        '</div>' +
        '<div class="appio-gate-step">' +
          '<div class="appio-gate-step-num">3</div>' +
          '<div class="appio-gate-step-text">Tap <strong>Add</strong> \u2014 the app icon lands on your home screen.</div>' +
        '</div>' +
      '</div>' +
      '<div class="appio-gate-hint">Open this page in <strong>Safari</strong> (not inside Instagram / Messenger / Chrome) for the Share button to appear.</div>'
    );
  }

  function androidInstall() {
    var menuIcon =
      '<svg class="appio-gate-share-icon" viewBox="0 0 4 16" fill="#3b82f6" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
        '<circle cx="2" cy="2" r="2"/><circle cx="2" cy="8" r="2"/><circle cx="2" cy="14" r="2"/>' +
      '</svg>';
    return (
      '<button id="appio-install-trigger" class="appio-gate-btn" disabled>' +
        '<span id="appio-install-label">Preparing install\u2026</span>' +
      '</button>' +
      '<div class="appio-gate-hint" style="margin-bottom:14px;">Or install it manually:</div>' +
      '<div class="appio-gate-steps">' +
        '<div class="appio-gate-step">' +
          '<div class="appio-gate-step-num">1</div>' +
          '<div class="appio-gate-step-text">Tap the <strong>menu</strong> ' + menuIcon + ' in the top-right corner of Chrome.</div>' +
        '</div>' +
        '<div class="appio-gate-step">' +
          '<div class="appio-gate-step-num">2</div>' +
          '<div class="appio-gate-step-text">Choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.</div>' +
        '</div>' +
        '<div class="appio-gate-step">' +
          '<div class="appio-gate-step-num">3</div>' +
          '<div class="appio-gate-step-text">Confirm by tapping <strong>Install</strong>.</div>' +
        '</div>' +
      '</div>'
    );
  }

  function renderDesktopLanding(appName, appInitial) {
    var url = window.location.origin + '/';
    var qrSrc = 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=' +
      encodeURIComponent(url);
    return (
      '<div class="appio-landing">' +
        '<div class="appio-landing-card">' +
          '<div class="appio-landing-left">' +
            '<div class="appio-landing-icon">' +
              '<span class="appio-gate-icon-fallback">' + escapeHtml(appInitial) + '</span>' +
              '<img src="/icon-192.png" alt="" onerror="this.style.display=\'none\';" />' +
            '</div>' +
            '<div class="appio-landing-title">' + escapeHtml(appName) + '</div>' +
            '<div class="appio-landing-subtitle">' +
              'A mobile-first web app. Best experienced on your phone.' +
            '</div>' +
            '<button id="appio-install-trigger" class="appio-gate-btn" style="display:none;">' +
              '<span id="appio-install-label">Install on this computer</span>' +
            '</button>' +
            '<div class="appio-landing-url">' +
              '<span class="appio-landing-url-text">' + escapeHtml(url) + '</span>' +
              '<button id="appio-copy-url" class="appio-landing-copy" type="button">Copy</button>' +
            '</div>' +
          '</div>' +
          '<div class="appio-landing-right">' +
            '<div class="appio-landing-qr">' +
              '<img src="' + qrSrc + '" alt="QR code" width="220" height="220" ' +
                'onerror="this.parentNode.innerHTML=\'<div class=&quot;appio-landing-qr-fallback&quot;>Scan unavailable</div>\';" />' +
            '</div>' +
            '<div class="appio-landing-qr-caption">' +
              '<strong>Scan to open on phone</strong><br/>' +
              '<span>Then tap Share \u2192 Add to Home Screen</span>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="appio-gate-footer">Made with <a href="https://appio.app" target="_blank" rel="noopener">Appio</a></div>' +
      '</div>'
    );
  }

  function wireDesktopInstall() {
    // On Chrome/Edge desktop, beforeinstallprompt may fire — reveal the
    // "Install on this computer" button and wire it up. On Safari/Firefox
    // desktop the button simply stays hidden.
    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      deferredPrompt = e;
      var btn = document.getElementById('appio-install-trigger');
      var label = document.getElementById('appio-install-label');
      if (!btn || !label) return;
      btn.style.display = '';
      btn.addEventListener('click', function () {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(function () { deferredPrompt = null; });
      });
    });
  }

  function wireCopyUrl() {
    var btn = document.getElementById('appio-copy-url');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var url = window.location.origin + '/';
      var done = function () {
        btn.textContent = 'Copied';
        setTimeout(function () { btn.textContent = 'Copy'; }, 1500);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(done).catch(function () {});
      } else {
        var ta = document.createElement('textarea');
        ta.value = url;
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); done(); } catch (e) {}
        document.body.removeChild(ta);
      }
    });
  }

  var deferredPrompt = null;
  function wireAndroidInstall() {
    // If the browser never fires beforeinstallprompt (Firefox Android,
    // older Chrome, or criteria not met), the button stays stuck on
    // "Preparing install…" and looks broken. Hide it after 3s so the
    // manual 3-step instructions become the primary affordance.
    var fallbackTimer = setTimeout(function () {
      var btn = document.getElementById('appio-install-trigger');
      if (btn && btn.disabled) btn.style.display = 'none';
    }, 3000);

    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      deferredPrompt = e;
      clearTimeout(fallbackTimer);
      var btn = document.getElementById('appio-install-trigger');
      var label = document.getElementById('appio-install-label');
      if (!btn || !label) return;
      btn.disabled = false;
      btn.style.display = '';
      label.textContent = 'Install app';
      btn.addEventListener('click', function () {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(function (result) {
          deferredPrompt = null;
          if (result && result.outcome === 'dismissed') label.textContent = 'Install app';
        });
      });
    });
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
})();
