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

- **Moteur de blockchain simulée** (`src/engine/`) : Bitcoin, Litecoin, Ethereum, BNB Chain, Tron, XRP, Solana, Monero. Modèle UTXO réel (entrées, sorties, rendu, frais), modèle à comptes avec jetons (USDT, USDC, DAI, WBTC), exchanges avec adresses de dépôt et balayage, échangeurs instantanés, mixeurs, CoinJoin, DEX, bridges, pools de confidentialité.
- **Outils d'analyse** (`src/engine/analysis.ts`) : regroupement d'adresses par entrées communes, détection du rendu avec la justification de chaque heuristique, détection des CoinJoin, attribution, exposition au risque sur 3 sauts, score de risque, corrélateur montant/temps.
- **Scénarios** (`src/scenarios/`) : générés de façon procédurale à partir d'une graine. La même graine donne la même affaire, ce qui permet de comparer ses résultats entre collègues ; le défi du jour en est un exemple.
- **Interface d'enquête** : graphe interactif (infobulles, annuler avec Ctrl Z, liens inter-chaînes pour les bridges et les corrélations), inspecteur d'adresse et de transaction, pièces du dossier (adresses cliquables), frise chronologique filtrable, journal, marquages, objectifs corrigés automatiquement, débriefing avec le flux réel, rapport d'analyse imprimable, modèle de réquisition. Touche « ? » pour la liste des raccourcis.
- **Académie** (`src/academy/`) : 52 leçons du niveau 0 (débutant absolu) au niveau 5 (expert), réparties en 9 filières ; contenu en blocs (schémas de flux, tableaux, études de cas, vérifications intégrées), 18 simulateurs interactifs, 361 questions de quiz, 524 fiches en répétition espacée, 14 exercices générés à l'infini, 12 examens chronométrés, 8 parcours certifiants (dont le grand cursus complet) et des certificats imprimables. Accès guidé (parcours) ou libre (bibliothèque).

## Ajouter un scénario

1. Créez un fichier dans `src/scenarios/` sur le modèle de `s01_first_trace.ts`.
2. Enregistrez-le dans `pack_btc.ts` ou `pack_account.ts`.
3. Vérifiez-le avec `npx tsx scripts/check-scenarios.ts <id>`.

## Ajouter ou modifier une leçon

Le plan officiel est dans `src/academy/model.ts` (`CURRICULUM`). Le contenu est dans `src/academy/content/` ; vérifiez avec `npx tsx scripts/check-academy.ts`. Attention : certains fichiers mélangent l'ordre des réponses à l'export, l'index `answer` désigne toujours l'option telle qu'écrite dans le source.

## Avertissement

La plupart des entités sont des acteurs réels (Binance, Coinbase, Kraken, OKX, Bitstamp, Coinhouse, Tornado Cash, Sinbad, Garantex, eXch, LockBit, Hydra…), décrits à partir de faits publics (`src/engine/entities.ts`). En revanche, les flux, les adresses et les affaires sont simulés : ils ne reflètent aucune transaction réelle, et la date d'une affaire ne tient pas compte de la période d'activité réelle d'un service (un mixeur saisi en 2023 peut apparaître dans une affaire de 2025). Les délais et modalités de coopération sont indicatifs. Restent fictifs les rôles qui prêteraient à un acteur réel un comportement non établi : Huobex (exchange offshore), SatsDesk OTC, Lendora (protocole piraté), AuroraTrade, OrbitCasino, CardHub, ainsi que le bridge ArcBridge, modèle générique.

Les logos viennent de [@web3icons/core](https://github.com/0xa3k5/web3icons) (MIT) et de [simple-icons](https://simpleicons.org) (CC0), embarqués dans le build (`src/ui/logos.ts`). Ce sont des marques déposées appartenant à leurs titulaires, utilisées ici uniquement pour identifier les services dans un cadre pédagogique.

Les modèles de réquisition et les contenus juridiques sont pédagogiques : vérifiez toujours les textes en vigueur et les trames de votre service.
