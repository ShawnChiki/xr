// turn-config.js: one shared relay (TURN) setup for every multiplayer app in this repo.
//
// PeerJS tries to connect two devices directly. On different wifi networks or cellular data that
// often fails, so this adds Sean's ExpressTURN relay to every WebRTC connection the page makes.
// Players never log in; the relay login below is used by the app itself.
//
// To change provider or login: edit TURN_SERVERS below (the games repo has its own copy of this file).
// Load it in <head>, before the app makes any connection:
//   <script src="../turn-config.js"></script>   (app in its own folder)
//   <script src="turn-config.js"></script>      (top-level .html)
(function () {
  var TURN_SERVERS = [
    { urls: 'stun:free.expressturn.com:3478' },
    {
      urls: [
        'turn:free.expressturn.com:3478?transport=udp',
        'turn:free.expressturn.com:3478?transport=tcp'
      ],
      username: '000000002110650914',
      credential: 'zhSRZXeX9cnDrM9k7BQIcpLGT1I='   // capital I after BQ (checked against the dashboard's secret key)
    }
  ];

  // Relays that no longer accept anonymous logins: dropped so connections don't waste time on them.
  var DEAD = /openrelay\.metered\.ca/;

  window.CHIKI_TURN = TURN_SERVERS;

  // chikiRelayCheck(): resolves true if this device can get an address on the relay within a few seconds.
  // Apps call it after a failed join so the message can say whether the relay itself is the problem.
  window.chikiRelayCheck = function (ms) {
    return new Promise(function (res) {
      var Pc = window.__chikiNativePC || window.RTCPeerConnection, done = false, pc;
      function end(v) { if (done) return; done = true; try { pc.close(); } catch (e) {} res(v); }
      try {
        pc = new Pc({ iceServers: TURN_SERVERS, iceTransportPolicy: 'relay' });
        pc.createDataChannel('check');
        pc.onicecandidate = function (e) { if (e.candidate && / typ relay /.test(e.candidate.candidate)) end(true); else if (!e.candidate) end(false); };
        pc.createOffer().then(function (o) { return pc.setLocalDescription(o); }).catch(function () { end(false); });
      } catch (e) { return res(false); }
      setTimeout(function () { end(false); }, ms || 6000);
    });
  };

  var Native = window.RTCPeerConnection;
  if (!Native || Native.__chikiTurn) return;
  window.__chikiNativePC = Native;

  function urlsOf(s) { return [].concat(s && (s.urls || s.url) || []).join(' '); }

  function withRelay(config) {
    var c = Object.assign({}, config || {});
    var kept = (c.iceServers || []).filter(function (s) { return !DEAD.test(urlsOf(s)); });
    c.iceServers = TURN_SERVERS.concat(kept);
    return c;
  }

  function ChikiPeerConnection(config, extra) {
    return extra === undefined ? new Native(withRelay(config)) : new Native(withRelay(config), extra);
  }
  ChikiPeerConnection.prototype = Native.prototype;
  Object.setPrototypeOf(ChikiPeerConnection, Native); // keeps RTCPeerConnection.generateCertificate etc.
  ChikiPeerConnection.__chikiTurn = true;

  window.RTCPeerConnection = ChikiPeerConnection;
  if (window.webkitRTCPeerConnection) window.webkitRTCPeerConnection = ChikiPeerConnection;
})();
