// Affaires décryptées — niveau 3 : Colonial Pipeline, Silk Road, Hydra.
// Affaires RÉELLES : seuls les faits établis par des sources publiques
// (communiqués officiels, documents judiciaires, presse de référence) sont
// rapportés. Les illustrations chiffrées sont signalées comme fictives.
import type { Lesson } from '../model'

export const LESSONS_AFFAIRES_N3: Lesson[] = [
  // ══════════════════════════════════════════════════════════════════════════
  // COLONIAL PIPELINE
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'affaire-colonial',
    title: 'Affaire décryptée : la rançon de Colonial Pipeline',
    level: 3,
    track: 'affaires',
    minutes: 30,
    summary: `Mai 2021 : le rançongiciel DarkSide paralyse le principal oléoduc de la côte Est des États-Unis. L'opérateur paie environ 75 BTC. Un mois plus tard, le département de la Justice américain annonce la saisie de 63,7 BTC. Retour sur la chronologie, le flux de la rançon, ce qui a rendu la saisie possible et ce qu'un enquêteur français peut en retenir.`,
    objectives: [
      `Retracer la chronologie de l'affaire et le circuit de la rançon, du paiement à la saisie.`,
      `Expliquer pourquoi 63,7 BTC seulement ont été saisis, et pourquoi la valeur en dollars a fondu.`,
      `Distinguer ce qui relève de la technique (traçage) et ce qui relève du droit (mandat de saisie) dans une récupération.`,
      `Transposer les enseignements à une procédure française : recueil immédiat, surveillance, saisie, coopération.`,
    ],
    prerequisites: ['ransomware', 'peel-chains', 'gel-saisie'],
    practice: ['ransomware-raas', 'peel-chain'],
    blocks: [
      {
        type: 'text',
        md: `Le **7 mai 2021**, Colonial Pipeline, qui exploite l'un des principaux réseaux d'oléoducs de carburant de la côte Est des États-Unis, découvre une attaque par rançongiciel. Par précaution, l'entreprise **arrête l'ensemble de son réseau**. Les perturbations d'approvisionnement qui suivent font de l'affaire un événement national.

L'attaque est attribuée à **DarkSide**, un groupe opérant en mode « Ransomware-as-a-Service » (RaaS). L'entreprise paie une rançon d'environ **75 BTC**, soit environ **4,4 millions de dollars** à l'époque. Le **7 juin 2021**, le département de la Justice (DOJ) annonce avoir saisi **63,7 BTC**, valorisés alors à environ **2,3 millions de dollars**.

Cette affaire est devenue un cas d'école : elle montre qu'une rançon payée en bitcoins n'est **pas** forcément perdue, à condition d'aller vite et de disposer, au bon moment, de l'outil juridique adapté.`,
      },
      {
        type: 'callout',
        kind: 'field',
        title: 'Pourquoi étudier ce dossier',
        md: `- C'est l'une des premières récupérations publiques d'une rançon par les autorités américaines.
- Le traçage décrit par le DOJ repose sur la **lecture du registre public** Bitcoin, accessible à tout enquêteur.
- La saisie illustre la différence entre **suivre** des fonds et **pouvoir les appréhender** : il faut une adresse identifiée, un titre juridique et un accès effectif.`,
      },
      { type: 'heading', text: 'Chronologie' },
      {
        type: 'steps',
        items: [
          { title: '7 mai 2021 — l’attaque', md: `Colonial découvre l'intrusion tôt le matin. Selon le témoignage de son dirigeant devant le Sénat, la décision d'arrêter tout l'oléoduc est prise en moins d'une heure.` },
          { title: '8 mai 2021 — le paiement', md: `La rançon, d'environ 75 BTC, est payée. L'entreprise indique avoir eu recours à des experts et à des négociateurs, et avoir informé le FBI.` },
          { title: 'Mai 2021 — le traçage', md: `Selon le DOJ, en examinant le registre public, les enquêteurs suivent plusieurs transferts et identifient environ 63,7 BTC, produit de la rançon, arrivés sur une adresse précise.` },
          { title: '7 juin 2021 — la saisie', md: `Le DOJ annonce la saisie des 63,7 BTC, sur la base d'un mandat de saisie autorisé par une juge du district nord de Californie. L'opération est conduite avec le FBI de San Francisco, dans le cadre du groupe de travail du DOJ consacré aux rançongiciels et à l'extorsion numérique.` },
          { title: '8 juin 2021 — l’audition', md: `Le dirigeant de Colonial est auditionné par une commission du Sénat. Il y explique sa décision de payer et la porte d'entrée de l'attaque : un ancien accès VPN protégé par un simple mot de passe.` },
        ],
      },
      {
        type: 'text',
        md: `**Le modèle DarkSide.** Comme d'autres groupes RaaS, DarkSide fournissait le logiciel et l'infrastructure à des **affiliés** qui menaient les intrusions. Chaque rançon était partagée. Selon l'analyse publiée par la société Elliptic, la rançon de Colonial a été répartie à raison d'environ **85 % pour l'affilié** (63,75 BTC) et **15 % pour le développeur**. Le montant saisi correspond donc, pour l'essentiel, à la **part de l'affilié**, et non à la totalité de la rançon.`,
      },
      { type: 'heading', text: 'Le flux de la rançon' },
      {
        type: 'flow',
        caption: `Schéma simplifié, établi d'après le communiqué du DOJ (7 juin 2021) et l'analyse publiée par Elliptic. Montants arrondis ; les adresses intermédiaires ne sont pas représentées.`,
        nodes: [
          { id: 'v', label: 'Colonial Pipeline', kind: 'victim', sub: 'paiement avec ses conseils' },
          { id: 'ra', label: 'Adresse de rançon', kind: 'suspect', sub: '≈ 75 BTC' },
          { id: 'sp', label: 'Partage RaaS', kind: 'tx', sub: '≈ 85 / 15' },
          { id: 'dev', label: 'Part développeur', kind: 'suspect', sub: '≈ 15 % — non saisie' },
          { id: 'aff', label: 'Part affilié', kind: 'suspect', sub: '≈ 63,75 BTC' },
          { id: 'hops', label: 'Transferts successifs', kind: 'tx', sub: 'petits montants détachés' },
          { id: 'tgt', label: 'Adresse identifiée', kind: 'wallet', sub: '63,7 BTC' },
          { id: 'fbi', label: 'Saisie FBI', kind: 'service', sub: 'mandat judiciaire' },
        ],
        edges: [
          { from: 'v', to: 'ra', label: '8 mai 2021' },
          { from: 'ra', to: 'sp' },
          { from: 'sp', to: 'dev', label: '15 %' },
          { from: 'sp', to: 'aff', label: '85 %' },
          { from: 'aff', to: 'hops' },
          { from: 'hops', to: 'tgt' },
          { from: 'tgt', to: 'fbi', label: 'clé détenue par le FBI' },
        ],
      },
      { type: 'heading', text: 'Ce qui a permis la saisie' },
      {
        type: 'table',
        caption: 'Les ressorts de la récupération et leurs limites',
        headers: ['Ressort', 'Ce que montrent les sources', 'Limite'],
        rows: [
          ['Signalement rapide', 'La victime a informé le FBI et coopéré dès le paiement', 'Suppose une victime qui signale vite et transmet adresse et txid'],
          ['Lecture du registre public', 'Le DOJ décrit le suivi de plusieurs transferts jusqu’à une adresse', 'Le traçage localise les fonds, il ne les immobilise pas'],
          ['Lecture du modèle RaaS', 'Le partage 85/15 explique pourquoi seule la part affilié a été visée', 'La part développeur a suivi un autre chemin'],
          ['Accès à la clé privée', 'L’affidavit indique que la clé de l’adresse était en possession du FBI', 'Le mode d’obtention n’a pas été rendu public : rien de reproductible'],
          ['Titre juridique', 'Mandat de saisie délivré par une juge du district nord de Californie', 'Une saisie exige toujours une décision, même quand la clé est accessible'],
        ],
      },
      {
        type: 'case',
        title: 'Le moment pivot : une adresse dont on détient la clé',
        md: `Sur une blockchain publique, n'importe qui peut **voir** des bitcoins. Seul le détenteur de la clé privée peut les **déplacer**. Le point décisif de l'affaire tient en une phrase de l'affidavit de saisie, rapportée par la presse : la clé privée de l'adresse visée se trouvait **en possession du FBI** dans le district nord de Californie.

Les autorités n'ont pas expliqué comment cette clé avait été obtenue. Des hypothèses ont circulé dans la presse, mais aucune n'a été confirmée officiellement : il ne faut donc **pas** en faire un enseignement technique. Ce que l'on peut retenir, c'est l'enchaînement :

1. Le traçage identifie **l'adresse** sur laquelle les fonds se sont arrêtés.
2. Les fonds y restent **plusieurs semaines** : l'affilié ne les a ni convertis ni dispersés davantage.
3. Une **décision judiciaire** autorise la saisie.
4. L'accès à la clé permet de **transférer** les fonds vers une adresse contrôlée par l'État.

Sans l'étape 1, rien n'était possible. Sans l'étape 3, la saisie n'aurait eu aucune base légale.`,
      },
      {
        type: 'check',
        q: `Pourquoi le DOJ a-t-il saisi 63,7 BTC et non les 75 BTC de la rançon ?`,
        options: [
          `Parce que Colonial n'avait finalement payé que 63,7 BTC`,
          `Parce que la rançon avait été partagée : la saisie a porté pour l'essentiel sur la part de l'affilié, la part du développeur ayant suivi un autre chemin`,
          `Parce que la loi américaine plafonne les saisies à 85 % des sommes en cause`,
          `Parce que 11 BTC avaient été dépensés en frais de transaction`,
        ],
        answer: 1,
        explain: `Le DOJ a précisé que la saisie ne portait pas sur la totalité de la rançon. L'analyse d'Elliptic montre un partage d'environ 85 % pour l'affilié et 15 % pour le développeur : les 63,7 BTC correspondent à l'essentiel de la part de l'affilié.`,
      },
      {
        type: 'widget',
        id: 'peel-chain',
        caption: `Illustration simplifiée, montants fictifs : la part d'un affilié transite par des transferts successifs qui détachent de petits montants. On suit la sortie principale jusqu'à l'adresse où les fonds s'immobilisent.`,
      },
      {
        type: 'callout',
        kind: 'warn',
        title: 'Récupérer des bitcoins n’est pas récupérer des dollars',
        md: `75 BTC valaient environ 4,4 millions de dollars au moment du paiement. Un mois plus tard, 63,7 BTC n'en valaient plus qu'environ 2,3 millions, en raison de la **baisse du cours** du bitcoin. En nombre de bitcoins, la majorité de la rançon a été saisie ; en dollars, la valeur récupérée est bien inférieure à la somme payée.

Dans vos procès-verbaux, exprimez toujours un montant **dans l'unité de l'actif** (BTC, ETH, USDT), et donnez la contre-valeur en euros **avec sa date et sa source de cours**.`,
      },
      { type: 'heading', text: 'Les erreurs et faiblesses côté auteurs' },
      {
        type: 'table',
        caption: 'Ce qui a exposé les fonds de l’affilié',
        headers: ['Faiblesse', 'Conséquence', 'Enseignement'],
        rows: [
          ['Rançon en bitcoins, sur un registre public', 'Chaque transfert est visible et horodaté', 'Le paiement est un point d’entrée pour l’enquête'],
          ['Fonds immobilisés plusieurs semaines sur une adresse identifiée', 'Les enquêteurs ont eu le temps d’obtenir un mandat', 'La dormance est une fenêtre d’action, pas une impasse'],
          ['Absence de conversion ou de dispersion poussée', 'La trace est restée courte et lisible', 'Plus on agit tôt, moins la trace est fragmentée'],
          ['Cible d’infrastructure critique', 'Mobilisation maximale des autorités', 'L’impact de l’attaque oriente les moyens d’enquête'],
        ],
      },
      { type: 'heading', text: 'Ce que l’enquêteur français peut transposer' },
      {
        type: 'steps',
        items: [
          { title: 'Recueillir immédiatement', md: `Note de rançon, échanges de négociation, adresse de paiement, txid, montant, horodatage, identité de l'intermédiaire payeur et justificatifs d'achat des crypto-actifs.` },
          { title: 'Tracer sans attendre', md: `Suivre la rançon dès le paiement, identifier le partage affilié / opérateurs, puis la ou les adresses où les fonds s'immobilisent ou entrent dans un service.` },
          { title: 'Surveiller', md: `Poser des alertes sur les adresses d'arrivée. Consigner en procédure la date de mise en place de la surveillance.` },
          { title: 'Geler ou saisir', md: `Si les fonds entrent chez un prestataire : réquisition et demande de gel en urgence. Si une clé devient accessible (support saisi, coopération) : saisie pénale des crypto-actifs, sur décision du magistrat compétent, avec transfert vers un portefeuille contrôlé par l'État et l'appui de l'AGRASC pour la gestion des avoirs.` },
          { title: 'Coopérer', md: `Si les fonds ou les auteurs sont à l'étranger : demande d'entraide pénale, appui d'Europol et d'Eurojust, échanges avec les services spécialisés partenaires.` },
        ],
      },
      {
        type: 'callout',
        kind: 'law',
        title: 'Rançon, sanctions et assurance',
        md: `Devant le Sénat, le dirigeant de Colonial a indiqué que l'entreprise avait vérifié à plusieurs reprises si DarkSide figurait sur une liste de sanctions : payer une entité sanctionnée exposerait le payeur à des poursuites.

En France, l'ANSSI recommande de **ne pas payer**. Le code des assurances (article L. 12-10-1, issu de la loi d'orientation et de programmation du ministère de l'intérieur de 2023) subordonne l'indemnisation des pertes liées à une cyberattaque au dépôt d'une plainte dans les **72 heures** suivant la connaissance de l'atteinte. La plainte rapide sert aussi l'enquête : elle permet de tracer pendant que les fonds sont encore proches de l'adresse de rançon.`,
      },
      {
        type: 'check',
        q: `Une entreprise vient de payer une rançon en BTC il y a deux heures. Quelle est la première démarche la plus utile ?`,
        options: [
          `Attendre la fin de l'enquête technique sur l'intrusion avant de s'intéresser aux fonds`,
          `Demander au réseau Bitcoin d'annuler la transaction`,
          `Recueillir l'adresse et le txid, tracer la rançon et placer des alertes sur les adresses d'arrivée`,
          `Envoyer un message aux auteurs pour réclamer la restitution`,
        ],
        answer: 2,
        explain: `Une transaction Bitcoin ne s'annule pas. Le temps est le facteur clé : tant que les fonds sont proches de l'adresse de rançon, la trace est courte et une demande de gel ou une saisie reste envisageable.`,
      },
      {
        type: 'callout',
        kind: 'law',
        title: 'Sources',
        md: `- Département de la Justice des États-Unis, communiqué du 7 juin 2021 annonçant la saisie de 63,7 BTC (repris par le bureau du procureur du district nord de Californie).
- Affidavit à l'appui du mandat de saisie (district nord de Californie, juin 2021), tel que rapporté par la presse spécialisée.
- Audition du dirigeant de Colonial Pipeline devant la commission de la sécurité intérieure du Sénat américain, 8 juin 2021 (comptes rendus de presse : CNBC, CBS News, Fortune).
- Elliptic, analyse publique du paiement de la rançon et du partage affilié / développeur (mai-juin 2021).`,
      },
    ],
    keyPoints: [
      `Mai 2021 : DarkSide attaque Colonial Pipeline ; la rançon d'environ 75 BTC est payée le 8 mai.`,
      `Le 7 juin 2021, le DOJ annonce la saisie de 63,7 BTC, sur mandat d'une juge du district nord de Californie.`,
      `La saisie porte pour l'essentiel sur la part de l'affilié (environ 85 %), la part du développeur ayant suivi un autre chemin.`,
      `Le traçage par le registre public a localisé les fonds ; la clé détenue par le FBI a permis de les déplacer. Son mode d'obtention n'est pas public.`,
      `En bitcoins, la majorité de la rançon a été saisie ; en dollars, la valeur a fortement baissé avec le cours.`,
      `Transposition : recueil immédiat, traçage, surveillance des adresses, gel ou saisie pénale, entraide.`,
    ],
    quiz: [
      {
        q: `Combien de bitcoins le DOJ a-t-il annoncé avoir saisis en juin 2021 ?`,
        options: ['75 BTC', '11,25 BTC', '4,4 BTC', '63,7 BTC'],
        answer: 3,
        explain: `Le communiqué du 7 juin 2021 annonce la saisie de 63,7 BTC, valorisés alors à environ 2,3 millions de dollars.`,
      },
      {
        kind: 'truefalse',
        q: `Le DOJ a expliqué publiquement comment le FBI avait obtenu la clé privée de l'adresse saisie.`,
        options: ['Vrai', 'Faux'],
        answer: 1,
        explain: `L'affidavit indique seulement que la clé était en possession du FBI. Les autorités n'ont pas révélé comment elle avait été obtenue : les hypothèses de presse ne sont pas des faits établis.`,
      },
      {
        kind: 'multi',
        q: `Quels éléments ont contribué à la récupération ? (plusieurs réponses)`,
        options: [
          `La coopération rapide de la victime avec le FBI`,
          `Le suivi des transferts sur le registre public Bitcoin`,
          `La conversion de la rançon en Monero par les auteurs`,
          `Un mandat de saisie délivré par une juge fédérale`,
        ],
        answer: [0, 1, 3],
        explain: `Signalement rapide, traçage sur le registre public et titre judiciaire ont été déterminants. Une conversion en Monero aurait au contraire compliqué le traçage.`,
      },
      {
        q: `Pourquoi la valeur en dollars des bitcoins saisis était-elle bien inférieure à la rançon payée ?`,
        options: [
          `Le FBI a revendu une partie des bitcoins avant l'annonce`,
          `Les frais de transaction ont absorbé la différence`,
          `Le cours du bitcoin avait baissé entre le paiement et la saisie`,
          `Colonial avait payé en partie en euros`,
        ],
        answer: 2,
        explain: `75 BTC valaient environ 4,4 millions de dollars en mai ; un mois plus tard, 63,7 BTC n'en valaient plus qu'environ 2,3 millions à cause de la baisse du cours.`,
      },
      {
        kind: 'truefalse',
        q: `Selon l'analyse publiée par Elliptic, environ 85 % de la rançon revenait à l'affilié et 15 % au développeur de DarkSide.`,
        options: ['Vrai', 'Faux'],
        answer: 0,
        explain: `C'est le partage caractéristique du modèle RaaS : la part de l'affilié (environ 63,75 BTC) correspond à peu près au montant saisi.`,
      },
      {
        q: `En France, une clé privée donnant accès à des fonds criminels est découverte sur un support saisi. Que faut-il faire ?`,
        options: [
          `Transférer immédiatement les fonds vers le portefeuille personnel de l'enquêteur pour les protéger`,
          `Procéder à une saisie pénale des crypto-actifs sur décision du magistrat compétent, vers un portefeuille contrôlé par l'État`,
          `Laisser les fonds en place : la clé suffit comme preuve`,
          `Demander à un exchange de racheter les fonds`,
        ],
        answer: 1,
        explain: `L'accès technique ne dispense jamais du titre juridique. La saisie se fait sur décision du magistrat, vers une adresse contrôlée par l'État, avec une traçabilité complète des opérations.`,
      },
      {
        kind: 'multi',
        q: `Quels éléments recueillir auprès d'une victime de rançongiciel qui a payé ? (plusieurs réponses)`,
        options: [
          `Le code source du rançongiciel, obligatoirement fourni par la victime`,
          `L'adresse de paiement et le txid`,
          `Les échanges avec le portail de négociation`,
          `L'identité de l'intermédiaire payeur et ses justificatifs`,
        ],
        answer: [1, 2, 3],
        explain: `Adresse, txid, négociation et justificatifs de l'intermédiaire sont essentiels. L'analyse technique du logiciel relève des services spécialisés, pas d'une obligation de la victime.`,
      },
    ],
    flashcards: [
      { front: 'Colonial Pipeline — dates clés', back: `Attaque le 7 mai 2021, paiement le 8 mai, saisie annoncée par le DOJ le 7 juin 2021.` },
      { front: 'Montants Colonial', back: `Rançon d'environ 75 BTC (environ 4,4 M$) ; 63,7 BTC saisis (environ 2,3 M$ à la date de l'annonce).` },
      { front: 'DarkSide', back: `Groupe de rançongiciel en mode RaaS : développeur + affiliés, partage de chaque rançon.` },
      { front: 'Partage de la rançon Colonial', back: `Environ 85 % affilié / 15 % développeur selon Elliptic ; la saisie vise l'essentiel de la part affilié.` },
      { front: 'Base juridique de la saisie', back: `Mandat de saisie autorisé par une juge du district nord de Californie.` },
      { front: 'La clé privée', back: `En possession du FBI selon l'affidavit ; mode d'obtention non divulgué. Ne pas spéculer.` },
      { front: 'BTC contre dollars', back: `Toujours exprimer un montant dans l'unité de l'actif, la contre-valeur en euros datée et sourcée.` },
      { front: 'Porte d’entrée de l’attaque', back: `Selon le dirigeant de Colonial : un ancien accès VPN protégé par un simple mot de passe.` },
      { front: 'Plainte et assurance (France)', back: `Article L. 12-10-1 du code des assurances : plainte dans les 72 heures pour l'indemnisation d'une cyberattaque.` },
      { front: 'Leçon principale', back: `Vitesse + traçage + titre juridique + accès effectif : les quatre conditions d'une récupération.` },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // SILK ROAD
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'affaire-silk-road',
    title: 'Affaire décryptée : Silk Road et les bitcoins de « l\'individu X »',
    level: 3,
    track: 'affaires',
    minutes: 30,
    summary: `Silk Road a fermé en 2013, mais ses bitcoins ont continué d'occuper les enquêteurs pendant près de dix ans. En 2020, environ 69 370 BTC dérobés à la plateforme par un pirate désigné comme « l'individu X » sont saisis. En 2021, plus de 50 000 BTC sont retrouvés chez James Zhong, qui avait fraudé le système de retrait du site en 2012. Deux dossiers distincts, une même leçon : les vieux bitcoins laissent une trace durable.`,
    objectives: [
      `Situer les deux affaires de bitcoins « post-Silk Road » (individu X, James Zhong) et leurs suites judiciaires.`,
      `Expliquer comment le croisement entre données d'une plateforme saisie et registre public révèle des sorties anormales.`,
      `Mobiliser clustering, ancienneté des pièces et analyse de chaînes de transactions sur des fonds dormants.`,
      `Identifier ce qui est transposable en procédure française (fonds dormants, saisie, confiscation).`,
    ],
    prerequisites: ['darknet', 'clustering', 'peel-chains'],
    practice: ['peel-chain', 'darknet-vendor', 'change-anatomy'],
    blocks: [
      {
        type: 'text',
        md: `**Silk Road** a été, de 2011 à 2013, le premier grand marché du darknet : un site accessible par Tor où l'on payait en bitcoins, principalement pour des stupéfiants. Le FBI l'a fermé en **octobre 2013** et a arrêté son fondateur, Ross Ulbricht, condamné en 2015 à la réclusion à perpétuité, puis gracié par le président des États-Unis en janvier 2025.

La fermeture du site n'a pas clos le dossier financier. Deux affaires ultérieures, **juridiquement distinctes**, ont porté sur des bitcoins sortis de Silk Road à l'insu de son administrateur :

- en **novembre 2020**, une action en confiscation civile vise environ **69 370 BTC** dérobés par un pirate désigné dans les documents comme **« l'individu X »** ;
- en **novembre 2022**, le parquet fédéral du district sud de New York annonce la saisie, un an plus tôt, de plus de **50 000 BTC** chez **James Zhong**, qui avait fraudé le système de retrait du site en 2012.

Les documents publics ne relient pas ces deux dossiers : il s'agit de fonds différents, traités par des juridictions différentes.`,
      },
      { type: 'heading', text: 'Chronologie' },
      {
        type: 'table',
        caption: 'Les bitcoins de Silk Road après la fermeture du site',
        headers: ['Date', 'Événement', 'Source'],
        rows: [
          ['2012', '54 transactions font sortir environ 70 411 BTC du portefeuille de Silk Road vers deux adresses', 'Plainte en confiscation, 2020'],
          ['Septembre 2012', 'James Zhong exploite une faille du système de retrait et obtient environ 50 000 BTC', 'Parquet du district sud de New York, 2022'],
          ['Avril 2013', 'Les fonds de « l’individu X » sont regroupés sur une adresse commençant par 1HQ3', 'Données on-chain, analyses publiques'],
          ['Octobre 2013', 'Fermeture de Silk Road par le FBI, arrestation de son fondateur', 'Documents judiciaires publics'],
          ['3 novembre 2020', '« L’individu X » signe un accord de confiscation ; environ 69 370 BTC quittent l’adresse 1HQ3', 'Plainte en confiscation, presse'],
          ['5 novembre 2020', 'Dépôt de la plainte en confiscation civile (district nord de Californie)', 'DOJ'],
          ['9 novembre 2021', 'Perquisition chez James Zhong en Géorgie : environ 50 676 BTC saisis', 'Parquet du district sud de New York'],
          ['Novembre 2022', 'Zhong plaide coupable de fraude électronique (wire fraud) ; annonce publique de la saisie', 'Parquet du district sud de New York'],
          ['Avril 2023', 'Zhong est condamné à un an et un jour d’emprisonnement', 'Parquet du district sud de New York'],
          ['Fin 2024', 'Après le rejet des revendications de tiers, la vente des 69 370 BTC est autorisée', 'Presse spécialisée'],
        ],
      },
      { type: 'heading', text: 'L’individu X : des sorties qui n’auraient pas dû exister' },
      {
        type: 'text',
        md: `Selon la plainte en confiscation de 2020, les enquêteurs ont travaillé avec une **société d'attribution blockchain** pour analyser les transactions de Silk Road. Ils ont relevé **54 transactions** en 2012, pour environ **70 411 BTC**, envoyées vers deux adresses. Ces sorties **ne figuraient pas** dans la base de données de Silk Road comme des retraits de vendeurs ou d'employés : elles ressemblaient donc à un vol.

Les fonds ont ensuite été regroupés, en avril 2013, sur une adresse commençant par \`1HQ3\`, qui est restée **immobile pendant plus de sept ans**. Selon la plainte, l'individu X avait piraté Silk Road et transféré les bitcoins vers ses propres portefeuilles ; Ross Ulbricht, ayant découvert son identité en ligne, l'avait menacé pour obtenir la restitution des fonds.

Le **3 novembre 2020**, l'individu X signe un **accord de consentement à la confiscation** avec le parquet du district nord de Californie. Le même jour, environ **69 370 BTC** quittent l'adresse \`1HQ3\` pour une adresse contrôlée par les autorités. Les documents publics ne révèlent ni son identité ni la manière dont il a été identifié.`,
      },
      {
        type: 'flow',
        caption: `Schéma simplifié du dossier « individu X », d'après la plainte en confiscation de novembre 2020 et les données on-chain publiques.`,
        nodes: [
          { id: 'sr', label: 'Portefeuille Silk Road', kind: 'service', sub: 'cluster attribué' },
          { id: 'tx', label: '54 transactions', kind: 'tx', sub: '2012 · ≈ 70 411 BTC' },
          { id: 'a2', label: 'Deux adresses', kind: 'suspect', sub: 'non enregistrées comme retraits' },
          { id: 'hq', label: 'Adresse 1HQ3…', kind: 'wallet', sub: 'avril 2013 · dormante 7 ans' },
          { id: 'gov', label: 'Adresse des autorités', kind: 'service', sub: '3 novembre 2020' },
          { id: 'db', label: 'Base de données Silk Road', kind: 'unknown', sub: 'retraits légitimes' },
        ],
        edges: [
          { from: 'sr', to: 'tx' },
          { from: 'tx', to: 'a2' },
          { from: 'a2', to: 'hq', label: 'regroupement' },
          { from: 'hq', to: 'gov', label: '≈ 69 370 BTC' },
          { from: 'db', to: 'tx', label: 'absentes de la base', dashed: true },
        ],
      },
      {
        type: 'case',
        title: 'Le moment pivot : confronter la chaîne aux données de la plateforme',
        md: `La découverte décrite par la plainte ne repose pas sur une technique exotique, mais sur un **croisement** :

1. Un cluster d'adresses est attribué à Silk Road (heuristique des entrées communes, adresses connues de la plateforme).
2. Toutes les sorties de ce cluster sont listées.
3. Ces sorties sont comparées aux **retraits enregistrés** dans la base de données du site.
4. Les sorties **sans contrepartie** dans la base, ici 54 transactions pour environ 70 411 BTC, deviennent des anomalies à expliquer.

Pour l'enquêteur, la leçon est double. D'abord, les données d'une plateforme saisie gardent leur valeur **des années** après la saisie. Ensuite, ce qui est **absent** des journaux internes peut être aussi parlant que ce qui y figure.`,
      },
      {
        type: 'check',
        q: `Qu'est-ce qui a signalé les 54 transactions comme suspectes, selon la plainte de 2020 ?`,
        options: [
          `Elles passaient par un mixeur`,
          `Elles ne correspondaient à aucun retrait de vendeur ou d'employé enregistré dans la base de données de Silk Road`,
          `Elles avaient été payées avec des frais anormalement élevés`,
          `Elles aboutissaient directement chez un exchange régulé`,
        ],
        answer: 1,
        explain: `C'est le croisement entre les sorties on-chain du cluster Silk Road et les retraits enregistrés dans la base du site qui a révélé ces sorties anormales.`,
      },
      { type: 'heading', text: 'James Zhong : la fraude au retrait' },
      {
        type: 'text',
        md: `Selon le parquet du district sud de New York, James Zhong a ouvert en **septembre 2012** une série de comptes sur Silk Road et exploité une faille du système de retrait. Exemple cité : le 19 septembre 2012, un dépôt de 500 BTC suivi, en quelques secondes, de cinq retraits de 500 BTC. En environ **140 transactions** rapides, il obtient environ **50 000 BTC**, ensuite déplacés vers d'autres adresses.

Le **9 novembre 2021**, une perquisition à son domicile de Gainesville, en Géorgie, permet de saisir environ **50 676 BTC**, retrouvés notamment dans un coffre enterré sous le plancher et sur un mini-ordinateur dissimulé dans une boîte de pop-corn. Zhong a plaidé coupable de **fraude électronique** (wire fraud) et a été condamné en **avril 2023** à **un an et un jour** d'emprisonnement. Le parquet a souligné l'association d'un traçage de crypto-actifs de pointe et d'un travail d'enquête classique.`,
      },
      { type: 'heading', text: 'Les techniques de traçage mobilisées' },
      {
        type: 'table',
        caption: 'Techniques applicables à des fonds anciens et dormants',
        headers: ['Technique', 'Principe', 'Apport dans ce type de dossier', 'Limite'],
        rows: [
          ['Clustering (entrées communes)', 'Des adresses dépensées ensemble appartiennent au même portefeuille', 'Délimiter le portefeuille de la plateforme et celui du voleur', 'Faussé par les CoinJoin et les services qui mutualisent'],
          ['Ancienneté des pièces', 'Des UTXO de 2012-2013 qui bougent sont rares et remarquables', 'Une alerte sur une adresse dormante signale le réveil des fonds', 'Ne dit rien de l’identité de celui qui les déplace'],
          ['Analyse des chaînes de transactions', 'Suivre la sortie principale saut par saut (peel chain)', 'Relier une adresse de regroupement à des points de sortie', 'Fastidieux sans outil, sensible aux erreurs de rendu'],
          ['Croisement avec des données saisies', 'Comparer on-chain et journaux internes', 'Révéler des sorties non enregistrées', 'Suppose l’accès légal aux données de la plateforme'],
        ],
      },
      {
        type: 'widget',
        id: 'cioh-cluster',
        caption: `Illustration simplifiée : reliez des adresses par leurs entrées communes pour délimiter un portefeuille, comme on délimite celui d'une plateforme avant d'en lister les sorties.`,
      },
      {
        type: 'callout',
        kind: 'example',
        title: 'Peel chains : illustration (montants fictifs)',
        md: `Une adresse de 1 000 BTC envoie 3 BTC vers un service et 996,99 BTC vers une nouvelle adresse ; celle-ci envoie 5 BTC vers un autre service et 991,98 BTC vers une troisième adresse, et ainsi de suite. La **sortie principale**, qui porte l'essentiel du solde, dessine la chaîne ; les petites sorties sont les « pelures », souvent dirigées vers des services où l'on peut requérir. Cette structure se retrouve fréquemment lorsque d'anciens fonds sont écoulés par petites quantités.`,
      },
      { type: 'heading', text: 'Les erreurs des auteurs' },
      {
        type: 'compare',
        left: {
          title: '« L’individu X »',
          md: `- Fonds volés laissés **plus de sept ans** sur une seule adresse, parmi les plus importantes de la blockchain, donc très surveillée.
- Sorties absentes de la base de données du site : une **anomalie détectable** dès que les données de Silk Road étaient exploitées.
- Lien avec la plateforme connu de son administrateur, qui l'avait identifié et menacé, selon la plainte.`,
        },
        right: {
          title: 'James Zhong',
          md: `- Fraude réalisée par des retraits multiples en quelques secondes : un schéma **enregistré** par la plateforme.
- Supports et clés conservés **à domicile** : une perquisition a suffi pour appréhender les fonds.
- Fonds conservés pendant près de dix ans plutôt que dispersés : une **masse unique** à retrouver.`,
        },
      },
      {
        type: 'check',
        q: `Une adresse inactive depuis 2013 et liée à un ancien marché du darknet se met à émettre des transactions. Quelle attitude adopter ?`,
        options: [
          `Ignorer : les faits sont prescrits, donc sans intérêt`,
          `Attendre que les fonds soient intégralement convertis en monnaie fiduciaire`,
          `Signaler l'adresse au réseau Bitcoin pour blocage`,
          `Suivre immédiatement les fonds et repérer les entrées dans des services où une réquisition ou un gel est possible`,
        ],
        answer: 3,
        explain: `Le réveil de fonds anciens est une opportunité : la trace est encore courte. La question de la prescription relève du magistrat ; l'enquêteur documente et identifie les points de sortie.`,
      },
      { type: 'heading', text: 'Ce que l’enquêteur français peut transposer' },
      {
        type: 'steps',
        items: [
          { title: 'Archiver les données des plateformes saisies', md: `Journaux, bases de données et adresses d'une plateforme démantelée restent exploitables des années plus tard. Documentez leur origine et leur intégrité (empreintes) pour pouvoir les produire en justice.` },
          { title: 'Surveiller les fonds dormants', md: `Placez des alertes sur les adresses identifiées, même inactives. Le réveil d'un portefeuille ancien est souvent le seul moment où l'on peut agir.` },
          { title: 'Croiser on-chain et off-chain', md: `Comparez systématiquement les sorties d'un cluster avec les enregistrements internes disponibles (retraits, comptes, journaux) : les écarts désignent les flux à expliquer.` },
          { title: 'Saisir puis faire confisquer', md: `Le droit français ne connaît pas l'action civile dirigée contre les biens eux-mêmes, telle que pratiquée aux États-Unis : la confiscation est en principe une peine prononcée par la juridiction pénale. En amont, la saisie pénale des crypto-actifs et, le cas échéant, leur vente avant jugement par l'AGRASC sur décision du magistrat (articles 41-5 et 99-2 du code de procédure pénale) protègent la valeur des avoirs.` },
        ],
      },
      {
        type: 'callout',
        kind: 'law',
        title: 'Sources',
        md: `- Département de la Justice des États-Unis (bureau du procureur du district nord de Californie), communiqué et plainte en confiscation civile du 5 novembre 2020 (affaire « United States v. Approximately 69,370 Bitcoin »), tels que rapportés par la presse (The Register, Fortune, ZDNet, 5 novembre 2020).
- Bureau du procureur du district sud de New York, communiqué du 7 novembre 2022 annonçant la saisie de plus de 3,36 milliards de dollars et la reconnaissance de culpabilité de James Zhong.
- Bureau du procureur du district sud de New York, communiqué d'avril 2023 sur la condamnation de James Zhong.
- Elliptic, analyse publique des mouvements de l'adresse 1HQ3… (novembre 2020).
- Presse spécialisée (The Block, Forklog) sur l'autorisation de vente des 69 370 BTC fin 2024.`,
      },
    ],
    keyPoints: [
      `Deux dossiers distincts : « l'individu X » (environ 69 370 BTC, confiscation civile en novembre 2020) et James Zhong (environ 50 676 BTC saisis en novembre 2021).`,
      `Les 54 transactions de 2012 ont été repérées parce qu'elles ne figuraient pas comme retraits dans la base de données de Silk Road.`,
      `Les fonds de l'individu X sont restés plus de sept ans sur une seule adresse, avant d'être transférés aux autorités après un accord de confiscation.`,
      `Zhong a fraudé le système de retrait en 2012 ; il a plaidé coupable de wire fraud et a été condamné à un an et un jour.`,
      `Clustering, ancienneté des pièces, chaînes de transactions et croisement avec des données saisies sont les outils de ces dossiers.`,
      `Des fonds dormants ne sont pas des fonds perdus : la surveillance permet d'agir au réveil.`,
    ],
    quiz: [
      {
        q: `Quel montant approximatif visait l'action en confiscation de novembre 2020 contre les fonds de « l'individu X » ?`,
        options: ['50 676 BTC', '69 370 BTC', '144 000 BTC', '1 909 BTC'],
        answer: 1,
        explain: `La plainte de novembre 2020 visait environ 69 370 BTC, transférés le 3 novembre 2020 depuis l'adresse 1HQ3… vers une adresse des autorités.`,
      },
      {
        kind: 'truefalse',
        q: `Les documents officiels établissent que James Zhong et « l'individu X » sont la même personne.`,
        options: ['Vrai', 'Faux'],
        answer: 1,
        explain: `Aucun document public ne relie les deux dossiers : fonds différents, juridictions différentes. L'identité de l'individu X n'a pas été rendue publique.`,
      },
      {
        q: `De quelle infraction James Zhong a-t-il plaidé coupable ?`,
        options: [`Trafic de stupéfiants`, `Blanchiment en bande organisée`, `Fraude électronique (wire fraud)`, `Piratage informatique de serveurs fédéraux`],
        answer: 2,
        explain: `Zhong a plaidé coupable de wire fraud pour avoir fraudé le système de retrait de Silk Road en 2012. Il a été condamné à un an et un jour d'emprisonnement.`,
      },
      {
        kind: 'multi',
        q: `Quelles techniques sont adaptées à l'analyse de fonds anciens issus d'une plateforme démantelée ? (plusieurs réponses)`,
        options: [
          `Clustering par entrées communes pour délimiter le portefeuille de la plateforme`,
          `Annulation des transactions anciennes par les mineurs`,
          `Croisement des sorties on-chain avec les journaux internes saisis`,
          `Alerte sur les adresses dormantes`,
        ],
        answer: [0, 2, 3],
        explain: `Clustering, croisement avec les données saisies et surveillance sont complémentaires. Une transaction confirmée ne peut pas être annulée.`,
      },
      {
        q: `Comment Zhong avait-il obtenu ses bitcoins, selon le parquet ?`,
        options: [
          `En déclenchant plusieurs retraits en quelques secondes après un seul dépôt`,
          `En vendant des stupéfiants sur Silk Road`,
          `En minant des blocs en 2012`,
          `En piratant le portefeuille personnel du fondateur`,
        ],
        answer: 0,
        explain: `Exemple cité par le parquet : un dépôt de 500 BTC suivi de cinq retraits de 500 BTC en quelques secondes. Environ 140 transactions lui ont permis d'obtenir environ 50 000 BTC.`,
      },
      {
        kind: 'truefalse',
        q: `En droit français comme en droit américain, l'État peut engager une action civile dirigée contre les bitcoins eux-mêmes, indépendamment de toute poursuite pénale.`,
        options: ['Vrai', 'Faux'],
        answer: 1,
        explain: `L'action civile in rem est propre au système américain. En France, la confiscation est en principe une peine prononcée par la juridiction pénale, précédée le cas échéant d'une saisie pénale.`,
      },
      {
        kind: 'multi',
        q: `Quelles erreurs ont exposé les auteurs dans ces deux dossiers ? (plusieurs réponses)`,
        options: [
          `Utiliser exclusivement Monero dès 2012`,
          `Conserver une masse unique de fonds pendant des années`,
          `Laisser des sorties incohérentes avec les journaux de la plateforme`,
          `Conserver clés et supports à domicile`,
        ],
        answer: [1, 2, 3],
        explain: `Fonds concentrés, anomalies dans les journaux et supports à domicile ont été décisifs. Monero n'existait pas en 2012 : il a été lancé en 2014.`,
      },
    ],
    flashcards: [
      { front: 'Silk Road', back: `Marché du darknet sur Tor (2011-2013), paiements en BTC ; fermé par le FBI en octobre 2013.` },
      { front: '« L’individu X »', back: `Pirate ayant dérobé des BTC à Silk Road ; accord de confiscation le 3 novembre 2020 pour environ 69 370 BTC.` },
      { front: 'Les 54 transactions', back: `Sorties de 2012 (environ 70 411 BTC) absentes des retraits enregistrés dans la base de Silk Road.` },
      { front: 'Adresse 1HQ3…', back: `Adresse de regroupement des fonds de l'individu X (avril 2013), dormante plus de sept ans.` },
      { front: 'James Zhong', back: `Fraude au retrait sur Silk Road en 2012 ; environ 50 676 BTC saisis le 9 novembre 2021 ; un an et un jour de prison.` },
      { front: 'Croisement on-chain / off-chain', back: `Comparer les sorties d'un cluster avec les journaux internes : les écarts désignent les flux suspects.` },
      { front: 'Ancienneté des pièces', back: `Des UTXO très anciens qui bougent sont rares : excellent déclencheur d'alerte.` },
      { front: 'Confiscation civile (États-Unis)', back: `Action dirigée contre les biens eux-mêmes ; sans équivalent direct en droit français.` },
      { front: 'Vente avant jugement', back: `Possible sur décision du magistrat, par l'AGRASC (articles 41-5 et 99-2 du code de procédure pénale).` },
      { front: 'Leçon Silk Road', back: `Les données d'une plateforme saisie et les fonds dormants restent exploitables des années plus tard.` },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // HYDRA
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'affaire-hydra',
    title: 'Affaire décryptée : Hydra, le marché du darknet russe',
    level: 3,
    track: 'affaires',
    minutes: 30,
    summary: `Le 5 avril 2022, la police criminelle fédérale allemande (BKA) saisit les serveurs d'Hydra Market, le plus grand marché du darknet au monde, et 543 BTC. Le même jour, le DOJ inculpe un résident russe présenté comme l'administrateur des serveurs du site et le Trésor américain sanctionne Hydra et l'exchange Garantex. Une opération coordonnée qui éclaire l'économie d'un marché du darknet et la manière de l'attaquer sur plusieurs fronts.`,
    objectives: [
      `Décrire le fonctionnement économique d'Hydra : commissions, comptes vendeurs, services de blanchiment intégrés.`,
      `Retracer l'opération du 5 avril 2022 et le rôle de chaque acteur (BKA, DOJ, OFAC).`,
      `Expliquer pourquoi des sanctions financières visant un marché et un exchange le même jour renforcent l'effet d'un démantèlement.`,
      `Utiliser l'exposition à un cluster de marché du darknet dans une enquête française sur les stupéfiants.`,
    ],
    prerequisites: ['darknet', 'stupefiants-crypto', 'exposition-risque', 'cadre-reglementaire'],
    practice: ['darknet-vendor', 'tron-sanctions-garantex'],
    blocks: [
      {
        type: 'text',
        md: `**Hydra Market** était un marché du darknet en langue russe, actif depuis **2015**. Le DOJ l'a décrit comme le plus grand et le plus ancien marché du darknet au monde : en **2021**, il aurait représenté environ **80 %** des transactions en crypto-actifs liées aux marchés du darknet, et il aurait reçu environ **5,2 milliards de dollars** en crypto-actifs depuis 2015.

On y trouvait principalement des **stupéfiants**, mais aussi des données financières volées, de faux documents d'identité, des services de piratage et des **services de blanchiment**. Selon la police criminelle fédérale allemande (BKA), la plateforme comptait au moment de sa fermeture environ **17 millions de comptes clients** et plus de **19 000 comptes vendeurs**, pour un chiffre d'affaires estimé à au moins **1,23 milliard d'euros** pour la seule année 2020.`,
      },
      { type: 'heading', text: 'L’économie d’un marché du darknet' },
      {
        type: 'table',
        caption: `Le modèle d'Hydra, d'après le DOJ et les analyses publiques`,
        headers: ['Élément', 'Fonctionnement', 'Trace exploitable'],
        rows: [
          ['Commission', 'L’opérateur prélève une commission sur chaque transaction', 'Flux réguliers vers les portefeuilles de l’opérateur'],
          ['Comptes vendeurs et acheteurs', 'Annonces avec photos, notation des vendeurs sur cinq étoiles', 'Pseudonymes et historique de ventes (données de serveurs saisis)'],
          ['Faux comptes vendeurs', 'Selon le DOJ, certains utilisateurs créaient des comptes vendeurs fictifs pour faire transiter des fonds par les portefeuilles d’Hydra', 'Le marché sert aussi de lessiveuse, au-delà des ventes réelles'],
          ['Service de mélange intégré', 'Un service maison, payant, destiné à masquer l’origine des bitcoins', 'Rupture apparente de la trace à l’intérieur du cluster Hydra'],
          ['Livraison par caches', 'Selon les analyses publiques, des coursiers déposent la marchandise dans des caches dont l’emplacement est communiqué à l’acheteur', 'Peu de contact physique : la trace financière devient centrale'],
        ],
      },
      { type: 'heading', text: 'Le 5 avril 2022 : une opération sur trois fronts' },
      {
        type: 'steps',
        items: [
          { title: 'Allemagne — les serveurs et les bitcoins', md: `Le BKA et le parquet spécialisé de Francfort (ZIT) saisissent l'infrastructure de serveurs d'Hydra en Allemagne et **543 BTC**, soit environ **23 millions d'euros**. Le site est fermé et affiche une bannière de saisie. Aucune arrestation n'est annoncée à ce stade.` },
          { title: 'États-Unis — l’inculpation', md: `Le DOJ annonce l'inculpation de **Dmitry Olegovich Pavlov**, résident russe, pour association en vue de distribuer des stupéfiants et association de blanchiment. Il est accusé d'avoir exploité, depuis environ novembre 2015, la société Promservice Ltd., qui administrait les serveurs d'Hydra, et d'avoir reçu des paiements répétés depuis des portefeuilles d'Hydra. Une inculpation n'est qu'une accusation : il est présumé innocent.` },
          { title: 'États-Unis — les sanctions', md: `Le Trésor américain (OFAC) sanctionne **Hydra** et l'exchange **Garantex**, et inscrit plus d'une centaine d'adresses de crypto-actifs sur sa liste de sanctions. Selon le Trésor, plus de 100 millions de dollars de transactions de Garantex étaient associés à des acteurs illicites et à des marchés du darknet, dont près de 6 millions liés au groupe de rançongiciel Conti.` },
        ],
      },
      {
        type: 'flow',
        caption: `Schéma simplifié de la circulation des fonds autour d'un marché comme Hydra (illustration générique, sans montants).`,
        nodes: [
          { id: 'buy', label: 'Acheteur', kind: 'victim', sub: 'achète des BTC' },
          { id: 'ex', label: 'Service d’échange', kind: 'exchange', sub: 'roubles → BTC' },
          { id: 'hy', label: 'Portefeuilles Hydra', kind: 'service', sub: 'dépôts, séquestre' },
          { id: 'op', label: 'Opérateur', kind: 'suspect', sub: 'commissions' },
          { id: 'ven', label: 'Compte vendeur', kind: 'suspect', sub: 'produit des ventes' },
          { id: 'mix', label: 'Mélange intégré', kind: 'mixer', sub: 'optionnel' },
          { id: 'out', label: 'Exchange à faible conformité', kind: 'exchange', sub: 'ex. Garantex' },
          { id: 'host', label: 'Hébergeur des serveurs', kind: 'service', sub: 'paiements répétés' },
        ],
        edges: [
          { from: 'buy', to: 'ex' },
          { from: 'ex', to: 'hy', label: 'dépôt' },
          { from: 'hy', to: 'op', label: 'commission' },
          { from: 'hy', to: 'ven', label: 'vente' },
          { from: 'ven', to: 'mix', dashed: true },
          { from: 'mix', to: 'out', dashed: true },
          { from: 'ven', to: 'out', label: 'retrait' },
          { from: 'hy', to: 'host', label: 'selon l’inculpation' },
        ],
      },
      {
        type: 'check',
        q: `Pourquoi la sanction de Garantex le jour même du démantèlement d'Hydra est-elle significative ?`,
        options: [
          `Parce qu'elle permet de saisir automatiquement tous les bitcoins de Garantex`,
          `Parce qu'elle vise un point de sortie utilisé par l'écosystème : les acteurs soumis au droit américain doivent cesser de traiter avec Garantex et les outils de conformité le signalent`,
          `Parce qu'elle oblige la Russie à extrader les opérateurs`,
          `Parce qu'elle annule les transactions passées de Garantex`,
        ],
        answer: 1,
        explain: `Une sanction ne saisit rien par elle-même. Elle coupe l'accès aux acteurs qui doivent la respecter et fait apparaître les adresses désignées dans les outils de conformité, ce qui complique la conversion des fonds.`,
      },
      { type: 'heading', text: 'Les techniques qui ont fait tomber Hydra' },
      {
        type: 'table',
        caption: 'Techniques d’enquête et leurs limites',
        headers: ['Technique', 'Ce que disent les sources', 'Limite'],
        rows: [
          ['Traçage des crypto-actifs', 'Le service fiscal d’enquête américain (IRS-CI) indique avoir utilisé le traçage pour aider à identifier l’opérateur des serveurs', 'Identifier n’est pas arrêter : le prévenu réside en Russie'],
          ['Localisation de l’infrastructure', 'Les serveurs étaient en Allemagne, à portée d’une saisie par le BKA', 'Un marché hébergé dans un pays non coopératif est hors d’atteinte'],
          ['Saisie des portefeuilles', '543 BTC saisis avec les serveurs', 'Ne représente qu’une faible part des flux historiques'],
          ['Coopération internationale', 'Opération coordonnée BKA / agences américaines (DEA, FBI, HSI, IRS-CI, services postaux), avec la coordination de l’équipe américaine contre les marchés du darknet (JCODE)', 'Exige des calendriers alignés entre pays'],
          ['Sanctions financières', 'Désignation d’Hydra et de Garantex, adresses publiées', 'Effet limité sur les acteurs qui ne respectent pas le droit américain'],
        ],
      },
      {
        type: 'case',
        title: 'Le moment pivot : l’hébergeur payé en crypto-actifs',
        md: `Un marché du darknet peut cacher son adresse IP derrière Tor, mais il a besoin de **machines** et de quelqu'un pour les **administrer**. Selon l'inculpation américaine, la société Promservice Ltd., présentée comme exploitée par Dmitry Pavlov, administrait les serveurs d'Hydra et recevait des **paiements répétés depuis des portefeuilles d'Hydra**.

Ce lien est typiquement **financier** : il apparaît en suivant les sorties du cluster de la plateforme vers des bénéficiaires récurrents. Un flux régulier, d'un montant stable, d'un marché vers un même bénéficiaire désigne un **prestataire** : hébergeur, développeur, modérateur. Ces prestataires sont souvent plus exposés que l'opérateur lui-même, car ils ont une existence commerciale.

Rappel : les faits reprochés à M. Pavlov sont des **accusations** ; à la date des informations publiques consultées, il n'avait pas été arrêté et aucune décision de culpabilité n'est connue.`,
      },
      {
        type: 'widget',
        id: 'risk-exposure',
        caption: `Illustration simplifiée : calculez l'exposition directe et indirecte d'une adresse au cluster d'un marché du darknet. C'est ce type de mesure qui permet à un exchange de détecter des fonds issus d'Hydra.`,
      },
      { type: 'heading', text: 'Les erreurs et faiblesses du dispositif' },
      {
        type: 'table',
        caption: 'Ce qui a exposé Hydra',
        headers: ['Faiblesse', 'Conséquence'],
        rows: [
          ['Serveurs hébergés dans un pays de l’Union européenne', 'Saisie physique de l’infrastructure par le BKA'],
          ['Fonds conservés dans des portefeuilles de la plateforme', '543 BTC saisis le jour de l’opération'],
          ['Prestataire payé depuis les portefeuilles du marché', 'Lien financier traçable entre la plateforme et son hébergeur présumé'],
          ['Dépendance à quelques points de sortie', 'Sanction simultanée de Garantex, qui fragilise la conversion des gains'],
          ['Volume massif et attribution ancienne', 'Cluster bien connu des outils d’analyse : les fonds issus d’Hydra sont détectés à l’entrée des exchanges conformes'],
        ],
      },
      {
        type: 'callout',
        kind: 'example',
        title: 'Après Hydra',
        md: `La fermeture d'Hydra n'a pas fait disparaître le marché russophone : selon les analyses publiques (Chainalysis, Flashpoint), plusieurs successeurs se sont disputé la clientèle, et une partie des boutiques s'est repliée sur Telegram. En Russie, un tribunal de la région de Moscou a condamné en décembre 2024 le fondateur présumé d'Hydra, Stanislav Moiseev, à la réclusion à perpétuité, et quinze coaccusés à des peines de 8 à 23 ans, selon la presse russe et internationale. Ce procès russe est distinct de l'opération germano-américaine.`,
      },
      {
        type: 'check',
        q: `Selon le DOJ, à quoi servaient les comptes vendeurs fictifs ouverts par certains utilisateurs d'Hydra ?`,
        options: [
          `À tester la sécurité du site`,
          `À noter les vendeurs concurrents`,
          `À faire transiter des fonds par les portefeuilles d'Hydra, comme méthode de blanchiment`,
          `À recevoir des remboursements de l'opérateur`,
        ],
        answer: 2,
        explain: `Un marché du darknet peut servir de lessiveuse : de faux comptes vendeurs permettent de faire entrer puis ressortir des fonds sous l'apparence de ventes.`,
      },
      { type: 'heading', text: 'Ce que l’enquêteur français peut transposer' },
      {
        type: 'steps',
        items: [
          { title: 'Exploiter les listes de sanctions comme source d’attribution', md: `Les adresses inscrites par l'OFAC sont publiques. Elles constituent une source d'attribution à citer précisément (liste, date d'inscription), sans dispenser de vérifier le lien par l'analyse.` },
          { title: 'Mesurer l’exposition', md: `Dans un dossier de stupéfiants, une exposition directe ou indirecte d'un portefeuille saisi au cluster d'un marché du darknet est un indice précieux, à présenter avec la méthode de calcul utilisée.` },
          { title: 'Chercher les prestataires', md: `Hébergeurs, développeurs, coursiers : repérez les bénéficiaires récurrents d'un cluster criminel, souvent plus faciles à identifier que l'opérateur.` },
          { title: 'Distinguer sanctions américaines et européennes', md: `Les sanctions de l'OFAC s'imposent aux personnes soumises au droit américain. En France, ce sont les mesures restrictives de l'Union européenne et les décisions de gel des avoirs prises en application du code monétaire et financier qui s'imposent juridiquement ; les listes américaines restent un renseignement utile.` },
          { title: 'Passer par la coopération', md: `Les données des serveurs saisis restent entre les mains des autorités qui les ont saisies : pour les exploiter dans un dossier français, passez par Europol ou par une demande d'entraide.` },
        ],
      },
      {
        type: 'callout',
        kind: 'law',
        title: 'Sources',
        md: `- Département de la Justice des États-Unis, communiqué du 5 avril 2022 sur la fermeture d'Hydra et l'inculpation de Dmitry Olegovich Pavlov (repris par l'IRS-CI, page consultée : irs.gov/node/107781).
- Police criminelle fédérale allemande (BKA), communiqué du 5 avril 2022 sur la saisie des serveurs d'Hydra et de 543 BTC, tel que rapporté par la presse (BleepingComputer, CyberScoop).
- Trésor américain (OFAC), communiqué du 5 avril 2022 sanctionnant Hydra et Garantex.
- Analyses publiques post-Hydra : Chainalysis, Flashpoint, TRM Labs (2022-2023).
- Presse russe et internationale (dont The Register, Novaya Gazeta) sur la condamnation prononcée en Russie en décembre 2024.`,
      },
    ],
    keyPoints: [
      `Hydra : marché du darknet russophone actif depuis 2015, environ 80 % des transactions des marchés du darknet en 2021 selon le DOJ.`,
      `5 avril 2022 : le BKA saisit les serveurs en Allemagne et 543 BTC (environ 23 M€).`,
      `Le même jour, le DOJ inculpe Dmitry Pavlov, présenté comme l'hébergeur des serveurs (présomption d'innocence), et l'OFAC sanctionne Hydra et Garantex.`,
      `L'économie d'Hydra : commissions, faux comptes vendeurs utilisés pour blanchir, service de mélange intégré.`,
      `Les paiements d'un marché vers ses prestataires sont des liens financiers traçables.`,
      `Les listes de sanctions sont une source d'attribution ; en France, ce sont les mesures européennes et nationales qui s'imposent juridiquement.`,
    ],
    quiz: [
      {
        q: `Quel service a saisi les serveurs d'Hydra et 543 BTC le 5 avril 2022 ?`,
        options: [`Le FBI`, `Europol`, `La police criminelle fédérale allemande (BKA)`, `L'OFAC`],
        answer: 2,
        explain: `Le BKA, avec le parquet spécialisé de Francfort, a saisi l'infrastructure en Allemagne, en coordination avec les autorités américaines.`,
      },
      {
        kind: 'truefalse',
        q: `Le 5 avril 2022, le Trésor américain a sanctionné à la fois Hydra et l'exchange Garantex.`,
        options: ['Vrai', 'Faux'],
        answer: 0,
        explain: `L'OFAC a désigné Hydra et Garantex le même jour, en inscrivant plus d'une centaine d'adresses de crypto-actifs sur sa liste.`,
      },
      {
        kind: 'multi',
        q: `Quels éléments faisaient partie du modèle d'Hydra selon le DOJ ? (plusieurs réponses)`,
        options: [
          `Un contrôle d'identité obligatoire des acheteurs`,
          `Une commission prélevée sur chaque transaction`,
          `Un service de mélange intégré`,
          `Des faux comptes vendeurs utilisés pour blanchir`,
        ],
        answer: [1, 2, 3],
        explain: `Commission, mélange intégré et faux comptes vendeurs sont décrits par le DOJ. Il n'y avait évidemment aucun contrôle d'identité.`,
      },
      {
        q: `De quoi Dmitry Pavlov est-il accusé par le DOJ ?`,
        options: [
          `D'avoir administré les serveurs d'Hydra via sa société, en recevant des paiements depuis les portefeuilles du marché`,
          `D'avoir fondé Hydra et d'en avoir été le principal vendeur`,
          `D'avoir piraté Garantex`,
          `D'avoir dirigé le BKA`,
        ],
        answer: 0,
        explain: `Selon l'inculpation, sa société Promservice Ltd. administrait les serveurs d'Hydra. Il s'agit d'accusations : il est présumé innocent.`,
      },
      {
        kind: 'truefalse',
        q: `Une désignation par l'OFAC saisit automatiquement les crypto-actifs des adresses inscrites.`,
        options: ['Vrai', 'Faux'],
        answer: 1,
        explain: `Une sanction oblige les personnes soumises au droit américain à bloquer les avoirs et à cesser toute relation. Elle ne transfère pas les fonds : sur une blockchain, seule la clé privée permet de les déplacer.`,
      },
      {
        q: `Dans une enquête française sur un trafic de stupéfiants, un portefeuille saisi présente une forte exposition indirecte à un marché du darknet. Comment l'utiliser ?`,
        options: [
          `Comme preuve suffisante à elle seule de la vente de stupéfiants`,
          `L'ignorer : l'exposition indirecte n'a aucune valeur`,
          `Le transmettre directement à l'OFAC pour sanction`,
          `Comme un indice à présenter avec la méthode de calcul et l'attribution utilisées, à corroborer par d'autres éléments`,
        ],
        answer: 3,
        explain: `L'exposition est un indice, pas une preuve autonome. Sa valeur dépend de la méthode (directe, indirecte, au prorata) et de la fiabilité de l'attribution, à exposer dans le rapport.`,
      },
      {
        kind: 'multi',
        q: `Quelles faiblesses ont exposé Hydra ? (plusieurs réponses)`,
        options: [
          `Des serveurs hébergés en Allemagne`,
          `Des fonds conservés dans des portefeuilles de la plateforme`,
          `L'usage exclusif de Monero pour tous les paiements`,
          `Des paiements traçables vers un prestataire d'hébergement`,
        ],
        answer: [0, 1, 3],
        explain: `Infrastructure à portée d'une saisie, fonds sur la plateforme et paiements aux prestataires ont été décisifs. Hydra fonctionnait principalement en bitcoins.`,
      },
    ],
    flashcards: [
      { front: 'Hydra Market', back: `Marché du darknet russophone (2015-2022), le plus grand au monde selon le DOJ.` },
      { front: 'Hydra — chiffres du DOJ', back: `Environ 80 % des transactions des marchés du darknet en 2021 ; environ 5,2 Md$ reçus depuis 2015.` },
      { front: 'Hydra — chiffres du BKA', back: `Environ 17 millions de comptes clients, plus de 19 000 vendeurs, au moins 1,23 Md€ de chiffre d'affaires en 2020.` },
      { front: '5 avril 2022', back: `Saisie des serveurs et de 543 BTC par le BKA ; inculpation de D. Pavlov ; sanctions OFAC contre Hydra et Garantex.` },
      { front: 'Promservice Ltd.', back: `Société présentée par le DOJ comme l'administrateur des serveurs d'Hydra (accusation, présomption d'innocence).` },
      { front: 'Faux comptes vendeurs', back: `Comptes fictifs utilisés pour faire transiter des fonds par les portefeuilles d'Hydra : le marché comme lessiveuse.` },
      { front: 'Garantex et Hydra', back: `Exchange sanctionné le même jour ; plus de 100 M$ de transactions liées à des acteurs illicites selon le Trésor.` },
      { front: 'Sanction OFAC', back: `Interdit aux personnes soumises au droit américain de traiter avec la cible ; ne déplace pas les fonds.` },
      { front: 'Prestataires d’un marché', back: `Hébergeurs, développeurs : bénéficiaires récurrents du cluster, souvent identifiables.` },
      { front: 'Après Hydra', back: `Fragmentation du marché russophone entre plusieurs successeurs et repli d'une partie des boutiques sur Telegram.` },
    ],
  },
]
