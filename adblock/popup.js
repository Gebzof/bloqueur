const box = document.getElementById('on');
chrome.storage.local.get({ enabled: true }).then(({ enabled }) => (box.checked = enabled));
box.addEventListener('change', () => chrome.runtime.sendMessage({ type: 'toggle', enabled: box.checked }));

// ---- VPN ----
const $ = id => document.getElementById(id);
const status = (text, cls = '') => { $('status').textContent = text; $('status').className = cls; };
const VPN_DEFAULTS = { enabled: false, scheme: 'https', host: '', port: 443, username: '', password: '' };

chrome.storage.local.get({ vpn: VPN_DEFAULTS, vpnError: '' }).then(({ vpn, vpnError }) => {
  if (vpnError) { status(vpnError, 'err'); chrome.storage.local.remove('vpnError'); }
  $('vpn-on').checked = vpn.enabled;
  $('vpn-scheme').value = vpn.scheme;
  $('vpn-host').value = vpn.host;
  $('vpn-port').value = vpn.port;
  $('vpn-user').value = vpn.username;
  $('vpn-pass').value = vpn.password;
});

function save() {
  const vpn = {
    enabled: $('vpn-on').checked,
    scheme: $('vpn-scheme').value,
    host: $('vpn-host').value.trim(),
    port: Number($('vpn-port').value) || 0,
    username: $('vpn-user').value.trim(),
    password: $('vpn-pass').value,
  };
  if (vpn.enabled && (!vpn.host || !vpn.port)) {
    $('vpn-on').checked = false;
    return status('Renseignez le serveur et le port.', 'err');
  }
  return chrome.storage.local.set({ vpn }).then(() => status(vpn.enabled ? 'VPN activé.' : 'VPN désactivé.', 'ok'));
}

$('vpn-save').addEventListener('click', save);
$('vpn-on').addEventListener('change', save);
// Service Tor installé par windows/installer-tor.bat (Tor Browser utilise le port 9150)
$('vpn-tor').addEventListener('click', () => {
  $('vpn-scheme').value = 'socks5';
  $('vpn-host').value = '127.0.0.1';
  $('vpn-port').value = 9050;
  $('vpn-user').value = '';
  $('vpn-pass').value = '';
  $('vpn-on').checked = true;
  save();
});
$('vpn-check').addEventListener('click', async () => {
  status('Vérification…');
  // Le proxy est-il vraiment appliqué par cette extension ?
  const { levelOfControl, value } = await chrome.proxy.settings.get({});
  const actif = levelOfControl === 'controlled_by_this_extension' && value.mode === 'fixed_servers';
  if (levelOfControl === 'controlled_by_other_extensions') return status('Une autre extension contrôle le proxy de Chrome : désactivez-la.', 'err');
  if (levelOfControl === 'not_controllable') return status('Le proxy de Chrome est verrouillé par une stratégie système.', 'err');
  // geojs accepte les connexions Tor (ipinfo les refuse)
  for (const url of ['https://get.geojs.io/v1/ip/geo.json', 'https://ipinfo.io/json']) {
    try {
      const r = await fetch(url, { cache: 'no-store' });
      if (!r.ok) continue;
      const d = await r.json();
      const lieu = [d.city, d.country_code || d.country].filter(Boolean).join(', ');
      return status(`${actif ? 'VPN actif' : 'Sans VPN'} — IP : ${d.ip} — ${lieu}`, actif ? 'ok' : '');
    } catch {}
  }
  status('Échec : serveur VPN injoignable ou identifiants incorrects', 'err');
});
