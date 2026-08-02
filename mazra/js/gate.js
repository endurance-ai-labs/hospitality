/* ============================================================
   Restaurant OS — demo password gate
   Loaded FIRST on every page. Hides the whole document until the
   demo password is entered, then unlocks for the browser session.

   This is a demo gate, not a security control: the hash ships in the
   page, so it keeps the demo off search engines and out of casual
   hands. Anything genuinely sensitive must never live in this repo.
   ============================================================ */
(function () {
  var KEY = 'rgos_unlocked';
  /* SHA-256 of the demo password */
  var HASH = 'ac90f728eed6e93794b7c08e9b4bdb92f43b1442d9dac792443c07983ca221de';
  var BASE = '/hospitality/mazra';

  try { if (sessionStorage.getItem(KEY) === '1') return; } catch (e) { return; }

  /* hide everything the other scripts are about to render */
  var style = document.createElement('style');
  style.id = 'rg-gate-style';
  style.textContent =
    'body > *:not(#rg-gate){display:none !important}' +
    '#rg-gate{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;' +
    'justify-content:center;padding:24px;' +
    'background:radial-gradient(1200px 600px at 50% -10%,rgba(39,102,214,.16),rgba(0,0,0,0) 60%),' +
    'linear-gradient(180deg,#f7f8fa 0%,#e8ecf2 100%);' +
    'font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}' +
    '#rg-gate .gbox{background:#fff;border:1px solid rgba(21,29,48,.12);border-radius:16px;' +
    'box-shadow:0 30px 80px rgba(21,29,48,.16);padding:38px 40px;max-width:420px;width:100%;text-align:center}' +
    '#rg-gate img{height:52px;margin:0 auto 18px;display:block}' +
    '#rg-gate h1{font-size:19px;font-weight:800;letter-spacing:-.015em;color:#151d30;margin:0 0 6px}' +
    '#rg-gate p{font-size:12.5px;color:#5b6472;margin:0 0 20px;line-height:1.55}' +
    '#rg-gate input{width:100%;padding:11px 14px;font-size:14px;font-family:inherit;' +
    'border:1px solid #dde4ee;border-radius:9px;outline:none;text-align:center;letter-spacing:.02em}' +
    '#rg-gate input:focus{border-color:#2766d6;box-shadow:0 0 0 3px rgba(39,102,214,.12)}' +
    '#rg-gate button{width:100%;margin-top:10px;padding:11px 14px;font-size:13.5px;font-weight:700;' +
    'font-family:inherit;color:#fff;background:#151d30;border:none;border-radius:9px;cursor:pointer}' +
    '#rg-gate button:hover{background:#2766d6}' +
    '#rg-gate .err{font-size:12px;color:#C96B57;margin-top:11px;min-height:16px;font-weight:600}' +
    '#rg-gate .foot{margin-top:22px;font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;color:#97a0ad}';
  (document.head || document.documentElement).appendChild(style);

  function sha256(text) {
    var buf = new TextEncoder().encode(text);
    return crypto.subtle.digest('SHA-256', buf).then(function (d) {
      return Array.prototype.map.call(new Uint8Array(d), function (b) {
        return b.toString(16).padStart(2, '0');
      }).join('');
    });
  }

  function mount() {
    if (document.getElementById('rg-gate')) return;
    var g = document.createElement('div');
    g.id = 'rg-gate';
    g.innerHTML =
      '<div class="gbox">' +
        '<img src="' + BASE + '/assets/brand/mazra-wordmark.svg" alt="">' +
        '<h1>Operating System</h1>' +
        '<p>This demo is private. Enter the access code to continue.</p>' +
        '<input id="rg-gate-in" type="password" placeholder="Access code" autocomplete="off" autofocus>' +
        '<button id="rg-gate-go">Enter</button>' +
        '<div class="err" id="rg-gate-err"></div>' +
        '<div class="foot">Endurance AI Labs · demo environment · fictional data</div>' +
      '</div>';
    document.body.appendChild(g);

    var input = document.getElementById('rg-gate-in');
    var err = document.getElementById('rg-gate-err');

    function submit() {
      sha256(input.value.trim()).then(function (h) {
        if (h === HASH) {
          try { sessionStorage.setItem(KEY, '1'); } catch (e) {}
          location.reload();
        } else {
          err.textContent = 'Incorrect access code.';
          input.value = '';
          input.focus();
        }
      });
    }
    document.getElementById('rg-gate-go').addEventListener('click', submit);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
    input.focus();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
