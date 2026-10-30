// Niveau 3 — Enquête : extorsions physiques, home-jackings et enlèvements
// liés aux crypto-actifs. Les références juridiques doivent toujours être
// vérifiées dans les textes en vigueur.
import type { Lesson } from '../model'

export const LESSON_VIOLENCES_SEED: Lesson = {
  id: 'violences-seed',
  title: 'Extorsions physiques et enlèvements liés aux crypto-actifs',
  level: 3,
  track: 'enquete',
  minutes: 40,
  summary: `Quand la cryptographie est trop solide, les auteurs s'attaquent à la personne : séquestrations à domicile, enlèvements contre rançon en crypto-actifs, guet-apens lors de transactions en espèces. Ciblage des victimes, qualifications, conduite de l'urgence avec le parquet et les unités spécialisées, ce que l'enquêteur crypto fait sur la chaîne pendant l'événement (surveillance, préparation des gels, points de sortie), arbitrage du moment du gel, protection des victimes et conseils de sûreté aux détenteurs.`,
  objectives: [
    `Reconnaître les typologies d'atteintes physiques liées aux crypto-actifs et les signaux de ciblage.`,
    `Situer les principales qualifications et le cadre procédural de la criminalité organisée, avec prudence.`,
    `Tenir le rôle de l'enquêteur crypto dans une cellule de crise : surveillance en temps réel, gels préparés, identification des points de sortie, journal horodaté.`,
    `Arbitrer avec le magistrat et le commandement le moment des gels lorsque la vie d'une personne est en jeu.`,
    `Conseiller victimes et détenteurs exposés sur les mesures de sûreté techniques et comportementales.`,
  ],
  prerequisites: ['gel-saisie', 'suivre-flux', 'tron-usdt', 'requisitions', 'opsec-enqueteur'],
  practice: ['tron-kidnapping-ransom'],
  blocks: [
    {
      type: 'text',
      md: `Dans la culture crypto, on appelle « attaque à la clé à molette » (*wrench attack*) le fait de contourner une sécurité informatique irréprochable par la violence : à quoi bon casser une clé privée quand on peut contraindre son détenteur ? Le phénomène est ancien, mais il a pris une ampleur nouvelle avec la hausse des cours et l'exposition publique de certains détenteurs.

La France a connu, depuis fin 2024 et surtout en 2025, **plusieurs affaires très médiatisées** : enlèvements et séquestrations visant des entrepreneurs du secteur ou leurs proches, tentatives d'enlèvement en pleine rue, violences graves destinées à obtenir une rançon en crypto-actifs. Ces affaires ont mobilisé les juridictions spécialisées, les unités d'élite et les enquêteurs crypto.

Pour vous, l'enjeu est double : **pendant** l'événement, apporter à la cellule de crise une lecture en temps réel de la chaîne et des leviers de gel ; **après**, remonter des flux de rançon vers des identités. Avec une règle qui domine tout le reste : **la vie des victimes passe avant les fonds**.`,
    },
    { type: 'heading', text: 'Les typologies' },
    {
      type: 'table',
      caption: 'Atteintes physiques liées aux crypto-actifs',
      headers: ['Typologie', 'Mode opératoire', 'Ce que veulent les auteurs', 'Traces crypto'],
      rows: [
        ['Séquestration à domicile (home-jacking)', 'Intrusion, souvent sous un prétexte (faux livreur, faux agent), victime contrainte de déverrouiller ses appareils', 'Transfert immédiat depuis les portefeuilles de la victime, seed, portefeuilles matériels', 'Transactions sortantes horodatées pendant l’intrusion'],
        ['Enlèvement contre rançon', 'Victime ou proche enlevé, rançon exigée de la famille ou de l’associé', 'Paiement en USDT ou BTC vers une adresse fournie par les ravisseurs', 'Adresse de rançon, puis dispersion'],
        ['Guet-apens lors d’une transaction', 'Rendez-vous « cash contre crypto » ou vente de matériel, agression sur place', 'Espèces, téléphone déverrouillé, transfert forcé', 'Annonces, conversations, adresse de réception'],
        ['Extorsion par menaces', 'Menaces visant la famille, sans passage à l’acte immédiat', 'Paiements répétés', 'Adresses de paiement successives'],
        ['Violences d’intimidation', 'Agression d’un proche pour faire pression', 'Paiement ou cession d’actifs d’entreprise', 'Variable'],
      ],
    },
    { type: 'heading', text: 'Le ciblage : comment les auteurs choisissent' },
    {
      type: 'text',
      md: `Les dossiers montrent des équipes souvent **organisées en strates** : des commanditaires qui repèrent et financent, des intermédiaires qui recrutent, des exécutants recrutés pour l'occasion (parfois très jeunes, parfois via des messageries, contre quelques milliers d'euros). Le ciblage s'appuie sur :

- **l'exposition publique** : patrimoine affiché sur les réseaux sociaux, captures de portefeuilles, train de vie, interviews, conférences ;
- **les registres publics** : dirigeants de sociétés du secteur dont l'adresse personnelle est accessible, siège social au domicile ;
- **les fuites de données** : bases clients de vendeurs de matériel ou de plateformes ayant fuité, bases issues d'escroqueries ;
- **le lien adresse–identité** : nom de domaine blockchain ou NFT affiché sur un profil, adresse publiée pour recevoir des dons, captures d'écran avec soldes ;
- **l'entourage** : proches, employés ou prestataires qui connaissent les habitudes et la détention.`,
    },
    {
      type: 'callout',
      kind: 'field',
      title: 'Signaux faibles avant le passage à l’acte',
      md: `Repérages autour du domicile ou des bureaux, véhicules volés ou faussement immatriculés stationnant à proximité, balise GPS découverte, tentatives d'hameçonnage très ciblées, appels de faux services de sécurité, livraisons non commandées, intérêt inhabituel d'un tiers pour l'emploi du temps des enfants. Un signalement de ce type par un acteur du secteur doit être **pris au sérieux et recoupé**, et peut justifier un diagnostic de sûreté.`,
    },
    {
      type: 'callout',
      kind: 'law',
      title: 'Qualifications et cadre (à vérifier dans les textes en vigueur)',
      md: `- **Arrestation, enlèvement, séquestration** : articles 224-1 et suivants du code pénal ; la qualification s'aggrave notamment lorsque la personne est détenue comme otage pour obtenir l'exécution d'un ordre ou d'une condition, comme le versement d'une rançon (article 224-4).
- **Extorsion** : articles 312-1 et suivants, avec des circonstances aggravantes (violences, arme, bande organisée).
- **Vol avec violences**, **association de malfaiteurs** (article 450-1) selon les faits.
- Commises en **bande organisée**, ces infractions relèvent pour l'essentiel de la liste de la criminalité organisée (article 706-73 du CPP), qui ouvre des techniques spéciales d'enquête et la compétence des juridictions spécialisées (JIRS).

Les choix de qualification et de juridiction appartiennent au parquet ; votre rôle est de lui apporter vite des éléments fiables.`,
    },
    { type: 'heading', text: 'Pendant l’événement : la cellule de crise' },
    {
      type: 'text',
      md: `Un enlèvement en cours est conduit par une **cellule de crise** sous la direction du magistrat, avec les enquêteurs saisis, les **négociateurs** et les **unités d'intervention spécialisées** (en gendarmerie, le GIGN et ses antennes). La stratégie de négociation, l'éventuel paiement et l'intervention ne relèvent pas de l'enquêteur crypto. Lui apporte trois choses : une **lecture en temps réel** de la chaîne, des **leviers prêts à l'emploi** (gels, demandes urgentes aux prestataires) et une **évaluation des conséquences** de chaque option technique.`,
    },
    {
      type: 'flow',
      caption: `Enlèvement contre rançon en USDT-TRC20 : ce que voit l'enquêteur crypto et où se situent les leviers. Le gel (en pointillé) n'est déclenché que sur décision de la cellule de crise.`,
      nodes: [
        { id: 'fam', label: 'Famille de l’otage', kind: 'victim', sub: '250 000 USDT exigés' },
        { id: 'r', label: 'Adresse de rançon', kind: 'suspect', sub: 'TXr4…k9Pq (neuve)' },
        { id: 'trx', label: 'Financeur en TRX', kind: 'wallet', sub: 'a fourni le TRX/énergie' },
        { id: 'sun', label: 'SunSwap', kind: 'dex', sub: 'USDT → TRX' },
        { id: 'dep', label: 'Adresse de dépôt OKX', kind: 'deposit', sub: 'client identifiable' },
        { id: 'ex', label: 'Exécutants', kind: 'unknown', sub: '6 petites adresses' },
        { id: 'teth', label: 'Tether', kind: 'service', sub: 'gel préparé' },
      ],
      edges: [
        { from: 'fam', to: 'r', label: 'paiement sous contrôle de la cellule' },
        { from: 'trx', to: 'r', label: 'financement des frais (piste !)' },
        { from: 'r', to: 'sun', label: 'échappe au gel si converti' },
        { from: 'r', to: 'dep', label: '80 000 USDT' },
        { from: 'r', to: 'ex', label: 'paiement des petites mains' },
        { from: 'teth', to: 'r', label: 'gel sur décision', dashed: true },
      ],
    },
    {
      type: 'steps',
      items: [
        { title: 'Recueillir les éléments crypto', md: `Adresses exigées (copies exactes des messages, captures, en-têtes), chaîne et actif demandés, montants, délais imposés, moyens de communication des ravisseurs. Identifier immédiatement la chaîne et le type d'adresse ; vérifier l'historique de chaque adresse (neuve ou déjà utilisée ?).` },
        { title: 'Mettre sous surveillance', md: `Toutes les adresses connues : adresses de rançon et, en cas de séquestration à domicile, **adresses de la victime** (obtenues auprès d'elle, de ses proches, de ses appareils ou de sa comptabilité). Chaque mouvement est horodaté en UTC et signalé à la cellule.` },
        { title: 'Remonter le financement', md: `Une adresse Tron neuve a besoin de TRX ou d'énergie pour déplacer des USDT ; une adresse EVM a besoin de gaz. **Qui l'a financée ?** L'adresse qui a fourni ces frais est souvent liée à l'historique des auteurs (retrait d'exchange, ancien portefeuille) : c'est fréquemment la meilleure piste d'identification.` },
        { title: 'Préparer les gels', md: `Rédiger à l'avance les demandes aux émetteurs (Tether, Circle) et aux exchanges susceptibles de recevoir les fonds, avec adresses, chaîne, référence de procédure et contact joignable en continu. Ne les envoyer **que sur décision** de la cellule.` },
        { title: 'Pré-alerter les points de sortie', md: `Avec l'accord du magistrat, contacter par les canaux d'urgence les exchanges vers lesquels les flux pourraient se diriger : la plupart prévoient une procédure pour les situations de danger imminent pour la vie. Demander la conservation des données et une alerte en cas de dépôt.` },
        { title: 'Évaluer chaque option', md: `Pour chaque levier, indiquer à la cellule ce qu'il produit et ce qu'il risque : un gel visible on-chain peut être détecté par les ravisseurs ; une conversion en TRX ou en ETH rendrait le gel de l'émetteur inopérant ; un dépôt sur un exchange ouvre une identification.` },
        { title: 'Tenir le journal', md: `Journal horodaté (UTC et heure locale) de chaque constatation, demande, réponse et décision. Il servira à la procédure et au retour d'expérience.` },
      ],
    },
    {
      type: 'callout',
      kind: 'warn',
      title: 'Le gel n’est pas toujours le premier geste',
      md: `Dans une escroquerie, on gèle le plus vite possible. Dans un enlèvement **en cours**, geler la rançon peut être perçu par les ravisseurs (le gel est visible sur la chaîne, et un transfert qui échoue se remarque) et exposer l'otage. Le moment du gel est donc une **décision de la cellule de crise et du magistrat**, éclairée par votre analyse. Une fois la victime libérée ou en sécurité, la logique s'inverse : gels massifs, réquisitions urgentes, saisies.`,
    },
    {
      type: 'check',
      q: `L'otage est toujours détenu. La rançon (250 000 USDT-TRC20) vient d'arriver sur l'adresse fournie par les ravisseurs. Quelle conduite est la bonne ?`,
      options: [
        `Envoyer immédiatement la demande de gel à Tether sans prévenir personne`,
        `Ne rien faire tant que l'affaire n'est pas terminée`,
        `Informer la cellule de crise, maintenir la surveillance, garder la demande de gel prête et ne la déclencher que sur décision`,
        `Contacter les ravisseurs pour leur signaler que les fonds sont tracés`,
      ],
      answer: 2,
      explain: `La sécurité de l'otage prime : le gel est un levier puissant mais visible, dont le déclenchement relève de la cellule de crise et du magistrat. La préparation et la surveillance, elles, ne coûtent rien.`,
    },
    { type: 'heading', text: 'Lire la chaîne pendant et après' },
    {
      type: 'text',
      md: `Les flux de rançon suivent souvent un schéma reconnaissable :

1. **Arrivée** sur une adresse neuve, financée quelques minutes ou heures avant en TRX ou en gaz.
2. **Fractionnement rapide** : quelques grosses parts pour les commanditaires, plusieurs petites pour les exécutants (paiements de quelques milliers d'USDT vers des adresses elles-mêmes neuves).
3. **Fuite du risque de gel** : conversion d'USDT en TRX ou en ETH sur un DEX, passage par un échangeur instantané, pont vers une autre chaîne.
4. **Encaissement** : dépôts sur des exchanges (parfois offshore), remises d'espèces auprès de courtiers OTC, achat de biens.

Chaque étape ouvre un levier : le financement désigne un portefeuille antérieur, les petites adresses des exécutants mènent souvent à des exchanges grand public (et à des identités), les dépôts permettent réquisitions et gels.

En cas de **séquestration à domicile**, la chronologie des transactions sortantes des portefeuilles de la victime, rapprochée de son récit et des éléments techniques (vidéo, téléphonie), date précisément le moment de la contrainte et désigne les adresses de réception des auteurs.`,
    },
    {
      type: 'widget',
      id: 'exchange-flow',
      caption: `Quand une part de la rançon atteint un exchange, c'est l'adresse de dépôt qui désigne le compte à geler et à réquisitionner, pas le hot wallet.`,
    },
    {
      type: 'case',
      title: 'Cas pratique — séquestration à domicile',
      md: `Nuit du 14 au 15 mars 2026, agglomération lyonnaise. Trois individus se présentant comme livreurs s'introduisent chez un développeur de logiciels connu pour ses publications sur les crypto-actifs. Sous la menace, il déverrouille son portefeuille matériel. Les auteurs repartent à 02 h 58 (heure locale). L'alerte est donnée à 03 h 20.

À 03 h 45, l'enquêteur crypto obtient de l'épouse l'accès à l'ordinateur familial : l'application compagnon du portefeuille matériel affiche les comptes et leurs xpub. Constatations :

- **01:47 UTC** : 2,35 BTC envoyés vers bc1q…7td2 (adresse neuve) ;
- **01:52 UTC** : 61 000 USDT (Ethereum) envoyés vers 0x91f3…be20, financée à 01:31 UTC en 0,004 ETH par l'adresse 0x4a0c…19e7.

La victime étant en sécurité, le magistrat autorise à 04 h 10 la demande de gel à Tether. Elle est effective à 09 h 32 : **58 200 USDT** sont bloqués, 2 800 ayant été convertis en ETH entre-temps. Côté Bitcoin, 0,41 BTC part vers un échangeur instantané (réquisition le jour même), le reste entame une chaîne de pelage, mise sous surveillance.

La piste décisive vient du financement : 0x4a0c…19e7 avait reçu six semaines plus tôt un retrait d'un exchange européen. La réquisition identifie son titulaire, un homme de 22 ans dont la téléphonie confirme la présence près du domicile cette nuit-là.`,
    },
    {
      type: 'case',
      title: 'Cas pratique — rançon fractionnée',
      md: `Un proche d'une dirigeante de société est enlevé ; les ravisseurs exigent 250 000 USDT-TRC20. Le paiement, décidé par la cellule de crise, arrive sur TXr4…k9Pq à 16:12 UTC. L'otage est libéré à 19:40 UTC. Entre-temps, l'adresse a :

- envoyé 6 × 4 000 USDT à six adresses neuves (16:30–16:41 UTC) ;
- converti 60 000 USDT en TRX sur SunSwap (16:55 UTC) ;
- déposé 80 000 USDT sur une adresse de dépôt OKX (17:20 UTC) ;
- conservé **86 000 USDT**.

À 19:45 UTC, demande de gel à Tether sur TXr4…k9Pq et sur les six adresses des exécutants (24 000 USDT encore présents sur cinq d'entre elles) ; demande urgente de gel et de données à OKX. Trois des six exécutants ont ensuite déposé leurs TRX sur des exchanges grand public : leurs identités sont obtenues en quelques jours.`,
    },
    { type: 'heading', text: 'Protéger les victimes et les détenteurs exposés' },
    {
      type: 'text',
      md: `Les victimes d'atteintes violentes ont besoin d'un accompagnement (aide aux victimes, soutien psychologique, information sur leurs droits) et parfois de mesures de protection : discrétion sur leur adresse dans la procédure dans les conditions prévues par le CPP, protection de leurs proches, sécurisation du domicile. Elles sont aussi des sources essentielles : ce qu'elles savent de leurs propres portefeuilles (comptes, chaînes, phrase de passe, contacts récents, personnes informées de leur patrimoine) oriente l'enquête.

Pour les **détenteurs exposés** (entrepreneurs du secteur, investisseurs visibles), la prévention relève à la fois de la sûreté physique et de l'architecture de leurs portefeuilles. Les référents sûreté de la gendarmerie peuvent réaliser des diagnostics ; les pouvoirs publics ont annoncé en 2025 des mesures d'accompagnement du secteur, dont il faut vérifier le contenu en vigueur.`,
    },
    {
      type: 'table',
      caption: 'Conseils de sûreté aux détenteurs : ce que chaque mesure protège, et ses limites',
      headers: ['Mesure', 'Effet recherché', 'Limite'],
      rows: [
        ['Discrétion : aucun affichage de patrimoine, de capture de solde ou d’adresse liée à l’identité', 'Ne pas devenir une cible', 'Les fuites passées ne s’effacent pas'],
        ['Adresse personnelle protégée (domiciliation de la société ailleurs, vigilance sur les registres et réseaux)', 'Empêcher la localisation', 'Les proches restent identifiables'],
        ['Multisignature avec clés réparties en lieux distincts ou chez un tiers de confiance (par exemple 2 sur 3)', 'Rendre impossible un transfert complet sous contrainte sur place', 'Complexité, risque de perte si mal géré'],
        ['Verrous temporels et coffres à délai (dépense différée, voie d’annulation)', 'Laisser le temps de réagir et de faire geler', 'Moins de souplesse au quotidien'],
        ['Prestataire régulé avec liste blanche d’adresses de retrait et délai pour toute nouvelle adresse', 'Bloquer un retrait forcé vers l’adresse des auteurs', 'Confiance dans le prestataire'],
        ['Portefeuille leurre (petit solde) et fonds principaux derrière une phrase de passe', 'Satisfaire un agresseur avec une somme limitée', 'Les auteurs connaissent la technique : ne jamais en faire un motif de résistance'],
        ['Plan d’urgence : mot code avec les proches, numéros d’urgence, alarme', 'Alerter vite', 'Doit être répété pour fonctionner'],
      ],
    },
    {
      type: 'callout',
      kind: 'tip',
      title: 'Le message à faire passer',
      md: `Face à une agression, **ne pas résister** : aucune somme ne vaut une vie. Les mesures techniques servent à **dissuader** en amont (une attaque qui ne peut rien rapporter sur place perd son intérêt) et à **récupérer** ensuite (délais, listes blanches, traçage, gel). Encouragez aussi le dépôt de plainte rapide : chaque heure compte pour geler.`,
    },
    {
      type: 'compare',
      left: {
        title: 'Détenteur exposé',
        md: `- Publie ses gains et des captures de son portefeuille.
- Société domiciliée chez lui, adresse retrouvable en ligne.
- Tout son patrimoine sur un portefeuille matériel unique, seed dans le tiroir du bureau.
- Aucun délai, aucune liste blanche : tout peut partir en cinq minutes.`,
      },
      right: {
        title: 'Détenteur protégé',
        md: `- Aucune communication sur son patrimoine.
- Siège social et courrier découplés du domicile.
- Multisignature 2 sur 3, une clé hors du domicile ; épargne derrière un délai de dépense.
- Petit portefeuille de dépenses courantes ; liste blanche et délai chez son prestataire ; plan d'urgence familial.`,
      },
    },
    {
      type: 'terms',
      items: [
        { term: 'Wrench attack', def: `Contrainte physique exercée sur le détenteur pour obtenir ses clés ou un transfert, contournant toute sécurité technique.` },
        { term: 'Adresse de rançon', def: `Adresse fournie par les auteurs ; souvent neuve, financée en frais juste avant le paiement.` },
        { term: 'Financeur de frais', def: `Adresse qui a fourni le TRX, l'énergie ou le gaz à l'adresse de rançon : piste d'identification majeure.` },
        { term: 'Multisignature', def: `Dépense exigeant plusieurs clés (par exemple 2 sur 3) : une seule clé saisie sous contrainte ne suffit pas.` },
        { term: 'Verrou temporel', def: `Condition de script interdisant de dépenser avant une date ou un délai (CLTV/CSV sur Bitcoin) ; base des coffres à délai.` },
        { term: 'Liste blanche de retrait', def: `Réglage d'un prestataire limitant les retraits à des adresses préenregistrées, avec délai pour en ajouter.` },
      ],
    },
    {
      type: 'check',
      q: `Une adresse de rançon Tron, neuve, a reçu 35 TRX vingt minutes avant le paiement. Pourquoi cet élément est-il précieux ?`,
      options: [
        `Parce que les TRX peuvent être gelés par Tether`,
        `Parce que l'adresse qui a fourni ces frais est souvent liée à l'historique des auteurs et peut mener à une identité`,
        `Parce qu'il prouve que la rançon a été payée en TRX`,
        `Il n'a aucun intérêt`,
      ],
      answer: 1,
      explain: `Pour déplacer des USDT, l'adresse doit disposer de TRX ou d'énergie. Le financeur provient souvent d'un retrait d'exchange ou d'un portefeuille déjà utilisé : c'est une piste de premier ordre.`,
    },
  ],
  keyPoints: [
    `Wrench attacks, home-jackings, enlèvements contre rançon et guet-apens : la violence contourne la cryptographie ; la vie prime toujours sur les fonds.`,
    `Le ciblage exploite l'exposition publique, les registres, les fuites de données, le lien adresse–identité et l'entourage.`,
    `Qualifications usuelles : séquestration (224-1 et s., 224-4 pour l'otage contre rançon), extorsion (312-1 et s.), association de malfaiteurs ; criminalité organisée (706-73) : à vérifier avec le parquet.`,
    `En cellule de crise, l'enquêteur crypto surveille, remonte le financement des frais, prépare gels et demandes urgentes, et évalue chaque option.`,
    `Le gel d'une rançon pendant la détention est une décision de la cellule et du magistrat ; après la libération, gels et réquisitions massifs.`,
    `Schéma typique : adresse neuve financée juste avant, fractionnement (commanditaires, exécutants), conversion pour échapper au gel, encaissement.`,
    `Prévention : discrétion, multisignature, verrous temporels, listes blanches et délais, portefeuille leurre sans jamais inciter à résister.`,
  ],
  quiz: [
    {
      q: `Dans un enlèvement en cours, qui décide du déclenchement d'un gel sur l'adresse de rançon ?`,
      options: [
        `L'enquêteur crypto seul, dès qu'il voit les fonds`,
        `L'émetteur du stablecoin, de sa propre initiative`,
        `La cellule de crise sous la direction du magistrat, éclairée par l'analyse de l'enquêteur crypto`,
        `La famille de l'otage`,
      ],
      answer: 2,
      explain: `Le gel peut être perçu par les ravisseurs et exposer l'otage : c'est une décision de conduite de crise, pas un réflexe technique.`,
    },
    {
      kind: 'multi',
      q: `Quels éléments la cellule de crise doit-elle attendre de l'enquêteur crypto ? (plusieurs réponses)`,
      options: [
        `La surveillance horodatée des adresses de rançon et de la victime`,
        `Des demandes de gel et des contacts d'urgence prêts à partir`,
        `La conduite de la négociation avec les ravisseurs`,
        `L'identification du financeur des frais de l'adresse de rançon`,
      ],
      answer: [0, 1, 3],
      explain: `La négociation relève des négociateurs spécialisés. L'enquêteur crypto apporte la lecture de la chaîne, les leviers prêts et les pistes d'identification.`,
    },
    {
      kind: 'truefalse',
      q: `Si les ravisseurs convertissent les USDT en TRX sur un DEX, une demande de gel à Tether ne permet plus de bloquer les montants convertis.`,
      options: ['Vrai', 'Faux'],
      answer: 0,
      explain: `L'émetteur ne contrôle que son jeton : une fois convertis en TRX (actif natif), les fonds échappent à son gel. D'où l'importance du temps et de la surveillance des points de sortie.`,
    },
    {
      q: `Après une séquestration à domicile, quelle source donne le plus rapidement les adresses de réception des auteurs ?`,
      options: [
        `Les transactions sortantes des portefeuilles de la victime pendant la plage horaire de l'intrusion`,
        `Un annuaire public des adresses crypto`,
        `Le registre du commerce`,
        `Le dernier bloc miné sur Bitcoin`,
      ],
      answer: 0,
      explain: `Les comptes de la victime (application compagnon, xpub, comptabilité) montrent les envois réalisés sous contrainte, horodatés, vers les adresses des auteurs.`,
    },
    {
      kind: 'multi',
      q: `Quelles mesures réduisent l'intérêt d'une agression pour un détenteur exposé ? (plusieurs réponses)`,
      options: [
        `Une multisignature dont une clé est conservée hors du domicile`,
        `Un délai de dépense ou une liste blanche de retrait chez son prestataire`,
        `La publication régulière de captures de son portefeuille pour rassurer sa communauté`,
        `L'absence de toute communication publique sur son patrimoine`,
      ],
      answer: [0, 1, 3],
      explain: `Publier son patrimoine attire au contraire les auteurs. Les autres mesures rendent un transfert complet sous contrainte impossible ou différé.`,
    },
    {
      q: `Que signifie la qualification d'otage prévue à l'article 224-4 du code pénal, dans le contexte d'une rançon en crypto-actifs ?`,
      options: [
        `Elle ne s'applique qu'aux rançons en euros`,
        `Elle vise la personne détenue notamment pour obtenir l'exécution d'une condition comme le versement d'une rançon, quelle qu'en soit la forme`,
        `Elle ne vise que les prises d'otages dans un aéronef`,
        `Elle remplace l'extorsion`,
      ],
      answer: 1,
      explain: `La nature de la rançon (espèces, virement, crypto-actifs) est indifférente ; la qualification exacte se vérifie avec le parquet.`,
    },
    {
      kind: 'truefalse',
      q: `Il faut conseiller aux détenteurs de résister à un agresseur en invoquant leur portefeuille leurre.`,
      options: ['Vrai', 'Faux'],
      answer: 1,
      explain: `Les auteurs connaissent la technique et l'escalade est imprévisible. Le message est de ne jamais résister ; les mesures techniques servent à dissuader en amont et à récupérer ensuite.`,
    },
  ],
  flashcards: [
    { front: 'Wrench attack', back: `Contrainte physique pour obtenir clés ou transferts : la violence contourne la cryptographie.` },
    { front: 'Règle cardinale en enlèvement', back: `La vie avant les fonds : le moment du gel relève de la cellule de crise et du magistrat.` },
    { front: 'Financeur des frais', back: `L'adresse qui a fourni TRX, énergie ou gaz à l'adresse de rançon : piste d'identification majeure.` },
    { front: 'Schéma de rançon', back: `Adresse neuve financée → fractionnement → conversion hors du jeton gelable → encaissement.` },
    { front: 'Séquestration à domicile : première source', back: `Transactions sortantes des portefeuilles de la victime pendant l'intrusion (xpub, application compagnon).` },
    { front: 'Otage contre rançon', back: `Art. 224-4 CP (à vérifier) ; bande organisée : régime 706-73 CPP.` },
    { front: 'Pré-alerte des exchanges', back: `Canaux d'urgence pour danger imminent pour la vie : conservation des données, alerte en cas de dépôt.` },
    { front: 'Multisignature 2 sur 3', back: `Une clé saisie sous contrainte ne suffit pas à dépenser.` },
    { front: 'Liste blanche de retrait', back: `Retraits limités à des adresses préenregistrées, délai pour en ajouter : bloque un retrait forcé.` },
    { front: 'Portefeuille leurre', back: `Petit solde visible, fonds principaux derrière une phrase de passe ; jamais un motif de résistance.` },
  ],
}
