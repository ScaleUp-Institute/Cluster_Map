/* Passphrase gate for the secure build.
   =====================================================================
   The repository is public, so the data files in it are ciphertext. This
   script is loaded BEFORE app.js and defines window.__SECURE_GET__, which
   app.js's getJSON() hands every data request to. It puts a passphrase
   prompt over the page and holds each request until the key is derived.

   The passphrase IS the key -- there is no separate login to bypass,
   because there is no plaintext anywhere to reach. What protects the data
   is the strength of the passphrase and the cost of deriving the key from
   it, nothing else. An attacker has the ciphertext and can grind at it
   offline with no rate limit, which is why the build uses a long random
   passphrase and 600,000 PBKDF2 rounds.

   File format, written by tools/make_deploy.py:
     data/crypto.json   salt, iteration count, a check blob, url -> file map
     *.enc              iv (12 bytes) || AES-256-GCM ciphertext+tag
   Plaintext inside is gzip, so the wire size matches the uncompressed
   build that GitHub would have gzipped for us anyway.                   */
(function () {
  'use strict';

  var MANIFEST = 'data/crypto.json';
  var SKEY = 'scaleup-map-key';      // sessionStorage: raw key, not the passphrase
  var man = null, keyP = null, unlock = null;

  var b64d = function (s) {
    var raw = atob(s), a = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) a[i] = raw.charCodeAt(i);
    return a;
  };
  var b64e = function (buf) {
    var a = new Uint8Array(buf), s = '';
    for (var i = 0; i < a.length; i++) s += String.fromCharCode(a[i]);
    return btoa(s);
  };

  function manifest() {
    if (!man) man = fetch(MANIFEST, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error('crypto.json → HTTP ' + r.status);
      return r.json();
    });
    return man;
  }

  function deriveKey(pass, m) {
    var enc = new TextEncoder();
    return crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey'])
      .then(function (base) {
        return crypto.subtle.deriveKey(
          { name: 'PBKDF2', salt: b64d(m.salt), iterations: m.iter, hash: 'SHA-256' },
          base, { name: 'AES-GCM', length: 256 }, true, ['decrypt']);
      });
  }

  /* Decrypting a 2 MB file with the wrong key fails only at the tag check, after
     the whole file has been read. The manifest carries a few encrypted bytes so a
     wrong passphrase is rejected immediately, and the message can say so plainly. */
  function verify(key, m) {
    var blob = b64d(m.check), iv = blob.slice(0, 12), ct = blob.slice(12);
    return crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, key, ct)
      .then(function (out) {
        if (new TextDecoder().decode(out) !== m.checkText) throw new Error('bad');
        return key;
      });
  }

  function cachedKey(m) {
    var raw;
    try { raw = sessionStorage.getItem(SKEY); } catch (e) { return null; }
    if (!raw) return null;
    return crypto.subtle.importKey('raw', b64d(raw), 'AES-GCM', true, ['decrypt'])
      .then(function (k) { return verify(k, m); })
      .catch(function () { try { sessionStorage.removeItem(SKEY); } catch (e) {} return null; });
  }

  function remember(key) {
    return crypto.subtle.exportKey('raw', key).then(function (raw) {
      try { sessionStorage.setItem(SKEY, b64e(raw)); } catch (e) {}
      return key;
    });
  }

  /* The label comes from our own build, but it is still interpolated into
     innerHTML, so it is escaped like anything else would be. */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------------------------------------------------------------- the gate */
  function showGate(m) {
    return new Promise(function (resolve) {
      var css = document.createElement('style');
      css.textContent =
        '#sg-wrap{position:fixed;inset:0;z-index:99999;background:#0d1b26;color:#e8eef2;' +
        'display:flex;align-items:center;justify-content:center;' +
        'font:400 15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}' +
        '#sg-box{width:min(420px,90vw);padding:34px 32px;background:#13293a;' +
        'border:1px solid #27445a;border-radius:12px;box-shadow:0 18px 50px rgba(0,0,0,.45)}' +
        '#sg-box h1{margin:0 0 6px;font-size:19px;font-weight:700;letter-spacing:-.01em}' +
        '#sg-box p{margin:0 0 20px;font-size:13.5px;color:#8fa8b8}' +
        '#sg-in{width:100%;box-sizing:border-box;padding:11px 13px;font:500 15px/1.4 ' +
        'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:.04em;' +
        'color:#e8eef2;background:#0d1b26;border:1px solid #2f506a;border-radius:7px}' +
        '#sg-in:focus{outline:none;border-color:#4a9ad4;box-shadow:0 0 0 3px rgba(74,154,212,.22)}' +
        '#sg-go{margin-top:14px;width:100%;padding:11px;font:600 14px/1 inherit;color:#fff;' +
        'background:#2F6DB5;border:0;border-radius:7px;cursor:pointer}' +
        '#sg-go:hover{background:#3a7cc7}#sg-go:disabled{opacity:.55;cursor:default}' +
        '#sg-msg{margin-top:13px;min-height:18px;font-size:13px;color:#ff9b9b}' +
        '#sg-msg.work{color:#8fa8b8}';
      document.head.appendChild(css);

      var wrap = document.createElement('div');
      wrap.id = 'sg-wrap';
      wrap.innerHTML =
        '<div id="sg-box" role="dialog" aria-modal="true" aria-labelledby="sg-h">' +
        '<h1 id="sg-h">' + esc(m.scopeLabel ? m.scopeLabel + ' Scaleup Map'
                                            : 'UK Scaleup Map') + '</h1>' +
        '<p>This build is encrypted. Enter the passphrase to load the data.</p>' +
        '<input id="sg-in" type="password" autocomplete="off" spellcheck="false" ' +
        'autocapitalize="off" aria-label="Passphrase" placeholder="XXXX-XXXX-XXXX-XXXX-XXXX">' +
        '<button id="sg-go" type="button">Unlock</button>' +
        '<div id="sg-msg" role="status" aria-live="polite"></div></div>';
      document.body.appendChild(wrap);

      var input = wrap.querySelector('#sg-in'),
          btn = wrap.querySelector('#sg-go'),
          msg = wrap.querySelector('#sg-msg');
      input.focus();

      function fail(text) {
        msg.className = ''; msg.textContent = text;
        btn.disabled = false; input.disabled = false;
        input.select(); input.focus();
      }

      function submit() {
        var pass = input.value.trim();
        if (!pass) { fail('Enter the passphrase.'); return; }
        btn.disabled = true; input.disabled = true;
        msg.className = 'work'; msg.textContent = 'Deriving key…';
        // 600,000 rounds is deliberately about a second. Yield first so the
        // message paints before the main thread blocks on the derivation.
        setTimeout(function () {
          deriveKey(pass, m).then(function (k) { return verify(k, m); })
            .then(remember)
            .then(function (k) {
              msg.textContent = 'Decrypting…';
              wrap.remove(); css.remove();
              resolve(k);
            })
            .catch(function () { fail('That passphrase is not right.'); });
        }, 30);
      }

      btn.addEventListener('click', submit);
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
    });
  }

  function key() {
    if (keyP) return keyP;
    keyP = manifest().then(function (m) {
      return Promise.resolve(cachedKey(m)).then(function (k) {
        return k || showGate(m);
      }).then(function (k) { unlock = m; return k; });
    });
    return keyP;
  }

  /* --------------------------------------------------------------- the loader */
  function gunzip(buf) {
    if (typeof DecompressionStream !== 'function') {
      throw new Error('This browser cannot decompress the data. Use a current ' +
                      'version of Chrome, Edge, Firefox or Safari.');
    }
    var s = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Response(s).text();
  }

  window.__SECURE_GET__ = function (url) {
    return key().then(function (k) {
      var enc = (unlock.files || {})[url];
      if (!enc) throw new Error('no encrypted file listed for ' + url);
      return fetch(enc, { cache: 'no-cache' }).then(function (r) {
        if (!r.ok) throw new Error(enc + ' → HTTP ' + r.status);
        return r.arrayBuffer();
      }).then(function (buf) {
        var all = new Uint8Array(buf);
        return crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: all.slice(0, 12) }, k, all.slice(12));
      }).then(gunzip).then(JSON.parse);
    });
  };
})();
