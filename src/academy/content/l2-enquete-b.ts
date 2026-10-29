// Niveau 2 — réquisitions aux prestataires et OPSEC de l'enquêteur.
import type { Lesson } from '../model'

export const L2_ENQUETE_B: Lesson[] = [
  // ════════════════════════════════════════════════════════════════════════
  // RÉQUISITIONS
  // ════════════════════════════════════════════════════════════════════════
  {
    id: 'requisitions',
    title: 'Réquisitions aux prestataires',
    level: 2,
    track: 'enquete',
    minutes: 35,
    summary:
      "La réquisition est le moment où le pseudonyme rencontre l'identité. Fondements selon le cadre d'enquête, régime particulier des données de connexion, statut des prestataires (PSAN, PSCA sous MiCA), choix de la bonne adresse et du bon destinataire, données à demander, prestataires étrangers (coopération volontaire, DEE, entraide), rédaction et exploitation des réponses.",
    objectives: [
      'Choisir le fondement de la réquisition selon le cadre d\'enquête (flagrance, préliminaire, instruction).',
      'Identifier la bonne cible : adresse de dépôt plutôt que hot wallet, exchange de la victime, émetteur de stablecoin.',
      'Connaître le statut des prestataires (PSAN, PSCA, passeport européen) et le vérifier.',
      'Lister les données utiles et rédiger une réquisition précise et exploitable.',
      'Choisir la voie adaptée pour un prestataire étranger et exploiter la réponse.',
    ],
    prerequisites: ['exchanges', 'suivre-flux', 'attribution-sources'],
    blocks: [
      {
        type: 'text',
        md: `Toute l'analyse on-chain converge vers un moment : la **réquisition**. C'est elle qui transforme « l'adresse de dépôt \`bc1q…u7d4\` chez Coinvault » en « le compte de M. X, ouvert le 3 janvier 2026 avec tel passeport, alimenté depuis tel IBAN, connecté depuis telle adresse IP ».

Une réquisition mal ciblée (adresse de hot wallet, tag XRP oublié, heure sans fuseau) revient vide ou ambiguë, et fait perdre des semaines. Une réquisition précise obtient souvent une réponse en quelques jours, ouvre de nouvelles pistes (banque, opérateur, autre exchange) et, parfois, permet un **gel** avant la dissipation des fonds.`,
      },
      { type: 'heading', text: 'Les fondements selon le cadre d\'enquête' },
      {
        type: 'table',
        headers: ['Cadre', 'Fondement (CPP)', 'Qui peut requérir', 'Condition'],
        rows: [
          ['Enquête de flagrance', 'Art. 60-1', 'L\'OPJ ou, sous son contrôle, l\'APJ', 'Aucune autorisation préalable'],
          ['Enquête préliminaire', 'Art. 77-1-1', 'Le procureur de la République, ou l\'OPJ / l\'APJ sur son autorisation', 'Autorisation du procureur (vérifier sa forme et sa portée)'],
          ['Information judiciaire', 'Art. 99-3', 'Le juge d\'instruction, ou l\'OPJ commis par lui', 'Commission rogatoire'],
        ],
        caption: 'Ces textes permettent de requérir toute personne, tout établissement ou organisme privé ou public susceptible de détenir des informations intéressant l\'enquête, y compris issues de systèmes informatiques.',
      },
      {
        type: 'text',
        md: `Le destinataire ne peut, en principe, opposer le secret professionnel sans motif légitime (des protections particulières existent pour certaines professions), et le fait de s'abstenir de répondre dans les meilleurs délais est pénalement sanctionné par une amende. Pour un prestataire établi en France, la réquisition est donc **contraignante** ; pour un prestataire établi à l'étranger, elle ne l'est pas (voir plus bas).`,
      },
      {
        type: 'callout',
        kind: 'law',
        title: 'Données de connexion : un régime particulier',
        md: `Les réquisitions portant sur des **données de connexion** (données de trafic et de localisation, et certaines données techniques permettant d'identifier la source d'une connexion) sont soumises à des conditions spécifiques prévues par l'**article 60-1-2 du CPP**, issues des évolutions de la jurisprudence européenne et nationale. Elles tiennent notamment à la **gravité** de l'infraction (par exemple un crime ou un délit puni d'au moins trois ans d'emprisonnement, ou certains délits commis par voie de communications électroniques lorsque la réquisition vise seulement à identifier l'auteur).

L'application exacte de ce régime aux journaux de connexion conservés par un prestataire de crypto-actifs est à apprécier avec le magistrat. Par prudence : vérifiez que l'infraction poursuivie entre dans le champ du texte et visez-le dans la réquisition. Les conditions évoluent : **contrôlez toujours la version en vigueur**.`,
      },
      { type: 'heading', text: 'Choisir la bonne cible' },
      {
        type: 'flow',
        nodes: [
          { id: 'v', label: 'Victime', kind: 'victim' },
          { id: 'cv', label: 'Coinvault', kind: 'exchange', sub: 'exchange de la victime' },
          { id: 's', label: 'Portefeuille suspect', kind: 'suspect' },
          { id: 'dep', label: 'Adresse de dépôt', kind: 'deposit', sub: 'unique au client : À REQUÉRIR' },
          { id: 'hot', label: 'Hot wallet Binova', kind: 'hot', sub: 'partagé par tous' },
          { id: 'usdt', label: 'Émetteur USDT', kind: 'service', sub: 'peut bloquer une adresse' },
        ],
        edges: [
          { from: 'v', to: 'cv', label: 'achat' },
          { from: 'cv', to: 's', label: 'retraits (txid)' },
          { from: 's', to: 'dep', label: 'dépôt 18 400 USDT' },
          { from: 'dep', to: 'hot', label: 'balayage', dashed: true },
          { from: 's', to: 'usdt', label: 'solde résiduel gelable', dashed: true },
        ],
        caption: 'Trois cibles typiques : l\'exchange de la victime (point de départ fiable), l\'exchange du suspect via l\'adresse de dépôt, et l\'émetteur du stablecoin pour un gel.',
      },
      {
        type: 'widget',
        id: 'exchange-flow',
        caption: 'Suivez un dépôt jusqu\'au cold wallet et identifiez l\'adresse qui désigne encore un client unique : c\'est elle qu\'il faut citer dans la réquisition.',
      },
      {
        type: 'check',
        q: 'Les fonds du suspect arrivent sur une adresse de dépôt Binova, puis sont balayés vers le hot wallet de Binova. Quelle adresse citer dans la réquisition ?',
        options: [
          'L\'adresse du hot wallet, car c\'est là que sont les fonds',
          'L\'adresse de dépôt, avec le txid du dépôt, le montant et l\'horodatage UTC',
          'L\'adresse du cold wallet',
          'Aucune : le nom du suspect suffit',
        ],
        answer: 1,
        explain: 'Le hot wallet est partagé par des millions de clients : il ne désigne personne. L\'adresse de dépôt est attribuée à un client unique ; avec le txid, elle permet d\'identifier le compte crédité.',
      },
      { type: 'heading', text: 'Statut des prestataires : PSAN, PSCA et MiCA' },
      {
        type: 'text',
        md: `- **PSAN** (prestataires de services sur actifs numériques) : régime français issu de la loi PACTE (2019), inscrit dans le code monétaire et financier, avec **enregistrement** obligatoire auprès de l'**AMF** pour certains services et un agrément optionnel.
- **MiCA** (règlement (UE) 2023/1114) : applicable aux prestataires depuis le **30 décembre 2024**. Les prestataires doivent être **agréés** comme **PSCA** (prestataires de services sur crypto-actifs) par l'autorité de leur État membre — l'AMF en France — et peuvent ensuite exercer dans toute l'Union par **passeport**.
- **Période transitoire** : les PSAN déjà enregistrés pouvaient continuer à exercer pendant une période transitoire, qui a pris fin en France le 1er juillet 2026. Le statut d'un prestataire (PSCA agréé, État d'agrément) doit être **vérifié à la date de l'acte** sur les listes de l'AMF et le registre de l'ESMA.
- **Règle de voyage** (règlement (UE) 2023/1113, applicable depuis le 30 décembre 2024) : les PSCA transmettent et conservent des informations sur l'émetteur et le bénéficiaire des transferts, et doivent, pour les transferts de plus de 1 000 € avec une adresse auto-hébergée, évaluer si celle-ci est contrôlée par leur client. Ces données peuvent être demandées.
- **Lutte anti-blanchiment** : PSAN et PSCA sont assujettis ; ils conservent les données d'identification et des opérations (en principe cinq ans après la fin de la relation d'affaires) et effectuent des déclarations de soupçon à **TRACFIN**.`,
      },
      { type: 'heading', text: 'Que demander à un exchange' },
      {
        type: 'table',
        headers: ['Catégorie', 'Données', 'Utilité'],
        rows: [
          ['Identité (KYC)', 'Nom, date de naissance, nationalité, adresse, pièces d\'identité, selfie ou vidéo, justificatif de domicile, profession et origine des fonds déclarées', 'Identifier le titulaire (ou la mule)'],
          ['Contacts', 'E-mail, téléphone (y compris celui de la double authentification), historique des modifications', 'Pivots vers opérateurs et fournisseurs de messagerie'],
          ['Connexions', 'IP et horodatages (UTC) d\'inscription, de connexion et des opérations sensibles, appareils, user-agents', 'Localiser, relier des comptes (sous réserve du régime des données de connexion)'],
          ['Moyens de paiement', 'IBAN, cartes, comptes de paiement liés, dépôts et retraits en monnaie fiduciaire', 'Rebondir vers les banques'],
          ['Historique crypto', 'Dépôts et retraits (actif, chaîne, montant, txid, adresses, tag/memo), transferts internes, ordres, liste blanche d\'adresses, données de la règle de voyage', 'Prolonger la trace au-delà de l\'exchange'],
          ['Comptes liés', 'Comptes partageant un appareil, une IP, un IBAN, une adresse de retrait, un parrainage', 'Découvrir le réseau de mules'],
          ['Support', 'Tickets, pièces fournies, explications données lors des contrôles', 'Contradictions, éléments d\'identité supplémentaires'],
          ['Solde et mesures', 'Solde actuel par actif, demande de blocage du compte', 'Préserver les fonds (à distinguer d\'une saisie)'],
        ],
        caption: 'Demandez ce qui est nécessaire à l\'enquête, et des exports exploitables (tableur) avec un fuseau horaire explicite.',
      },
      { type: 'heading', text: 'Prestataires étrangers' },
      {
        type: 'table',
        headers: ['Situation', 'Voie', 'Caractère', 'Remarques'],
        rows: [
          ['Prestataire établi en France', 'Réquisition (60-1, 77-1-1, 99-3)', 'Contraignant', 'Coinvault dans les exercices'],
          ['Grand exchange étranger doté d\'un portail forces de l\'ordre', 'Demande de coopération volontaire', 'Non contraignant', 'Souvent rapide pour l\'identité de base et le gel ; usage procédural à apprécier avec le parquet (Binova, Kaizen)'],
          ['Prestataire établi dans un autre État membre de l\'UE', 'Décision d\'enquête européenne (directive 2014/41/UE)', 'Contraignant', 'Émise ou validée par un magistrat ; délais encadrés (Nordex en Estonie)'],
          ['Prestataire hors UE sans coopération volontaire', 'Demande d\'entraide pénale internationale', 'Contraignant selon les conventions', 'Plusieurs mois ; à anticiper avec une demande de conservation (Helvetix en Suisse)'],
          ['Émetteur de stablecoin', 'Demande de blocage via son portail', 'Volontaire', 'Gel rapide d\'une adresse ; à demander dès l\'identification'],
          ['Entité sanctionnée ou non coopérative', '—', 'Aucune', 'Signalement, partenaires, suivre la sortie (Grantis, FlashX)'],
        ],
      },
      {
        type: 'callout',
        kind: 'tip',
        title: 'La stratégie en deux temps',
        md: `Stratégie fréquente face à un prestataire étranger : **immédiatement**, demande volontaire de conservation des données, de données de base et de blocage du compte ; **ensuite**, DEE ou entraide pour obtenir de façon contraignante les éléments indispensables à la procédure. Pensez aux appuis : Europol, Eurojust, officiers de liaison, structures spécialisées nationales. Le règlement européen « e-Evidence », applicable depuis août 2026 à certains fournisseurs de services, peut aussi entrer en jeu : son applicabilité à un prestataire de crypto-actifs donné est à vérifier.`,
      },
      {
        type: 'check',
        q: 'Un exchange agréé PSCA en Estonie refuse de fournir l\'historique complet d\'un compte sans décision contraignante. Quel instrument utiliser ?',
        options: [
          'Une demande d\'entraide hors UE',
          'Une simple réquisition 60-1, qui s\'impose à lui',
          'Une décision d\'enquête européenne (DEE)',
          'Un signalement PHAROS',
        ],
        answer: 2,
        explain: 'Au sein de l\'Union, la DEE permet d\'obtenir l\'exécution contraignante de mesures d\'enquête dans un autre État membre.',
      },
      { type: 'heading', text: 'Rédiger une réquisition efficace' },
      {
        type: 'steps',
        items: [
          { title: 'Cadre', md: 'Fondement juridique, autorité, numéro de procédure, infraction visée (et, le cas échéant, le texte relatif aux données de connexion).' },
          { title: 'Identifiants techniques', md: 'Chaîne, actif (et adresse du contrat du jeton), adresse(s), tag/memo, **txid**, montant exact, **horodatage UTC**, sens du flux (dépôt ou retrait).' },
          { title: 'Période', md: 'De l\'ouverture du compte à ce jour, ou une fenêtre ciblée justifiée.' },
          { title: 'Données demandées', md: 'Liste précise par catégorie (identité, contacts, connexions, paiements, historique, comptes liés, support), format attendu.' },
          { title: 'Mesures conservatoires', md: 'Conservation des données, blocage du compte le cas échéant, avec justification du risque de dissipation.' },
          { title: 'Confidentialité et délai', md: 'Demande expresse de ne pas informer le client, délai de réponse, motif de l\'urgence.' },
          { title: 'Contact', md: 'Coordonnées de l\'enquêteur pour les questions techniques.' },
        ],
      },
      {
        type: 'case',
        title: 'Exemple — l\'essentiel d\'une demande à Binova',
        md: `**Objet** : identification du titulaire d'un compte crédité par un dépôt USDT (TRC-20), procédure n° 2026/0412, escroquerie en bande organisée et blanchiment.

**Éléments techniques** : chaîne Tron, actif USDT (contrat \`TR7N…Lj6t\`), adresse de dépôt \`TQx7…9bLm\`, txid \`b41c…e07a\`, montant 18 400,00 USDT, horodatage 2026-09-14 08:31:07 UTC.

**Données demandées** : identité et documents KYC du titulaire ; e-mails et téléphones ; IP et appareils d'inscription et de connexion du 01/08/2026 à ce jour ; moyens de paiement liés ; historique complet des dépôts et retraits (txid, adresses, montants, UTC) ; comptes partageant appareil, IP, IBAN ou adresse de retrait ; solde actuel.

**Mesures** : conservation des données ; blocage du compte, les fonds étant susceptibles d'être dissipés ; confidentialité vis-à-vis du titulaire ; export au format tableur, fuseau UTC.`,
      },
      { type: 'heading', text: 'Exploiter la réponse' },
      {
        type: 'text',
        md: `À réception, **vérifiez avant d'exploiter** :

- les txid fournis correspondent-ils à la chaîne et aux montants ? Le dépôt de l'affaire figure-t-il dans l'historique ?
- les horodatages sont-ils en UTC ou en heure locale du prestataire ?
- l'adresse IP est-elle celle d'un VPN, d'un hébergeur, d'un point d'accès mobile (partagé par de nombreux abonnés) ?
- l'identité est-elle crédible, ou s'agit-il d'une mule, d'une identité achetée, d'un document falsifié ?

Chaque réponse ouvre de nouveaux actes : réquisitions à l'opérateur (numéro), à la banque (IBAN, puis interrogation du FICOBA selon les modalités en vigueur), au fournisseur de messagerie, à d'autres exchanges (adresses de retrait). Les retraits listés par l'exchange prolongent la trace on-chain.`,
      },
      {
        type: 'callout',
        kind: 'warn',
        title: 'Erreurs fréquentes',
        md: `- Citer l'adresse du **hot wallet** au lieu de l'adresse de dépôt.
- Oublier le **tag ou memo** sur XRP, Stellar, EOS.
- Donner une heure **locale sans fuseau**.
- Demander « toutes informations utiles » sans liste précise.
- Oublier les **comptes liés**, qui révèlent les réseaux de mules.
- Ne pas demander la **confidentialité** : certains prestataires informent leurs clients par défaut.`,
      },
      {
        type: 'terms',
        items: [
          { term: 'PSAN', def: 'Prestataire de services sur actifs numériques, régime français issu de la loi PACTE (enregistrement AMF).' },
          { term: 'PSCA', def: 'Prestataire de services sur crypto-actifs agréé au titre de MiCA, avec passeport européen.' },
          { term: 'DEE', def: 'Décision d\'enquête européenne (directive 2014/41/UE) : exécution contraignante d\'actes d\'enquête dans un autre État membre.' },
          { term: 'Entraide pénale internationale', def: 'Demande adressée à un État tiers sur la base de conventions, pour obtenir des actes ou des éléments de preuve.' },
          { term: 'Règle de voyage', def: 'Obligation pour les PSCA de transmettre et conserver les informations sur l\'émetteur et le bénéficiaire des transferts.' },
          { term: 'Coopération volontaire', def: 'Réponse non contrainte d\'un prestataire étranger, souvent via un portail dédié aux forces de l\'ordre.' },
        ],
      },
    ],
    keyPoints: [
      'Fondements : art. 60-1 (flagrance), 77-1-1 (préliminaire, autorisation du procureur), 99-3 (instruction) du CPP.',
      'Données de connexion : conditions particulières (art. 60-1-2 CPP), notamment de gravité, à vérifier et viser.',
      'Requérir l\'adresse de dépôt (unique au client), jamais le hot wallet ; penser à l\'exchange de la victime et à l\'émetteur du stablecoin.',
      'MiCA : PSCA agréés (AMF en France) avec passeport ; vérifier le statut à la date de l\'acte.',
      'Demander identité, contacts, connexions, paiements, historique crypto, comptes liés, support, solde et blocage.',
      'Étranger : coopération volontaire immédiate, puis DEE dans l\'UE ou entraide pénale hors UE.',
      'Toujours fournir txid, adresse, tag/memo, montant et horodatage UTC ; demander la confidentialité.',
    ],
    quiz: [
      {
        q: 'En enquête préliminaire, sur quel fondement un OPJ adresse-t-il une réquisition à un exchange établi en France ?',
        options: [
          'Article 60-1 CPP, sans autorisation',
          'Article 99-3 CPP',
          'Article 77-1-1 CPP, sur autorisation du procureur de la République',
          'Aucun fondement nécessaire',
        ],
        answer: 2,
        explain: 'En préliminaire, les réquisitions relèvent de l\'article 77-1-1 : le procureur ou, sur son autorisation, l\'OPJ (ou l\'APJ).',
      },
      {
        q: 'Avant de demander les adresses IP de connexion d\'un client, que faut-il vérifier ?',
        options: [
          'Que les conditions applicables aux données de connexion (notamment art. 60-1-2 CPP) sont remplies',
          'Rien de particulier',
          'Que le client a donné son accord',
          'Que l\'exchange est coté en bourse',
        ],
        answer: 0,
        explain: 'Les données de trafic, de localisation et certaines données techniques d\'identification sont soumises à des conditions spécifiques, notamment de gravité.',
      },
      {
        q: 'Un exchange est agréé PSCA en Estonie et refuse de fournir l\'historique complet sans décision contraignante. Quel instrument ?',
        options: ['Une demande d\'entraide hors UE', 'Une réquisition 60-1 suffit', 'Un signalement PHAROS', 'Une décision d\'enquête européenne (DEE)'],
        answer: 3,
        explain: 'Au sein de l\'UE, la DEE permet d\'obtenir l\'exécution contraignante de mesures d\'enquête dans un autre État membre.',
      },
      {
        kind: 'truefalse',
        q: 'Pour identifier le client d\'un exchange, il suffit de citer l\'adresse du hot wallet qui a reçu les fonds après balayage.',
        options: ['Vrai', 'Faux'],
        answer: 1,
        explain: 'Le hot wallet est partagé par tous les clients. C\'est l\'adresse de dépôt (ou le couple adresse + tag) et le txid qui désignent le compte.',
      },
      {
        kind: 'multi',
        q: 'Quels éléments techniques doivent figurer dans une réquisition visant un dépôt ? (plusieurs réponses)',
        options: [
          'La chaîne et l\'actif (avec le contrat du jeton)',
          'L\'adresse de dépôt et, le cas échéant, le tag ou memo',
          'Le txid et le montant exact',
          'L\'horodatage en UTC',
          'Le cours du bitcoin le jour de la rédaction',
        ],
        answer: [0, 1, 2, 3],
        explain: 'Chaîne, actif, adresse, tag/memo, txid, montant et horodatage UTC permettent au prestataire de retrouver l\'opération sans ambiguïté.',
      },
      {
        q: 'Pourquoi demander des exports avec un fuseau horaire explicite ?',
        options: [
          'Pour la mise en page',
          'Pour réduire le volume des données',
          'Pour rapprocher sans erreur les horodatages du prestataire avec ceux de la blockchain (UTC) et d\'autres sources',
          'Ce n\'est pas utile',
        ],
        answer: 2,
        explain: 'Un décalage horaire non identifié fausse les corrélations (connexions, transactions, appels).',
      },
      {
        q: 'Depuis quand les prestataires de services sur crypto-actifs relèvent-ils de MiCA ?',
        options: ['Depuis la loi PACTE de 2019', 'Depuis le 30 décembre 2024', 'Depuis le 1er janvier 2023', 'MiCA ne vise pas les prestataires'],
        answer: 1,
        explain: 'Les dispositions de MiCA relatives aux prestataires s\'appliquent depuis le 30 décembre 2024, avec une période transitoire pour les acteurs déjà enregistrés.',
      },
      {
        kind: 'truefalse',
        q: 'Une réponse volontaire d\'un exchange étranger via son portail a la même force contraignante qu\'une DEE.',
        options: ['Vrai', 'Faux'],
        answer: 1,
        explain: 'La coopération volontaire n\'est pas juridiquement contrainte : contenu et délais varient, et son usage procédural s\'apprécie avec le parquet. La DEE ou l\'entraide sécurisent les éléments indispensables.',
      },
    ],
    flashcards: [
      { front: 'Réquisition en flagrance', back: 'Art. 60-1 CPP : l\'OPJ ou, sous son contrôle, l\'APJ.' },
      { front: 'Réquisition en préliminaire', back: 'Art. 77-1-1 CPP : le procureur ou, sur son autorisation, l\'OPJ / l\'APJ.' },
      { front: 'Réquisition en instruction', back: 'Art. 99-3 CPP : le juge d\'instruction ou l\'OPJ commis.' },
      { front: 'Données de connexion', back: 'Régime particulier (art. 60-1-2 CPP), notamment de gravité de l\'infraction : à vérifier et viser.' },
      { front: 'Quelle adresse requérir chez un exchange ?', back: 'L\'adresse de dépôt (unique au client) avec le txid — jamais le hot wallet.' },
      { front: 'PSCA', back: 'Prestataire agréé au titre de MiCA (AMF en France), avec passeport dans toute l\'UE.' },
      { front: 'Prestataire dans un autre État membre, données contraignantes', back: 'Décision d\'enquête européenne (directive 2014/41/UE).' },
      { front: 'Prestataire hors UE', back: 'Coopération volontaire si elle existe ; sinon demande d\'entraide pénale internationale, longue : anticiper la conservation.' },
      { front: 'Règle de voyage', back: 'Règlement (UE) 2023/1113 : informations émetteur / bénéficiaire transmises et conservées par les PSCA.' },
      { front: 'Cinq erreurs fréquentes', back: 'Hot wallet au lieu du dépôt, tag oublié, heure sans fuseau, demande vague, comptes liés oubliés (et confidentialité non demandée).' },
      { front: 'Conservation des données KYC', back: 'En principe cinq ans après la fin de la relation d\'affaires (obligations anti-blanchiment).' },
    ],
    practice: ['first-trace', 'eth-first', 'xrp-destination-tag', 'pig-butchering-tron'],
  },

  // ════════════════════════════════════════════════════════════════════════
  // OPSEC DE L'ENQUÊTEUR
  // ════════════════════════════════════════════════════════════════════════
  {
    id: 'opsec-enqueteur',
    title: "OPSEC de l'enquêteur crypto",
    level: 2,
    track: 'enquete',
    minutes: 24,
    summary:
      "Les auteurs surveillent leurs adresses, leurs sites et leurs comptes : une maladresse de l'enquêteur peut déclencher la dissipation des fonds en quelques minutes. Ce que le suspect peut voir ou non, poste et identités dédiés, outils tiers et fuites d'information, confidentialité des actes, intégrité de la preuve et protection personnelle de l'enquêteur.",
    objectives: [
      'Distinguer les actions invisibles pour le suspect de celles qui peuvent l\'alerter.',
      'Mettre en place un environnement de travail dédié et cloisonné.',
      'Éviter les fuites d\'information par les outils tiers et respecter les règles de protection des données.',
      'Préserver la confidentialité des réquisitions, des gels et des échanges avec les victimes.',
      'Garantir l\'intégrité des éléments collectés et se protéger personnellement.',
    ],
    prerequisites: ['premiers-reflexes', 'osint', 'requisitions'],
    blocks: [
      {
        type: 'text',
        md: `L'**OPSEC** (*operational security*) de l'enquêteur, c'est l'ensemble des précautions qui empêchent le suspect d'apprendre qu'il est visé — ou d'en apprendre plus qu'il ne faut. En matière de crypto-actifs, l'enjeu est immédiat : un auteur alerté peut **déplacer ses fonds en quelques minutes**, vers un mixeur, un échangeur sans KYC ou une autre chaîne. Plusieurs semaines d'analyse peuvent être perdues par un clic.

L'OPSEC protège aussi **l'enquêteur lui-même** (identification, harcèlement, hameçonnage ciblé) et **la procédure** (intégrité des preuves, respect des règles de protection des données).`,
      },
      {
        type: 'table',
        headers: ['Menace', 'Exemple', 'Conséquence', 'Parade'],
        rows: [
          ['Alerte du suspect', 'Visite répétée du site frauduleux depuis le réseau du service', 'Le site change d\'adresses de dépôt, les fonds bougent', 'Environnement dédié, visites limitées et réfléchies'],
          ['Action on-chain visible', 'Envoi d\'une transaction test vers l\'adresse du suspect', 'Le suspect voit un paiement inattendu', 'Ne jamais interagir on-chain sans décision et cadre'],
          ['Fuite par un tiers', 'Le prestataire informe son client de la réquisition', 'Le compte est vidé avant le gel', 'Demande expresse de confidentialité, gel simultané'],
          ['Fuite par la victime', 'La victime publie l\'adresse ou contacte un « hacker »', 'Le réseau apprend l\'existence d\'une plainte', 'Consignes claires à la victime'],
          ['Ciblage de l\'enquêteur', 'Recherche de son nom sur les réseaux sociaux, hameçonnage', 'Pression, compromission du poste', 'Hygiène numérique personnelle, vigilance'],
          ['Compromission technique', 'Ouverture d\'un fichier piégé reçu d\'un suspect', 'Poste infecté, données exfiltrées', 'Analyse en environnement isolé'],
        ],
      },
      { type: 'heading', text: 'Ce que le suspect voit, et ce qu\'il ne voit pas' },
      {
        type: 'compare',
        left: {
          title: 'Invisible pour le suspect',
          md: `- Consulter une adresse sur un explorateur public ou dans SPECTRA.
- Interroger un nœud ou un outil d'analyse (sous réserve de la confidentialité de l'outil).
- Requérir un prestataire **qui respecte la confidentialité**.
- Analyser une copie archivée d'un site.`,
        },
        right: {
          title: 'Potentiellement visible',
          md: `- **Visiter** son site ou cliquer sur ses liens (journaux, liens de suivi).
- **Envoyer** quoi que ce soit à son adresse (même 1 satoshi).
- Le **gel** d'un compte ou d'une adresse (blocage visible, événement on-chain pour un stablecoin).
- **Suivre**, « liker », consulter un profil qui affiche ses visiteurs.
- Une **publication** de la victime, de la presse ou d'un collègue.`,
        },
      },
      {
        type: 'check',
        q: 'Laquelle de ces actions est susceptible d\'alerter le suspect ?',
        options: [
          'Consulter son adresse sur un explorateur de blocs public',
          'Calculer l\'exposition de son adresse dans SPECTRA',
          'Lui envoyer 0,0001 BTC depuis un portefeuille du service pour « tester » l\'adresse',
          'Analyser une copie archivée de son site',
        ],
        answer: 2,
        explain: 'Toute transaction vers l\'adresse du suspect est visible de lui. Les consultations d\'explorateurs et l\'analyse dans un outil ne laissent pas de trace de son côté.',
      },
      { type: 'heading', text: 'Poste de travail et identités' },
      {
        type: 'steps',
        items: [
          { title: 'Un environnement dédié', md: 'Poste ou machine virtuelle réservés aux investigations en ligne, conformes aux règles de sécurité de votre service, distincts du poste bureautique et de tout équipement personnel.' },
          { title: 'Une sortie réseau maîtrisée', md: 'Ne visitez pas les sites des suspects depuis une adresse IP rattachable au service ; utilisez les moyens de navigation anonymisée prévus par votre service.' },
          { title: 'Des identités cloisonnées', md: 'Jamais de compte personnel. Des comptes d\'investigation dédiés, cohérents et sans lien entre eux ni avec l\'enquêteur ; toute interaction relève de l\'enquête sous pseudonyme et de ses habilitations.' },
          { title: 'Un navigateur propre', md: 'Profil vierge, sans extension de portefeuille, sans session ouverte sur des comptes réels ; nettoyage entre deux affaires.' },
          { title: 'Une traçabilité interne', md: 'Notez ce que vous avez visité, quand et depuis quel environnement : cela documente la procédure et permet d\'expliquer une éventuelle réaction du suspect.' },
        ],
      },
      {
        type: 'callout',
        kind: 'warn',
        title: 'Portefeuilles et phrases de récupération',
        md: `- Ne connectez **jamais** un portefeuille à un site frauduleux « pour voir » : c'est exactement ce qu'attend un drainer.
- Ne saisissez **jamais** une phrase de récupération saisie ou communiquée par une victime sur un appareil connecté à internet, ni dans un logiciel non validé.
- Une phrase de récupération ou une clé saisie est un **scellé** : sa manipulation (transfert vers un portefeuille de l'État, par exemple) suit une procédure formalisée, traitée dans les leçons sur la saisie.`,
      },
      { type: 'heading', text: 'Outils tiers et fuites d\'information' },
      {
        type: 'text',
        md: `Coller une adresse dans un moteur de recherche, un site d'analyse gratuit, un service de traduction ou un assistant conversationnel en ligne, c'est **transmettre une donnée de l'enquête à un tiers** : on ignore qui la journalise, la revend ou la consulte. Certains outils publics affichent même les adresses « récemment recherchées ».

Règles pratiques :

- privilégiez les **outils validés** par votre service (SPECTRA, outils sous contrat, explorateurs consultés depuis l'environnement dédié) ;
- ne versez jamais dans un outil en ligne non validé des **données personnelles** issues de la procédure (identité, KYC, IBAN, captures de la victime) ;
- méfiez-vous des fonctions de **partage public** (liens de graphes, signalements communautaires) : publier une adresse « pour prévenir d'autres victimes » peut alerter l'auteur.`,
      },
      {
        type: 'callout',
        kind: 'law',
        title: 'Protection des données et secret de l\'enquête',
        md: `Les données personnelles traitées dans une procédure pénale relèvent de la directive (UE) 2016/680 et de sa transposition dans la loi Informatique et libertés : nécessité, proportionnalité, sécurité, traitements autorisés. Le **secret de l'enquête et de l'instruction** (art. 11 du CPP) s'applique à toute personne qui concourt à la procédure. Transmettre des données d'enquête à un service en ligne non autorisé peut méconnaître ces deux exigences : en cas de doute, demandez à votre référent sécurité ou au magistrat.`,
      },
      { type: 'heading', text: 'Confidentialité des actes' },
      {
        type: 'text',
        md: `- **Réquisitions** : demandez expressément la non-information du client ; certains prestataires étrangers informent leurs utilisateurs par défaut, sauf demande motivée.
- **Gel** : un gel prévient le suspect. Coordonnez-le : si plusieurs services détiennent des fonds, demandez les blocages **simultanément** ; si une interpellation est envisagée, articulez le gel avec elle.
- **Victimes** : expliquez-leur de ne pas publier les adresses, de ne pas contacter l'escroc, de ne pas répondre aux offres de « récupération », et de vous transmettre tout nouveau contact.
- **Déconfliction** : avant une action visible, vérifiez qu'un autre service n'enquête pas sur la même cible (adresses, domaines, pseudonymes partagés).
- **Communication** : aucune information sur une affaire en cours sur les réseaux sociaux, même anonymisée ; attention aux captures d'écran partagées entre collègues hors des canaux prévus.`,
      },
      {
        type: 'case',
        title: 'Cas — la publication qui a coûté 180 000 USDT',
        md: `Le 6 octobre 2026, une victime de faux placement dépose plainte. L'adresse de collecte TRON des auteurs détient encore **182 000 USDT**. La demande de blocage à l'émetteur est préparée pour le lendemain matin.

Le soir même, la victime publie sur un réseau social une capture de la plainte, avec l'adresse, « pour prévenir les autres ». Elle reçoit dans l'heure un message d'un « expert en récupération » à qui elle confirme qu'une enquête est ouverte. À 23:12 UTC, l'adresse est vidée : 181 950 USDT partent en quatre transactions vers un échangeur instantané sans KYC.

Leçons : consignes écrites à la victime dès la plainte ; demande de gel **sans délai** quand des stablecoins sont identifiés ; et exploitation du compte de l'« expert », qui appartient vraisemblablement au même réseau.`,
      },
      {
        type: 'check',
        q: 'Des USDT des auteurs sont identifiés sur deux adresses, et un compte chez Coinvault est alimenté par le même réseau. Quelle conduite est la plus prudente ?',
        options: [
          'Geler d\'abord une adresse et attendre de voir la réaction des auteurs',
          'Demander les blocages auprès de l\'émetteur et de Coinvault de façon coordonnée et simultanée',
          'Publier les adresses pour avertir les autres victimes',
          'Envoyer un message aux auteurs pour les inciter à rendre les fonds',
        ],
        answer: 1,
        explain: 'Un premier gel alerte les auteurs, qui videront aussitôt les autres avoirs. Les blocages doivent être coordonnés et simultanés.',
      },
      { type: 'heading', text: 'Intégrité de la preuve' },
      {
        type: 'widget',
        id: 'hash-playground',
        caption: 'Modifiez un seul caractère d\'un texte et regardez l\'empreinte SHA-256 changer entièrement : c\'est ce qui permet de prouver qu\'un fichier collecté n\'a pas été altéré.',
      },
      {
        type: 'steps',
        items: [
          { title: 'Collecter proprement', md: 'Exports d\'outils, captures, réponses de prestataires : conservez les fichiers originaux, sans les retoucher.' },
          { title: 'Calculer l\'empreinte', md: 'Empreinte SHA-256 de chaque fichier au moment de la collecte, consignée au procès-verbal.' },
          { title: 'Horodater', md: 'Date et heure de collecte avec fuseau ; pour les données on-chain, citer txid, hauteur de bloc et heure UTC, vérifiables par tous.' },
          { title: 'Conserver et tracer', md: 'Stockage sécurisé, copies de travail distinctes des originaux, traçabilité de qui a accédé à quoi.' },
          { title: 'Rendre reproductible', md: 'Noter l\'outil, sa version et les paramètres (profondeur d\'exposition, heuristiques activées) pour qu\'un expert puisse refaire l\'analyse.' },
        ],
      },
      { type: 'heading', text: 'Se protéger personnellement' },
      {
        type: 'text',
        md: `Les réseaux criminels qui manient des crypto-actifs ont souvent des compétences techniques. Réduisez votre **surface d'exposition** :

- limitez les informations professionnelles et personnelles publiques (réseaux sociaux, photos, famille, lieu de travail) ;
- méfiez-vous des sollicitations ciblées (faux journaliste, faux collègue étranger, faux « chercheur en sécurité » qui propose des données) : elles peuvent viser à vous identifier ou à compromettre votre poste ;
- n'ouvrez les fichiers issus de suspects ou de sources inconnues (PDF, archives, documents bureautiques) que dans un environnement isolé ;
- n'ayez **aucune** activité crypto personnelle mêlée à vos investigations, et signalez tout conflit d'intérêts.`,
      },
      {
        type: 'callout',
        kind: 'field',
        title: 'Sur le terrain : la question avant chaque action visible',
        md: `Avant de visiter un site, de geler, de contacter un prestataire non coopératif ou de laisser une victime agir : **« Si le suspect l'apprend dans l'heure, que perd-on ? »** Si la réponse est « les fonds » ou « la piste », l'action doit être décidée, coordonnée et, le plus souvent, différée jusqu'à ce que les mesures conservatoires soient prêtes.`,
      },
      {
        type: 'terms',
        items: [
          { term: 'OPSEC', def: 'Sécurité opérationnelle : précautions qui empêchent l\'adversaire d\'apprendre ce qu\'il ne doit pas savoir.' },
          { term: 'Environnement dédié', def: 'Poste ou machine virtuelle réservés aux investigations, cloisonnés du reste du système d\'information.' },
          { term: 'Déconfliction', def: 'Vérification qu\'aucun autre service n\'agit sur la même cible avant une action visible.' },
          { term: 'Empreinte SHA-256', def: 'Valeur calculée sur un fichier, qui change entièrement à la moindre modification et garantit son intégrité.' },
          { term: 'Gel coordonné', def: 'Demandes de blocage simultanées auprès de tous les détenteurs identifiés, pour éviter la dissipation du reste.' },
        ],
      },
    ],
    keyPoints: [
      'Un suspect alerté déplace ses fonds en minutes : chaque action visible se décide et se coordonne.',
      'Consulter une adresse est invisible ; visiter un site, envoyer une transaction, geler ou publier peut alerter.',
      'Environnement dédié, sortie réseau maîtrisée, identités cloisonnées, jamais de portefeuille connecté à un site suspect.',
      'Ne pas verser de données d\'enquête dans des outils en ligne non validés (directive 2016/680, secret de l\'enquête).',
      'Réquisitions confidentielles, gels simultanés, consignes écrites aux victimes, déconfliction.',
      'Intégrité de la preuve : fichiers originaux, empreinte SHA-256, horodatage, outil et paramètres consignés.',
    ],
    quiz: [
      {
        q: 'Laquelle de ces actions est susceptible d\'alerter le suspect ?',
        options: [
          'Consulter son adresse sur un explorateur public',
          'Visiter à plusieurs reprises son site frauduleux depuis le réseau du service',
          'Calculer l\'exposition de son adresse dans un outil',
          'Lire une copie archivée de son site',
        ],
        answer: 1,
        explain: 'Les visites laissent des traces dans les journaux du serveur du suspect, qui peut reconnaître une adresse IP institutionnelle.',
      },
      {
        kind: 'truefalse',
        q: 'Envoyer une petite transaction test vers l\'adresse d\'un suspect est sans risque, car le montant est négligeable.',
        options: ['Vrai', 'Faux'],
        answer: 1,
        explain: 'Toute transaction vers son adresse est visible du suspect, quel que soit le montant, et peut l\'alerter.',
      },
      {
        kind: 'multi',
        q: 'Quelles pratiques relèvent d\'une bonne OPSEC ? (plusieurs réponses)',
        options: [
          'Utiliser un poste ou une machine virtuelle dédiés aux investigations',
          'Demander la confidentialité dans chaque réquisition',
          'Coordonner les demandes de gel pour qu\'elles soient simultanées',
          'Coller les données KYC reçues dans un assistant en ligne non validé pour les résumer',
          'Donner des consignes écrites à la victime',
        ],
        answer: [0, 1, 2, 4],
        explain: 'Verser des données personnelles de la procédure dans un outil en ligne non validé est une fuite d\'information, contraire à la protection des données et au secret de l\'enquête.',
      },
      {
        q: 'Pourquoi coordonner plusieurs demandes de gel pour qu\'elles interviennent en même temps ?',
        options: [
          'Pour simplifier la rédaction',
          'Parce que le premier gel alerte les auteurs, qui videraient aussitôt les autres avoirs',
          'Parce que la loi interdit les gels successifs',
          'Pour réduire les frais',
        ],
        answer: 1,
        explain: 'Un blocage est visible : il faut frapper tous les avoirs identifiés en même temps.',
      },
      {
        q: 'Une victime vous remet sa phrase de récupération. Quelle conduite adopter ?',
        options: [
          'La saisir dans un portefeuille sur votre téléphone pour vérifier le solde',
          'La saisir sur le site de l\'escroc pour comparer',
          'La traiter comme un élément sensible : ne jamais la saisir sur un appareil connecté hors procédure formalisée',
          'L\'envoyer par e-mail à un collègue',
        ],
        answer: 2,
        explain: 'Une phrase de récupération donne le contrôle des fonds : sa manipulation suit une procédure formalisée et sécurisée.',
      },
      {
        kind: 'truefalse',
        q: 'Calculer l\'empreinte SHA-256 d\'un fichier collecté permet ensuite de démontrer qu\'il n\'a pas été modifié.',
        options: ['Vrai', 'Faux'],
        answer: 0,
        explain: 'La moindre modification change entièrement l\'empreinte. Consignée au PV, elle garantit l\'intégrité du fichier.',
      },
      {
        q: 'Une victime veut publier l\'adresse des escrocs sur les réseaux sociaux « pour prévenir les autres ». Que lui conseiller ?',
        options: [
          'De le faire, cela aidera l\'enquête',
          'De ne pas le faire tant que les mesures conservatoires ne sont pas prises, car cela peut alerter les auteurs',
          'De contacter d\'abord un service de récupération',
          'D\'envoyer un message aux auteurs pour les prévenir de la plainte',
        ],
        answer: 1,
        explain: 'Une publication peut provoquer la dissipation des fonds et attirer de faux services de récupération.',
      },
    ],
    flashcards: [
      { front: 'OPSEC', back: 'Précautions qui empêchent le suspect d\'apprendre qu\'il est visé (et protègent l\'enquêteur et la procédure).' },
      { front: 'Actions invisibles pour le suspect', back: 'Consulter un explorateur, analyser dans un outil, requérir un prestataire confidentiel, lire une archive.' },
      { front: 'Actions potentiellement visibles', back: 'Visiter son site, lui envoyer une transaction, geler, suivre ses profils, publier.' },
      { front: 'Règle d\'or des gels', back: 'Coordonnés et simultanés : le premier blocage alerte les auteurs.' },
      { front: 'Outils en ligne non validés', back: 'Ne pas y verser de données d\'enquête : fuite d\'information, protection des données, secret de l\'enquête.' },
      { front: 'Phrase de récupération remise par une victime', back: 'Élément sensible : jamais saisie sur un appareil connecté hors procédure formalisée.' },
      { front: 'Consignes à la victime', back: 'Ne pas publier, ne pas contacter l\'escroc, ignorer les offres de récupération, signaler tout nouveau contact.' },
      { front: 'Intégrité d\'un fichier collecté', back: 'Fichier original conservé, empreinte SHA-256 consignée, horodatage avec fuseau.' },
      { front: 'Question avant chaque action visible', back: '« Si le suspect l\'apprend dans l\'heure, que perd-on ? »' },
      { front: 'Déconfliction', back: 'Vérifier qu\'un autre service n\'agit pas sur la même cible avant une action visible.' },
    ],
    practice: ['first-trace', 'pig-butchering-tron', 'address-poisoning'],
  },
]
