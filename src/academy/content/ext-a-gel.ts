// Niveau 3 — Stablecoins : listes noires des émetteurs, gel au niveau du
// contrat ou de la plateforme, demande de gel, suite judiciaire et limites.
// Les politiques des émetteurs et les références juridiques évoluent : à vérifier.
import type { Lesson } from '../model'

export const LESSON_GEL_STABLECOINS: Lesson = {
  id: 'gel-stablecoins',
  title: 'Émetteurs de stablecoins : listes noires, gel et coopération',
  level: 3,
  track: 'stablecoins',
  minutes: 35,
  summary: `Le gel d'un stablecoin centralisé est le levier le plus rapide de l'enquêteur crypto : il frappe une adresse, même auto-hébergée, en quelques heures. Fonctions de liste noire des contrats USDT et USDC, différence entre gel par l'émetteur et gel par une plateforme, vitesse et préparation, contenu d'une demande qui aboutit, suite judiciaire (saisie, destruction et réémission, rôle de l'AGRASC), et limites : DAI, versions pontées, conversion en actifs natifs, adresses partagées.`,
  objectives: [
    `Expliquer comment un émetteur centralisé bloque une adresse au niveau du contrat, et vérifier on-chain qu'un gel est effectif.`,
    `Choisir en temps réel le bon levier : émetteur, plateforme, ou suivi jusqu'au prochain point de contrôle.`,
    `Rédiger une demande de gel complète, exacte et immédiatement exploitable.`,
    `Enchaîner gel, saisie judiciaire et réémission vers une adresse de l'autorité, en lien avec le magistrat et l'AGRASC.`,
    `Identifier les situations où aucun gel émetteur n'est possible ou souhaitable.`,
  ],
  prerequisites: ['stablecoins', 'tron-usdt', 'gel-saisie', 'requisitions'],
  practice: ['pig-butchering-tron', 'address-poisoning', 'tron-kidnapping-ransom'],
  blocks: [
    {
      type: 'text',
      md: `Un collecteur d'escroquerie détient 412 000 USDT sur une adresse Tron auto-hébergée. Aucun exchange à réquisitionner, aucune clé à saisir, un suspect à l'étranger. Pourtant, quelques heures après votre demande, ces fonds peuvent être **immobilisés** : l'émetteur de l'USDT inscrit l'adresse sur la liste noire de son contrat, et plus aucun transfert n'est possible.

Ce pouvoir est la contrepartie de la **centralisation** des stablecoins : un émetteur qui promet un remboursement 1 pour 1 en dollars garde la main sur son jeton. Pour l'enquêteur, c'est un outil d'une efficacité unique, à condition de savoir **quand** il fonctionne, **comment** le demander, et **ce qu'il faut faire après**.`,
    },
    { type: 'heading', text: 'Le mécanisme : la liste noire dans le contrat' },
    {
      type: 'text',
      md: `Un stablecoin est un **contrat** sur chaque blockchain où il est émis. Les contrats des grands émetteurs centralisés contiennent des fonctions réservées à l'émetteur :

- **USDT (Tether)** : sur Ethereum, \`addBlackList\` et \`removeBlackList\` inscrivent ou retirent une adresse ; \`destroyBlackFunds\` détruit le solde d'une adresse bloquée. Les événements \`AddedBlackList\` et \`DestroyedBlackFunds\` en gardent la trace. Le contrat Tron dispose de mécanismes équivalents.
- **USDC (Circle)** : un rôle de *blacklister* peut appeler \`blacklist\` ; tout transfert depuis ou vers l'adresse échoue ensuite ; l'événement \`Blacklisted\` est émis.

L'adresse bloquée **conserve son solde**, mais ne peut plus rien en faire. Sur décision judiciaire, l'émetteur peut ensuite **détruire** les jetons bloqués et en **émettre** l'équivalent vers une adresse désignée par l'autorité : c'est la voie de la récupération.`,
    },
    {
      type: 'callout',
      kind: 'tip',
      title: 'Vérifier soi-même qu’un gel est effectif',
      md: `Sur l'explorateur, onglet de lecture du contrat : \`isBlackListed(adresse)\` (USDT sur Ethereum) ou \`isBlacklisted(adresse)\` (USDC) renvoie \`true\`. Les événements du contrat filtrés sur l'adresse donnent l'heure exacte du gel (à consigner en UTC). Sur Tron, l'explorateur signale généralement les adresses bloquées. Le solde figé à cet instant est le montant qui pourra être saisi.`,
    },
    {
      type: 'table',
      caption: 'Principaux stablecoins et capacité de gel (politiques publiques résumées avec prudence, à vérifier au moment de l’acte)',
      headers: ['Jeton', 'Émetteur', 'Gel au niveau du contrat', 'Pratique de coopération', 'Remarque'],
      rows: [
        ['USDT', 'Tether', 'Oui (liste noire, destruction des fonds bloqués)', 'Portail dédié aux forces de l’ordre ; gels fréquents sur demande motivée', 'Un contrat par chaîne : préciser Tron, Ethereum…'],
        ['USDC', 'Circle', 'Oui (blacklist)', 'Politique plus restrictive, fondée sur des obligations légales ou des décisions', 'Émis pour l’Europe par une entité agréée en France comme établissement de monnaie électronique (à vérifier)'],
        ['EURC', 'Circle', 'Oui', 'Comme l’USDC', 'Stablecoin en euros'],
        ['PYUSD et autres stablecoins régulés', 'Émetteurs régulés', 'En général oui (à vérifier dans le contrat)', 'Selon l’émetteur', 'Lire le contrat sur l’explorateur'],
        ['DAI', 'Protocole décentralisé (écosystème Sky, ex-MakerDAO)', 'Non : pas de fonction de gel dans le contrat DAI', 'Aucun gel émetteur possible', 'Suivre jusqu’à une plateforme'],
        ['Versions pontées (USDC.e, USDT « bridgés »)', 'Le bridge, pas l’émetteur', 'Selon le contrat du bridge', 'L’émetteur du jeton d’origine n’a pas la main', 'Identifier qui contrôle le contrat'],
      ],
    },
    {
      type: 'callout',
      kind: 'law',
      title: 'MiCA et stablecoins (à vérifier)',
      md: `Le règlement MiCA encadre les jetons de monnaie électronique (EMT) et les jetons se référant à des actifs : un stablecoin en euros ou en dollars offert au public dans l'Union doit être émis par un établissement de crédit ou de monnaie électronique agréé. Selon les informations publiques, l'USDC et l'EURC sont émis pour l'Europe par une entité agréée en France, tandis que l'USDT n'a pas fait l'objet d'une telle autorisation, ce qui a conduit de nombreuses plateformes à en restreindre l'offre aux clients de l'Espace économique européen début 2025. Cela ne change rien au gel : l'émetteur peut geler son jeton sur **toute** adresse, où qu'elle soit. Vérifiez le statut des émetteurs à la date de l'acte.`,
    },
    { type: 'heading', text: 'Deux niveaux de gel' },
    {
      type: 'compare',
      left: {
        title: 'Gel par l’émetteur',
        md: `- Vise une **adresse**, y compris auto-hébergée.
- Ne porte que sur **son jeton** (les TRX, ETH et autres jetons restent libres).
- **Visible** sur la chaîne (événement, échec des transferts).
- Demandé via le canal de l'émetteur (portail forces de l'ordre).
- Ouvre la voie à une destruction et réémission sur décision judiciaire.`,
      },
      right: {
        title: 'Gel par une plateforme',
        md: `- Vise un **compte client** (exchange, courtier, application).
- Porte sur **tous les actifs** du compte.
- **Invisible** sur la chaîne : c'est une écriture interne.
- Demandé au prestataire, à partir de l'**adresse de dépôt** et du txid.
- Relayé par une saisie (avoirs incorporels chez un prestataire).`,
      },
    },
    {
      type: 'flow',
      caption: `Le bon levier dépend de l'endroit où se trouvent les fonds. On ne demande jamais à l'émetteur de geler le hot wallet d'un exchange : c'est le compte du client qu'il faut viser, via la plateforme.`,
      nodes: [
        { id: 'v', label: 'Victimes', kind: 'victim', sub: '41 virements USDT' },
        { id: 'c', label: 'Collecteur auto-hébergé', kind: 'suspect', sub: 'TNd7…w3Ga' },
        { id: 'dep', label: 'Adresse de dépôt', kind: 'deposit', sub: 'compte client OKX' },
        { id: 'hot', label: 'Hot wallet OKX', kind: 'hot', sub: 'fonds de milliers de clients' },
        { id: 'iss', label: 'Tether', kind: 'service', sub: 'gel émetteur' },
        { id: 'plat', label: 'Conformité OKX', kind: 'exchange', sub: 'gel du compte' },
      ],
      edges: [
        { from: 'v', to: 'c', label: '412 000 USDT' },
        { from: 'c', to: 'dep', label: '150 000 USDT' },
        { from: 'dep', to: 'hot', label: 'balayage' },
        { from: 'iss', to: 'c', label: 'liste noire' },
        { from: 'plat', to: 'dep', label: 'blocage du compte' },
      ],
    },
    {
      type: 'callout',
      kind: 'warn',
      title: 'Adresses à ne jamais faire geler par l’émetteur',
      md: `Hot wallet d'exchange, contrat de pool de DEX, contrat de bridge, adresse de paiement d'un prestataire : ces adresses détiennent les fonds de **tiers**. Une demande de gel serait refusée ou causerait un dommage collatéral considérable. Vérifiez l'attribution de l'adresse avant toute demande, et visez le compte client via la plateforme. Vérifiez aussi que l'adresse n'est pas celle d'une **victime** (empoisonnement d'adresse, mule de bonne foi) : un gel mal ciblé bloque des fonds légitimes.`,
    },
    {
      type: 'check',
      q: `Les 150 000 USDT d'un suspect ont été déposés sur une adresse de dépôt OKX, puis balayés vers le hot wallet. À qui demander le gel ?`,
      options: [
        `À OKX, en visant le compte client désigné par l'adresse de dépôt et le txid`,
        `À Tether, en visant le hot wallet d'OKX`,
        `À personne : les fonds sont mélangés`,
        `Au DEX SunSwap`,
      ],
      answer: 0,
      explain: `Une fois sur la plateforme, les fonds sont une créance du client sur l'exchange. C'est le compte qu'il faut bloquer, via l'adresse de dépôt ; le hot wallet appartient à l'exchange et sert tous ses clients.`,
    },
    { type: 'heading', text: 'La course contre la montre' },
    {
      type: 'text',
      md: `Un suspect averti sait que l'USDT se gèle. Dès qu'il se sent repéré (plainte, publication, tentative de retrait bloquée), il peut **convertir** ses USDT en TRX ou en ETH sur un DEX, les **déposer** chez un prestataire complaisant ou les **faire passer** sur une autre chaîne. Une conversion prend une minute ; une demande de gel, des heures.

Pour gagner cette course :

- **Ouvrez votre accès** au portail forces de l'ordre des émetteurs **avant** d'en avoir besoin (comptes nominatifs, adresse électronique institutionnelle, validation par l'émetteur).
- Tenez un **modèle de demande** prêt, dans lequel il ne reste qu'à reporter les adresses et les faits.
- **Surveillez** les adresses dès leur identification : chaque mouvement modifie le montant gelable et peut désigner un nouveau point de contrôle.
- Envoyez la demande **dès l'identification** de fonds gelables, puis complétez : le gel est une mesure conservatoire, la procédure suit.
- Anticipez les **fuseaux horaires**, les week-ends et les jours fériés ; indiquez un contact joignable en continu.`,
    },
    {
      type: 'table',
      caption: 'Décider en temps réel : où sont les fonds, quel levier actionner',
      headers: ['Situation constatée', 'Levier prioritaire', 'En parallèle'],
      rows: [
        ['USDT ou USDC sur une adresse auto-hébergée', 'Demande de gel à l’émetteur', 'Surveillance ; préparer la saisie et la demande de réémission'],
        ['Dépôt sur un exchange identifié', 'Gel du compte par la plateforme (adresse de dépôt + txid)', 'Réquisition identité et historique'],
        ['Conversion en TRX, ETH ou autre actif natif', 'Plus de gel émetteur possible', 'Suivre jusqu’au prochain point de contrôle (exchange, échangeur, OTC)'],
        ['DAI ou version pontée', 'Pas d’émetteur gelant', 'Suivre ; examiner qui contrôle le contrat ponté'],
        ['Fonds dans un contrat (pool, bridge)', 'Aucun gel ciblé', 'Attendre et suivre la sortie'],
        ['Adresse partagée par des tiers (hot wallet, prestataire)', 'Ne pas solliciter l’émetteur', 'Passer par la plateforme concernée'],
      ],
    },
    {
      type: 'widget',
      id: 'exchange-flow',
      caption: `Dépôt client, balayage, hot wallet : dès que les stablecoins entrent chez un prestataire, le levier passe de l'émetteur à la plateforme.`,
    },
    { type: 'heading', text: 'Rédiger une demande qui aboutit' },
    {
      type: 'steps',
      items: [
        { title: 'Le demandeur', md: `Service, grade, nom, adresse électronique institutionnelle, téléphone joignable en continu. Les demandes venant d'adresses personnelles sont écartées.` },
        { title: 'La procédure', md: `Référence de procédure, autorité judiciaire saisie (parquet, juge d'instruction), cadre d'enquête, infraction visée.` },
        { title: 'Le fondement', md: `Réquisition ou demande de coopération selon le cadre et la localisation de l'émetteur. Un émetteur établi hors de France répond sur une base **volontaire** : la motivation et la précision font la différence.` },
        { title: 'Les éléments techniques', md: `Pour chaque adresse : adresse **complète**, **chaîne** (Tron et Ethereum sont deux contrats distincts), jeton, solde constaté avec l'heure UTC, txid démontrant l'origine illicite des fonds.` },
        { title: 'Les faits', md: `Résumé bref et factuel : mode opératoire, nombre de victimes, préjudice, chemin des fonds jusqu'à l'adresse. Un graphe simple en annexe aide.` },
        { title: 'La demande', md: `Gel immédiat des adresses listées ; conservation des informations ; confirmation du gel et du montant bloqué ; modalités ultérieures de destruction et réémission sur décision judiciaire.` },
        { title: 'L’urgence', md: `Justifier : mouvements en cours, suspect en fuite, risque de conversion. Une urgence motivée est traitée plus vite qu'une urgence décrétée.` },
      ],
    },
    {
      type: 'table',
      caption: 'Erreurs qui retardent ou font échouer un gel',
      headers: ['Erreur', 'Conséquence', 'Parade'],
      rows: [
        ['Adresse abrégée ou mal recopiée', 'Gel impossible ou mauvaise adresse', 'Copier-coller depuis l’explorateur, double vérification'],
        ['Chaîne non précisée (USDT-TRC20 ou ERC-20 ?)', 'Allers-retours, perte de temps', 'Toujours indiquer la chaîne et le contrat'],
        ['Adresse d’exchange ou de contrat visée', 'Refus', 'Vérifier l’attribution ; viser la plateforme'],
        ['Pas de référence de procédure', 'Demande non traitée', 'Référence et autorité saisie dès le premier envoi'],
        ['Messagerie personnelle', 'Doute sur l’authenticité, rejet', 'Adresse institutionnelle et compte portail'],
        ['Aucune preuve d’origine', 'Demande jugée insuffisante', 'Txid des victimes jusqu’à l’adresse'],
      ],
    },
    { type: 'heading', text: 'Après le gel : saisie, réémission, AGRASC' },
    {
      type: 'text',
      md: `Le gel reste une **mesure de l'émetteur**, prise volontairement : il peut être levé, et il ne transfère rien à l'autorité. Il doit donc être relayé rapidement par une **mesure judiciaire**, définie avec le magistrat :

1. **Saisie** : décision visant les jetons bloqués, selon le régime applicable (notamment les saisies spéciales des articles 706-141 et suivants du CPP pour les biens incorporels), notifiée à l'émetteur, au besoin par la voie de l'entraide.
2. **Destruction et réémission** : l'émetteur détruit les jetons de l'adresse bloquée et émet le montant équivalent vers une **adresse contrôlée par l'autorité**, désignée selon les instructions du magistrat et les pratiques en vigueur.
3. **Constatation** : vérification on-chain de la destruction et de l'émission (txid, montants, heures UTC), procès-verbal.
4. **Gestion** : l'**AGRASC** assiste les juridictions dans la gestion des avoirs saisis ; selon les décisions, les actifs peuvent être conservés, vendus avant jugement ou restitués. Les modalités pratiques (portefeuille de l'État, transfert à l'agence) suivent les instructions de votre chaîne.
5. **Victimes** : la restitution ou l'indemnisation passent par les décisions de justice ; tenez un tableau reliant fonds gelés et préjudices.`,
    },
    {
      type: 'callout',
      kind: 'law',
      title: 'Prudence sur les fondements',
      md: `Les fondements exacts de la saisie, l'autorité compétente (juge des libertés et de la détention sur requête du procureur, juge d'instruction), les formes de notification à un émetteur étranger et le circuit de conservation doivent être vérifiés dans les textes en vigueur et arrêtés avec le magistrat. Les pratiques des émetteurs (délais, exigences de forme, conditions de réémission) évoluent : renseignez-vous auprès des structures spécialisées avant de vous engager auprès d'un magistrat sur un calendrier.`,
    },
    {
      type: 'case',
      title: 'Cas pratique — une journée de course au gel',
      md: `Escroquerie aux faux placements, 41 victimes. Le 12 mai 2026 :

- **09:00** (heure locale) : réception de la synthèse des plaintes ; 38 transferts USDT-TRC20 convergent vers le collecteur **TNd7…w3Ga**, qui détient **412 000 USDT** et 1 900 TRX.
- **11:30** : attribution vérifiée (adresse auto-hébergée, aucune étiquette de prestataire) ; mise sous surveillance.
- **12:10** : demande de gel à Tether via le portail, avec référence de procédure, accord du parquet et txid de 12 victimes représentatives.
- **13:40** : alerte : 150 000 USDT partent vers une adresse de dépôt OKX. Demande urgente de gel du compte à OKX à 13:55.
- **14:05** : 60 000 USDT convertis en TRX sur SunSwap : perdus pour le gel émetteur, suivis vers un échangeur instantané.
- **17:50** : gel effectif ; \`isBlackListed\` renvoie \`true\` ; **202 000 USDT** bloqués.
- **J+1** : OKX confirme le blocage du compte (148 900 USDT encore présents) et transmet l'identité du titulaire.

Saisie sur requête du parquet dans les semaines suivantes ; réémission des 202 000 USDT vers l'adresse institutionnelle désignée, constatée on-chain. Sur 412 000 USDT, **350 900** sont immobilisés. Le retour d'expérience pointe les 2 h 40 entre l'identification et la demande : avec un modèle prêt et un accès au portail déjà ouvert, le dépôt chez OKX aurait pu être anticipé.`,
    },
    {
      type: 'check',
      q: `Un suspect détient 90 000 DAI sur une adresse auto-hébergée. Que peut-on attendre d'une demande de gel « à l'émetteur » ?`,
      options: [
        `Un gel en quelques heures, comme pour l'USDT`,
        `Un gel automatique par la blockchain Ethereum`,
        `Une réémission en USDC`,
        `Rien : le contrat DAI ne comporte pas de fonction de gel ; il faut suivre les fonds jusqu'à une plateforme ou saisir les clés`,
      ],
      answer: 3,
      explain: `DAI est émis par un protocole décentralisé dont le contrat ne permet pas de bloquer une adresse. Les leviers restent la plateforme suivante, ou la saisie si l'on accède aux clés.`,
    },
    {
      type: 'terms',
      items: [
        { term: 'Liste noire (blacklist)', def: `Registre du contrat d'un stablecoin listant les adresses qui ne peuvent plus transférer le jeton.` },
        { term: 'Destruction et réémission', def: `Sur décision judiciaire, l'émetteur détruit les jetons d'une adresse bloquée et émet l'équivalent vers une adresse de l'autorité.` },
        { term: 'Gel plateforme', def: `Blocage d'un compte client par un prestataire ; invisible on-chain, porte sur tous les actifs du compte.` },
        { term: 'Version pontée', def: `Jeton représentant un stablecoin sur une autre chaîne, émis par un bridge et non par l'émetteur d'origine.` },
        { term: 'Portail forces de l’ordre', def: `Canal sécurisé d'un émetteur ou d'un exchange pour recevoir les demandes des autorités ; accès à ouvrir à l'avance.` },
        { term: 'Montant gelable', def: `Solde du jeton de l'émetteur encore présent sur l'adresse au moment où le gel prend effet.` },
      ],
    },
    {
      type: 'check',
      q: `Pourquoi faut-il préciser la chaîne (Tron, Ethereum…) dans une demande de gel d'USDT ?`,
      options: [
        `Par simple politesse`,
        `Parce que Tether ne gèle que sur Ethereum`,
        `Parce que l'USDT de chaque chaîne est un contrat distinct et que le même format d'adresse ne signifie pas la même chaîne`,
        `Parce que la chaîne détermine le cours de l'USDT`,
      ],
      answer: 2,
      explain: `L'émetteur doit agir sur le bon contrat. Une adresse Ethereum peut aussi exister sur d'autres chaînes EVM, et une demande ambiguë fait perdre un temps précieux.`,
    },
  ],
  keyPoints: [
    `Les contrats des stablecoins centralisés (USDT, USDC, EURC…) permettent à l'émetteur de bloquer une adresse, même auto-hébergée ; le solde reste visible mais immobile.`,
    `Gel émetteur : une adresse, un jeton, visible on-chain. Gel plateforme : un compte, tous ses actifs, invisible on-chain, via l'adresse de dépôt.`,
    `Jamais de gel émetteur sur un hot wallet, un contrat de pool ou de bridge, ni sur l'adresse d'une victime : vérifier l'attribution d'abord.`,
    `Vitesse : accès au portail ouvert à l'avance, modèle prêt, surveillance, demande dès l'identification, contact joignable en continu.`,
    `Demande complète : demandeur institutionnel, référence de procédure, adresse complète, chaîne, jeton, solde, txid d'origine, faits, urgence motivée.`,
    `Le gel se relaie par une saisie judiciaire, puis destruction et réémission vers une adresse de l'autorité ; l'AGRASC assiste la gestion des avoirs.`,
    `Limites : DAI sans gel, versions pontées hors de portée de l'émetteur, conversion en actifs natifs, fonds dans des contrats.`,
  ],
  quiz: [
    {
      q: `Que se passe-t-il pour une adresse inscrite sur la liste noire du contrat USDT ?`,
      options: [
        `Ses USDT sont immédiatement transférés à la police`,
        `Tous ses actifs, TRX compris, sont bloqués`,
        `Elle conserve son solde d'USDT mais ne peut plus le transférer ; ses autres actifs restent libres`,
        `L'adresse disparaît de la blockchain`,
      ],
      answer: 2,
      explain: `Le gel porte sur le seul jeton de l'émetteur. La récupération passe ensuite par une décision judiciaire, puis une destruction et réémission.`,
    },
    {
      kind: 'multi',
      q: `Quelles adresses ne doivent pas faire l'objet d'une demande de gel à l'émetteur ? (plusieurs réponses)`,
      options: [
        `Le hot wallet d'un exchange`,
        `Le contrat d'un pool de DEX`,
        `Le collecteur auto-hébergé d'un escroc`,
        `L'adresse d'une victime d'empoisonnement d'adresse`,
      ],
      answer: [0, 1, 3],
      explain: `Les trois autres détiennent des fonds de tiers ou légitimes. Le collecteur auto-hébergé est précisément la cible type d'un gel émetteur.`,
    },
    {
      kind: 'truefalse',
      q: `Le gel d'un compte client par un exchange est visible sur la blockchain.`,
      options: ['Vrai', 'Faux'],
      answer: 1,
      explain: `C'est une écriture interne de la plateforme. Seul le gel émetteur, inscrit dans le contrat, est visible on-chain.`,
    },
    {
      q: `Comment vérifier sur l'explorateur qu'une adresse a bien été gelée par Circle ?`,
      options: [
        `En appelant la fonction de lecture isBlacklisted(adresse) du contrat USDC, ou en consultant l'événement Blacklisted`,
        `En regardant si son solde est nul`,
        `En envoyant soi-même des USDC à l'adresse`,
        `En consultant le cours de l'USDC`,
      ],
      answer: 0,
      explain: `Les fonctions de lecture et les événements du contrat donnent l'état et l'heure du gel, sans aucune manipulation de fonds.`,
    },
    {
      kind: 'multi',
      q: `Quels éléments une demande de gel doit-elle impérativement contenir ? (plusieurs réponses)`,
      options: [
        `La clé privée de l'adresse visée`,
        `L'adresse complète et la chaîne`,
        `La référence de procédure et l'autorité judiciaire saisie`,
        `Des txid démontrant l'origine des fonds`,
      ],
      answer: [1, 2, 3],
      explain: `L'émetteur agit sur son contrat : il n'a besoin d'aucune clé privée. Il lui faut une cible exacte, un cadre identifiable et une motivation.`,
    },
    {
      q: `Des USDT ont été convertis en TRX sur SunSwap avant le gel. Quelle est la conséquence ?`,
      options: [
        `Tether peut geler les TRX`,
        `Les TRX sont gelés automatiquement`,
        `Le gel émetteur ne peut plus les atteindre : il faut suivre les TRX jusqu'au prochain point de contrôle`,
        `La conversion est annulée`,
      ],
      answer: 2,
      explain: `Le TRX est l'actif natif de Tron, hors du contrôle de Tether. Il faut le suivre jusqu'à un exchange, un échangeur ou un courtier.`,
    },
    {
      kind: 'truefalse',
      q: `Un gel obtenu auprès d'un émetteur doit être relayé par une mesure judiciaire, car il reste une mesure volontaire de l'émetteur.`,
      options: ['Vrai', 'Faux'],
      answer: 0,
      explain: `Le gel peut être levé et ne transfère rien à l'autorité ; la saisie, puis la réémission vers une adresse institutionnelle, sécurisent les fonds.`,
    },
    {
      q: `Pourquoi l'émetteur de l'USDC ne peut-il pas geler un USDC.e ponté sur une autre chaîne ?`,
      options: [
        `Parce que ce jeton est émis par le contrat du bridge et non par l'émetteur d'origine`,
        `Parce que l'USDC.e n'a pas de valeur`,
        `Parce que les chaînes de couche 2 interdisent les gels`,
        `Il le peut toujours`,
      ],
      answer: 0,
      explain: `Une version pontée est un jeton distinct, contrôlé par le bridge. L'émetteur ne maîtrise que son jeton natif, y compris celui verrouillé dans le bridge.`,
    },
  ],
  flashcards: [
    { front: 'Fonctions de gel USDT (Ethereum)', back: `addBlackList / removeBlackList ; destroyBlackFunds ; événements AddedBlackList, DestroyedBlackFunds.` },
    { front: 'Fonction de gel USDC', back: `blacklist(adresse) par le rôle blacklister ; lecture isBlacklisted ; événement Blacklisted.` },
    { front: 'Gel émetteur', back: `Une adresse (même auto-hébergée), un seul jeton, visible on-chain.` },
    { front: 'Gel plateforme', back: `Un compte client, tous ses actifs, invisible on-chain ; via l'adresse de dépôt et le txid.` },
    { front: 'Adresses à ne pas faire geler', back: `Hot wallets, pools de DEX, bridges, prestataires, victimes.` },
    { front: 'DAI', back: `Pas de fonction de gel : suivre jusqu'à une plateforme ou saisir les clés.` },
    { front: 'Version pontée', back: `Émise par le bridge : hors de portée de l'émetteur d'origine.` },
    { front: 'Après le gel', back: `Saisie judiciaire → destruction et réémission vers une adresse de l'autorité → constatation → gestion (AGRASC).` },
    { front: 'Préparer la course au gel', back: `Accès portail ouvert à l'avance, modèle de demande, surveillance, contact joignable en continu.` },
    { front: 'Montant gelable', back: `Solde du jeton présent au moment où le gel prend effet : le consigner en UTC.` },
    { front: 'Chaîne dans la demande', back: `Toujours la préciser : un contrat USDT par chaîne.` },
  ],
}
