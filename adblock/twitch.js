// Bloque les pubs Twitch intégrées au flux vidéo (SSAI).
// Twitch insère les pubs directement dans les playlists HLS lues par le worker du lecteur :
// on remplace ce worker par une version dont le fetch filtre ces playlists.
// Pendant une pub, on bascule sur un flux "de secours" (autre type de lecteur, souvent sans pub) ;
// si aucun n'est propre, on retire les segments publicitaires (image figée le temps de la pub).
(() => {
  if (window.__nopubTwitch) return;
  window.__nopubTwitch = true;

  // ---- Code exécuté dans le worker du lecteur (doit être autonome) ----
  function workerMain() {
    const CLIENT_ID = 'kimne78kx3ncx6brgo4mv6wki5h1ko';
    const PLAYER_TYPES = ['embed', 'popout', 'autoplay', 'site'];
    const realFetch = self.fetch.bind(self);
    const headers = {};          // Device-ID, Client-Version… transmis par la page
    const variants = new Map();  // URL playlist média -> { channel, usherUrl, resolution, frameRate }
    const backups = new Map();   // channel|resolution -> { url, playerType }
    let adActive = false;

    self.addEventListener('message', e => {
      if (e.data && e.data.__nopub === 'headers') {
        Object.assign(headers, e.data.headers);
        e.stopImmediatePropagation();
      }
    });

    const hasAds = text => text.includes('stitched') || text.includes('X-TV-TWITCH-AD');

    function parseMaster(text, usherUrl) {
      const channel = (usherUrl.match(/\/hls\/([^/.]+)\.m3u8/) || [])[1];
      if (!channel) return;
      const lines = text.split('\n');
      for (let i = 0; i < lines.length - 1; i++) {
        if (!lines[i].startsWith('#EXT-X-STREAM-INF')) continue;
        const res = (lines[i].match(/RESOLUTION=(\d+x\d+)/) || [])[1] || '';
        const fps = parseFloat((lines[i].match(/FRAME-RATE=([\d.]+)/) || [])[1]) || 0;
        variants.set(lines[i + 1].trim(), { channel: channel.toLowerCase(), usherUrl, resolution: res, frameRate: fps });
      }
    }

    function pickVariant(text, info) {
      const lines = text.split('\n');
      let best = null, bestScore = Infinity;
      for (let i = 0; i < lines.length - 1; i++) {
        if (!lines[i].startsWith('#EXT-X-STREAM-INF')) continue;
        const res = (lines[i].match(/RESOLUTION=(\d+)x(\d+)/) || []);
        const fps = parseFloat((lines[i].match(/FRAME-RATE=([\d.]+)/) || [])[1]) || 0;
        const want = info.resolution.split('x').map(Number);
        const score = res[2] ? Math.abs(res[2] - (want[1] || 0)) * 10 + Math.abs(fps - info.frameRate) : 1e6;
        if (score < bestScore) { bestScore = score; best = lines[i + 1].trim(); }
      }
      return best;
    }

    async function getToken(channel, playerType) {
      const h = { 'Client-ID': CLIENT_ID, 'Content-Type': 'text/plain;charset=UTF-8' };
      if (headers.deviceId) h['Device-ID'] = headers.deviceId;
      if (headers.clientVersion) h['Client-Version'] = headers.clientVersion;
      if (headers.clientSession) h['Client-Session-Id'] = headers.clientSession;
      const res = await realFetch('https://gql.twitch.tv/gql', {
        method: 'POST',
        headers: h,
        body: JSON.stringify({
          operationName: 'PlaybackAccessToken_Template',
          query: 'query PlaybackAccessToken_Template($login: String!, $isLive: Boolean!, $vodID: ID!, $isVod: Boolean!, $playerType: String!, $platform: String!) {  streamPlaybackAccessToken(channelName: $login, params: {platform: $platform, playerBackend: "mediaplayer", playerType: $playerType}) @include(if: $isLive) {    value    signature   authorization { isForbidden forbiddenReasonCode }   __typename  }  videoPlaybackAccessToken(id: $vodID, params: {platform: $platform, playerBackend: "mediaplayer", playerType: $playerType}) @include(if: $isVod) {    value    signature   __typename  }}',
          variables: { isLive: true, login: channel, isVod: false, vodID: '', playerType, platform: playerType === 'autoplay' ? 'android' : 'web' },
        }),
      });
      if (!res.ok) return null;
      const json = await res.json();
      return json && json.data && json.data.streamPlaybackAccessToken;
    }

    // Cherche un flux de secours sans pub pour ce variant. Renvoie le texte de la playlist média ou null.
    async function findBackup(info) {
      const key = info.channel + '|' + info.resolution;
      const cached = backups.get(key);
      if (cached) {
        try {
          const text = await (await realFetch(cached.url)).text();
          if (!hasAds(text)) return text;
        } catch {}
        backups.delete(key);
      }
      for (const playerType of PLAYER_TYPES) {
        try {
          const token = await getToken(info.channel, playerType);
          if (!token || !token.value) continue;
          const usher = new URL(info.usherUrl);
          usher.searchParams.set('sig', token.signature);
          usher.searchParams.set('token', token.value);
          usher.searchParams.set('p', String(Math.floor(Math.random() * 1e7)));
          const masterRes = await realFetch(usher.href);
          if (!masterRes.ok) continue;
          const url = pickVariant(await masterRes.text(), info);
          if (!url) continue;
          const text = await (await realFetch(url)).text();
          if (!hasAds(text)) {
            backups.set(key, { url, playerType });
            return text;
          }
        } catch {}
      }
      return null;
    }

    // Retire les segments publicitaires et les marqueurs de pub.
    function stripAds(text) {
      const lines = text.split('\n');
      const out = [];
      for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        if (l.startsWith('#EXTINF') && !l.includes(',live')) { i++; continue; } // saute aussi l'URL du segment
        // Garde seulement les DATERANGE techniques (horodatage, session) ; les autres décrivent la pub
        if (l.startsWith('#EXT-X-DATERANGE') && !/CLASS="(timestamp|twitch-session)"/.test(l)) continue;
        if (l.startsWith('#EXT-X-TWITCH-PREFETCH')) continue;
        out.push(l);
      }
      return out.join('\n');
    }

    self.fetch = async function (input, init) {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input && input.url;
      if (!url || !url.includes('.m3u8')) return realFetch(input, init);

      const res = await realFetch(input, init);
      if (!res.ok) return res;

      if (url.includes('usher.ttvnw.net') && url.includes('/hls/')) {
        const text = await res.text();
        parseMaster(text, url);
        console.info('[Bloqueur de pubs] Flux Twitch intercepté (' + variants.size + ' qualités)');
        return new Response(text, { status: res.status, statusText: res.statusText, headers: res.headers });
      }

      const info = variants.get(url);
      if (!info) {
        const text = await res.text();
        return new Response(hasAds(text) ? stripAds(text) : text, { status: res.status, statusText: res.statusText, headers: res.headers });
      }

      let text = await res.text();
      const key = info.channel + '|' + info.resolution;
      if (hasAds(text)) {
        const backup = await findBackup(info);
        if (!adActive) console.info('[Bloqueur de pubs] Pub Twitch détectée → ' + (backup ? 'flux de secours (' + backups.get(key).playerType + ')' : 'segments pub retirés'));
        adActive = true;
        text = backup || stripAds(text);
      } else {
        if (adActive) console.info('[Bloqueur de pubs] Fin de la pub, retour au flux normal');
        adActive = false;
        backups.delete(key);
      }
      return new Response(text, { status: res.status, statusText: res.statusText, headers: res.headers });
    };
  }

  // ---- Côté page : remplacement du Worker du lecteur ----
  const WORKER_PREFIX = '(' + workerMain.toString() + ')();\n';
  const RealWorker = window.Worker;
  const workers = new Set();
  const gqlHeaders = {};

  function wrapWorkerUrl(url, opts) {
    if (opts && opts.type === 'module') return url;
    try {
      const abs = new URL(url, location.href).href;
      // Lecture synchrone : Twitch révoque le blob juste après la création du worker.
      const xhr = new XMLHttpRequest();
      xhr.open('GET', abs, false);
      xhr.send();
      const src = xhr.responseText || '';
      if (xhr.status !== 200 && xhr.status !== 0) return url;
      if (!/twitch|ivs|mediaplayer/i.test(src)) return url;
      return URL.createObjectURL(new Blob([WORKER_PREFIX + src], { type: 'text/javascript' }));
    } catch {
      return url;
    }
  }

  class NoPubWorker extends RealWorker {
    constructor(url, opts) {
      super(wrapWorkerUrl(url, opts), opts);
      workers.add(this);
      this.postMessage({ __nopub: 'headers', headers: gqlHeaders });
    }
  }
  window.Worker = NoPubWorker;

  // Récupère les en-têtes envoyés par Twitch à son API, pour que les requêtes de secours y ressemblent.
  const realFetch = window.fetch;
  window.fetch = function (input, init) {
    try {
      const url = typeof input === 'string' ? input : input && input.url;
      if (url && url.includes('gql.twitch.tv')) {
        const h = new Headers((init && init.headers) || (input instanceof Request ? input.headers : undefined));
        const next = {
          deviceId: h.get('Device-ID') || h.get('X-Device-Id'),
          clientVersion: h.get('Client-Version'),
          clientSession: h.get('Client-Session-Id'),
        };
        let changed = false;
        for (const k in next) if (next[k] && next[k] !== gqlHeaders[k]) { gqlHeaders[k] = next[k]; changed = true; }
        if (changed) workers.forEach(w => w.postMessage({ __nopub: 'headers', headers: gqlHeaders }));
      }
    } catch {}
    return realFetch.apply(this, arguments);
  };
})();
