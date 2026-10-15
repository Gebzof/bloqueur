# Bloqueur de pubs

Extension Chrome (Manifest V3) qui bloque les publicités et les traqueurs courants, masque les emplacements publicitaires et supprime les pubs Twitch.

## Fonctionnalités

- **Blocage réseau** : les requêtes vers les régies publicitaires et traqueurs connus (DoubleClick, Google Ads, Amazon Ads, Taboola, Outbrain…) sont bloquées via `declarativeNetRequest`.
- **Nettoyage visuel** : les emplacements publicitaires et les blocs « Sponsorisé » / « Publicité » sont masqués, y compris ceux ajoutés dynamiquement.
- **Twitch** : les pubs sont intégrées directement dans le flux vidéo, donc impossibles à bloquer par le réseau. L'extension intercepte les playlists du lecteur :
  1. pendant une pub, elle bascule sur un flux de secours sans pub ;
  2. si aucun flux propre n'est disponible, elle retire les segments publicitaires (l'image reste figée le temps de la pub).
- **VPN** : tout le trafic de Chrome peut passer par un serveur proxy (HTTPS, HTTP ou SOCKS5) configuré dans le popup, avec un bouton pour vérifier l'IP et le pays de sortie.
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

## VPN

L'extension ne fournit pas de serveur : il faut les informations d'un proxy (fournisseur VPN ou serveur personnel).

1. Cliquer sur l'icône de l'extension.
2. Dans la section **VPN**, renseigner le type, le serveur, le port et, si besoin, l'identifiant et le mot de passe.
3. Cocher **VPN activé**, puis **Vérifier l'IP** pour contrôler la ville et le pays de sortie.

Seul le trafic de Chrome passe par le VPN, pas le reste de l'ordinateur. Chrome ne gère pas l'identifiant / mot de passe pour les proxies SOCKS5.

### Avec Tor

Le dossier `windows` contient un installateur qui met Tor en **service Windows** : il démarre avec le PC et tourne en arrière-plan, sans fenêtre.

1. Double-cliquer sur `windows\installer-tor.bat` et accepter la demande d'administrateur. Le script télécharge Tor depuis torproject.org, vérifie son empreinte SHA-256, l'installe dans `C:\ProgramData\Tor` avec une sortie en Allemagne, puis crée le service.
2. Dans le popup, cliquer sur **Tor**, puis sur **Vérifier l'IP**.

Tant que **VPN activé** est décoché, rien ne passe par Tor : le service attend sans rien faire. Si Tor ne répond pas, l'extension coupe le VPN automatiquement pour ne pas bloquer la navigation.

- Autre pays : `powershell -ExecutionPolicy Bypass -File windows\installer-tor.ps1 -Pays nl` (code pays à 2 lettres).
- Désinstaller : double-cliquer sur `windows\desinstaller-tor.bat`.
- Avec Tor Browser à la place du service : régler le port sur `9150` et garder Tor Browser ouvert.

Tor permet de choisir le pays de sortie, pas la ville. La connexion est plus lente et certains sites bloquent Tor.

## Structure

| Fichier | Rôle |
|---|---|
| `adblock/manifest.json` | Déclaration de l'extension |
| `adblock/rules.json` | Règles de blocage réseau |
| `adblock/background.js` | Compteur, activation/désactivation et VPN |
| `adblock/cosmetic.css` / `cosmetic.js` | Masquage des emplacements publicitaires |
| `adblock/twitch.js` / `twitch.css` | Suppression des pubs Twitch |
| `adblock/popup.html` / `popup.js` | Fenêtre de l'icône |
| `windows/installer-tor.bat` / `desinstaller-tor.bat` | Installation / désinstallation du service Tor |

## Dépannage Twitch

Ouvrir la console (F12) sur Twitch : les messages `[Bloqueur de pubs]` indiquent quand une pub est détectée et comment elle a été traitée. Twitch modifie régulièrement son système publicitaire, le blocage peut donc nécessiter des mises à jour.
