// Niveau 3 — Inter-chaînes et confidentialité : bridges, chain hopping, mixeurs centralisés.
// Entités citées : FICTIVES (voir src/engine/entities.ts).
import type { Lesson } from '../model'

export const L3_FLUX: Lesson[] = [
  // ══════════════════════════════════════════════════════════════════════════
  // BRIDGES
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'bridges',
    title: `Bridges : suivre les fonds d'une chaîne à l'autre`,
    level: 3,
    track: 'interchaines',
    minutes: 30,
    summary: `Un actif ne quitte jamais sa blockchain : un bridge verrouille, détruit ou avance des fonds pour en créer l'équivalent ailleurs. Modèles de bridges, lecture des événements de départ et d'arrivée, identifiant qui relie les deux côtés, pièges (relayeurs, frais, conversions) et leviers d'enquête.`,
    objectives: [
      `Distinguer les grands modèles de bridges (lock-and-mint, burn-and-mint, réseau de liquidité, custodial, bridge canonique de rollup).`,
      `Lire un événement de départ : actif, montant, chaîne de destination, destinataire, identifiant unique.`,
      `Relier formellement un dépôt et une livraison par leur identifiant (nonce, deposit id, hash de message) plutôt que par le seul montant.`,
      `Éviter les erreurs classiques : prendre le relayeur pour un complice, raisonner au montant exact, oublier une conversion d'actif.`,
      `Identifier les leviers d'enquête propres à chaque type de bridge (gel par l'émetteur, opérateur custodial, interface web).`,
    ],
    prerequisites: ['comptes-evm', 'tokens-erc20', 'dex-defi', 'suivre-flux'],
    practice: ['chain-hopping', 'rugpull-bsc', 'defi-exploit'],
    blocks: [
      {
        type: 'text',
        md: `Vous suivez des USDT sur Ethereum. Saut après saut, tout est limpide… puis les fonds arrivent sur un **contrat** et, apparemment, s'arrêtent là. Le solde du contrat est énorme, il reçoit des milliers de dépôts par jour, et rien ne ressort vers une adresse qui ressemble à votre suspect. Vous venez de rencontrer un **bridge** (pont inter-chaînes).

Pour un enquêteur, le bridge n'est pas un mur : c'est une **porte** dont il faut lire la serrure. Quasiment tous les bridges publient sur la chaîne de départ **où** et **à qui** les fonds doivent être livrés. Il suffit de savoir où regarder.`,
      },
      { type: 'heading', text: `Le principe : rien ne traverse vraiment` },
      {
        type: 'text',
        md: `Un bitcoin ne peut pas « aller » sur Ethereum, pas plus qu'un USDT-ERC20 ne peut « aller » sur BNB Chain. Chaque blockchain est un registre fermé. Un bridge crée donc un **mécanisme de correspondance** : on immobilise ou on détruit de la valeur d'un côté, et on fait apparaître une valeur équivalente de l'autre.

Trois conséquences pratiques pour l'analyse :

- il y a toujours **deux transactions distinctes**, sur deux chaînes, avec deux hash différents ;
- la transaction d'arrivée ne « contient » pas les fonds de départ : elle est émise par un contrat ou un opérateur du bridge, souvent à partir de **ses propres réserves** ;
- le lien entre les deux est porté par des **données** (événement, message, identifiant), pas par un flux de fonds visible.`,
      },
      {
        type: 'terms',
        items: [
          { term: 'Chaîne source / destination', def: `La blockchain où les fonds sont déposés dans le bridge, et celle où ils sont livrés.` },
          { term: 'Jeton enveloppé (wrapped)', def: `Représentation d'un actif émise sur une autre chaîne, adossée à l'original verrouillé (ex. un « BTC enveloppé » sur Ethereum).` },
          { term: 'Lock-and-mint', def: `L'original est verrouillé dans un contrat sur la source ; une représentation est émise (mint) sur la destination. Retour par burn-and-release.` },
          { term: 'Burn-and-mint natif', def: `L'émetteur officiel détruit le jeton sur la source et le réémet nativement sur la destination. L'actif reçu est le jeton officiel.` },
          { term: 'Réseau de liquidité', def: `Des réserves existent sur chaque chaîne ; un relayeur (filler, solver) avance les fonds au destinataire puis se fait rembourser.` },
          { term: 'chainId', def: `Identifiant numérique d'une chaîne EVM, présent dans les événements de bridge (1 = Ethereum, 56 = BNB Chain…).` },
          { term: 'Nonce / deposit id / hash de message', def: `Identifiant unique attribué au dépôt et repris par la livraison : c'est lui qui prouve la correspondance.` },
          { term: 'Explorateur de messages', def: `Site publié par un bridge qui associe automatiquement dépôt et livraison à partir de l'identifiant.` },
        ],
      },
      {
        type: 'table',
        caption: `Les grands modèles de bridges, vus par l'enquêteur`,
        headers: ['Modèle', 'Mécanisme', 'Côté destination, qui paie ?', `Levier d'enquête`],
        rows: [
          ['Lock-and-mint', `Original verrouillé dans un contrat, représentation émise sur la destination`, `Le contrat du bridge émet (mint) le jeton enveloppé`, `Événements publics ; peu de données personnelles`],
          ['Burn-and-mint natif (émetteur)', `L'émetteur détruit puis réémet son propre jeton`, `Le contrat officiel de l'émetteur`, `Le jeton reste gelable par l'émetteur sur la destination`],
          ['Réseau de liquidité', `Réserves sur chaque chaîne, relayeur qui avance les fonds`, `Un relayeur ou la réserve du bridge, commun à des milliers d'utilisateurs`, `Seul l'identifiant relie les deux côtés`],
          ['Custodial', `Un opérateur détient les fonds et livre l'équivalent`, `Un portefeuille de l'opérateur`, `Opérateur identifiable : réquisition, parfois gel`],
          ['Canonique de rollup', `Dépôt sur Ethereum, crédit sur le L2 ; retrait par preuve`, `Le système du rollup`, `Délais de retrait longs (jusqu'à environ 7 jours pour les rollups optimistes)`],
        ],
      },
      {
        type: 'flow',
        caption: `Lock-and-mint : l'original reste verrouillé sur la source, une représentation apparaît sur la destination. Le lien est porté par l'identifiant.`,
        nodes: [
          { id: 's', label: 'Suspect', kind: 'suspect', sub: '0x4be1… (Ethereum)' },
          { id: 'lock', label: 'Contrat de verrouillage', kind: 'bridge', sub: 'Ethereum' },
          { id: 'ev', label: 'Événement Locked', kind: 'tx', sub: 'dst 56 · nonce 88 412' },
          { id: 'mint', label: 'Contrat d’émission', kind: 'bridge', sub: 'BNB Chain' },
          { id: 'r', label: 'Destinataire', kind: 'wallet', sub: '0xc07d… (BNB Chain)' },
        ],
        edges: [
          { from: 's', to: 'lock', label: '150 000 USDT' },
          { from: 'lock', to: 'ev', label: 'publie' },
          { from: 'ev', to: 'mint', label: 'même nonce' },
          { from: 'mint', to: 'r', label: '149 850 USDT enveloppés' },
        ],
      },
      {
        type: 'flow',
        caption: `Réseau de liquidité : le destinataire est payé par un relayeur qui sert tout le monde. Ce n'est pas un complice.`,
        nodes: [
          { id: 's', label: 'Suspect', kind: 'suspect', sub: 'Arbitrum' },
          { id: 'pool', label: 'Réserve du bridge', kind: 'bridge', sub: 'Arbitrum' },
          { id: 'rel', label: 'Relayeur', kind: 'service', sub: 'sert des milliers d’utilisateurs' },
          { id: 'r', label: 'Destinataire', kind: 'wallet', sub: 'Base' },
        ],
        edges: [
          { from: 's', to: 'pool', label: 'dépôt · deposit id 5 120 334' },
          { from: 'rel', to: 'r', label: 'avance les fonds · fill 5 120 334' },
          { from: 'pool', to: 'rel', label: 'remboursement (plus tard, groupé)' },
        ],
      },
      {
        type: 'callout',
        kind: 'tip',
        title: 'Dans SPECTRA',
        md: `**ArcBridge** fonctionne comme un bridge de liquidité : vous déposez sur la passerelle (*Gateway*) de la chaîne source, et la passerelle de la chaîne de destination verse au destinataire, au besoin **converti** dans l'actif natif de cette chaîne (ETH déposé, BNB reçu par exemple). Les deux transactions affichent la chaîne cible, le destinataire et le même **nonce** : c'est ce nonce qu'il faut citer pour justifier le saut.`,
      },
      { type: 'heading', text: `Lire l'événement de départ` },
      {
        type: 'text',
        md: `Sur la chaîne source, la transaction de dépôt appelle une fonction du contrat du bridge (\`bridgeOut\`, \`deposit\`, \`lock\`, \`sendToChain\`… selon les protocoles). Le contrat émet un **événement** (log) qui contient typiquement :

- l'**actif** et le **montant** déposés ;
- l'**expéditeur** ;
- la **chaîne de destination**, souvent sous forme de chainId numérique ;
- l'**adresse destinataire**, qui peut être différente de l'expéditeur et dans un autre format ;
- un **identifiant unique** (nonce, deposit id, hash de message).

Sur un explorateur de type Etherscan, ces données sont dans l'onglet **Logs** de la transaction. Si le contrat est vérifié, l'explorateur décode les champs ; sinon, il faut décoder les données brutes à partir de l'ABI du contrat.`,
      },
      {
        type: 'table',
        caption: `Identifiants de chaînes EVM les plus fréquents (à vérifier sur une liste de référence en cas de doute)`,
        headers: ['chainId', 'Chaîne', 'Actif natif'],
        rows: [
          ['1', 'Ethereum', 'ETH'],
          ['10', 'Optimism', 'ETH'],
          ['56', 'BNB Smart Chain', 'BNB'],
          ['137', 'Polygon PoS', 'POL (ex-MATIC)'],
          ['8453', 'Base', 'ETH'],
          ['42161', 'Arbitrum One', 'ETH'],
          ['43114', 'Avalanche C-Chain', 'AVAX'],
        ],
      },
      {
        type: 'case',
        title: `Cas pratique — 150 000 USDT d'Ethereum vers BNB Chain`,
        md: `Le 3 mars à 14:21:07 UTC, bloc Ethereum 20 811 402, l'adresse \`0x4be1…9a03\` appelle ArcBridge. L'événement \`Locked\` indique : 150 000 USDT, \`dstChainId\` = 56, \`recipient\` = \`0xc07d…71e2\`, \`nonce\` = 88 412.

Sur BNB Chain, à 14:30:44 UTC (9 minutes plus tard), la passerelle ArcBridge émet un événement \`Minted\` : \`nonce\` = 88 412, 149 850 USDT vers \`0xc07d…71e2\`. Écart de 150 USDT, soit 0,1 % : cohérent avec les frais affichés par le bridge.

Ce que l'on peut écrire : « dépôt txid 0x9f3c… (Ethereum, bloc 20 811 402, nonce 88 412) ↔ livraison txid 0x51aa… (BNB Chain, nonce 88 412) ». Le lien est **établi** : il repose sur l'identifiant publié par le protocole, pas sur une ressemblance de montant.`,
      },
      { type: 'widget', id: 'bridge-flow', caption: `Suivez un dépôt de bridge : lisez l'événement de départ, repérez le nonce, retrouvez la livraison sur l'autre chaîne.` },
      {
        type: 'check',
        q: `Un événement de dépôt indique dstChainId = 42161 et un destinataire 0x7a1e…. Où chercher la livraison ?`,
        options: ['Sur Polygon, à l’adresse 0x7a1e…', 'Sur Ethereum, dans le même bloc', 'Nulle part : un bridge ne livre pas', 'Sur Arbitrum One, à l’adresse 0x7a1e…'],
        answer: 3,
        explain: `42161 est le chainId d'Arbitrum One. Le destinataire figure dans l'événement : on cherche sur Arbitrum une livraison vers 0x7a1e… reprenant le même identifiant.`,
      },
      { type: 'heading', text: 'Les pièges du saut inter-chaînes' },
      {
        type: 'compare',
        left: {
          title: 'Lien établi',
          md: `- Même **identifiant** (nonce, deposit id, hash de message) dans le dépôt et la livraison.
- Confirmé par l'explorateur de messages du bridge **et** par les deux explorateurs de chaîne.
- Se représente en **trait plein** sur un graphe.`,
        },
        right: {
          title: 'Simple corrélation',
          md: `- Montant voisin et heure compatible, **sans** identifiant commun.
- Fréquent sur les petits bridges mal décodés ou les services opaques.
- Se représente en **pointillé**, avec le nombre de candidats et un niveau de confiance.`,
        },
      },
      {
        type: 'callout',
        kind: 'warn',
        title: 'Le relayeur n’est pas votre suspect',
        md: `Sur un réseau de liquidité, la livraison est émise par un **relayeur** qui sert des milliers d'utilisateurs par jour. Le requérir, le qualifier de « complice » ou remonter ses fonds n'a aucun sens : ses réserves ne contiennent pas les fonds de votre victime. Votre piste continue **au destinataire**, pas au payeur.`,
      },
      {
        type: 'text',
        md: `Autres difficultés courantes :

- **Écarts de montant** : frais du bridge, frais du relayeur, frais de gaz prélevés sur le montant. Raisonnez en fourchette (souvent quelques dixièmes de pour cent, parfois davantage).
- **Conversion d'actif** : certains bridges livrent un autre actif que celui déposé (ETH déposé, BNB reçu ; USDT déposé, USDC reçu). Comparez les **contre-valeurs** horodatées, pas les quantités.
- **Destinataire non EVM** : vers Solana, Tron ou Bitcoin, l'adresse est souvent encodée (par exemple en \`bytes32\`) dans l'événement. Il faut la convertir dans le format de la chaîne cible (base58, bech32…).
- **Agrégateurs** : une seule transaction peut enchaîner swap → bridge → swap. Décomposez chaque étape et notez chaque actif.
- **Délais** : de quelques secondes à plusieurs heures ; plusieurs jours pour un retrait de rollup optimiste vers Ethereum.
- **Couverture des outils** : les grands bridges sont suivis automatiquement par les outils commerciaux, les petits ou les récents beaucoup moins. En cas de trou, décodez l'événement vous-même.`,
      },
      {
        type: 'steps',
        items: [
          { title: 'Reconnaître le bridge', md: `Le contrat destinataire est-il étiqueté « bridge » par l'outil ou l'explorateur ? Sinon, cherchez son nom de contrat vérifié et la fonction appelée.` },
          { title: 'Ouvrir les logs du dépôt', md: `Relevez actif, montant, chaîne de destination, destinataire et identifiant. Notez bloc et heure UTC.` },
          { title: 'Convertir si nécessaire', md: `chainId → nom de chaîne ; destinataire encodé → format natif de la chaîne cible.` },
          { title: `Interroger l'explorateur de messages`, md: `S'il existe, il donne la transaction de livraison. Conservez une capture horodatée.` },
          { title: 'Vérifier sur la chaîne de destination', md: `Retrouvez la livraison dans l'explorateur de la chaîne cible : même identifiant, destinataire, montant cohérent après frais.` },
          { title: 'Documenter le saut', md: `Dans la chronologie : deux txid, deux chaînes, l'identifiant, l'écart de montant expliqué, le délai.` },
          { title: 'Reprendre le traçage', md: `Repartez du **destinataire** sur la nouvelle chaîne, avec les outils et explorateurs de cette chaîne.` },
        ],
      },
      { type: 'heading', text: `Leviers d'enquête` },
      {
        type: 'text',
        md: `La plupart des bridges sont **non custodiaux** et sans KYC : il n'y a pas de « compte client » à requérir. Les leviers sont ailleurs :

- un bridge **custodial** ou un émetteur de **jeton enveloppé centralisé** connaît ses clients et peut parfois bloquer des fonds ;
- un stablecoin livré par **burn-and-mint natif** reste le jeton officiel, donc **gelable** par son émetteur sur la chaîne de destination ;
- l'**interface web** du bridge peut être exploitée par une société identifiable (journaux de connexion, IP) : résultats incertains, mais à tenter dans les affaires graves ;
- surtout, le bridge n'est qu'un **saut** : la suite du flux mène presque toujours à un exchange, un OTC ou un échangeur, là où l'identification devient possible.`,
      },
      {
        type: 'callout',
        kind: 'field',
        title: 'Sur le terrain',
        md: `Les piratages de bridges figurent parmi les plus gros vols de l'histoire des crypto-actifs : en 2022, le bridge du réseau Ronin a perdu plus de 600 millions de dollars, vol publiquement attribué par le FBI à un groupe lié à la Corée du Nord. Les fonds issus de ces vols passent ensuite par des mixeurs, des échangeurs et des réseaux OTC. Un montant exceptionnel apparu juste après un piratage public est un indice d'attribution fort, à recouper avec les adresses publiées par la victime et les partenaires.`,
      },
      {
        type: 'check',
        q: `Sur BNB Chain, les fonds arrivent chez le destinataire depuis une adresse qui a effectué 40 000 versements ce mois-ci, tous liés à des dépôts de bridge. Que faites-vous ?`,
        options: [
          `Je requiers le titulaire de cette adresse, probable complice`,
          `Je considère que c'est un relayeur et je poursuis la trace à partir du destinataire`,
          `Je remonte les fonds de cette adresse pour trouver la victime`,
          `J'arrête la trace : les fonds sont mélangés`,
        ],
        answer: 1,
        explain: `Un payeur commun à des dizaines de milliers de livraisons est un relayeur ou une réserve du bridge. La piste se poursuit au destinataire ; le lien avec le dépôt est porté par l'identifiant.`,
      },
      {
        type: 'callout',
        kind: 'example',
        title: 'Formulation pour le rapport',
        md: `« Le 03/03 à 14:21:07 UTC, l'adresse 0x4be1…9a03 a déposé 150 000 USDT dans le bridge ArcBridge sur Ethereum (txid 0x9f3c…, bloc 20 811 402). L'événement émis désigne la chaîne BNB Smart Chain (chainId 56), le destinataire 0xc07d…71e2 et le nonce 88 412. La livraison correspondante (même nonce) a été constatée sur BNB Smart Chain à 14:30:44 UTC : 149 850 USDT versés à 0xc07d…71e2 (txid 0x51aa…). L'écart de 150 USDT correspond aux frais du protocole. »`,
      },
    ],
    keyPoints: [
      `Un actif ne quitte jamais sa chaîne : un bridge produit deux transactions distinctes, reliées par des données.`,
      `Modèles : lock-and-mint, burn-and-mint natif, réseau de liquidité, custodial, bridge canonique de rollup.`,
      `L'événement de départ donne la chaîne de destination (chainId), le destinataire et un identifiant unique.`,
      `Seul l'identifiant commun (nonce, deposit id, hash de message) établit le lien ; montant et heure ne sont que des indices.`,
      `Sur un réseau de liquidité, le payeur côté destination est un relayeur, pas un complice : la piste continue au destinataire.`,
      `Écarts de frais, conversions d'actif et adresses encodées obligent à raisonner en contre-valeur et à convertir les formats.`,
      `Un stablecoin livré par burn-and-mint natif reste gelable par son émetteur.`,
    ],
    quiz: [
      {
        q: `Dans un bridge lock-and-mint, que se passe-t-il sur la chaîne de destination ?`,
        options: [
          `L'actif original y arrive physiquement`,
          `Rien tant que le suspect n'a pas réclamé les fonds manuellement`,
          `Une représentation enveloppée de l'actif est émise au destinataire`,
          `Le bridge verse systématiquement de l'ETH`,
        ],
        answer: 2,
        explain: `L'original est verrouillé sur la source ; une représentation (jeton enveloppé) est émise sur la destination. Le retour se fait par destruction de la représentation et libération de l'original.`,
      },
      {
        q: `Quel élément relie de façon fiable un dépôt sur la chaîne source à la livraison sur la chaîne de destination ?`,
        options: [
          `L'identifiant unique (nonce, deposit id, hash de message) présent dans les deux événements`,
          `Le montant exact, identique au centime près`,
          `L'horodatage, à la minute près`,
          `Le prix du gaz payé des deux côtés`,
        ],
        answer: 0,
        explain: `Le montant varie (frais, conversion) et l'heure n'est qu'un indice. L'identifiant attribué par le protocole établit la correspondance.`,
      },
      {
        kind: 'multi',
        q: `Quelles situations expliquent qu'un montant livré diffère du montant déposé ? (plusieurs réponses)`,
        options: [
          `Les frais du bridge ou du relayeur`,
          `Une conversion d'actif en chemin (ETH déposé, BNB reçu)`,
          `Une erreur de la blockchain qui « perd » des fonds`,
          `Un agrégateur qui enchaîne swap et bridge dans la même opération`,
        ],
        answer: [0, 1, 3],
        explain: `Frais, conversions et agrégateurs expliquent les écarts. Une blockchain ne « perd » pas de fonds : un écart inexpliqué signale une étape non décodée.`,
      },
      {
        kind: 'truefalse',
        q: `Sur un bridge à réseau de liquidité, l'adresse qui verse les fonds au destinataire appartient forcément à un complice du suspect.`,
        options: ['Vrai', 'Faux'],
        answer: 1,
        explain: `C'est un relayeur qui avance les fonds depuis sa propre liquidité pour des milliers d'utilisateurs, puis se fait rembourser. Il n'a aucun lien avec le suspect.`,
      },
      {
        q: `Un événement de dépôt indique dstChainId = 56. Quelle est la chaîne de destination ?`,
        options: ['Ethereum', 'Polygon', 'Arbitrum One', 'BNB Smart Chain'],
        answer: 3,
        explain: `56 = BNB Smart Chain (1 = Ethereum, 137 = Polygon, 42161 = Arbitrum One).`,
      },
      {
        q: `Pourquoi un bridge burn-and-mint natif de stablecoin intéresse-t-il particulièrement l'enquêteur ?`,
        options: [
          `Il impose un KYC à tous ses utilisateurs`,
          `L'actif livré est le jeton officiel de l'émetteur, qui peut le geler sur la chaîne de destination`,
          `Il conserve les adresses IP de tous les utilisateurs`,
          `Il interdit les destinataires différents de l'expéditeur`,
        ],
        answer: 1,
        explain: `Le jeton réémis nativement reste soumis aux fonctions de liste noire de l'émetteur : une demande de gel reste possible après le saut.`,
      },
      {
        kind: 'multi',
        q: `Le destinataire d'un dépôt de bridge vers Solana apparaît sous une forme hexadécimale de 32 octets dans l'événement. Que faites-vous ? (plusieurs réponses)`,
        options: [
          `Je convertis la valeur dans le format d'adresse de Solana (base58)`,
          `Je vérifie la livraison avec l'explorateur de messages du bridge et l'explorateur Solana`,
          `Je conclus que la destination est impossible à connaître`,
          `Je cherche cette valeur hexadécimale telle quelle sur Ethereum`,
        ],
        answer: [0, 1],
        explain: `Les destinataires non EVM sont souvent encodés en bytes32 : il faut les convertir au format de la chaîne cible, puis confirmer la livraison sur les deux sources.`,
      },
    ],
    flashcards: [
      { front: `Pourquoi parle-t-on de « deux transactions » pour un bridge ?`, back: `Un actif ne quitte pas sa chaîne : un dépôt sur la source et une livraison sur la destination, deux hash distincts reliés par des données.` },
      { front: 'Lock-and-mint', back: `Original verrouillé sur la source, représentation enveloppée émise sur la destination ; retour par burn-and-release.` },
      { front: 'Burn-and-mint natif', back: `L'émetteur détruit son jeton sur la source et le réémet sur la destination : le jeton reçu est officiel et gelable.` },
      { front: 'Réseau de liquidité', back: `Un relayeur avance les fonds au destinataire depuis sa liquidité, puis se fait rembourser. Le payeur n'est pas le suspect.` },
      { front: `Qu'est-ce qui prouve le lien dépôt ↔ livraison ?`, back: `L'identifiant unique (nonce, deposit id, hash de message) présent dans les deux événements.` },
      { front: 'chainId 1 / 56 / 137 / 42161 / 8453', back: 'Ethereum / BNB Smart Chain / Polygon / Arbitrum One / Base.' },
      { front: `Où lire la destination d'un dépôt de bridge ?`, back: `Dans les logs (événements) de la transaction de dépôt : chaîne cible, destinataire, identifiant.` },
      { front: 'Destinataire en bytes32 vers Solana ou Tron ?', back: `Convertir dans le format natif de la chaîne cible (base58…) avant de chercher la livraison.` },
      { front: `Retrait d'un rollup optimiste vers Ethereum : délai ?`, back: `Souvent environ 7 jours (période de contestation) via le bridge canonique.` },
      { front: `Représentation d'un saut de bridge sur un graphe`, back: `Trait plein si l'identifiant est vérifié ; pointillé si seulement corrélé (montant/temps).` },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // CHAIN HOPPING
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'chain-hopping',
    title: 'Chain hopping et échangeurs instantanés',
    level: 3,
    track: 'interchaines',
    minutes: 30,
    summary: `Sauter d'actif en actif et de chaîne en chaîne pour casser la continuité de l'analyse. Fonctionnement des échangeurs instantanés sans compte, corrélation montant/temps pas à pas, comptage des candidats, chronologie inter-chaînes et présentation prudente des résultats.`,
    objectives: [
      `Reconnaître un schéma de chain hopping et les moyens utilisés (échangeurs, bridges, DEX, exchanges, memos).`,
      `Expliquer pourquoi un échangeur instantané ne laisse aucun lien on-chain, et ce qu'il sait pourtant de la commande.`,
      `Conduire une corrélation montant/temps : montant attendu, fenêtre, liste des sorties, comptage des candidats.`,
      `Tenir une chronologie inter-chaînes unique, en UTC et en contre-valeur.`,
      `Présenter un saut corrélé comme une hypothèse assortie d'un niveau de confiance, et le faire confirmer par réquisition.`,
    ],
    prerequisites: ['bridges', 'dex-defi', 'exchanges', 'requisitions'],
    practice: ['chain-hopping', 'monero-wall', 'darknet-vendor'],
    blocks: [
      {
        type: 'text',
        md: `Le **chain hopping** consiste à faire transiter des fonds par plusieurs actifs et plusieurs blockchains successifs : BTC → ETH → BNB → USDT, parfois en passant par Monero. Chaque saut change d'explorateur, de format d'adresse, de modèle de transaction… et parfois casse purement et simplement le lien on-chain.

Les objectifs de l'auteur sont toujours les mêmes :

- **rompre la continuité** des outils (chaque chaîne a ses lacunes de couverture) ;
- passer par des services qui ne laissent **aucun lien visible** entre entrée et sortie ;
- multiplier les **juridictions** et les interlocuteurs, donc les délais pour l'enquêteur.

La bonne nouvelle : chaque saut a un **opérateur**, un **protocole** ou une **trace temporelle**. Votre travail est de choisir, pour chaque saut, la bonne méthode.`,
      },
      { type: 'heading', text: 'Anatomie d’un parcours en trois chaînes' },
      {
        type: 'flow',
        caption: `Schéma type (mission « Chain hopping ») : le saut BTC → ETH via l'échangeur est le seul sans lien on-chain (pointillé). Le bridge et le DEX, eux, se lisent.`,
        nodes: [
          { id: 'v', label: 'Victimes', kind: 'victim', sub: 'BTC' },
          { id: 'col', label: 'Collecteur', kind: 'suspect', sub: 'Bitcoin' },
          { id: 'oc', label: 'ChangeNOW', kind: 'exchange', sub: 'dépôt BTC → hot wallet ETH' },
          { id: 'e', label: 'Adresse neuve', kind: 'wallet', sub: 'Ethereum' },
          { id: 'br', label: 'ArcBridge', kind: 'bridge', sub: 'ETH → BNB' },
          { id: 'b', label: 'Même acteur', kind: 'wallet', sub: 'BNB Chain' },
          { id: 'dx', label: 'PancakeSwap', kind: 'dex', sub: 'BNB → USDT' },
          { id: 'ex', label: 'Dépôt OKX', kind: 'deposit', sub: 'exchange' },
        ],
        edges: [
          { from: 'v', to: 'col', label: 'paiements' },
          { from: 'col', to: 'oc', label: '0,8215 BTC' },
          { from: 'oc', to: 'e', label: '19,61 ETH · corrélation', dashed: true },
          { from: 'e', to: 'br', label: 'nonce 41 077' },
          { from: 'br', to: 'b', label: 'BNB livrés' },
          { from: 'b', to: 'dx', label: 'swap' },
          { from: 'dx', to: 'ex', label: 'USDT' },
        ],
      },
      {
        type: 'table',
        caption: `Les moyens de sauter, et ce qui permet de les franchir`,
        headers: ['Moyen', 'Lien on-chain ?', 'Qui détient la correspondance', 'Méthode de l’enquêteur'],
        rows: [
          ['Bridge', 'Oui (événement + identifiant)', 'Le protocole, publiquement', 'Lire les logs, citer l’identifiant'],
          ['Swap sur DEX', 'Oui (même transaction)', 'La blockchain', 'Lire les legs du swap (jetons entrants/sortants)'],
          ['Échangeur instantané', 'Non', `L'échangeur (commande, IP, adresse de réception)`, 'Corrélation montant/temps puis réquisition avec le hash du dépôt'],
          ['Exchange centralisé', 'Non (dépôt d’un actif, retrait d’un autre)', `L'exchange (compte KYC)`, 'Réquisition : relevé des dépôts et retraits du compte'],
          ['Protocole inter-chaînes à memo', 'Oui (memo du dépôt)', 'La blockchain', 'Lire le memo : chaîne et adresse de destination'],
          ['Crypto à confidentialité renforcée (XMR)', 'Non', 'Personne on-chain', 'Points d’entrée/sortie, timing, OSINT (voir leçon Monero)'],
        ],
      },
      { type: 'heading', text: `L'échangeur instantané : un exchange sans compte` },
      {
        type: 'steps',
        items: [
          { title: 'La commande', md: `L'utilisateur choisit la paire (BTC → ETH), saisit son **adresse de réception** et obtient une **adresse de dépôt**, généralement unique pour cette commande. Taux fixe ou flottant.` },
          { title: 'Le dépôt', md: `Il envoie ses BTC à l'adresse de dépôt. Côté chaîne : une transaction banale vers une adresse neuve.` },
          { title: 'Le rapatriement', md: `Quelques minutes plus tard, l'échangeur balaie l'adresse de dépôt vers son **hot wallet** BTC. C'est ce qui permet aux outils d'étiqueter l'adresse de dépôt.` },
          { title: 'Le versement', md: `Après confirmation, l'échangeur verse des ETH **depuis son hot wallet ETH** vers l'adresse de réception, moins sa commission et l'écart de cours.` },
        ],
      },
      {
        type: 'compare',
        left: {
          title: 'Ce que montre la blockchain',
          md: `- Un dépôt BTC vers une adresse attribuée à l'échangeur.
- Des dizaines de versements ETH depuis son hot wallet, vers des inconnus.
- **Aucun** lien transactionnel entre les deux.`,
        },
        right: {
          title: `Ce que sait l'échangeur`,
          md: `- La commande : adresse de dépôt ↔ adresse de réception.
- Souvent l'**IP**, l'empreinte du navigateur, parfois un e-mail.
- Les horodatages exacts et le taux appliqué.`,
        },
      },
      {
        type: 'callout',
        kind: 'field',
        title: 'Sur le terrain',
        md: `De nombreux échangeurs, même offshore et sans KYC, répondent aux demandes motivées des forces de l'ordre si on leur fournit le **hash de la transaction de dépôt** et l'adresse de dépôt. Dans SPECTRA, ChangeNOW coopère volontairement ; eXch ne répond pas. Envoyez la demande **tôt** : les durées de conservation de ces services sont inconnues, et la corrélation que vous menez en parallèle ne remplace pas leur réponse.`,
      },
      { type: 'heading', text: 'La corrélation montant / temps, pas à pas' },
      {
        type: 'steps',
        items: [
          { title: '1. Montant attendu', md: `Montant déposé × cours au moment de l'opération, moins la commission et l'écart (souvent 0,5 à 2 %). Utilisez un **cours horodaté de référence** et notez sa source.` },
          { title: '2. Fenêtre de temps', md: `Du dépôt (ou de sa confirmation) jusqu'à quelques dizaines de minutes ou une heure après. Élargissez si le service est connu pour ses retenues de conformité.` },
          { title: '3. Liste exhaustive', md: `Listez **toutes** les sorties du hot wallet de l'échangeur sur la chaîne de destination dans la fenêtre, pas seulement celles qui vous arrangent.` },
          { title: '4. Filtre', md: `Retenez les sorties dont la contre-valeur entre dans la fourchette attendue.` },
          { title: '5. Comptage', md: `Comptez les candidats restants **et** le nombre total de sorties examinées. C'est ce ratio qui fixe la force de l'hypothèse.` },
          { title: '6. Recoupement', md: `Cherchez des éléments indépendants : adresse de réception neuve puis réutilisée, même adresse EVM active sur d'autres chaînes, schéma de dépense identique à celui du suspect.` },
          { title: '7. Confirmation', md: `Réquisition de l'échangeur avec le hash du dépôt. Tant qu'elle n'est pas revenue, le saut reste une **hypothèse**.` },
        ],
      },
      {
        type: 'callout',
        kind: 'tip',
        title: 'Dans l\'espace d\'enquête : les « sorties probables »',
        md: `Quand un dépôt chez un échangeur instantané est identifié (inspecteur de la transaction, ou bouton *Sorties probables* sur la destination dans l'outil de traçage), SPECTRA applique automatiquement les étapes 1 à 5 : il examine tous les paiements du même service dans les 4 heures, garde ceux dont le montant correspond aux frais habituels et les classe par probabilité. Un candidat très au-dessus des autres renforce l'hypothèse ; plusieurs candidats proches la fragilisent. *Lier* pose un lien de corrélation dans le graphe, l'icône de traçage poursuit le suivi depuis le paiement. Les étapes 6 et 7 restent à faire.`,
      },
      {
        type: 'case',
        title: 'Cas pratique — 0,8215 BTC chez ChangeNOW',
        md: `Dépôt de 0,8215 BTC à 14:02 UTC (confirmé à 14:09) sur une adresse de dépôt ChangeNOW. Cours de référence : environ 24,1 ETH pour 1 BTC → 19,80 ETH bruts. Après 0,5 à 2 % de frais : fourchette de **19,40 à 19,70 ETH**.

Sorties du hot wallet ETH de ChangeNOW entre 14:09 et 15:00 : **214**. Dans la fourchette : **une seule**, 19,61 ETH à 14:17 UTC vers \`0x2d9a…e410\`, adresse jamais vue auparavant. Quarante minutes plus tard, cette adresse dépose la totalité dans ArcBridge vers BNB Chain.

Conclusion : hypothèse **forte** (1 candidat sur 214, adresse neuve, usage immédiat cohérent avec le schéma du suspect), à confirmer par réquisition de ChangeNOW avec le hash du dépôt.`,
      },
      { type: 'widget', id: 'timing-correlation', caption: `Réglez fenêtre et tolérance : observez comment le nombre de candidats, et donc la confiance, évolue.` },
      {
        type: 'check',
        q: `Dépôt de 2 BTC chez un échangeur. Cours : 20 ETH pour 1 BTC. Commission annoncée : 1 %. Quel versement ETH attendez-vous ?`,
        options: ['Environ 40 ETH', 'Environ 39,6 ETH', 'Environ 20 ETH', 'Environ 2 ETH'],
        answer: 1,
        explain: `2 × 20 = 40 ETH bruts ; moins 1 % = 39,6 ETH. En pratique, on retient une fourchette autour de cette valeur pour absorber la variation de cours.`,
      },
      {
        type: 'table',
        caption: 'Sources de faux positifs et parades',
        headers: ['Source d’erreur', 'Effet', 'Parade'],
        rows: [
          ['Volume élevé du service', 'Plusieurs sorties compatibles par coïncidence', 'Resserrer la fenêtre, compter les candidats, chercher des recoupements'],
          ['Volatilité du cours', 'Montant attendu faux', 'Cours à la minute d’une source de référence ; fourchette élargie'],
          ['Versement fractionné ou groupé', 'Aucun candidat isolé', 'Chercher des combinaisons de sorties vers des adresses liées'],
          ['Retenue de conformité', 'Versement des heures plus tard', 'Élargir la fenêtre si aucun candidat'],
          ['Taux fixe vs flottant', 'Écart de montant imprévu', 'Tester les deux hypothèses de calcul'],
          ['Hot wallet mal attribué', 'Liste de sorties incomplète', 'Vérifier l’attribution (balayages depuis les adresses de dépôt)'],
        ],
      },
      {
        type: 'callout',
        kind: 'warn',
        title: 'Le chiffre qui change tout',
        md: `« Un seul candidat sur 214 sorties dans la fenêtre » et « six candidats possibles » n'ont pas du tout la même valeur. Indiquez **toujours** le nombre de candidats et le nombre de sorties examinées. Ne retenez jamais « le plus proche » comme certain.`,
      },
      { type: 'heading', text: 'Quand la blockchain parle : les memos' },
      {
        type: 'text',
        md: `Certains protocoles d'échange natifs inter-chaînes fonctionnent avec un **memo** inscrit dans la transaction de dépôt : il indique l'actif voulu, la chaîne et l'**adresse de destination**. Un memo du type \`=:ETH.ETH:0x2d9a…e410\` se lit littéralement « échanger vers de l'ETH natif sur Ethereum, livrer à 0x2d9a…e410 ».

C'est une aubaine : le saut devient **constaté** et non plus corrélé. Pensez donc à ouvrir les données de chaque transaction de dépôt (champ OP_RETURN sur Bitcoin, memo sur d'autres chaînes) avant de lancer une corrélation.

Même logique pour un **exchange centralisé** utilisé comme saut (dépôt de BTC, retrait d'USDT-TRC20) : aucun lien on-chain, mais la réquisition du compte donne la correspondance exacte.`,
      },
      { type: 'heading', text: 'Une chronologie inter-chaînes unique' },
      {
        type: 'table',
        caption: `Extrait de chronologie : une ligne par transaction, tout en UTC, avec la contre-valeur et la nature du lien`,
        headers: ['UTC', 'Chaîne', 'Opération', 'Montant', 'Contre-valeur', 'Lien avec la ligne précédente', 'Confiance'],
        rows: [
          ['12/05 14:02', 'Bitcoin', 'Collecteur → dépôt ChangeNOW', '0,8215 BTC', '≈ 49 300 €', '—', 'Établi'],
          ['12/05 14:17', 'Ethereum', 'Hot wallet ChangeNOW → 0x2d9a…', '19,61 ETH', '≈ 48 800 €', 'Corrélation (1/214)', 'Élevée'],
          ['12/05 14:58', 'Ethereum', '0x2d9a… → ArcBridge', '19,60 ETH', '≈ 48 780 €', 'Constaté', 'Établi'],
          ['12/05 15:07', 'BNB Chain', 'ArcBridge → 0x2d9a…', '82,4 BNB', '≈ 48 690 €', 'Nonce 41 077', 'Établi'],
          ['12/05 15:20', 'BNB Chain', 'Swap PancakeSwap → USDT', '52 640 USDT', '≈ 48 540 €', 'Même transaction', 'Établi'],
        ],
      },
      {
        type: 'callout',
        kind: 'tip',
        title: 'Réflexe EVM',
        md: `Une même clé privée contrôle **la même adresse** sur toutes les chaînes EVM. Si \`0x2d9a…\` apparaît sur Ethereum, regardez immédiatement BNB Chain, Polygon, Arbitrum, Base : les suspects y oublient souvent des fonds ou un historique qui renforce l'attribution.`,
      },
      {
        type: 'check',
        q: `La corrélation trouve 6 sorties compatibles dans la fenêtre, sans autre élément. Comment la présenter ?`,
        options: [
          `Indiquer 6 candidats et une confiance faible, en attendant la réponse du service`,
          `Retenir la plus proche du montant attendu comme certaine`,
          `Retenir les 6 adresses comme appartenant au suspect`,
          `Ne rien mentionner dans le rapport`,
        ],
        answer: 0,
        explain: `Six candidats sans recoupement = hypothèse faible. On la mentionne avec ses limites et on demande confirmation au service.`,
      },
      {
        type: 'callout',
        kind: 'law',
        title: 'Rédaction et procédure',
        md: `Un saut obtenu par corrélation est une **inférence** : rédigez-le comme tel (« compatible avec », « hypothèse de confiance élevée »), avec la méthode, la fenêtre, la tolérance, le cours utilisé et le nombre de candidats. La réquisition ou la demande d'entraide auprès du service (selon son lieu d'établissement) transforme ensuite l'hypothèse en constatation. Conservez les deux dans le dossier : la démarche et sa confirmation.`,
      },
    ],
    keyPoints: [
      `Le chain hopping enchaîne actifs et chaînes pour casser la continuité des outils et multiplier les juridictions.`,
      `Bridges, DEX et protocoles à memo laissent un lien lisible ; échangeurs instantanés et exchanges centralisés n'en laissent pas.`,
      `Un échangeur instantané connaît la commande (dépôt ↔ réception, souvent IP) : le requérir avec le hash du dépôt.`,
      `Corrélation : montant attendu (cours − frais), fenêtre de temps, liste exhaustive des sorties du hot wallet, filtrage.`,
      `Toujours indiquer le nombre de candidats sur le nombre de sorties examinées, et garder le statut d'hypothèse.`,
      `Tenir une chronologie unique en UTC avec contre-valeur et nature du lien à chaque saut.`,
      `Même adresse EVM sur toutes les chaînes EVM : vérifier systématiquement les autres réseaux.`,
    ],
    quiz: [
      {
        q: `Que fournir à un échangeur instantané pour qu'il retrouve une commande ?`,
        options: [
          `Le nom présumé du suspect`,
          `Le cours du BTC au jour de l'opération`,
          `Le hash de la transaction de dépôt et l'adresse de dépôt`,
          `Rien : ces services ne conservent aucune donnée`,
        ],
        answer: 2,
        explain: `Le hash du dépôt permet au service de retrouver la commande, donc l'adresse de réception et souvent l'IP.`,
      },
      {
        q: `Dépôt de 1,5 BTC. Cours : 30 000 USDT pour 1 BTC. Commission 2 %. Quel versement en USDT attendez-vous ?`,
        options: ['45 000', '44 100', '44 900', '30 000'],
        answer: 1,
        explain: `1,5 × 30 000 = 45 000 USDT bruts ; moins 2 % (900) = 44 100 USDT.`,
      },
      {
        kind: 'multi',
        q: `Quels sauts laissent un lien lisible directement sur la blockchain ? (plusieurs réponses)`,
        options: [
          `Un bridge qui publie un événement avec un identifiant`,
          `Un swap sur un DEX`,
          `Un échangeur instantané sans compte`,
          `Un protocole inter-chaînes dont le dépôt porte un memo de destination`,
        ],
        answer: [0, 1, 3],
        explain: `Bridge, DEX et memo laissent des données on-chain. L'échangeur instantané paie depuis son hot wallet, sans lien transactionnel avec le dépôt.`,
      },
      {
        kind: 'truefalse',
        q: `Si une seule sortie du hot wallet correspond au montant attendu dans la fenêtre, le lien est établi et n'a pas besoin d'être confirmé.`,
        options: ['Vrai', 'Faux'],
        answer: 1,
        explain: `Même avec un candidat unique, c'est une inférence forte, pas une constatation. La réponse du service ou des recoupements indépendants la confirment.`,
      },
      {
        q: `Pourquoi un memo du type « =:ETH.ETH:0x2d9a… » dans un dépôt est-il précieux ?`,
        options: [
          `Il prouve l'identité civile du déposant`,
          `Il bloque automatiquement les fonds`,
          `Il signifie que l'opération a été annulée`,
          `Il indique on-chain l'actif, la chaîne et l'adresse de destination`,
        ],
        answer: 3,
        explain: `L'instruction de destination est inscrite dans la transaction : le saut est constaté sans corrélation.`,
      },
      {
        kind: 'multi',
        q: `Quels éléments renforcent une hypothèse de corrélation ? (plusieurs réponses)`,
        options: [
          `Un candidat unique parmi plusieurs centaines de sorties examinées`,
          `Une adresse de réception neuve, utilisée immédiatement selon le schéma connu du suspect`,
          `Le fait que l'échangeur soit situé à l'étranger`,
          `La même adresse EVM active sur une autre chaîne avec un historique lié à l'affaire`,
        ],
        answer: [0, 1, 3],
        explain: `Rareté des candidats et recoupements indépendants renforcent l'hypothèse ; la localisation du service n'apporte rien à la corrélation.`,
      },
      {
        q: `Le suspect dépose des BTC sur son compte d'exchange régulé puis retire des USDT-TRC20. Comment relier formellement les deux ?`,
        options: [
          `Par corrélation montant/temps uniquement`,
          `C'est impossible`,
          `Par le memo de la transaction Bitcoin`,
          `Par réquisition de l'exchange : le relevé du compte relie dépôt et retrait`,
        ],
        answer: 3,
        explain: `L'exchange tient le compte client : son relevé établit la correspondance que la blockchain ne montre pas.`,
      },
    ],
    flashcards: [
      { front: 'Chain hopping', back: `Enchaîner actifs et blockchains (BTC → ETH → BNB → USDT…) pour casser la continuité de l'analyse.` },
      { front: `Échangeur instantané : lien on-chain dépôt ↔ versement ?`, back: `Aucun : le versement part du hot wallet du service. Mais le service connaît la commande.` },
      { front: `Que demander à un échangeur ?`, back: `La commande liée au hash du dépôt : adresse de réception, horodatages, IP, e-mail éventuel.` },
      { front: 'Montant attendu', back: `Montant déposé × cours horodaté, moins commission et écart (souvent 0,5 à 2 %).` },
      { front: 'Force d’une corrélation', back: `Nombre de candidats rapporté au nombre de sorties examinées, plus les recoupements indépendants.` },
      { front: 'Memo de dépôt inter-chaînes', back: `Instruction on-chain indiquant actif, chaîne et adresse de destination : le saut devient constaté.` },
      { front: 'Exchange utilisé comme saut', back: `Pas de lien on-chain entre dépôt et retrait ; la réquisition du compte l'établit.` },
      { front: 'Réflexe EVM', back: `Même adresse sur toutes les chaînes EVM : vérifier Ethereum, BNB Chain, Polygon, Arbitrum, Base…` },
      { front: 'Chronologie inter-chaînes', back: `Une ligne par transaction, en UTC, avec contre-valeur, nature du lien et niveau de confiance.` },
      { front: 'Statut d’un saut corrélé', back: `Hypothèse (inférence) jusqu'à confirmation par le service ou par recoupements.` },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // MIXEURS
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'mixeurs',
    title: 'Mixeurs centralisés',
    level: 3,
    track: 'confidentialite',
    minutes: 25,
    summary: `Un mixeur centralisé reçoit des fonds et en restitue d'autres, après un délai et moins une commission. Ce que l'on voit sur la chaîne, l'erreur méthodologique à ne pas commettre, les pistes qui restent (corrélation, erreurs post-mixage, données de démantèlement, preuves hors chaîne) et la portée juridique.`,
    objectives: [
      `Décrire le cycle d'une commande dans un mixeur custodial et ce qu'il laisse sur la chaîne.`,
      `Reconnaître un cluster de mixeur et interpréter correctement une exposition à un mixeur.`,
      `Expliquer pourquoi on ne « propage » jamais des fonds à travers un mixeur.`,
      `Exploiter les pistes résiduelles : corrélation, erreurs de l'utilisateur après le mixage, données de démantèlement, preuves hors chaîne.`,
      `Rédiger un passage de rapport sur un mixeur sans surinterpréter.`,
    ],
    prerequisites: ['clustering', 'change-heuristics', 'exposition-risque', 'chain-hopping'],
    practice: ['centralized-mixer', 'ransomware-raas'],
    blocks: [
      {
        type: 'text',
        md: `Les fonds de votre victime arrivent sur une adresse que l'outil étiquette **« Mixeur »** en rouge. Le réflexe naïf est de conclure « fin de piste ». Le réflexe opposé, tout aussi faux, est de suivre les sorties du mixeur comme si c'étaient les fonds de la victime.

La bonne approche est entre les deux : un mixeur casse le lien **transactionnel**, mais il ne supprime ni le **temps**, ni les **montants**, ni les **erreurs humaines**, ni les **données hors chaîne**.`,
      },
      { type: 'heading', text: `Le cycle d'une commande` },
      {
        type: 'steps',
        items: [
          { title: 'Commande', md: `L'utilisateur indique une ou plusieurs **adresses de sortie**, choisit (ou subit) un délai et une répartition, et reçoit une **adresse de dépôt** unique. Il obtient souvent une « lettre de garantie » signée par le service.` },
          { title: 'Dépôt', md: `Il envoie ses fonds sur l'adresse de dépôt.` },
          { title: 'Balayage', md: `Le service regroupe l'adresse de dépôt vers ses **réserves**, comme le ferait un exchange.` },
          { title: 'Restitution', md: `Après le délai (quelques heures à plusieurs jours), le service verse **d'autres fonds**, puisés dans ses réserves, vers les adresses de sortie, moins une **commission** (souvent 1 à 5 %, parfois aléatoire), éventuellement fractionnés en plusieurs versements.` },
        ],
      },
      {
        type: 'flow',
        caption: `Le lien transactionnel s'arrête au balayage. Entre le dépôt et les sorties, seule une corrélation (pointillé) est possible.`,
        nodes: [
          { id: 'v', label: 'Victime', kind: 'victim', sub: 'hameçonnage' },
          { id: 's', label: 'Suspect', kind: 'suspect', sub: 'bc1q…7xk' },
          { id: 'd', label: 'Dépôt Nebula', kind: 'deposit', sub: 'adresse unique' },
          { id: 'r', label: 'Réserves Nebula', kind: 'mixer', sub: 'fonds de tous les clients' },
          { id: 'o1', label: 'Sortie 1', kind: 'wallet', sub: '1,18 BTC' },
          { id: 'o2', label: 'Sortie 2', kind: 'wallet', sub: '0,97 BTC' },
          { id: 'o3', label: 'Sortie 3', kind: 'wallet', sub: '0,98 BTC' },
        ],
        edges: [
          { from: 'v', to: 's', label: '3,2 BTC' },
          { from: 's', to: 'd', label: '3,2 BTC' },
          { from: 'd', to: 'r', label: 'balayage' },
          { from: 'r', to: 'o1', label: '+9 h' },
          { from: 'r', to: 'o2', label: '+14 h' },
          { from: 'r', to: 'o3', label: '+21 h' },
          { from: 'd', to: 'o1', label: 'corrélation ?', dashed: true },
        ],
      },
      {
        type: 'terms',
        items: [
          { term: 'Mixeur centralisé (custodial)', def: `Service qui prend la garde des fonds et en restitue d'autres. L'utilisateur doit lui faire confiance.` },
          { term: 'Réserve', def: `Portefeuilles du mixeur où sont regroupés les dépôts de tous les clients et d'où partent les versements.` },
          { term: 'Lettre de garantie', def: `Message signé avec une clé du service, remis au client comme preuve de l'engagement. Trouvée sur un appareil, c'est une pièce précieuse.` },
          { term: 'Code client (mixing code)', def: `Identifiant que certains mixeurs remettent pour éviter de restituer au client ses propres anciens fonds lors d'une commande suivante : il relie les commandes d'un même utilisateur.` },
          { term: 'Délai et commission aléatoires', def: `Paramètres destinés à brouiller la corrélation montant/temps.` },
        ],
      },
      {
        type: 'compare',
        left: {
          title: 'Mixeur centralisé (cette leçon)',
          md: `- **Custodial** : le service détient les fonds.
- Un opérateur, une infrastructure, des journaux possibles.
- Démantelable, avec saisie de serveurs et de bases.`,
        },
        right: {
          title: 'CoinJoin et pools (niveau 4)',
          md: `- **Non custodial** : transaction collaborative ou contrat intelligent.
- Pas de garde des fonds par un tiers.
- Analyse fondée sur la structure des transactions et le timing.`,
        },
      },
      { type: 'heading', text: 'Ce que l’on voit sur la chaîne' },
      {
        type: 'text',
        md: `- **À l'entrée** : une adresse de dépôt neuve, balayée peu après vers les réserves. Les outils regroupent dépôts et réserves dans un **cluster** étiqueté « mixeur ».
- **À la sortie** : des versements depuis les réserves vers des adresses de sortie, sans lien transactionnel avec un dépôt donné.
- **En exposition** : l'outil calcule qu'une adresse a reçu une part de ses fonds d'un mixeur, directement ou à quelques sauts. C'est un **indicateur de risque**, pas la preuve qu'elle a reçu les fonds d'un dépôt précis.`,
      },
      {
        type: 'callout',
        kind: 'warn',
        title: 'L’erreur méthodologique à ne jamais commettre',
        md: `Les bénéficiaires des sorties d'un mixeur ne sont **pas** reliés aux déposants par la blockchain. Écrire qu'une sortie « contient » les fonds de la victime, ou « propager » le préjudice à travers le mixeur au prorata, est une erreur qu'un avocat de la défense relèvera immédiatement. Au-delà d'un mixeur, on ne parle plus que de **corrélation**.`,
      },
      {
        type: 'table',
        caption: `Indices qu'un cluster est un mixeur centralisé`,
        headers: ['Indice', 'Ce que l’on observe', 'Fiabilité'],
        rows: [
          ['Adresses de dépôt à usage unique', 'Chaque dépôt sur une adresse neuve, balayée sous quelques heures', 'Moyenne (les exchanges font pareil)'],
          ['Versements décalés et fractionnés', 'Sorties vers des adresses neuves, montants « cassés », délais irréguliers', 'Moyenne'],
          ['Absence de contrepartie régulée', 'Aucun flux vers ou depuis des exchanges réputés à l’échelle du cluster', 'Bonne si combinée'],
          ['Promotion sur des forums', 'Adresses ou lettres de garantie publiées sur des forums spécialisés', 'Bonne (source à citer)'],
          ['Attribution d’outil ou de démantèlement', 'Étiquette fournie par un outil, une autorité ou des données saisies', 'Variable : vérifier date et source'],
        ],
      },
      { type: 'widget', id: 'risk-exposure', caption: `Calculez l'exposition directe et indirecte d'une adresse à un mixeur : un pourcentage de risque, pas une preuve de lien.` },
      {
        type: 'check',
        q: `Une adresse a reçu 0,95 BTC depuis les réserves de Sinbad, 6 heures après que la victime y a déposé 1 BTC. Que pouvez-vous écrire ?`,
        options: [
          `Que l'adresse a reçu les fonds de la victime`,
          `Qu'un versement compatible en montant et en délai a été observé, à confronter aux autres candidats`,
          `Que l'adresse appartient au mixeur`,
          `Rien : un mixeur rend toute analyse impossible`,
        ],
        answer: 1,
        explain: `C'est une corrélation, à documenter avec le nombre de candidats dans la fenêtre. Aucun lien transactionnel n'existe.`,
      },
      { type: 'heading', text: 'Ce qui reste exploitable' },
      {
        type: 'table',
        caption: 'Pistes résiduelles après un mixeur centralisé',
        headers: ['Piste', 'Principe', 'Force typique', 'Exemple'],
        rows: [
          ['Corrélation montant/temps', 'Somme des sorties ≈ dépôt − commission, dans la fenêtre de délai', 'Faible à moyenne', '3,2 BTC déposés, 3,13 BTC ressortis en trois versements sous 24 h'],
          ['Regroupement post-mixage', 'Les sorties sont dépensées ensemble ou envoyées au même endroit', 'Forte', 'Trois sorties consolidées vers un même dépôt Binance'],
          ['Réutilisation d’adresse', 'Adresse de sortie déjà connue ou réutilisée ensuite', 'Forte', 'Sortie vers une adresse déjà utilisée par le suspect avant les faits'],
          ['Schéma propre au service', 'Montants ou délais standards reconnaissables', 'Moyenne', 'Versements toujours fractionnés en 3 parts'],
          ['Données de démantèlement', 'Bases saisies reliant commandes, dépôts et sorties', 'Forte', 'Correspondance obtenue via la coopération internationale'],
          ['Hors chaîne', 'Traces sur les appareils du suspect', 'Forte', 'Lettre de garantie, historique Tor, capture de commande'],
        ],
      },
      { type: 'widget', id: 'timing-correlation', caption: `Appliquez la corrélation à une sortie de mixeur : délai long, commission variable, et beaucoup plus de candidats qu'avec un échangeur.` },
      {
        type: 'case',
        title: 'Cas pratique — l’erreur après le mixage',
        md: `Le 12 mars à 08:41 UTC, le suspect dépose 3,2 BTC volés sur une adresse de dépôt de Sinbad. Dans les 36 heures, les réserves du mixeur effectuent 47 versements. Trois d'entre eux, de 1,18 BTC, 0,97 BTC et 0,98 BTC (total 3,13 BTC, soit 2,2 % de moins que le dépôt), partent vers trois adresses neuves.

Pris isolément, ces versements ne valent pas grand-chose : d'autres combinaisons de sorties approchent aussi 3,13 BTC. Mais le 14 mars, une **même transaction** dépense les trois adresses ensemble (entrées communes) vers une adresse de dépôt attribuée à **Binance**.

Le regroupement post-mixage transforme une corrélation faible en hypothèse forte : les trois sorties sont contrôlées par une même personne, qui a déposé un montant compatible chez Binance. Réquisition de Binance pour identifier le titulaire du compte.`,
      },
      {
        type: 'flow',
        caption: `Le regroupement post-mixage : l'utilisateur défait lui-même le travail du mixeur.`,
        nodes: [
          { id: 'r', label: 'Réserves Nebula', kind: 'mixer' },
          { id: 'o1', label: 'Sortie 1', kind: 'wallet', sub: '1,18 BTC' },
          { id: 'o2', label: 'Sortie 2', kind: 'wallet', sub: '0,97 BTC' },
          { id: 'o3', label: 'Sortie 3', kind: 'wallet', sub: '0,98 BTC' },
          { id: 't', label: 'Transaction de regroupement', kind: 'tx', sub: '3 entrées communes' },
          { id: 'ex', label: 'Dépôt Binance', kind: 'deposit', sub: 'compte KYC' },
        ],
        edges: [
          { from: 'r', to: 'o1' },
          { from: 'r', to: 'o2' },
          { from: 'r', to: 'o3' },
          { from: 'o1', to: 't', label: 'entrée' },
          { from: 'o2', to: 't', label: 'entrée' },
          { from: 'o3', to: 't', label: 'entrée' },
          { from: 't', to: 'ex', label: '3,129 BTC' },
        ],
      },
      {
        type: 'callout',
        kind: 'field',
        title: 'Sur le terrain : basculez hors chaîne',
        md: `En perquisition ou lors de l'exploitation d'un téléphone, cherchez : **lettres de garantie** (fichiers texte signés), **codes clients** du mixeur, historique du navigateur Tor, captures d'écran de commande, notes contenant des adresses de sortie. Une seule lettre de garantie relie formellement une adresse de dépôt à un utilisateur et à ses adresses de sortie.`,
      },
      { type: 'heading', text: 'Démantèlements et portée juridique' },
      {
        type: 'text',
        md: `Plusieurs mixeurs centralisés ont été démantelés par des opérations internationales : par exemple **ChipMixer**, mis hors ligne en 2023 par les autorités allemandes et américaines avec le soutien d'Europol, ou **Bitcoin Fog**, dont l'opérateur a été condamné aux États-Unis en 2024. Ces opérations permettent de saisir serveurs, bases de données et fonds.

Les données issues de démantèlements peuvent relier dépôts et sorties. Leur disponibilité et leurs conditions d'exploitation dépendent des cadres de coopération : renseignez-vous auprès des structures spécialisées de votre chaîne et via Europol, et ne versez à la procédure que ce qui a été obtenu par une voie régulière.`,
      },
      {
        type: 'callout',
        kind: 'law',
        title: 'Portée juridique',
        md: `L'usage d'un mixeur n'est pas en soi une infraction dans tous les pays, mais il constitue un **indice fort de volonté de dissimulation**, utile pour caractériser le blanchiment (article 324-1 du code pénal). Le code pénal prévoit aussi une présomption d'origine illicite lorsque les conditions d'une opération n'ont d'autre justification que de dissimuler l'origine ou le bénéficiaire des biens (article 324-1-1). L'opportunité et la qualification relèvent du magistrat : vérifiez les textes en vigueur et décrivez des faits précis (montant, date, paramètres de la commande).`,
      },
      {
        type: 'callout',
        kind: 'example',
        title: 'Formulation pour le rapport',
        md: `« Le 12/03 à 08:41 UTC, 3,2 BTC ont été déposés sur une adresse attribuée par l'outil X (consulté le 20/03) au mixeur Sinbad (txid …). Aucun lien transactionnel ne permet de suivre ces fonds au-delà du mixeur. Une corrélation montant/temps (fenêtre 36 h, tolérance 5 %) a identifié plusieurs combinaisons de versements compatibles. L'une d'elles (trois versements totalisant 3,13 BTC) a été regroupée le 14/03 dans une transaction unique vers un dépôt Binance, ce qui fonde une hypothèse de confiance élevée. »`,
      },
      {
        type: 'check',
        q: `Quelle erreur de l'utilisateur facilite le plus la reprise de la trace après un mixeur ?`,
        options: [
          `Choisir un délai très long`,
          `Utiliser plusieurs adresses de sortie neuves`,
          `Regrouper ensuite toutes les sorties vers un même compte d'exchange`,
          `Payer une commission élevée`,
        ],
        answer: 2,
        explain: `Le regroupement recrée un point de convergence contrôlé par une seule personne, et le compte d'exchange est identifiable par réquisition.`,
      },
    ],
    keyPoints: [
      `Mixeur centralisé : dépôt, balayage vers les réserves, restitution d'autres fonds après un délai, moins une commission.`,
      `Aucun lien transactionnel entre un dépôt et les sorties : on ne propage jamais des fonds à travers un mixeur.`,
      `L'exposition à un mixeur est un indicateur de risque, pas la preuve d'un lien avec un dépôt précis.`,
      `Corrélation montant/temps : souvent faible seule (délais et commissions aléatoires, nombreux candidats).`,
      `Les erreurs post-mixage (regroupement, réutilisation d'adresse, dépôt sur un même compte) sont la meilleure piste.`,
      `Démantèlements et preuves hors chaîne (lettres de garantie, codes clients, historique Tor) peuvent relier dépôts et sorties.`,
      `L'usage d'un mixeur est un indice de dissimulation utile à la caractérisation du blanchiment.`,
    ],
    quiz: [
      {
        q: `Une adresse a reçu des fonds d'un mixeur. Peut-on affirmer qu'elle a reçu les fonds de la victime déposés dans ce mixeur ?`,
        options: [
          `Non : il n'existe aucun lien transactionnel entre dépôts et sorties`,
          `Oui, si le montant est proche`,
          `Oui, si c'est le même jour`,
          `Oui, dans tous les cas`,
        ],
        answer: 0,
        explain: `Le mixeur restitue d'autres fonds puisés dans ses réserves. Un montant proche n'est qu'une corrélation à documenter.`,
      },
      {
        q: `Quelle est la nature d'un mixeur centralisé ?`,
        options: [
          `Un contrat intelligent non custodial`,
          `Une transaction collaborative entre utilisateurs`,
          `Un DEX à teneur de marché automatisé`,
          `Un service custodial qui détient les fonds pendant le mélange`,
        ],
        answer: 3,
        explain: `L'utilisateur confie ses fonds au service, qui pourrait les conserver ou tenir des journaux, et qui peut être démantelé.`,
      },
      {
        kind: 'multi',
        q: `Quelles pistes peuvent relier un utilisateur à ses sorties de mixeur ? (plusieurs réponses)`,
        options: [
          `Une lettre de garantie retrouvée sur son ordinateur`,
          `Le regroupement des sorties dans une même transaction`,
          `L'exposition « mixeur » calculée par l'outil sur une adresse quelconque`,
          `Des bases de données saisies lors du démantèlement du service`,
        ],
        answer: [0, 1, 3],
        explain: `Lettre de garantie, regroupement et données de démantèlement relient concrètement un utilisateur à ses sorties. Une exposition n'est qu'un indicateur de risque.`,
      },
      {
        kind: 'truefalse',
        q: `Pour évaluer le préjudice récupérable, on peut répartir les fonds de la victime au prorata sur toutes les sorties du mixeur.`,
        options: ['Vrai', 'Faux'],
        answer: 1,
        explain: `Les sorties proviennent des réserves communes : aucune n'est liée à un dépôt précis. Propager au prorata à travers un mixeur est une erreur méthodologique.`,
      },
      {
        q: `Pourquoi la corrélation montant/temps est-elle généralement plus faible après un mixeur qu'après un échangeur instantané ?`,
        options: [
          `Parce que les mixeurs n'utilisent pas la blockchain`,
          `Parce que les délais sont longs et aléatoires, les commissions variables et les versements fractionnés`,
          `Parce que les mixeurs versent toujours le montant exact`,
          `Parce que les mixeurs sont tous situés en France`,
        ],
        answer: 1,
        explain: `Plus la fenêtre est large et les paramètres aléatoires, plus le nombre de candidats augmente, donc moins la corrélation est probante.`,
      },
      {
        q: `Dans un rapport, comment qualifier le dépôt de fonds dans un mixeur au regard du blanchiment ?`,
        options: [
          `Comme la preuve que le déposant est l'auteur de l'infraction d'origine`,
          `Comme un fait sans intérêt`,
          `Comme un indice de volonté de dissimulation, la qualification relevant du magistrat`,
          `Comme une infraction autonome dans tous les pays`,
        ],
        answer: 2,
        explain: `L'usage d'un mixeur est un indice fort de dissimulation ; l'enquêteur décrit les faits, le magistrat qualifie.`,
      },
      {
        kind: 'multi',
        q: `Lors d'une perquisition chez un suspect soupçonné d'utiliser un mixeur, que recherchez-vous en priorité ? (plusieurs réponses)`,
        options: [
          `Des lettres de garantie signées par le service`,
          `Le code client remis par le mixeur`,
          `L'historique de navigation Tor et des captures de commande`,
          `Les factures d'électricité du domicile`,
        ],
        answer: [0, 1, 2],
        explain: `Ces éléments relient le suspect à des commandes précises (adresses de dépôt et de sortie). Les factures d'électricité n'apportent rien ici.`,
      },
    ],
    flashcards: [
      { front: 'Mixeur centralisé', back: `Service custodial : dépôt, délai, restitution d'autres fonds depuis ses réserves, moins une commission.` },
      { front: 'Lien dépôt → sortie de mixeur ?', back: `Aucun lien transactionnel : uniquement des corrélations à documenter.` },
      { front: 'Exposition à un mixeur', back: `Indicateur de risque calculé par l'outil, pas preuve d'un lien avec un dépôt précis.` },
      { front: 'Lettre de garantie', back: `Message signé par le mixeur, remis au client : relie adresse de dépôt, client et sorties.` },
      { front: 'Code client (mixing code)', back: `Identifiant qui évite de restituer au client ses anciens fonds ; relie les commandes d'un même utilisateur.` },
      { front: 'Meilleure piste post-mixage', back: `Le regroupement des sorties (entrées communes) ou leur envoi vers un même compte d'exchange.` },
      { front: 'Commission typique', back: `Souvent 1 à 5 %, parfois aléatoire ; délais de quelques heures à plusieurs jours.` },
      { front: 'Démantèlements de mixeurs', back: `Ex. ChipMixer (2023, soutien d'Europol) : serveurs et bases saisis, utiles pour relier dépôts et sorties.` },
      { front: 'Mixeur et blanchiment', back: `Indice fort de dissimulation (art. 324-1 et 324-1-1 CP, à vérifier) ; qualification par le magistrat.` },
      { front: 'Mixeur vs CoinJoin', back: `Mixeur : custodial, un opérateur. CoinJoin : transaction collaborative non custodiale.` },
    ],
  },
]
