// Compte les requêtes bloquées par onglet et affiche le total sur l'icône.
chrome.declarativeNetRequest.setExtensionActionOptions({ displayActionCountAsBadgeText: true });
chrome.action.setBadgeBackgroundColor({ color: '#c0392b' });

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg.type === 'toggle') {
    chrome.declarativeNetRequest
      .updateEnabledRulesets(msg.enabled ? { enableRulesetIds: ['ads'] } : { disableRulesetIds: ['ads'] })
      .then(() => chrome.storage.local.set({ enabled: msg.enabled }))
      .then(() => reply({ ok: true }));
    return true;
  }
});

// ---- VPN (proxy) : tout le trafic de Chrome passe par le serveur configuré dans le popup ----
const VPN_DEFAULTS = { enabled: false, scheme: 'https', host: '', port: 443, username: '', password: '' };

async function applyVpn() {
  const { vpn } = await chrome.storage.local.get({ vpn: VPN_DEFAULTS });
  if (vpn.enabled && vpn.host && vpn.port) {
    await chrome.proxy.settings.set({
      scope: 'regular',
      value: {
        mode: 'fixed_servers',
        rules: {
          singleProxy: { scheme: vpn.scheme, host: vpn.host, port: Number(vpn.port) },
          bypassList: ['<local>', 'localhost', '127.0.0.1', '[::1]'],
        },
      },
    });
  } else {
    await chrome.proxy.settings.clear({ scope: 'regular' });
  }
}

// Identifiants du proxy (HTTP/HTTPS). On ne réessaie pas en boucle si le mot de passe est refusé.
const authTried = new Set();
chrome.webRequest.onAuthRequired.addListener(
  (details, callback) => {
    if (!details.isProxy) return callback({});
    if (authTried.has(details.requestId)) return callback({ cancel: true }); // identifiants refusés
    authTried.add(details.requestId);
    chrome.storage.local.get({ vpn: VPN_DEFAULTS }).then(({ vpn }) =>
      callback(vpn.enabled && vpn.username ? { authCredentials: { username: vpn.username, password: vpn.password } } : { cancel: true })
    );
  },
  { urls: ['<all_urls>'] },
  ['asyncBlocking']
);
const forgetAuth = d => authTried.delete(d.requestId);
chrome.webRequest.onCompleted.addListener(forgetAuth, { urls: ['<all_urls>'] });
chrome.webRequest.onErrorOccurred.addListener(forgetAuth, { urls: ['<all_urls>'] });

// Serveur VPN injoignable (ex. Tor arrêté) : on coupe le VPN pour ne pas priver Chrome d'Internet
chrome.proxy.onProxyError.addListener(async e => {
  console.warn('[Bloqueur de pubs] Erreur VPN :', e.error, e.details);
  if (e.error !== 'net::ERR_PROXY_CONNECTION_FAILED' && e.error !== 'net::ERR_SOCKS_CONNECTION_FAILED') return;
  const { vpn } = await chrome.storage.local.get({ vpn: VPN_DEFAULTS });
  if (!vpn.enabled) return;
  await chrome.storage.local.set({
    vpn: { ...vpn, enabled: false },
    vpnError: `VPN désactivé : serveur ${vpn.host}:${vpn.port} injoignable.`,
  });
});
chrome.storage.onChanged.addListener(changes => { if (changes.vpn) applyVpn(); });
chrome.runtime.onStartup.addListener(applyVpn);
chrome.runtime.onInstalled.addListener(applyVpn);
