// Affaire décryptée — niveau 4 : le piratage du bridge Ronin (mars 2022).
// Affaire RÉELLE : seuls les faits établis par des sources publiques
// (communiqués du FBI et du Trésor américain, post-mortem de l'opérateur,
// autorités norvégiennes, presse de référence) sont rapportés ; ce qui n'a pu
// être confirmé est marqué « (à vérifier) ». La mission associée est fictive.
import type { Lesson } from '../model'

export const LESSON_AFFAIRE_RONIN: Lesson = {
  id: 'affaire-ronin',
  title: 'Affaire décryptée : le piratage du bridge Ronin',
  level: 4,
  track: 'affaires',
  minutes: 40,
  summary: `Le 23 mars 2022, un attaquant retire du bridge de la sidechain Ronin (jeu Axie Infinity) environ 173 600 ETH et 25,5 millions d'USDC, soit plus de 600 millions de dollars au cours de l'époque. Aucune faille de code : l'attaquant détient 5 des 9 clés de validateurs, le seuil exigé, et ses retraits sont parfaitement valides. Le vol n'est découvert que six jours plus tard. En avril, le FBI l'attribue au groupe nord-coréen Lazarus. Suivent Tornado Cash, le passage vers Bitcoin, des mixeurs sanctionnés et des saisies partielles. Un dossier d'école sur la compromission de clés, la détection tardive et le blanchiment étatique.`,
  objectives: [
    `Retracer l'affaire Ronin, de la compromission des clés de validateurs aux saisies de 2022 et 2023.`,
    `Expliquer pourquoi un bridge à validateurs est un multisig géant, et pourquoi un retrait signé par des clés volées est indiscernable d'un retrait légitime.`,
    `Décrire le circuit de blanchiment documenté publiquement : dispersion, exchanges, Tornado Cash, conversion vers Bitcoin, mixeurs.`,
    `Mesurer le rôle des actions publiques (attribution du FBI, désignations de l'OFAC) dans le traçage et le gel.`,
    `Transposer les enseignements à une enquête sur un bridge compromis : signataires, surveillance, réquisitions, sanctions.`,
  ],
  prerequisites: ['bridges', 'privacy-pools', 'acteurs-etatiques'],
  practice: ['bridge-validateurs'],
  blocks: [
    {
      type: 'text',
      md: `**Pourquoi étudier ce dossier ?** Parce qu'il réunit, en une seule affaire, presque tout ce qu'un analyste doit savoir des vols de grande ampleur : une attaque **hors chaîne** (hameçonnage ciblé d'un employé) qui produit des transactions **valides sur la chaîne**, un délai de détection de six jours, un acteur **étatique** identifié publiquement, et un blanchiment qui enchaîne les outils étudiés dans les leçons précédentes : dispersion, exchanges, pool de confidentialité, saut de chaîne, mixeurs Bitcoin.

**Le contexte.** **Ronin** est une sidechain compatible EVM créée par le studio vietnamien **Sky Mavis** pour son jeu **Axie Infinity**, alors au sommet de sa popularité. Pour faire passer des ETH et des USDC d'Ethereum vers Ronin, les joueurs utilisent le **bridge Ronin** : un contrat sur Ethereum verrouille les fonds, et l'équivalent est émis sur Ronin. Pour **retirer** des fonds du contrat Ethereum, il faut les signatures de **5 validateurs sur 9**. Le bridge est donc, en pratique, un **coffre multisignature 5-sur-9** contenant des centaines de millions de dollars.`,
    },
    { type: 'heading', text: 'Chronologie' },
    {
      type: 'steps',
      items: [
        { title: 'Novembre-décembre 2021 — une autorisation oubliée', md: `Pour absorber un pic d'activité, l'**Axie DAO** autorise temporairement Sky Mavis à signer des transactions en son nom. Selon le post-mortem et la presse, la pratique cesse en décembre 2021, mais l'autorisation (« allowlist ») **n'est pas révoquée**. Sky Mavis opère alors 4 des 9 validateurs ; avec la signature de l'Axie DAO, quiconque contrôle l'infrastructure de Sky Mavis atteint le seuil de 5.` },
        { title: 'Avant mars 2022 — l’hameçonnage ciblé', md: `Selon le post-mortem de Sky Mavis, des employés sont la cible d'attaques d'hameçonnage ciblé et l'un d'eux est compromis. La presse spécialisée (The Block, juillet 2022) rapporte qu'un ingénieur aurait été approché pour une **fausse offre d'emploi** et aurait ouvert un document PDF piégé.` },
        { title: '23 mars 2022 — les retraits', md: `Avec 5 signatures valides (4 clés de Sky Mavis et la signature de l'Axie DAO obtenue via l'autorisation non révoquée), l'attaquant retire du contrat du bridge sur Ethereum **173 600 ETH** et **25,5 millions d'USDC**, vers une adresse qu'il contrôle.` },
        { title: '29 mars 2022 — la découverte', md: `Le vol est découvert lorsqu'un utilisateur **ne parvient pas à retirer 5 000 ETH** du bridge. Sky Mavis rend l'incident public le jour même ; le bridge est suspendu.` },
        { title: 'Avril 2022 — attribution et financement', md: `Sky Mavis annonce une levée de **150 millions de dollars** menée par Binance pour rembourser les utilisateurs. Le **14 avril**, le FBI déclare que **Lazarus Group et APT38**, acteurs liés à la Corée du Nord, sont responsables du vol ; le même jour, l'OFAC ajoute l'adresse ayant reçu les fonds à l'entrée « Lazarus Group » de sa liste de sanctions.` },
        { title: '6 mai 2022 — Blender.io', md: `Le Trésor américain sanctionne le mixeur Bitcoin **Blender.io**, première désignation d'un mixeur, en indiquant qu'il a servi à traiter plus de **20,5 millions de dollars** de produits du vol de Ronin.` },
        { title: '28 juin 2022 — réouverture', md: `Le bridge rouvre après audit, avec davantage de validateurs (11 au redémarrage, selon la presse) et un mécanisme de limitation des gros retraits ; les utilisateurs sont remboursés.` },
        { title: '8 août 2022 — Tornado Cash', md: `L'OFAC désigne **Tornado Cash**, en indiquant que le service a servi à blanchir plus de **455 millions de dollars** volés par Lazarus Group lors du piratage de Ronin. Ces sanctions ont été levées en mars 2025, à la suite d'une décision de justice américaine.` },
        { title: 'Septembre 2022 — première saisie', md: `Chainalysis annonce que plus de **30 millions de dollars** issus du vol (environ 10 % selon son estimation) ont été saisis avec l'aide des autorités américaines : la première saisie de fonds volés par un groupe nord-coréen selon la société.` },
        { title: 'Février 2023 — la Norvège', md: `L'Økokrim (police économique norvégienne) annonce la saisie d'environ **60 millions de couronnes** (environ 5,9 millions de dollars) liés au vol, en coopération avec le FBI ; la somme est ensuite confisquée au profit de Ronin Network.` },
      ],
    },
    {
      type: 'callout',
      kind: 'example',
      title: 'L’adresse désignée par l’OFAC',
      md: `L'adresse Ethereum ajoutée le 14 avril 2022 à l'entrée « Lazarus Group » de la liste SDN, et qui a reçu les fonds retirés du bridge, est \`0x098B716B8Aaf21512996dC57EB0615e2383E2f96\`. À partir de cette date, toute personne soumise au droit américain qui traite avec elle s'expose à des sanctions : les plateformes régulées la bloquent, et chaque fonds qui en descend devient « exposé » au sens des outils d'analyse.`,
    },
    { type: 'heading', text: 'Le moment pivot : une signature valide, six jours de silence' },
    {
      type: 'case',
      title: 'Aucune faille de code',
      md: `Contrairement à beaucoup de piratages DeFi (erreur de logique, manipulation d'oracle, prêt éclair), **le contrat du bridge a fonctionné exactement comme prévu**. Il a reçu des demandes de retrait accompagnées de 5 signatures valides sur 9 et les a honorées. Vu de la chaîne, rien ne distinguait ces retraits d'opérations légitimes, sinon leur **montant** : la quasi-totalité des réserves du bridge, en deux opérations.

Trois enseignements :

1. **La sécurité d'un bridge à validateurs se résume à celle de ses clés.** Quatre clés détenues par une même entité et une délégation de signature oubliée ont suffi à ramener un 5-sur-9 à une seule organisation à compromettre.
2. **La détection n'est pas automatique.** Pendant six jours, personne n'a surveillé les réserves du contrat : c'est un utilisateur bloqué qui a donné l'alerte. Une simple alerte sur la variation des réserves aurait réduit la fenêtre d'action de l'attaquant.
3. **L'attribution publique change la donne.** Une fois l'adresse désignée par l'OFAC, les exchanges régulés n'ont plus aucune latitude : les dépôts deviennent risqués pour l'attaquant, qui se tourne vers les outils non custodiaux (Tornado Cash) et le saut vers Bitcoin.`,
    },
    {
      type: 'widget',
      id: 'bridge-flow',
      caption: `Rappel du fonctionnement d'un bridge à validateurs : l'événement de départ et la signature des validateurs déclenchent la libération des fonds à l'arrivée. Si les validateurs (ou leurs clés) sont compromis, un « retrait » peut être signé sans aucun dépôt correspondant.`,
    },
    {
      type: 'check',
      q: `Pourquoi les retraits frauduleux du 23 mars 2022 ont-ils été acceptés par le contrat du bridge ?`,
      options: [
        `Parce que le contrat contenait une faille de réentrance`,
        `Parce qu'ils portaient 5 signatures valides de validateurs sur les 9, le seuil exigé`,
        `Parce que les mineurs d'Ethereum les ont validés manuellement`,
        `Parce que l'oracle de prix a été manipulé`,
      ],
      answer: 1,
      explain: `L'attaquant contrôlait 4 clés de Sky Mavis et pouvait obtenir la signature de l'Axie DAO grâce à une autorisation non révoquée : le seuil de 5 sur 9 était atteint, le contrat a honoré les retraits.`,
    },
    { type: 'heading', text: 'Le circuit de blanchiment documenté publiquement' },
    {
      type: 'flow',
      caption: `Schéma simplifié établi d'après les communiqués du Trésor américain et les analyses publiques (2022). L'ordre et la simultanéité des étapes varient ; les montants intermédiaires ne sont pas tous publics.`,
      nodes: [
        { id: 'br', label: 'Bridge Ronin (Ethereum)', kind: 'bridge', sub: '23 mars 2022' },
        { id: 'atk', label: 'Adresse de l’attaquant', kind: 'suspect', sub: '0x098B…2f96 (SDN)' },
        { id: 'disp', label: 'Adresses de dispersion', kind: 'wallet', sub: 'fractionnement' },
        { id: 'cex', label: 'Exchanges centralisés', kind: 'exchange', sub: 'premiers dépôts, gels partiels' },
        { id: 'tc', label: 'Tornado Cash', kind: 'mixer', sub: '> 455 M$ selon le Trésor' },
        { id: 'swap', label: 'Conversion vers Bitcoin', kind: 'bridge', sub: 'jetons BTC enveloppés, DEX' },
        { id: 'btcmix', label: 'Mixeurs Bitcoin', kind: 'mixer', sub: 'Blender.io (> 20,5 M$)…' },
        { id: 'out', label: 'Sortie hors chaîne', kind: 'unknown', sub: 'OTC, intermédiaires' },
      ],
      edges: [
        { from: 'br', to: 'atk', label: '173 600 ETH + 25,5 M USDC' },
        { from: 'atk', to: 'disp' },
        { from: 'disp', to: 'cex', dashed: true },
        { from: 'disp', to: 'tc' },
        { from: 'tc', to: 'swap' },
        { from: 'swap', to: 'btcmix' },
        { from: 'btcmix', to: 'out', dashed: true },
      ],
    },
    {
      type: 'table',
      caption: 'Les étapes du blanchiment et ce qu’elles ont laissé aux enquêteurs',
      headers: ['Étape', 'Ce qui a été rapporté publiquement', 'Prise pour l’enquête'],
      rows: [
        ['Conversion des USDC', 'Les USDC sont échangés contre de l’ETH dans les premiers jours, selon les analyses publiques (à vérifier)', 'Un stablecoin centralisé est gelable par son émetteur : l’attaquant s’en débarrasse vite'],
        ['Dispersion', 'Fractionnement vers de nombreuses adresses intermédiaires', 'Arbre de dispersion traçable ; Chainalysis évoque plus de 12 000 adresses dans le blanchiment'],
        ['Exchanges centralisés', 'Des dépôts sont observés dans les premières semaines ; Binance annonce avoir gelé environ 5,8 M$ répartis sur 86 comptes (à vérifier)', 'Gels et données de comptes, même si les montants restent faibles'],
        ['Tornado Cash', 'Plus de 455 M$ blanchis selon le Trésor (août 2022)', 'Dépôts à dénomination fixe : analyses de montant et de délai, avec leurs limites'],
        ['Passage vers Bitcoin', 'Conversion d’une grande partie des ETH en jetons BTC enveloppés puis en BTC, selon les analystes (août 2022)', 'Changement de chaîne : suivre l’émission et le rachat des jetons enveloppés'],
        ['Mixeurs Bitcoin', 'Blender.io (> 20,5 M$ selon le Trésor) ; ChipMixer cité par des analystes', 'Services ensuite sanctionnés ou démantelés, dont les données peuvent être saisies'],
      ],
    },
    {
      type: 'callout',
      kind: 'warn',
      title: 'Montants : toujours dater et sourcer',
      md: `Les montants en dollars de l'affaire varient selon les sources (de 540 à 625 millions) parce qu'ils dépendent du cours retenu et de la date. Les quantités en actifs sont plus stables : **173 600 ETH** et **25,5 millions d'USDC** selon le post-mortem de l'opérateur. Dans un rapport, indiquez les quantités en actifs, puis la contre-valeur **avec sa date et sa source de cours**.`,
    },
    { type: 'heading', text: 'Ce que les auteurs ont bien fait, et ce qui les a trahis' },
    {
      type: 'compare',
      left: {
        title: 'Du point de vue de l’attaquant, ce qui a « fonctionné »',
        md: `- **Préparation hors chaîne** : hameçonnage ciblé, patience, exploitation d'une délégation oubliée.
- **Fenêtre de six jours** sans détection, pour disperser avant toute réaction.
- **Abandon rapide de l'USDC**, gelable, au profit de l'ETH.
- **Outils non custodiaux** (Tornado Cash) puis **changement de chaîne** vers Bitcoin.
- Volume tel que l'essentiel des fonds n'a pas été récupéré à ce jour, selon les informations publiques.`,
      },
      right: {
        title: 'Ce qui a laissé prise aux enquêteurs',
        md: `- **Adresse de réception unique et publique**, désignée par l'OFAC trois semaines après la découverte.
- **Premiers dépôts vers des exchanges centralisés**, partiellement gelés.
- Dépendance à des **services ensuite sanctionnés ou démantelés** (Blender.io, ChipMixer, Tornado Cash).
- **Points de conversion** vers Bitcoin (jetons enveloppés, DEX) traçables.
- Saisies successives aux États-Unis (2022) et en Norvège (2023), par la coopération internationale.`,
      },
    },
    {
      type: 'check',
      q: `Pourquoi l'attaquant a-t-il rapidement converti les 25,5 millions d'USDC dérobés ?`,
      options: [
        `Parce que l'USDC perdait de la valeur`,
        `Parce que l'USDC est un stablecoin centralisé dont l'émetteur peut geler les adresses, contrairement à l'ETH`,
        `Parce que Tornado Cash n'accepte que les USDC`,
        `Parce que les USDC ne peuvent pas quitter Ethereum`,
      ],
      answer: 1,
      explain: `L'émetteur d'un stablecoin centralisé peut bloquer une adresse. Conserver des USDC sur une adresse surveillée exposait l'attaquant à un gel ; l'ETH, actif natif, n'offre pas cette prise.`,
    },
    { type: 'heading', text: 'Ce que l’enquêteur peut transposer' },
    {
      type: 'steps',
      items: [
        { title: 'Lire un bridge comme un coffre multisignature', md: `Identifier le seuil (m sur n), qui détient chaque clé de validateur, et **quelles clés ont signé** chaque retrait suspect. Dans un bridge à validateurs, la transaction de retrait ou ses journaux portent en général la trace des signataires : c'est l'équivalent du témoin d'un multisig Bitcoin, et c'est là que se localise la compromission.` },
        { title: 'Rapprocher retraits et dépôts', md: `Un retrait légitime correspond à un dépôt (ou à une combustion) sur l'autre chaîne. Un retrait signé **sans dépôt correspondant** est la signature d'une compromission des validateurs.` },
        { title: 'Agir dans les premières heures', md: `Publier les adresses de l'attaquant, alerter les émetteurs de stablecoins et les exchanges, demander les gels : tout ce qui n'est pas fait avant la dispersion devient beaucoup plus difficile ensuite.` },
        { title: 'Suivre les changements de chaîne', md: `Repérer l'émission de jetons enveloppés, les dépôts sur des bridges et les DEX qui servent au saut vers Bitcoin, puis reprendre le traçage UTXO de l'autre côté.` },
        { title: 'Exploiter le cadre des sanctions', md: `Une désignation OFAC transforme les adresses en points de contrôle pour tout le secteur régulé. Vérifiez le régime applicable en France et dans l'Union (gels nationaux et européens), et mentionnez les désignations dans vos réquisitions.` },
        { title: 'Penser coopération internationale', md: `Les saisies de cette affaire ont été obtenues aux États-Unis et en Norvège. Les fonds traversent les juridictions ; l'entraide et les échanges entre cellules spécialisées sont la règle, pas l'exception.` },
      ],
    },
    {
      type: 'callout',
      kind: 'field',
      title: 'Mission d’entraînement : le « Nexus Bridge » (fictif)',
      md: `La mission associée transpose ce dossier dans un environnement **entièrement fictif** : le Nexus Bridge, protégé par un seuil de validateurs, est vidé par des retraits signés sans dépôt correspondant. À vous d'identifier les validateurs signataires, de suivre la dispersion, le passage par un pool de confidentialité et le saut de chaîne, et de désigner les points de gel et de réquisition. Aucune donnée de la mission ne correspond à l'affaire réelle.`,
    },
    {
      type: 'callout',
      kind: 'law',
      title: 'Sources',
      md: `- Sky Mavis / Ronin, « Back to Building: Ronin Security Breach Postmortem » (2022) : date de l'attaque, montants (173 600 ETH, 25,5 M USDC), 5 clés sur 9 (4 de Sky Mavis, 1 de l'Axie DAO), employé compromis par hameçonnage ciblé.
- FBI, déclaration du 14 avril 2022 attribuant le vol à Lazarus Group et APT38.
- Trésor américain (OFAC) : mise à jour de la liste SDN du 14 avril 2022 (adresse 0x098B…2f96) ; désignation de Blender.io (6 mai 2022) ; désignation de Tornado Cash (8 août 2022), levée en mars 2025.
- Chainalysis, annonce de septembre 2022 sur la saisie de plus de 30 M$.
- Økokrim, communiqué de février 2023 sur la saisie puis la confiscation d'environ 60 M NOK au profit de Ronin Network.
- Presse spécialisée (The Block, juillet 2022) sur la fausse offre d'emploi ; presse (Blockworks, Decrypt, Bloomberg) sur la levée de 150 M$ et la réouverture du bridge en juin 2022 ; analyses publiques d'août 2022 sur le passage vers Bitcoin.`,
    },
  ],
  keyPoints: [
    `23 mars 2022 : 173 600 ETH et 25,5 M USDC retirés du bridge Ronin (plus de 600 M$ au cours de l'époque), découverts le 29 mars, six jours plus tard.`,
    `Aucune faille de code : l'attaquant détenait 5 des 9 clés de validateurs (4 de Sky Mavis et une signature de l'Axie DAO via une autorisation non révoquée).`,
    `Vecteur initial : hameçonnage ciblé d'un employé de Sky Mavis (fausse offre d'emploi selon la presse).`,
    `14 avril 2022 : attribution par le FBI à Lazarus Group / APT38 ; désignation de l'adresse de réception par l'OFAC.`,
    `Blanchiment : dispersion, exchanges (gels partiels), Tornado Cash (> 455 M$ selon le Trésor), passage vers Bitcoin, mixeurs dont Blender.io (> 20,5 M$).`,
    `Récupérations partielles : environ 30 M$ saisis en 2022 (États-Unis), environ 60 M NOK en 2023 (Norvège) ; utilisateurs remboursés par Sky Mavis.`,
    `Transposer : lire un bridge comme un multisig, identifier les signataires, rapprocher retraits et dépôts, agir avant la dispersion.`,
  ],
  quiz: [
    {
      q: `Quels actifs ont été retirés du bridge Ronin le 23 mars 2022, selon le post-mortem de l'opérateur ?`,
      options: [
        `119 754 BTC`,
        `Environ 173 600 ETH et 25,5 millions d'USDC`,
        `401 000 ETH`,
        `625 millions d'USDT`,
      ],
      answer: 1,
      explain: `Le post-mortem de Sky Mavis fait état de 173 600 ETH et de 25,5 millions d'USDC, soit plus de 600 millions de dollars au cours de l'époque.`,
    },
    {
      q: `Combien de signatures de validateurs fallait-il pour retirer des fonds du bridge, et combien l'attaquant en contrôlait-il ?`,
      options: [
        `2 sur 3 ; il en contrôlait 2`,
        `5 sur 9 ; il en contrôlait 5 (4 clés de Sky Mavis et la signature de l'Axie DAO)`,
        `9 sur 9 ; il en contrôlait 9`,
        `1 sur 1 ; il a volé la clé unique`,
      ],
      answer: 1,
      explain: `Le seuil était de 5 sur 9. Sky Mavis opérait 4 validateurs et disposait encore d'une autorisation de signer pour l'Axie DAO, jamais révoquée : la compromission d'une seule organisation suffisait.`,
    },
    {
      kind: 'truefalse',
      q: `Le piratage de Ronin résulte d'une erreur de programmation du contrat du bridge.`,
      options: ['Vrai', 'Faux'],
      answer: 1,
      explain: `Le contrat a fonctionné comme prévu : il a honoré des retraits accompagnés de signatures valides. La faille était organisationnelle et opérationnelle (concentration des clés, autorisation non révoquée, hameçonnage).`,
    },
    {
      q: `Comment le vol a-t-il été découvert ?`,
      options: [
        `Par une alerte automatique de surveillance des réserves, dans la minute`,
        `Par le FBI, le jour même`,
        `Six jours plus tard, lorsqu'un utilisateur n'a pas pu retirer 5 000 ETH du bridge`,
        `Par la revendication publique des auteurs`,
      ],
      answer: 2,
      explain: `L'attaque du 23 mars n'a été remarquée que le 29 mars, à la suite de l'échec d'un retrait de 5 000 ETH : aucune surveillance des réserves n'avait donné l'alerte.`,
    },
    {
      q: `À quel groupe le FBI a-t-il attribué le vol, et quand ?`,
      options: [
        `À un groupe de rançongiciel russe, en mars 2022`,
        `À Lazarus Group et APT38, acteurs liés à la Corée du Nord, le 14 avril 2022`,
        `À un employé isolé, en juin 2022`,
        `Le FBI n'a jamais attribué ce vol`,
      ],
      answer: 1,
      explain: `Le 14 avril 2022, le FBI a déclaré que Lazarus Group et APT38 étaient responsables du vol ; l'OFAC a désigné le même jour l'adresse de réception.`,
    },
    {
      kind: 'multi',
      q: `Quels éléments du circuit de blanchiment figurent dans les communiqués officiels du Trésor américain ? (plusieurs réponses)`,
      options: [
        `Tornado Cash, utilisé pour blanchir plus de 455 millions de dollars du vol`,
        `Blender.io, utilisé pour traiter plus de 20,5 millions de dollars du vol`,
        `L'adresse de réception des fonds, ajoutée à l'entrée Lazarus Group de la liste SDN`,
        `Un faux stablecoin émis par les auteurs`,
      ],
      answer: [0, 1, 2],
      explain: `Les trois premiers éléments proviennent des actions de l'OFAC (avril, mai et août 2022). Aucune émission de stablecoin n'est mentionnée.`,
    },
    {
      q: `Pourquoi la désignation de l'adresse de l'attaquant par l'OFAC a-t-elle compliqué le blanchiment ?`,
      options: [
        `Parce qu'elle a bloqué techniquement l'adresse sur Ethereum`,
        `Parce que les acteurs régulés ne peuvent plus traiter avec cette adresse ni avec les fonds qui en proviennent, ce qui pousse l'attaquant vers des outils non custodiaux`,
        `Parce qu'elle a annulé les transactions passées`,
        `Parce qu'elle a révélé la clé privée`,
      ],
      answer: 1,
      explain: `Une sanction n'a aucun effet technique sur la chaîne ; elle agit sur les intermédiaires régulés, qui doivent bloquer l'adresse et les fonds exposés.`,
    },
    {
      kind: 'multi',
      q: `Quelles récupérations partielles sont publiquement documentées ? (plusieurs réponses)`,
      options: [
        `Plus de 30 millions de dollars saisis en 2022 avec l'aide de Chainalysis et des autorités américaines`,
        `Environ 60 millions de couronnes saisis par l'Økokrim et confisqués au profit de Ronin Network`,
        `La restitution intégrale des fonds par les auteurs`,
        `Le gel de l'intégralité des ETH par Ethereum`,
      ],
      answer: [0, 1],
      explain: `Les saisies américaine (2022) et norvégienne (2023) sont documentées. Il n'y a eu ni restitution par les auteurs ni « gel » par le réseau Ethereum, qui n'a pas ce pouvoir.`,
    },
    {
      q: `Face à un bridge à validateurs vidé, quelle vérification on-chain permet de qualifier rapidement une compromission des validateurs ?`,
      options: [
        `Vérifier le taux de frais des retraits`,
        `Constater que les retraits sont signés par le seuil de validateurs sans dépôt ni combustion correspondants sur l'autre chaîne, et identifier les validateurs signataires`,
        `Compter le nombre de jetons émis sur l'autre chaîne`,
        `Interroger un explorateur Bitcoin`,
      ],
      answer: 1,
      explain: `Un retrait légitime répond à un dépôt. Un retrait valide sans contrepartie trahit des signatures obtenues frauduleusement ; les signataires localisent les clés compromises.`,
    },
  ],
  flashcards: [
    { front: 'Ronin', back: `Sidechain EVM de Sky Mavis pour Axie Infinity ; bridge avec Ethereum protégé par 5 signatures sur 9 validateurs.` },
    { front: 'Montants dérobés', back: `173 600 ETH et 25,5 M USDC, le 23 mars 2022 (plus de 600 M$ au cours de l'époque).` },
    { front: 'Clés compromises', back: `5 sur 9 : 4 validateurs de Sky Mavis + la signature de l'Axie DAO via une autorisation de 2021 non révoquée.` },
    { front: 'Vecteur initial', back: `Hameçonnage ciblé d'un employé de Sky Mavis ; fausse offre d'emploi et PDF piégé selon la presse.` },
    { front: 'Découverte', back: `29 mars 2022, six jours après : un utilisateur ne parvient pas à retirer 5 000 ETH.` },
    { front: 'Attribution', back: `FBI, 14 avril 2022 : Lazarus Group et APT38 (Corée du Nord). Adresse de réception désignée par l'OFAC le même jour.` },
    { front: 'Tornado Cash et Ronin', back: `OFAC, 8 août 2022 : plus de 455 M$ du vol blanchis via Tornado Cash (sanctions levées en mars 2025).` },
    { front: 'Blender.io', back: `Premier mixeur sanctionné par l'OFAC (6 mai 2022) : plus de 20,5 M$ du vol de Ronin traités.` },
    { front: 'Saisies', back: `Plus de 30 M$ (États-Unis, septembre 2022) ; environ 60 M NOK (Økokrim, février 2023), confisqués au profit de Ronin Network.` },
    { front: 'Leçon principale', back: `Un bridge à validateurs est un multisig : sa sécurité est celle de ses clés. Un retrait signé sans dépôt correspondant = compromission.` },
  ],
}
