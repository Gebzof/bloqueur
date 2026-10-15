# Bloqueur de pubs

Extension Chrome (Manifest V3) qui bloque les publicités et les traqueurs courants, masque les emplacements publicitaires et supprime les pubs Twitch.

## Fonctionnalités

- **Blocage réseau** : les requêtes vers les régies publicitaires et traqueurs connus (DoubleClick, Google Ads, Amazon Ads, Taboola, Outbrain…) sont bloquées via `declarativeNetRequest`.
- **Nettoyage visuel** : les emplacements publicitaires et les blocs « Sponsorisé » / « Publicité » sont masqués, y compris ceux ajoutés dynamiquement.
- **Twitch** : les pubs sont intégrées directement dans le flux vidéo, donc impossibles à bloquer par le réseau. L'extension intercepte les playlists du lecteur :
  1. pendant une pub, elle bascule sur un flux de secours sans pub ;
  2. si aucun flux propre n'est disponible, elle retire les segments publicitaires (l'image reste figée le temps de la pub).
- **Compteur** : le nombre de requêtes bloquées sur l'onglet s'affiche sur l'icône.

## Installation

1. Cloner le dépôt :
   ```
   git clone https://github.com/Gebzof/bloqueur.git
   ```
2. Ouvrir `chrome://extensions` et activer le **Mode développeur**.
3. Cliquer sur **Charger l'extension non empaquetée** et sélectionner le dossier `adblock`.

### Mise à jour

```
git pull
```

Puis cliquer sur ⟳ sur l'extension dans `chrome://extensions` et recharger les onglets ouverts.

## Structure

| Fichier | Rôle |
|---|---|
| `adblock/manifest.json` | Déclaration de l'extension |
| `adblock/rules.json` | Règles de blocage réseau |
| `adblock/background.js` | Compteur et activation/désactivation |
| `adblock/cosmetic.css` / `cosmetic.js` | Masquage des emplacements publicitaires |
| `adblock/twitch.js` / `twitch.css` | Suppression des pubs Twitch |
| `adblock/popup.html` / `popup.js` | Fenêtre de l'icône |

## Dépannage Twitch

Ouvrir la console (F12) sur Twitch : les messages `[Bloqueur de pubs]` indiquent quand une pub est détectée et comment elle a été traitée. Twitch modifie régulièrement son système publicitaire, le blocage peut donc nécessiter des mises à jour.
