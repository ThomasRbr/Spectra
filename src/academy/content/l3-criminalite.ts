// Niveau 3 — Typologies : rançongiciels (RaaS) et marchés du darknet.
// Entités citées : FICTIVES (voir src/engine/entities.ts).
import type { Lesson } from '../model'

export const L3_CRIMINALITE: Lesson[] = [
  // ══════════════════════════════════════════════════════════════════════════
  // RANÇONGICIELS
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'ransomware',
    title: 'Rançongiciels et modèle RaaS',
    level: 3,
    track: 'typologies',
    minutes: 30,
    summary: `L'écosystème des rançongiciels en mode « Ransomware-as-a-Service » : opérateurs, affiliés, courtiers d'accès. Le paiement de la rançon, la transaction de partage visible sur la chaîne, le portefeuille des opérateurs qui relie les victimes, les circuits de blanchiment et les éléments à recueillir auprès de la victime.`,
    objectives: [
      `Décrire les rôles de l'écosystème RaaS et la double extorsion.`,
      `Reconnaître sur la chaîne l'adresse de rançon et la transaction de partage affilié / opérateur.`,
      `Exploiter le portefeuille des opérateurs pour relier des victimes et mesurer une campagne.`,
      `Identifier les circuits de blanchiment des rançons et les opportunités d'action (sorties, dormance).`,
      `Recueillir auprès de la victime les éléments utiles, en tenant compte des sensibilités juridiques du paiement.`,
    ],
    prerequisites: ['utxo', 'change-heuristics', 'clustering', 'peel-chains', 'mixeurs'],
    practice: ['ransomware-raas'],
    blocks: [
      {
        type: 'text',
        md: `Un lundi matin, une PME de 80 salariés découvre ses serveurs chiffrés. Sur chaque poste, une note : « Vos fichiers sont chiffrés et vos données ont été copiées. Rendez-vous sur notre portail pour négocier. » Après une semaine de discussions, la direction paie **18,4 BTC**.

Pour l'enquêteur, ce paiement est une **porte d'entrée**. Les rançons sont presque toujours payées en bitcoins sur une adresse dédiée, et l'organisation des groupes modernes laisse sur la chaîne une signature caractéristique : le **partage** entre ceux qui ont mené l'attaque et ceux qui fournissent le logiciel.`,
      },
      { type: 'heading', text: 'L’écosystème RaaS' },
      {
        type: 'table',
        caption: `Les rôles d'un écosystème de rançongiciel « as a service »`,
        headers: ['Rôle', 'Activité', 'Rémunération', 'Trace exploitable'],
        rows: [
          ['Opérateurs (développeurs)', 'Logiciel de chiffrement, infrastructure, site de fuite, portail de négociation sur Tor', 'Commission sur chaque rançon (souvent 10 à 30 %)', 'Portefeuille commun à toutes les victimes'],
          ['Affiliés', 'Intrusion, élévation de privilèges, exfiltration, déploiement', 'La majeure partie de la rançon (souvent 70 à 90 %)', 'Circuit de blanchiment propre à chaque affilié'],
          ['Courtiers d’accès initial', 'Vente d’accès à des réseaux compromis', 'Prix fixe ou pourcentage', 'Paiements des affiliés vers les courtiers'],
          ['Négociateurs, blanchisseurs, hébergeurs', 'Services spécialisés au profit des groupes', 'Honoraires', 'Flux récurrents depuis plusieurs groupes'],
        ],
      },
      {
        type: 'text',
        md: `La **double extorsion** est devenue la norme : les données sont exfiltrées avant le chiffrement, et le groupe menace de les publier sur son **site de fuite** si la victime ne paie pas. Certains groupes y ajoutent des attaques par déni de service ou le harcèlement des clients de la victime.

Les groupes changent souvent de nom, mais les affiliés et les infrastructures circulent : un portefeuille, un montant de commission ou un schéma de blanchiment peuvent survivre à un changement de marque.`,
      },
      {
        type: 'flow',
        caption: `La rançon arrive sur une adresse unique, puis la transaction de partage répartit affilié et opérateurs. L'adresse des opérateurs reçoit la part de toutes les victimes.`,
        nodes: [
          { id: 'v', label: 'Entreprise victime', kind: 'victim' },
          { id: 'int', label: 'Intermédiaire payeur', kind: 'exchange', sub: 'compte du prestataire' },
          { id: 'ra', label: 'Adresse de rançon', kind: 'suspect', sub: 'unique par victime' },
          { id: 'sp', label: 'Transaction de partage', kind: 'tx', sub: '80 / 20' },
          { id: 'aff', label: 'Affilié', kind: 'suspect', sub: '14,72 BTC' },
          { id: 'op', label: 'Opérateurs LockBit', kind: 'suspect', sub: '3,68 BTC' },
          { id: 'ov', label: 'Autres victimes', kind: 'victim', sub: '11 partages' },
        ],
        edges: [
          { from: 'v', to: 'int', label: 'virement en euros' },
          { from: 'int', to: 'ra', label: '18,4 BTC' },
          { from: 'ra', to: 'sp', label: '+3 h' },
          { from: 'sp', to: 'aff', label: '80 %' },
          { from: 'sp', to: 'op', label: '20 %' },
          { from: 'ov', to: 'op', label: 'parts opérateur' },
        ],
      },
      {
        type: 'callout',
        kind: 'example',
        title: 'Opérations internationales',
        md: `En février 2024, l'opération **Cronos**, menée par une coalition internationale de services d'enquête (dont des services français) avec Europol, a pris le contrôle de l'infrastructure du groupe LockBit, saisi des serveurs, des données et des comptes de crypto-actifs. Les données saisies lors de ce type d'opération peuvent relier des victimes, des affiliés et des adresses : renseignez-vous auprès des structures spécialisées.`,
      },
      { type: 'heading', text: 'Le paiement de la rançon' },
      {
        type: 'text',
        md: `- Le paiement se fait majoritairement en **BTC**, parfois en **XMR** (certains groupes appliquent un supplément pour le BTC, jugé plus traçable).
- Le portail de négociation fournit une **adresse unique par victime**, souvent neuve.
- Le paiement est fréquemment effectué par un **intermédiaire** (négociateur, prestataire de réponse à incident, courtier) depuis son propre compte d'exchange : le payeur on-chain n'est alors **pas** la victime. Les justificatifs de l'intermédiaire (facture, ordre d'achat, txid) font le lien.
- Plusieurs paiements partiels sont possibles (paiement test, puis solde).`,
      },
      {
        type: 'case',
        title: 'Cas pratique — 18,4 BTC versés à LockBit',
        md: `Le 14 octobre à 10:12 UTC, un prestataire de réponse à incident verse **18,4 BTC** depuis son compte Coinhouse sur l'adresse \`bc1q…r7m\` indiquée dans le portail LockBit. À 13:20 UTC, une transaction dépense cette adresse vers deux sorties : **14,7199 BTC** et **3,6800 BTC** (frais : 0,0001 BTC).

Ratio : 3,68 / 18,3999 = **20,0 %**. La sortie de 3,68 BTC va vers \`bc1q…op4\`, adresse qui a reçu sur trois mois **onze** autres versements, chacun égal à 20 % d'une transaction de partage. Les adresses de rançon correspondantes permettent d'identifier onze autres attaques, dont deux font l'objet de plaintes en France.

La sortie de 14,72 BTC (affilié) part en peel chain : 4 BTC dans Sinbad, puis 6,1 BTC vers un dépôt Bitstamp six jours plus tard.`,
      },
      {
        type: 'check',
        q: `Une rançon de 25 BTC est scindée immédiatement en 20 BTC et 5 BTC. Quelle interprétation privilégier ?`,
        options: [
          `Un paiement et son rendu`,
          `Un partage affilié (80 %) / opérateurs (20 %) caractéristique du RaaS`,
          `Un CoinJoin`,
          `Des frais de minage`,
        ],
        answer: 1,
        explain: `Un partage immédiat selon une proportion fixe, répétée d'une victime à l'autre, signe le modèle RaaS. On le confirme en retrouvant d'autres partages vers la même adresse.`,
      },
      { type: 'heading', text: 'Reconnaître la signature on-chain' },
      {
        type: 'table',
        caption: `Indicateurs d'un paiement de rançon et de son partage`,
        headers: ['Indicateur', 'Observation', 'Ce que cela apporte'],
        rows: [
          ['Adresse de rançon neuve', 'Aucun historique avant le paiement de la victime', 'Confirme l’adresse unique par victime'],
          ['Partage rapide à proportion fixe', 'Deux sorties dans un ratio stable (ex. 80/20) quelques heures après le paiement', 'Identifie part affilié et part opérateurs'],
          ['Adresse opérateur récurrente', 'Reçoit des parts de nombreuses transactions de partage', 'Relie les victimes, mesure la campagne'],
          ['Adresse mentionnée dans la note', 'Même adresse ou même portail pour plusieurs victimes', 'Rattache l’attaque à un groupe connu'],
          ['Peel chain sur la part affilié', 'Petits versements successifs vers des services', 'Points de sortie à requérir'],
        ],
      },
      { type: 'widget', id: 'peel-chain', caption: `La part de l'affilié est souvent écoulée en peel chain : suivez la chaîne principale et relevez chaque versement vers un service.` },
      { type: 'heading', text: 'Le blanchiment des rançons' },
      {
        type: 'table',
        caption: 'Circuits de blanchiment et leviers',
        headers: ['Circuit', 'Ce que l’on observe', 'Levier'],
        rows: [
          ['Peel chain', 'Chaîne de transactions détachant de petits montants', 'Réquisitions des services destinataires'],
          ['Mixeur / CoinJoin', 'Passage par un cluster de mixeur ou des sorties égales', 'Corrélation, erreurs post-mixage, données de démantèlement'],
          ['Chain hopping', 'BTC → ETH → USDT → bridge', 'Échangeurs, bridges (identifiants), émetteur du stablecoin (gel)'],
          ['Conversion en XMR', 'Dépôt chez un échangeur, sortie en Monero', 'Réquisition de l’échangeur, analyse des retours vers BTC'],
          ['OTC / exchanges peu regardants', 'Dépôts importants vers des services à KYC faible', 'Coopération internationale, signalement'],
          ['Dormance', 'Fonds immobiles des mois ou des années', 'Surveillance des adresses (alertes)'],
        ],
      },
      {
        type: 'callout',
        kind: 'tip',
        title: 'Surveillez, ne clôturez pas',
        md: `Des fonds immobiles ne sont pas des fonds perdus. Placez des **alertes** sur les adresses de l'affilié et des opérateurs dans votre outil : le jour où les fonds bougent vers un service régulé, vous pouvez demander un gel en quelques heures. Notez dans la procédure la date de mise en place de la surveillance.`,
      },
      { type: 'widget', id: 'risk-exposure', caption: `Mesurez l'exposition d'une adresse de sortie au cluster « rançongiciel » : utile pour argumenter une demande de gel auprès d'un exchange.` },
      { type: 'heading', text: 'Ce qu’il faut recueillir auprès de la victime' },
      {
        type: 'steps',
        items: [
          { title: 'La note de rançon', md: `Fichier original (et son empreinte), identifiant de victime, URL du portail, nom du groupe revendiqué.` },
          { title: 'Les échanges de négociation', md: `Export intégral ou captures horodatées du portail : montants demandés, remises, adresses fournies, délais, preuves de déchiffrement.` },
          { title: 'Le paiement', md: `Adresse de paiement, txid, montant, horodatage. Pour un paiement en XMR : la **clé de transaction** (tx key), indispensable pour prouver le paiement.` },
          { title: `L'intermédiaire`, md: `Identité du prestataire payeur, facture, ordre d'achat des crypto-actifs, compte d'exchange utilisé.` },
          { title: `Les éléments techniques`, md: `Journaux, indicateurs de compromission, vecteur d'entrée présumé, en lien avec les services techniques compétents.` },
          { title: 'Les déclarations', md: `Date de la plainte, notifications éventuelles aux autorités compétentes (protection des données, sécurité des systèmes d'information).` },
        ],
      },
      {
        type: 'compare',
        left: {
          title: 'Rançon payée en BTC',
          md: `- Adresse et txid suffisent pour suivre.
- Partage affilié / opérateurs visible.
- Peel chains, mixeurs, sorties vers des services : traçables.`,
        },
        right: {
          title: 'Rançon payée en XMR',
          md: `- Montants et destinataires masqués on-chain.
- La **clé de transaction** fournie par le payeur prouve le paiement.
- Les leviers se déplacent vers l'achat des XMR (exchange ou échangeur) et les échanges de négociation.`,
        },
      },
      {
        type: 'callout',
        kind: 'law',
        title: 'Le paiement : un sujet juridiquement sensible',
        md: `Les autorités françaises (notamment l'ANSSI) recommandent de **ne pas payer**. Le paiement peut en outre soulever des questions juridiques : risque de violer des **sanctions internationales** si le bénéficiaire est une personne ou une entité désignée, conditions d'indemnisation par l'assurance (la loi d'orientation et de programmation du ministère de l'intérieur de 2023 a subordonné le jeu de certaines garanties au dépôt d'une plainte dans un délai bref après la connaissance de l'attaque, à vérifier dans le code des assurances). Ces questions relèvent du parquet et des conseils de la victime : l'enquêteur documente les faits, sans porter de jugement sur la décision de payer.`,
      },
      {
        type: 'callout',
        kind: 'field',
        title: 'Sur le terrain : la traçabilité paie',
        md: `En 2021, après l'attaque d'un grand opérateur d'oléoduc aux États-Unis, le département de la Justice américain a annoncé avoir saisi environ 63,7 des 75 BTC versés, en suivant la rançon jusqu'à une adresse dont il avait obtenu la clé. Même sans issue aussi spectaculaire, chaque point de sortie vers un service régulé est une occasion de gel et d'identification d'un affilié.`,
      },
      {
        type: 'callout',
        kind: 'tip',
        title: 'Même sans paiement',
        md: `L'adresse figurant dans une note de rançon est utile même si la victime n'a pas payé : elle peut avoir été réutilisée pour d'autres victimes et rattacher l'attaque à un groupe connu. Transmettez-la aux structures spécialisées.`,
      },
      {
        type: 'check',
        q: `Les fonds d'une part affilié sont immobiles depuis huit mois. Que faire ?`,
        options: [
          `Clore la trace : les fonds sont perdus`,
          `Envoyer un message on-chain aux auteurs`,
          `Mettre en place des alertes sur les adresses pour réagir dès un mouvement`,
          `Demander au réseau Bitcoin de geler l'adresse`,
        ],
        answer: 2,
        explain: `La dormance est fréquente. Une surveillance permet d'intervenir au moment de la sortie vers un service (gel, réquisition).`,
      },
    ],
    keyPoints: [
      `RaaS : opérateurs (logiciel, infrastructure, portail) et affiliés (intrusions) se partagent chaque rançon.`,
      `Adresse de rançon unique par victime, puis transaction de partage à proportion fixe (ex. 80/20).`,
      `L'adresse des opérateurs reçoit la part de nombreuses victimes : elle relie les attaques et mesure la campagne.`,
      `Le payeur on-chain est souvent un intermédiaire : ses justificatifs relient le paiement à la victime.`,
      `Blanchiment : peel chains, mixeurs, chain hopping, XMR, OTC, dormance (surveiller les adresses).`,
      `Recueillir note, négociation, adresse, txid et, pour XMR, la clé de transaction.`,
      `Le paiement est juridiquement sensible (sanctions, assurance) : documenter sans juger.`,
    ],
    quiz: [
      {
        q: `Pourquoi l'adresse qui reçoit la part des opérateurs est-elle précieuse ?`,
        options: [
          `Elle appartient à la victime`,
          `Elle est automatiquement gelée par le réseau`,
          `Elle reçoit la commission de nombreuses attaques et relie les victimes d'un même groupe`,
          `Elle ne reçoit jamais de fonds`,
        ],
        answer: 2,
        explain: `Les opérateurs centralisent les commissions : leur adresse est un point de convergence entre affaires.`,
      },
      {
        q: `Le paiement a été effectué par un négociateur depuis son compte d'exchange. Conséquence ?`,
        options: [
          `Le payeur on-chain est l'intermédiaire : ses justificatifs rattachent le paiement à la victime`,
          `La victime n'est plus concernée par la procédure`,
          `Le paiement est juridiquement nul`,
          `Les fonds sont automatiquement gelés`,
        ],
        answer: 0,
        explain: `L'origine on-chain du paiement est le compte de l'intermédiaire ; facture et ordre d'achat documentent le lien avec la victime.`,
      },
      {
        kind: 'multi',
        q: `Quels éléments faut-il recueillir auprès d'une victime qui a payé une rançon ? (plusieurs réponses)`,
        options: [
          `La note de rançon et l'identifiant de victime`,
          `L'intégralité des échanges sur le portail de négociation`,
          `L'adresse de paiement et le txid`,
          `Le mot de passe de la messagerie personnelle du dirigeant`,
        ],
        answer: [0, 1, 2],
        explain: `Note, négociation, adresse et txid sont indispensables. Les identifiants personnels n'ont pas à être demandés.`,
      },
      {
        kind: 'truefalse',
        q: `Pour une rançon payée en Monero, la clé de transaction fournie par le payeur permet de prouver le paiement à une adresse donnée.`,
        options: ['Vrai', 'Faux'],
        answer: 0,
        explain: `Les montants et destinataires XMR sont masqués ; la clé de transaction permet de démontrer qu'un paiement donné a été fait vers une adresse précise.`,
      },
      {
        q: `Rançon de 12 BTC, partage observé : 9,6 BTC et 2,4 BTC. Quelle part revient vraisemblablement aux opérateurs ?`,
        options: ['9,6 BTC (80 %)', '2,4 BTC (20 %)', '12 BTC', '6 BTC'],
        answer: 1,
        explain: `Dans le modèle RaaS, la part minoritaire et récurrente vers une même adresse est la commission des opérateurs ; on le confirme par les autres partages vers cette adresse.`,
      },
      {
        kind: 'multi',
        q: `Quels circuits de blanchiment observe-t-on fréquemment sur les parts d'affiliés ? (plusieurs réponses)`,
        options: [
          `Peel chains vers des services`,
          `Passage par des mixeurs ou des CoinJoin`,
          `Conversion en Monero via des échangeurs`,
          `Remboursement spontané à la victime`,
        ],
        answer: [0, 1, 2],
        explain: `Peel chains, mixeurs et conversion en XMR sont classiques ; la dormance aussi.`,
      },
      {
        q: `Quelle est la position de l'enquêteur sur la décision de la victime de payer ?`,
        options: [
          `Il doit l'interdire`,
          `Il documente les faits ; les questions juridiques (sanctions, assurance) relèvent du parquet et des conseils de la victime`,
          `Il doit négocier à sa place`,
          `Il doit refuser la plainte si la victime a payé`,
        ],
        answer: 1,
        explain: `Les autorités recommandent de ne pas payer, mais l'enquêteur n'a pas à juger la décision : il recueille et documente les éléments.`,
      },
    ],
    flashcards: [
      { front: 'RaaS', back: `Ransomware-as-a-Service : opérateurs (logiciel, infrastructure) + affiliés (intrusions), partage de chaque rançon.` },
      { front: 'Double extorsion', back: `Chiffrement + menace de publier les données exfiltrées sur un site de fuite.` },
      { front: 'Transaction de partage', back: `Répartition rapide de la rançon à proportion fixe (ex. 80 % affilié / 20 % opérateurs).` },
      { front: 'Adresse des opérateurs', back: `Reçoit la commission de nombreuses victimes : relie les attaques d'un groupe.` },
      { front: 'Intermédiaire payeur', back: `Négociateur ou prestataire qui paie depuis son compte : ses justificatifs relient paiement et victime.` },
      { front: 'Rançon en XMR', back: `Recueillir la clé de transaction ; leviers sur l'achat des XMR et la négociation.` },
      { front: 'Dormance', back: `Fonds immobiles pendant des mois : poser des alertes pour réagir au mouvement.` },
      { front: 'Courtier d’accès initial', back: `Vend aux affiliés des accès à des réseaux déjà compromis.` },
      { front: 'Adresse dans une note non payée', back: `Utile quand même : peut relier l'attaque à d'autres victimes et à un groupe.` },
      { front: 'Paiement de rançon et droit', back: `Sujet sensible (sanctions, assurance) : l'enquêteur documente, le parquet apprécie.` },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // DARKNET
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'darknet',
    title: 'Marchés du darknet et séquestre',
    level: 3,
    track: 'typologies',
    minutes: 30,
    summary: `Fonctionnement financier d'une place de marché du darknet : comptes, dépôts, séquestre centralisé ou multisignature, finalisation anticipée, retraits des vendeurs, exit scams. Angles d'enquête côté acheteur et côté vendeur, pivots OSINT, achat sous pseudonyme et limites de l'analyse.`,
    objectives: [
      `Décrire le circuit financier d'un marché darknet (dépôts, balayage, séquestre, commission, retraits).`,
      `Distinguer séquestre centralisé, séquestre multisignature 2-sur-3 et finalisation anticipée.`,
      `Identifier des acheteurs à partir de leurs dépôts depuis des exchanges régulés.`,
      `Reconstituer le chiffre d'affaires d'un vendeur et ses sorties, en croisant OSINT et logistique.`,
      `Mesurer les limites : marchés en Monero, attributions incertaines, exposition indirecte.`,
    ],
    prerequisites: ['clustering', 'exchanges', 'osint', 'exposition-risque', 'chain-hopping'],
    practice: ['darknet-vendor'],
    blocks: [
      {
        type: 'text',
        md: `Une place de marché du darknet ressemble, financièrement, à un **exchange custodial clandestin**. Chaque utilisateur a un compte, une adresse de dépôt et un solde ; la plateforme regroupe les fonds dans ses propres portefeuilles, garde le prix des commandes en **séquestre** et prélève sa commission.

Ce fonctionnement a une conséquence majeure : on ne remonte pas « de l'achat au vendeur » en suivant la chaîne, parce que le séquestre est un portefeuille commun qui paie tout le monde. Il faut un **point d'entrée** de chaque côté : un acheteur, un vendeur, ou la plateforme elle-même.`,
      },
      { type: 'heading', text: 'Le modèle financier d’une place de marché' },
      {
        type: 'flow',
        caption: `Circuit type (Hydra Market) : l'acheteur dépose, le séquestre centralisé garde le prix, le vendeur est payé à la finalisation, moins la commission.`,
        nodes: [
          { id: 'cex', label: 'Exchange régulé', kind: 'exchange', sub: 'compte de l’acheteur' },
          { id: 'bd', label: 'Dépôt acheteur', kind: 'deposit', sub: 'Obsidian' },
          { id: 'esc', label: 'Séquestre Obsidian', kind: 'hot', sub: 'paie tous les vendeurs' },
          { id: 'vw', label: 'Portefeuille vendeur', kind: 'suspect' },
          { id: 'p2p', label: 'Hodl Hodl', kind: 'service', sub: 'P2P' },
          { id: 'sw', label: 'ChangeNOW', kind: 'exchange', sub: 'BTC → LTC' },
          { id: 'cv', label: 'Coinhouse', kind: 'exchange', sub: 'KYC' },
        ],
        edges: [
          { from: 'cex', to: 'bd', label: 'retrait BTC' },
          { from: 'bd', to: 'esc', label: 'balayage' },
          { from: 'esc', to: 'vw', label: 'libération − commission' },
          { from: 'vw', to: 'p2p', label: 'ventes P2P' },
          { from: 'vw', to: 'sw', label: 'swap' },
          { from: 'vw', to: 'cv', label: 'dépôt' },
        ],
      },
      {
        type: 'terms',
        items: [
          { term: 'Séquestre (escrow)', def: `Le prix de la commande est bloqué par la plateforme jusqu'à la confirmation de réception par l'acheteur.` },
          { term: 'Finalisation', def: `Confirmation par l'acheteur, qui libère les fonds au vendeur (moins la commission de la plateforme).` },
          { term: 'Finalisation anticipée (FE)', def: `Libération des fonds au vendeur avant l'expédition, exigée par certains vendeurs « de confiance ».` },
          { term: 'Multisignature 2-sur-3', def: `Les fonds sont bloqués sur une adresse qui exige 2 signatures sur 3 (acheteur, vendeur, plateforme).` },
          { term: 'Caution vendeur (vendor bond)', def: `Somme versée par un vendeur pour ouvrir sa boutique : un paiement identifiable.` },
          { term: 'Exit scam', def: `La plateforme ferme brutalement en conservant les fonds en séquestre et les soldes des utilisateurs.` },
          { term: 'Clé PGP', def: `Clé de chiffrement et de signature utilisée par les vendeurs pour communiquer et prouver leur identité numérique d'une plateforme à l'autre.` },
        ],
      },
      {
        type: 'compare',
        left: {
          title: 'Séquestre centralisé',
          md: `- La plateforme détient seule les fonds.
- Cluster reconnaissable (comme un exchange), qui paie tous les vendeurs.
- Risque d'exit scam élevé.
- Vendeurs payés depuis des adresses communes.`,
        },
        right: {
          title: 'Séquestre multisignature 2-sur-3',
          md: `- Une adresse multisignature par commande.
- La plateforme ne peut pas partir seule avec les fonds.
- Chaque libération est une transaction distincte, parfois plus facile à rattacher à une commande.
- Plus contraignant, moins répandu.`,
        },
      },
      { type: 'widget', id: 'exchange-flow', caption: `Un marché darknet fonctionne comme un exchange : dépôt de l'utilisateur, balayage, portefeuille central. Retrouvez chaque étape.` },
      {
        type: 'check',
        q: `Peut-on suivre sur la chaîne les fonds d'un achat précis jusqu'au vendeur, à travers le séquestre centralisé ?`,
        options: [
          `Oui, la transaction de libération reprend toujours l'adresse de l'acheteur`,
          `Non : le séquestre est un portefeuille commun ; il faut un point d'entrée côté vendeur (ou une corrélation avec l'heure de finalisation)`,
          `Oui, grâce au nonce`,
          `Non, et aucune autre méthode n'existe`,
        ],
        answer: 1,
        explain: `Le séquestre centralisé mélange les fonds de tous les acheteurs. Un achat sous pseudonyme permet en revanche de corréler la libération avec l'heure de finalisation et le montant.`,
      },
      { type: 'heading', text: 'Côté acheteur' },
      {
        type: 'text',
        md: `Beaucoup d'acheteurs alimentent leur compte **directement depuis un exchange régulé**, ou via un unique portefeuille intermédiaire. Les outils d'analyse font apparaître une **exposition directe** (retrait du compte client vers une adresse de dépôt du marché) ou indirecte.

La réquisition de l'exchange donne l'identité, les adresses IP de connexion et l'historique des retraits. Les montants (souvent quelques dizaines à quelques centaines d'euros, récurrents) et leur fréquence renseignent sur une consommation personnelle ou une activité de revente.`,
      },
      {
        type: 'case',
        title: 'Cas pratique — 14 retraits vers Obsidian',
        md: `L'outil signale qu'un compte client Coinhouse a effectué, entre janvier et juin, **14 retraits** vers des adresses directement balayées dans le cluster Hydra Market : de 0,0021 à 0,0185 BTC (environ 120 à 1 100 €), en moyenne tous les douze jours, avec une hausse nette en mai.

Réquisition de Coinhouse : identité, IP de connexion, moyens de paiement. L'analyse de la fréquence et des montants, croisée avec la surveillance des colis à l'adresse du titulaire, oriente vers une activité de revente locale.`,
      },
      { type: 'heading', text: 'Côté vendeur' },
      {
        type: 'steps',
        items: [
          { title: `Obtenir un point d'entrée`, md: `Achat sous pseudonyme (cadre légal à respecter), adresse de retrait publiée, saisie chez un acheteur, données de démantèlement.` },
          { title: 'Corréler la libération', md: `Après un achat sous pseudonyme, la libération du séquestre suit la finalisation : cherchez une sortie du séquestre au montant attendu (prix − commission) juste après l'heure de confirmation.` },
          { title: 'Reconstituer le portefeuille', md: `Depuis l'adresse de réception identifiée : regroupements (entrées communes), rendus, autres libérations reçues du séquestre.` },
          { title: `Chiffrer l'activité`, md: `Somme des libérations reçues sur la période : c'est le **chiffre d'affaires** net de commission du vendeur.` },
          { title: 'Suivre les sorties', md: `P2P, échangeurs (y compris vers d'autres chaînes, comme Litecoin), exchanges régulés : chaque service KYC est une cible de réquisition.` },
          { title: 'Croiser', md: `Avec l'OSINT (pseudonyme, PGP) et la logistique (envois postaux, points relais).` },
        ],
      },
      {
        type: 'table',
        caption: 'Pivots OSINT côté vendeur',
        headers: ['Pivot', 'Ce qu’il relie', 'Précaution'],
        rows: [
          ['Pseudonyme de vendeur', 'Boutiques sur plusieurs marchés et forums', 'Un pseudonyme peut être usurpé'],
          ['Empreinte de clé PGP', 'Identité numérique stable d’une plateforme à l’autre', 'Comparer l’empreinte complète, pas le nom'],
          ['Messages signés', 'Annonces, adresses de retrait publiées, changements de plateforme', 'Vérifier la signature'],
          ['Photos de produits', 'Métadonnées, décor, objets identifiables', 'Métadonnées souvent supprimées'],
          ['Avis clients', 'Volume d’activité, zones de livraison, délais', 'Avis parfois achetés'],
          ['Emballages et envois', 'Bureaux de dépôt, habitudes logistiques', 'Coordination avec les services compétents'],
        ],
      },
      {
        type: 'case',
        title: 'Cas pratique — le vendeur et son erreur de KYC',
        md: `Achat sous pseudonyme de 0,0412 BTC, finalisé le 9 février à 18:20 UTC. À 18:34, le séquestre Obsidian libère **0,0391 BTC** (prix − 5 % de commission) vers \`bc1q…v3n\`. Cette adresse est ensuite regroupée avec 37 autres adresses ayant reçu des libérations du séquestre : **2,86 BTC** de chiffre d'affaires en quatre mois.

Sorties : 0,9 BTC vendus sur Hodl Hodl, 1,1 BTC convertis en Litecoin via ChangeNOW (corrélation : un seul candidat sur 96 sorties LTC dans la fenêtre), et **0,64 BTC déposés chez Coinhouse** sur un compte vérifié. La clé PGP publiée sur le forum est identique à celle de la boutique Obsidian.

Stratégie : réquisition de Coinhouse en priorité (identité, IP), demande à ChangeNOW avec le hash du dépôt, puis Hodl Hodl.`,
      },
      { type: 'heading', text: 'Les limites de l’analyse' },
      {
        type: 'table',
        caption: 'Limites et parades',
        headers: ['Limite', 'Conséquence', 'Parade'],
        rows: [
          ['Marchés acceptant uniquement le Monero', 'Analyse interne impossible', 'Points d’entrée et de sortie transparents (achat des XMR, conversions)'],
          ['Attribution de cluster incertaine', 'Risque de confondre marché et service de mixage utilisé par le marché', 'Vérifier date, source et méthode d’attribution'],
          ['Exposition indirecte', 'Plusieurs sauts entre une personne et le marché', 'Ne jamais conclure à un achat sur cette seule base'],
          ['Commerce sur messageries chiffrées', 'Paiement direct au vendeur, sans séquestre', 'Adresses de paiement communiquées, saisies d’appareils'],
          ['Exit scam', 'Fonds de la plateforme déplacés en masse', 'Surveiller les portefeuilles centraux, rapprocher des victimes'],
        ],
      },
      { type: 'widget', id: 'risk-exposure', caption: `Distinguez exposition directe et indirecte à un marché : la seconde est un signal, pas une preuve d'achat.` },
      {
        type: 'callout',
        kind: 'warn',
        title: 'Exposition indirecte ≠ achat',
        md: `Une adresse exposée à 4 % à un marché darknet, à trois sauts, n'établit **pas** que son titulaire a acheté quoi que ce soit : il a pu recevoir des fonds d'une personne qui, elle-même, a reçu d'un vendeur. Seule une exposition **directe** (dépôt vers une adresse du marché) est un indice sérieux, à confirmer par d'autres éléments.`,
      },
      {
        type: 'callout',
        kind: 'example',
        title: 'Démantèlements historiques',
        md: `Silk Road (2013), AlphaBay (2017) et Hydra (2022) figurent parmi les grandes plateformes démantelées. Lors de la fermeture d'Hydra, les autorités allemandes ont annoncé la saisie des serveurs et de bitcoins d'une valeur d'environ 23 millions d'euros. Les bases saisies (comptes, adresses de dépôt, messages, clés PGP) alimentent ensuite des enquêtes dans de nombreux pays.`,
      },
      {
        type: 'callout',
        kind: 'law',
        title: 'Cadre juridique',
        md: `Les achats sous pseudonyme sont encadrés par le code de procédure pénale (enquête sous pseudonyme, article 230-46, pour les infractions et dans les conditions qu'il prévoit) : le cadre, les autorisations et la traçabilité des actes doivent être vérifiés avant toute opération. Les qualifications envisageables (trafic de stupéfiants, blanchiment, association de malfaiteurs…) relèvent du magistrat. Vérifiez les textes en vigueur.`,
      },
      {
        type: 'callout',
        kind: 'field',
        title: 'Sur le terrain',
        md: `Croisez toujours la piste financière et la piste logistique : un vendeur identifié par ses retraits se confirme par ses envois, et inversement. Les dates de libération du séquestre correspondent souvent, à quelques jours près, aux dates de dépôt des colis.`,
      },
      {
        type: 'check',
        q: `Quel élément OSINT relie le plus solidement un vendeur à travers plusieurs plateformes ?`,
        options: [
          `Le nom de sa boutique`,
          `Le prix de ses produits`,
          `La couleur de son logo`,
          `L'empreinte complète de sa clé PGP`,
        ],
        answer: 3,
        explain: `Les vendeurs réutilisent leur clé PGP pour conserver leur réputation ; l'empreinte complète est difficile à usurper, contrairement à un nom.`,
      },
    ],
    keyPoints: [
      `Un marché darknet fonctionne comme un exchange custodial clandestin : comptes, dépôts, balayage, séquestre, commission, retraits.`,
      `Le séquestre centralisé paie tous les vendeurs : on ne suit pas un achat jusqu'au vendeur sans point d'entrée.`,
      `Séquestre multisignature 2-sur-3, finalisation anticipée et exit scams sont des variantes à connaître.`,
      `Côté acheteur : dépôts directs depuis des exchanges régulés, identifiables par réquisition.`,
      `Côté vendeur : libérations du séquestre = chiffre d'affaires ; sorties vers P2P, échangeurs, exchanges.`,
      `Pivots OSINT : pseudonyme, empreinte PGP, messages signés ; toujours croiser avec la logistique.`,
      `Une exposition indirecte n'établit pas à elle seule un achat.`,
    ],
    quiz: [
      {
        q: `Qu'est-ce que la « finalisation anticipée » (finalize early) ?`,
        options: [
          `La fermeture définitive du marché`,
          `Un remboursement automatique de l'acheteur`,
          `La libération des fonds au vendeur avant la réception de la marchandise`,
          `Un CoinJoin organisé par la plateforme`,
        ],
        answer: 2,
        explain: `L'acheteur renonce à la protection du séquestre : le vendeur est payé avant l'expédition.`,
      },
      {
        q: `Dans un séquestre multisignature 2-sur-3, qui détient les clés ?`,
        options: [
          `Le vendeur seul`,
          `L'acheteur, le vendeur et la plateforme ; deux signatures sur trois suffisent à libérer les fonds`,
          `La plateforme seule`,
          `Un notaire désigné`,
        ],
        answer: 1,
        explain: `Deux des trois parties doivent signer, ce qui empêche la plateforme de partir seule avec les fonds.`,
      },
      {
        kind: 'multi',
        q: `Un compte client d'exchange a effectué 14 retraits vers des adresses de dépôt d'un marché. Quelles suites donner ? (plusieurs réponses)`,
        options: [
          `Réquisition de l'exchange : identité, IP de connexion, historique des retraits`,
          `Analyse des montants et de la fréquence (consommation ou revente)`,
          `Réquisition du marché darknet`,
          `Croisement avec d'autres éléments (logistique, téléphonie) avant toute conclusion`,
        ],
        answer: [0, 1, 3],
        explain: `L'exchange identifie le titulaire ; montants et fréquence orientent ; d'autres éléments confirment. On ne « requiert » pas un marché clandestin.`,
      },
      {
        kind: 'truefalse',
        q: `Une adresse exposée indirectement (à trois sauts) à un marché darknet appartient forcément à un acheteur de ce marché.`,
        options: ['Vrai', 'Faux'],
        answer: 1,
        explain: `L'exposition indirecte peut résulter de flux sans lien avec un achat. Seule une exposition directe est un indice sérieux, à confirmer.`,
      },
      {
        q: `Après un achat sous pseudonyme finalisé à 18:20 UTC, comment trouver l'adresse du vendeur ?`,
        options: [
          `En cherchant une sortie du séquestre au montant attendu (prix − commission) juste après la finalisation`,
          `En suivant le dépôt de l'acheteur jusqu'au vendeur à travers le séquestre`,
          `En demandant l'adresse au marché`,
          `C'est impossible`,
        ],
        answer: 0,
        explain: `La libération suit la finalisation : la corrélation montant/heure donne un candidat, à confirmer par le regroupement avec d'autres libérations.`,
      },
      {
        kind: 'multi',
        q: `Comment reconstituer le chiffre d'affaires d'un vendeur ? (plusieurs réponses)`,
        options: [
          `Identifier ses adresses de réception (regroupements, rendus)`,
          `Sommer les libérations reçues du séquestre sur la période`,
          `Multiplier le nombre d'avis clients par un prix moyen, sans autre élément`,
          `Distinguer ces libérations des autres entrées du portefeuille`,
        ],
        answer: [0, 1, 3],
        explain: `Le chiffre d'affaires net de commission se mesure par les libérations du séquestre vers les adresses du vendeur. Les avis ne sont qu'un indicateur d'appoint.`,
      },
      {
        q: `Pourquoi les marchés « Monero uniquement » compliquent-ils l'analyse ?`,
        options: [
          `Parce qu'ils sont tous situés en Europe`,
          `Parce que le Monero n'a pas de blockchain`,
          `Parce qu'ils utilisent des destination tags`,
          `Parce que les montants et les destinataires sont masqués on-chain : seuls les points d'entrée et de sortie transparents restent exploitables`,
        ],
        answer: 3,
        explain: `Le Monero masque montants, expéditeurs et destinataires. On travaille sur l'achat des XMR et leurs conversions vers des actifs transparents.`,
      },
    ],
    flashcards: [
      { front: 'Marché darknet, modèle financier', back: `Exchange custodial clandestin : comptes, dépôts balayés, séquestre, commission, retraits.` },
      { front: 'Séquestre (escrow)', back: `Prix bloqué par la plateforme jusqu'à la confirmation de réception par l'acheteur.` },
      { front: 'Finalisation anticipée (FE)', back: `Le vendeur est payé avant l'expédition ; l'acheteur renonce à la protection.` },
      { front: 'Multisignature 2-sur-3', back: `Acheteur, vendeur, plateforme : deux signatures suffisent à libérer les fonds.` },
      { front: 'Exit scam', back: `Fermeture brutale de la plateforme qui conserve séquestres et soldes.` },
      { front: 'Trouver le vendeur après un achat sous pseudonyme', back: `Sortie du séquestre au montant (prix − commission) juste après la finalisation.` },
      { front: 'Chiffre d’affaires d’un vendeur', back: `Somme des libérations du séquestre reçues sur ses adresses.` },
      { front: 'Pivot OSINT le plus solide', back: `L'empreinte complète de la clé PGP, réutilisée d'une plateforme à l'autre.` },
      { front: 'Exposition indirecte à un marché', back: `Signal à vérifier, jamais preuve d'achat à elle seule.` },
      { front: 'Achat sous pseudonyme', back: `Encadré par le CPP (art. 230-46, à vérifier) : autorisations et traçabilité.` },
    ],
  },
]
