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
