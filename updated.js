// When did each app last change? Read from this repo's commit history on GitHub, so it is always right
// without anyone having to remember to bump a date.
// On an app page: a small "Updated …" tag in the bottom-right corner (also on window.chikiUpdated).
// On the launcher (data-mode="list"): only the helpers; index.html draws its own labels.
(() => {
  const REPO = 'ShawnChiki/xr', TTL = 3 * 60 * 1000;             // ask GitHub at most every 3 minutes per app
  const me = document.currentScript, base = new URL('.', me.src);
  // the repo path for a page: "chikiballz-vr.html", or "wobble-run" for an app in its own folder
  function pathOf(href){
    const rel = new URL(href, location.href).pathname.slice(base.pathname.length).replace(/index\.html$/, '').replace(/\/$/, '');
    return rel || 'index.html';
  }
  async function latest(path){
    const key = 'chiki-updated:' + path;
    try { const c = JSON.parse(localStorage.getItem(key)); if (c && Date.now() - c.at < TTL) return c.v; } catch (e) {}
    const r = await fetch(`https://api.github.com/repos/${REPO}/commits?per_page=1&path=${encodeURIComponent(path)}`, { headers: { Accept: 'application/vnd.github+json' } });
    if (!r.ok) throw new Error('GitHub ' + r.status);
    const j = await r.json(); if (!j.length) throw new Error('no commits');
    const v = { date: j[0].commit.committer.date, msg: j[0].commit.message.split('\n')[0] };
    try { localStorage.setItem(key, JSON.stringify({ at: Date.now(), v })); } catch (e) {}
    return v;
  }
  function ago(d){
    const s = (Date.now() - d) / 1000;
    if (s < 90) return 'just now';
    if (s < 3600) return Math.round(s / 60) + ' min ago';
    if (s < 86400) { const h = Math.round(s / 3600); return h + (h === 1 ? ' hour ago' : ' hours ago'); }
    const n = Math.round(s / 86400); return n + (n === 1 ? ' day ago' : ' days ago');
  }
  const when = d => d.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const seenKey = path => 'chiki-seen:' + path;
  window.ChikiUpdated = { latest, pathOf, ago, when, seenKey };
  if (me.dataset.mode === 'list') return;

  const path = pathOf(location.href);
  latest(path).then(v => {
    const d = new Date(v.date);
    window.chikiUpdated = { date: d, message: v.msg, label: 'Updated ' + ago(d) };
    try { localStorage.setItem(seenKey(path), v.date); } catch (e) {}
    const tag = document.createElement('div');
    tag.textContent = 'Updated ' + when(d) + ' · ' + ago(d);
    tag.title = v.msg;
    tag.setAttribute('style', 'position:fixed;right:10px;bottom:10px;z-index:2147483000;pointer-events:none;' +
      'font:600 12px/1.2 system-ui,-apple-system,"Segoe UI",sans-serif;color:#fff;background:rgba(20,18,40,.72);' +
      'border:1px solid rgba(255,255,255,.18);border-radius:999px;padding:5px 10px;white-space:nowrap');
    document.body.appendChild(tag);
    dispatchEvent(new CustomEvent('chiki-updated', { detail: window.chikiUpdated }));
  }).catch(() => {});
})();
