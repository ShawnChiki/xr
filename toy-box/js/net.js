/* ================= Toy Box: playing together (PeerJS, 4-digit codes) =================
   The toddler's device hosts: it runs the match and sends snapshots. Up to two phones join as toys.
   ?nettest uses a BroadcastChannel instead, so two tabs on one computer can test without the internet. */
const NET = { host: false, code: '', peer: null, conns: {}, conn: null, on: false, test: /[?&]nettest/.test(location.search), ice: null };
const NET_PREFIX = 'chiki-toybox-', MAX_TOYS = 2;
function Em() { this._h = {}; } Em.prototype.on = function (k, f) { (this._h[k] = this._h[k] || []).push(f); return this; }; Em.prototype.emit = function (k, ...a) { (this._h[k] || []).forEach(f => f(...a)); };
function BCConn(o, r) { Em.call(this); this.o = o; this.peer = r; this.open = false; } BCConn.prototype = Object.create(Em.prototype);
BCConn.prototype.ready = function () { if (this.open) return; this.open = true; setTimeout(() => this.emit('open'), 0); };
BCConn.prototype.send = function (d) { this.o.bc.postMessage({ to: this.peer, from: this.o.id, k: 'data', d }); };
BCConn.prototype.close = function () { this.o.bc.postMessage({ to: this.peer, from: this.o.id, k: 'close' }); };
function BCPeer(id) { Em.call(this); this.id = id || 'g' + Math.random().toString(36).slice(2, 9); this.conns = {}; this.bc = new BroadcastChannel('toybox-net');
  this.bc.onmessage = e => { const m = e.data; if (m.to !== this.id) return; const c = this.conns[m.from];
    if (m.k === 'conn') { const n = new BCConn(this, m.from); this.conns[m.from] = n; this.emit('connection', n); n.ready(); this.bc.postMessage({ to: m.from, from: this.id, k: 'ok' }); }
    else if (m.k === 'ok') c && c.ready(); else if (m.k === 'data') c && c.emit('data', m.d); else if (m.k === 'close') c && c.emit('close'); };
  setTimeout(() => this.emit('open', this.id), 10); }
BCPeer.prototype = Object.create(Em.prototype);
BCPeer.prototype.connect = function (id) { const c = new BCConn(this, id); this.conns[id] = c; this.bc.postMessage({ to: id, from: this.id, k: 'conn' }); setTimeout(() => { if (!c.open) this.emit('error', { type: 'peer-unavailable' }); }, 1500); return c; };
BCPeer.prototype.destroy = function () { try { this.bc.close(); } catch (e) {} };

async function makeIce() {
  const stun = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }];
  try { const user = Math.floor(Date.now() / 1000 + 24 * 3600) + ':toybox';
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode('openrelayprojectsecret'), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
    const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(user))), H = 'staticauth.openrelay.metered.ca';
    return stun.concat([{ urls: ['turn:' + H + ':80', 'turn:' + H + ':80?transport=tcp', 'turn:' + H + ':443', 'turns:' + H + ':443?transport=tcp'], username: user, credential: btoa(String.fromCharCode(...sig)) }]);
  } catch (e) { return stun; } }
async function loadPeer() { if (NET.test) return; if (!NET.ice) NET.ice = await makeIce(); if (window.Peer) return;
  await new Promise((res, rej) => { const sc = document.createElement('script'); sc.src = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js'; sc.onload = res; sc.onerror = () => rej(new Error('load')); document.head.append(sc); }); }
function makePeer(id) { if (NET.test) return new BCPeer(id); const o = { debug: 1, config: { iceServers: NET.ice } }; return id ? new window.Peer(id, o) : new window.Peer(o); }
function errText(e) { return e.type === 'peer-unavailable' ? 'No toddler with that code. Check it and try again.' : (e.type === 'network' || e.type === 'server-error' || e.type === 'socket-error') ? "Can't reach the matchmaker. Check the internet and try again." : 'Something went wrong (' + e.type + '). Try again.'; }
function netReset() {
  for (const id in NET.conns) try { NET.conns[id].close(); } catch (e) {}
  try { NET.conn && NET.conn.close(); } catch (e) {} try { NET.peer && NET.peer.destroy(); } catch (e) {}
  Object.assign(NET, { host: false, code: '', peer: null, conns: {}, conn: null, on: false });
}
// ---- host ----
async function netHost(onStatus) {
  netReset(); onStatus('Starting…');
  try { await loadPeer(); } catch (e) { return onStatus("Couldn't load the multiplayer part. Check the internet."); }
  const go = () => { const code = NET.test ? '1234' : String(1000 + Math.floor(Math.random() * 9000)), peer = makePeer(NET_PREFIX + code); NET.peer = peer;
    peer.on('open', () => { Object.assign(NET, { host: true, on: true, code }); onStatus('', code); });
    peer.on('connection', c => {
      c.on('open', () => { if (Object.keys(NET.conns).length >= MAX_TOYS) { try { c.send({ t: 'full' }); } catch (e) {} setTimeout(() => c.close(), 400); return; }
        NET.conns[c.peer] = c; APP.onJoin(c.peer); });
      c.on('data', m => APP.onHostData(c.peer, m));
      const drop = () => { if (NET.conns[c.peer]) { delete NET.conns[c.peer]; APP.onLeave(c.peer); } }; c.on('close', drop); c.on('error', drop);
    });
    peer.on('error', e => { if (e.type === 'unavailable-id') { try { peer.destroy(); } catch (_) {} go(); return; } if (!NET.on) onStatus(errText(e)); });
    peer.on('disconnected', () => { try { peer.reconnect(); } catch (e) {} }); };
  go();
}
function sendTo(pid, m) { const c = NET.conns[pid]; if (c) try { c.send(m); } catch (e) {} }
function sendAll(m) { for (const pid in NET.conns) sendTo(pid, m); }
// ---- phone ----
async function netJoin(code, onStatus) {
  code = String(code || '').trim(); if (!/^\d{4}$/.test(code)) return onStatus('Type the 4-digit code from the toddler.');
  netReset(); NET.code = code; onStatus('Connecting to ' + code + '…');
  try { await loadPeer(); } catch (e) { return onStatus("Couldn't load the multiplayer part. Check the internet."); }
  const peer = makePeer(); NET.peer = peer; let done = false;
  peer.on('open', () => { const c = peer.connect(NET_PREFIX + code, { reliable: true }); NET.conn = c;
    c.on('open', () => { done = true; NET.on = true; NET.myId = peer.id; onStatus('ok'); });
    c.on('data', m => APP.onClientData(m));
    c.on('close', () => APP.onHostGone()); c.on('error', () => APP.onHostGone()); });
  peer.on('error', e => { if (!done) onStatus(errText(e)); });
  setTimeout(() => { if (!done && NET.code === code) onStatus("Couldn't connect. Same Wi-Fi as the toddler? Check the code and try again."); }, 20000);
}
function sendHost(m) { if (NET.conn) try { NET.conn.send(m); } catch (e) {} }
