# SPECTRA — Crypto Tracing Lab

Plateforme d'entraînement au traçage de crypto-actifs, inspirée des outils d'analyse professionnels. Tout fonctionne en local, hors ligne : aucune donnée ne quitte le poste.

## Lancer

- Windows : double-cliquez sur `Lancer SPECTRA.bat` (il installe les dépendances au premier lancement).
- Sinon : `npm install` puis `npm run dev`, et ouvrez http://localhost:5173.
- Version autonome : `npm run build` produit le dossier `dist/`, à servir avec `npm run preview`.

## Application Windows (.exe)

SPECTRA existe aussi en application de bureau (Tauri), sans serveur ni navigateur :

- `npm run desktop:build` produit :
  - `src-tauri/target/release/spectra.exe` : exécutable autonome, un seul fichier à copier et lancer ;
  - `src-tauri/target/release/bundle/nsis/SPECTRA_1.0.0_x64-setup.exe` : installateur (sans droits administrateur, avec raccourcis).
- `npm run desktop:dev` lance la version de bureau en développement.
- Prérequis pour compiler : Rust (cible MSVC) et les Visual Studio Build Tools. Pour lancer : Windows 10 ou 11 avec WebView2 (présent par défaut ; l'installateur l'ajoute si besoin).
- L'exécutable n'est pas signé : au premier lancement, Windows SmartScreen peut afficher « Windows a protégé votre ordinateur » → « Informations complémentaires » → « Exécuter quand même ».
- La progression est enregistrée par l'application, séparément de la version navigateur.

## Ce qu'il y a dedans

- **Moteur de blockchain simulée** (`src/engine/`) : Bitcoin, Litecoin, Ethereum, BNB Chain, Tron, XRP, Solana, Monero, TON, Arbitrum One et Base. Modèle UTXO réel (entrées, sorties, rendu, frais), modèle à comptes avec jetons (USDT, USDC, DAI, WBTC ; jettons sur TON), exchanges avec adresses de dépôt et balayage (adresse partagée + destination tag sur XRP, + commentaire sur TON), échangeurs instantanés, mixeurs, CoinJoin, DEX, bridges (dont les bridges canoniques des rollups, retrait en ~7 jours), pools de confidentialité, DAB crypto (achat / vente contre espèces), Lightning (ouverture, fermeture coopérative ou forcée de canal, portefeuille custodial dont les paiements restent hors chaîne), portefeuilles HD (`src/engine/hd.ts` : xpub / ypub / zpub, chemins BIP 44/49/84/86, seeds EVM de démonstration) et même compte 0x sur plusieurs chaînes EVM.
- **Outils d'analyse** (`src/engine/analysis.ts`) : regroupement d'adresses par entrées communes, détection du rendu avec la justification de chaque heuristique, détection des CoinJoin et des transactions Lightning (ouverture / fermeture de canal), attribution, exposition au risque sur 3 sauts, score de risque, corrélateur montant/temps.
- **Scénarios** (`src/scenarios/`) : 52 missions jouables, dont 16 de niveau débutant et 4 tutoriels guidés pas à pas (plus 2 affaires réservées aux certifications) sur 11 chaînes — Bitcoin, Litecoin, Ethereum, Arbitrum, Base, BNB Chain, Tron, TON, XRP, Solana, Monero — générées de façon procédurale à partir d'une graine. Chaque mission compte 11 ou 12 objectifs (repérage d'adresses et de transactions, montants, délais, entités de sortie, choix de procédure), pour 30 minutes environ au niveau débutant et près d'1 h 30 pour les affaires expertes. La même graine donne la même affaire, ce qui permet de comparer ses résultats entre collègues ; le défi du jour en est un exemple.
- **Interface d'enquête** : graphe interactif (infobulles, annuler avec Ctrl Z, liens inter-chaînes pour les bridges et les corrélations), inspecteur d'adresse et de transaction, outil de dérivation HD (une xpub citée dans une pièce s'ouvre d'un clic, avec gap limit réglable), pièces du dossier (adresses cliquables), frise chronologique filtrable, journal, marquages, objectifs corrigés automatiquement, débriefing avec le flux réel, rapport d'analyse imprimable, modèle de réquisition. Touche « ? » pour la liste des raccourcis.
- **Académie** (`src/academy/`) : 72 leçons du niveau 0 (débutant absolu) au niveau 5 (expert), réparties en 10 filières dont 7 affaires réelles décryptées à partir des documents publics (Colonial Pipeline, Silk Road, Hydra, Bitfinex, ChipMixer, Garantex, Bybit) ; contenu en blocs (schémas de flux, tableaux, études de cas, vérifications intégrées), 18 simulateurs interactifs, 503 questions de quiz, 729 fiches en répétition espacée, 26 exercices générés à l'infini, 13 examens chronométrés, 9 parcours certifiants (dont le grand cursus complet) et des certificats imprimables. Chaque mission déclare ses leçons prérequises (`src/academy/prereqs.ts`) : le grand cursus est construit automatiquement (chaque exercice après sa leçon, chaque mission juste après son dernier prérequis, un examen en fin de niveau), et la fiche de lancement distingue « À lire avant » et « Pour aller plus loin ». Accès guidé (parcours) ou libre (bibliothèque).
- **Boîte à outils terrain** (`src/academy/toolbox/`, menu « Terrain ») : 14 fiches réflexes à cocher (accueil de victime, gel en urgence, enlèvement avec rançon, perquisition, saisie, exploitation de supports, audition, réquisitions PSAN et DAB, analyse d'adresse, changement de chaîne, OSINT, rapport, OPSEC) avec points critiques, pièges et leçons liées, et 7 modèles de documents pré-remplis depuis le profil (PV de constatations, demande de gel à un émetteur de stablecoin, réquisitions PSAN et DAB, inventaire de saisie, questionnaire d'audition de victime, note de synthèse au magistrat), à imprimer en A4 ou à copier en texte. Modèles pédagogiques, à adapter aux trames du service et aux textes en vigueur.

## Ajouter un scénario

1. Créez un fichier dans `src/scenarios/` sur le modèle de `s01_first_trace.ts`.
2. Enregistrez-le dans `pack_btc.ts` ou `pack_account.ts`.
3. Vérifiez-le avec `npx tsx scripts/check-scenarios.ts <id>`, puis déclarez ses prérequis dans `src/academy/prereqs.ts` et lancez `npx tsx scripts/check-paths.ts`, qui refuse toute mission placée avant ses prérequis.

## Ajouter ou modifier une leçon

Le plan officiel est dans `src/academy/model.ts` (`CURRICULUM`). Le contenu est dans `src/academy/content/` ; vérifiez avec `npx tsx scripts/check-academy.ts`. Attention : certains fichiers mélangent l'ordre des réponses à l'export, l'index `answer` désigne toujours l'option telle qu'écrite dans le source.

## Avertissement

La plupart des entités sont des acteurs réels (Binance, Coinbase, Kraken, OKX, Bitstamp, Coinhouse, Tornado Cash, Sinbad, Garantex, eXch, LockBit, Hydra…), décrits à partir de faits publics (`src/engine/entities.ts`). En revanche, les flux, les adresses et les affaires sont simulés : ils ne reflètent aucune transaction réelle, et la date d'une affaire ne tient pas compte de la période d'activité réelle d'un service (un mixeur saisi en 2023 peut apparaître dans une affaire de 2025). Les délais et modalités de coopération sont indicatifs. Restent fictifs les rôles qui prêteraient à un acteur réel un comportement non établi : Huobex (exchange offshore), SatsDesk OTC, Lendora (protocole piraté), AuroraTrade, OrbitCasino, CardHub, CryptoGuichet (DAB), VoltPocket, Lumen LSP, TonPocket, Mosaïque Market, MoonPad, YieldNova, ainsi que le bridge ArcBridge, modèle générique. Arbitrum Bridge et Base Bridge sont les bridges canoniques réels, décrits de façon factuelle.

Les logos viennent de [@web3icons/core](https://github.com/0xa3k5/web3icons) (MIT) et de [simple-icons](https://simpleicons.org) (CC0), plus trois icônes officielles copiées dans `src/ui/brands/` (ChangeNOW et Hodl Hodl depuis leurs sites, Wasabi depuis le dépôt [WalletWasabi](https://github.com/WalletWasabi/WalletWasabi), MIT), le tout embarqué dans le build (`src/ui/logos.ts`). Les entités sans logo, dont les services criminels ou saisis, sont représentées par une marque à initiales. Ce sont des marques déposées appartenant à leurs titulaires, utilisées ici uniquement pour identifier les services dans un cadre pédagogique.

Les modèles de réquisition et les contenus juridiques sont pédagogiques : vérifiez toujours les textes en vigueur et les trames de votre service.
