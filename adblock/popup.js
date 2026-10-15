const box = document.getElementById('on');
chrome.storage.local.get({ enabled: true }).then(({ enabled }) => (box.checked = enabled));
box.addEventListener('change', () => chrome.runtime.sendMessage({ type: 'toggle', enabled: box.checked }));
