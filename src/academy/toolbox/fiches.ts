// Fiches réflexes de la boîte à outils terrain.
// Contenu pédagogique : à confronter aux instructions du service, du parquet
// et aux textes en vigueur. Aucune fiche ne remplace l'avis du magistrat.
import type { ChecklistItem, Fiche } from './types'

/** Item ordinaire. */
const t = (text: string, detail?: string): ChecklistItem => (detail ? { text, detail } : { text })
/** Item critique : perte de preuve ou de fonds s'il est oublié. */
const c = (text: string, detail?: string): ChecklistItem => (detail ? { text, detail, critique: true } : { text, critique: true })

export const FICHES: Fiche[] = [
  // ── Accueil victime ──────────────────────────────────────────────────────
  {
    id: 'victime-premier-contact',
    title: 'Premier contact avec une victime d\'escroquerie crypto',
    category: 'accueil',
    icon: 'HeartHandshake',
    summary: 'Recueillir dès le premier entretien tout ce qui permettra de tracer les fonds et de requérir vite : adresses, hash, plateformes, chronologie, moyens de paiement.',
    when: 'Plainte ou signalement pour faux placement, arnaque sentimentale à l\'investissement (« pig butchering »), faux conseiller, faux support technique, address poisoning, drainer ou piratage d\'un compte d\'exchange.',
    sections: [
      {
        title: 'Mettre la victime à l\'abri',
        items: [
          c('Vérifier si des fonds sont encore en mouvement ou si la victime s\'apprête à payer', 'Stopper tout paiement prévu (« frais de déblocage », « taxe », « caution »). Si un envoi date de quelques heures : basculer immédiatement sur la fiche « Urgence : fonds en mouvement ».'),
          c('Lui demander de cesser tout échange avec les escrocs, sans rien supprimer', 'Conversations, comptes, applications et e-mails sont des preuves : ne pas supprimer, ne pas bloquer le contact avant export.'),
          t('La prévenir de l\'escroquerie au faux « récupérateur »', 'Les victimes sont souvent recontactées par de prétendus cabinets, avocats ou « agents » qui promettent de récupérer les fonds contre paiement. Aucun service d\'enquête ne réclame de frais.'),
          t('Faire sécuriser les comptes encore actifs', 'Changer les mots de passe (exchange, messagerie, e-mail), activer la double authentification. Si une phrase de récupération a été communiquée ou un drainer signé, conseiller de déplacer le reliquat vers un portefeuille neuf — sans jamais manipuler soi-même les fonds de la victime.'),
          t('L\'inviter à contacter sa banque sans délai', 'Pour un virement récent, la banque peut parfois tenter un rappel de fonds ; pour une carte, une contestation selon les conditions de l\'établissement.'),
        ],
      },
      {
        title: 'Chronologie des faits',
        items: [
          t('Premier contact : date, canal (réseau social, site de rencontre, publicité, SMS, appel), identité affichée'),
          t('Déroulé de la manipulation : promesse, premiers « gains » affichés, retraits test, pression, demandes de frais'),
          c('Tableau daté de chaque paiement : date et heure, montant en euros, actif, quantité, réseau, moyen utilisé', 'Le construire pendant l\'audition : il sert de base au rapprochement avec les transactions on-chain et à la réquisition des plateformes.'),
          t('Dernier contact avec les escrocs et état actuel de la relation'),
        ],
      },
      {
        title: 'Éléments techniques à collecter',
        items: [
          c('Adresses de destination exactes, copiées et jamais retapées', 'Les extraire de l\'historique du portefeuille ou de l\'exchange (export, capture), avec le réseau utilisé. Une même adresse 0x… existe sur toutes les chaînes EVM : le réseau est indispensable.'),
          c('Hash (TxID) des transactions', 'Dans l\'historique : « TxID », « hash », « ID de transaction ». À défaut, date, heure, montant et adresse suffisent souvent à les retrouver sur l\'explorateur.'),
          t('Adresses du portefeuille de la victime (source des envois)'),
          t('Plateforme d\'achat utilisée (exchange, PSAN/PSCA, DAB, achat P2P) : nom, identifiant client, relevé complet', 'Le relevé de l\'exchange de la victime donne les adresses de retrait et les hash exacts, horodatés.'),
          c('Memo, destination tag ou commentaire exigé lors de l\'envoi', 'Sur XRP, Stellar, TON, EOS…, il désigne le client final d\'un exchange : sans lui, la plateforme ne peut pas identifier le titulaire.'),
          t('Fausse plateforme : nom, URL exacte, application installée (nom, lien de téléchargement), identifiants, captures du « solde »'),
          t('Exports natifs des conversations plutôt que de simples captures', 'Relever l\'identifiant technique des comptes (numéro, @pseudonyme, ID), pas seulement le nom affiché.'),
          t('Numéros, adresses e-mail, pseudonymes, sites et IBAN fournis par les escrocs'),
          t('Moyens de paiement fiat : virements (IBAN bénéficiaires), cartes, coupons prépayés, espèces remises'),
        ],
      },
      {
        title: 'Clôture de l\'entretien',
        items: [
          t('Joindre les pièces à la plainte sur support (exports, relevés, captures) avec leur provenance'),
          t('Remettre les coordonnées de l\'enquêteur et le numéro de procédure'),
          t('Expliquer les suites possibles sans promettre de récupération', 'Le traçage peut identifier des comptes ; le gel et la restitution dépendent de la réactivité, de la coopération des plateformes et des décisions judiciaires.'),
          t('Orienter vers l\'aide aux victimes (associations France Victimes) et, au besoin, vers un accompagnement psychologique'),
        ],
      },
    ],
    pitfalls: [
      'Retaper une adresse à la main : un seul caractère faux rend la réquisition inutile.',
      'Ne relever que le montant en euros : il faut l\'actif, la quantité et le réseau.',
      'Confondre l\'adresse affichée par la fausse plateforme avec une adresse de dépôt d\'un exchange réel : c\'est souvent cette dernière qui permet l\'identification.',
      'Laisser la victime supprimer l\'application ou les conversations « par honte ».',
      'Promettre un remboursement ou un gel : la victime risque ensuite de payer un faux récupérateur.',
    ],
    lessons: ['premiers-reflexes', 'typologies', 'explorateur-blocs', 'ponzi-mlm', 'address-poisoning'],
    tools: ['Questionnaire d\'audition de victime (modèle imprimable)', 'Explorateur de blocs pour retrouver un hash à partir de la date et du montant'],
    modeles: ['questionnaire-victime', 'pv-constatations'],
  },

  // ── Urgence ──────────────────────────────────────────────────────────────
  {
    id: 'urgence-gel',
    title: 'Urgence : fonds en mouvement, gel immédiat',
    category: 'urgence',
    icon: 'Zap',
    summary: 'Les fonds viennent de partir : identifier en quelques minutes où ils peuvent encore être bloqués (émetteur de stablecoin, exchange) et transmettre une demande exploitable.',
    when: 'Vol, escroquerie, piratage ou drainer datant de quelques heures ; tant que les fonds n\'ont pas été convertis, mixés ou retirés, un gel reste possible.',
    sections: [
      {
        title: 'Les quinze premières minutes',
        items: [
          c('Obtenir l\'adresse de destination et le hash de la transaction initiale'),
          c('Identifier l\'actif et le réseau', 'USDT, USDC : gelables par l\'émetteur. BTC, ETH, TRX natifs : non gelables sur la chaîne, seul un intermédiaire (exchange, service) peut bloquer.'),
          t('Suivre les fonds saut par saut jusqu\'à leur position actuelle', 'Noter chaque adresse, hash et horodatage UTC ; repérer en priorité les dépôts vers un exchange identifié.'),
          c('Aviser sans délai le magistrat de permanence et la hiérarchie'),
          t('Ouvrir un journal horodaté des actions', 'Heure de chaque constat, appel, envoi et réponse : il alimentera le PV et la chronologie.'),
        ],
      },
      {
        title: 'Stablecoins : saisir l\'émetteur',
        items: [
          c('USDT : solliciter Tether par son canal dédié aux autorités', 'L\'émetteur peut inscrire une adresse sur liste noire sur demande d\'une autorité répressive ; le gel vaut pour la chaîne concernée (Tron, Ethereum…). Les procédures évoluent : vérifier le canal en vigueur.'),
          t('USDC / EURC : saisir Circle par les voies formelles', 'Circle gèle en principe sur la base d\'une décision ou d\'une demande formelle d\'autorité ; les délais sont souvent plus longs.'),
          c('Transmettre : adresses, réseau, montant, hash, résumé des faits, cadre procédural, coordonnées de l\'OPJ et du magistrat'),
          t('Demander une confirmation écrite du gel et du montant bloqué'),
        ],
      },
      {
        title: 'Exchanges et services',
        items: [
          c('Fonds sur une adresse de dépôt d\'exchange : contacter la conformité ou le portail forces de l\'ordre', 'Demander le blocage conservatoire du compte et la conservation des données, puis régulariser par réquisition.'),
          t('Rédiger la réquisition (art. 60-1, 77-1-1 ou 99-3 CPP selon le cadre) avec demande de blocage'),
          t('Plateforme étrangère : utiliser son canal forces de l\'ordre et anticiper l\'entraide', 'Beaucoup gèlent à titre conservatoire sur demande motivée d\'un service d\'enquête, puis exigent un acte formel dans un délai donné.'),
          t('Échangeur instantané, bridge, DEX : identifier un opérateur centralisé s\'il existe', 'Un échangeur centralisé peut parfois bloquer un ordre en cours ; un DEX ou un bridge décentralisé ne le peut pas.'),
        ],
      },
      {
        title: 'Surveiller et documenter',
        items: [
          t('Placer les adresses sous surveillance (alertes de l\'outil d\'analyse ou de l\'explorateur)'),
          c('Capturer l\'état des adresses au moment de chaque demande', 'Soldes et transactions horodatés : ces captures fondent le PV de constatations.'),
          t('Rédiger le PV de constatations et la demande de gel écrite'),
          t('Relancer en l\'absence de réponse et tracer chaque relance'),
        ],
      },
    ],
    pitfalls: [
      'Attendre la réquisition formelle avant tout contact : quelques heures suffisent pour que les fonds soient convertis ou mixés.',
      'Croire qu\'un BTC ou un ETH peut être « gelé » sur la blockchain : seul un intermédiaire peut bloquer.',
      'Transmettre une adresse sans son réseau (une adresse 0x… existe sur toutes les chaînes EVM).',
      'Envoyer de la poussière ou un message on-chain aux suspects : cela les alerte et pollue la preuve.',
      'Oublier de demander le montant effectivement bloqué et une confirmation écrite.',
    ],
    lessons: ['gel-stablecoins', 'gel-saisie', 'stablecoins', 'tron-usdt', 'exchanges', 'suivre-flux'],
    tools: ['Traceur et surveillance d\'adresses (espace d\'enquête)', 'Générateur de réquisition (espace d\'enquête)', 'Frise chronologique pour horodater les sauts'],
    modeles: ['gel-stablecoin', 'requisition-psan', 'pv-constatations'],
  },
  {
    id: 'extorsion-rancon',
    title: 'Enlèvement ou extorsion avec rançon en crypto',
    category: 'urgence',
    icon: 'Siren',
    summary: 'Protéger les personnes d\'abord, préparer en parallèle le suivi des fonds en temps réel et les demandes de gel, coordonnés avec la conduite de l\'opération.',
    when: 'Enlèvement ou séquestration d\'un détenteur de crypto-actifs ou d\'un proche (« wrench attack »), menaces avec demande de paiement en crypto, vol avec violence visant un portefeuille.',
    sections: [
      {
        title: 'Priorité aux personnes',
        items: [
          c('Déclencher le dispositif d\'urgence et aviser immédiatement le parquet', 'La sauvegarde des vies prime sur la récupération des fonds ; la stratégie (paiement ou non, négociation) relève de l\'autorité judiciaire et des unités spécialisées.'),
          t('Solliciter les unités spécialisées (négociation, intervention) selon les procédures internes'),
          c('Conserver toutes les communications des auteurs (appels, messages, vidéos) sans y répondre hors consigne'),
          t('Cerner l\'exposition de la victime : notoriété crypto, réseaux sociaux, fuite de données clients, entourage', 'Le ciblage repose souvent sur une information publique ou une fuite : c\'est aussi une piste d\'identification.'),
        ],
      },
      {
        title: 'Préparer le volet crypto',
        items: [
          c('Relever l\'adresse de paiement exigée, l\'actif et le réseau'),
          t('Mettre l\'adresse sous surveillance en temps réel (outil d\'analyse, explorateur)'),
          t('Pré-identifier émetteurs et exchanges susceptibles d\'être touchés ; préparer les demandes de gel', 'En stablecoin, le gel par l\'émetteur peut être très rapide une fois la victime en sécurité.'),
          t('Si des transferts ont déjà eu lieu sous la contrainte : relever hash et heures, appliquer la fiche « Urgence : fonds en mouvement »'),
        ],
      },
      {
        title: 'Pendant et après le paiement',
        items: [
          t('Suivre les fonds saut par saut et horodater chaque mouvement'),
          c('Caler le moment des gels sur la stratégie opérationnelle', 'Un gel prématuré peut mettre la victime en danger : décision à prendre avec le magistrat et le commandement de l\'opération.'),
          t('Requérir en urgence les exchanges recevant les fonds (identité, IP, appareils, retraits)'),
          t('Exploiter ensuite les supports et les déclarations de la victime (portefeuilles vidés, contraintes subies)'),
        ],
      },
    ],
    pitfalls: [
      'Déclencher un gel ou toute action visible sans coordination avec la conduite de l\'opération.',
      'Négliger la piste de la donnée personnelle (fuite, exposition en ligne) qui a permis le ciblage.',
      'Interagir on-chain avec l\'adresse des auteurs.',
    ],
    lessons: ['violences-seed', 'gel-stablecoins', 'suivre-flux', 'osint'],
    tools: ['Surveillance d\'adresses et frise chronologique (espace d\'enquête)'],
    modeles: ['gel-stablecoin', 'requisition-psan'],
  },

  // ── Perquisition & saisie ────────────────────────────────────────────────
  {
    id: 'perquisition-crypto',
    title: 'Perquisition : repérer et préserver les crypto-actifs',
    category: 'perquisition',
    icon: 'ScanSearch',
    summary: 'Ne passer à côté d\'aucun crypto-actif et ne rien détruire : supports, phrases de récupération, portefeuilles matériels, applications, comptes.',
    when: 'Perquisition chez une personne ayant manipulé ou susceptible de détenir des crypto-actifs (escroquerie, stupéfiants, blanchiment, rançongiciel…).',
    sections: [
      {
        title: 'Préparer',
        items: [
          t('Recenser les indices crypto du dossier (adresses, exchanges, achats de hardware wallet, relevés bancaires)'),
          c('Prévoir un enquêteur formé ou un spécialiste numérique, et le matériel', 'Sacs de Faraday, câbles et chargeurs, appareil photo dédié, portefeuille de saisie du service prêt, imprimés d\'inventaire.'),
          t('Arrêter avec le magistrat la stratégie : saisie des supports, copie des données, transfert immédiat des fonds ou non'),
          t('Anticiper la découverte d\'un ordinateur allumé ou d\'un portefeuille déverrouillé'),
        ],
      },
      {
        title: 'Repérer',
        items: [
          c('Phrases de récupération (12 ou 24 mots) sur papier, carnet, plaque métallique, gravure', 'Chercher dans les livres, boîtiers, cadres, coffres ; une liste numérotée de mots anglais est un indice fort. Ne jamais saisir une phrase dans un appareil connecté.'),
          c('Portefeuilles matériels (Ledger, Trezor, Coldcard, BitBox…), leurs boîtes et cartes de récupération'),
          t('Téléphones, ordinateurs, tablettes, clés USB, disques, cartes mémoire'),
          t('Mots de passe, codes PIN, passphrases notés, gestionnaires de mots de passe', 'Une passphrase BIP39 (« 25e mot ») ouvre un portefeuille différent : la chercher avec la seed.'),
          t('Documents : relevés d\'exchange, factures de hardware wallet, QR codes imprimés, paper wallets, contrats de minage'),
          t('Matériel de minage ou nœud (mini-PC, serveur) : à signaler au spécialiste'),
          t('Espèces, tickets de DAB crypto, traces de ventes P2P'),
        ],
      },
      {
        title: 'Préserver',
        items: [
          c('Ne pas éteindre un ordinateur allumé sans l\'avis du spécialiste', 'Portefeuille ouvert, session d\'exchange ou volume chiffré monté peuvent être perdus à l\'extinction. Photographier l\'écran avant toute action.'),
          c('Ne pas allumer un appareil éteint'),
          c('Isoler les téléphones du réseau : mode avion s\'il est déverrouillé, sinon sac de Faraday', 'Empêche l\'effacement et les transferts déclenchés à distance ; maintenir les appareils alimentés.'),
          t('Photographier chaque élément en place avant de le manipuler'),
          t('Ne jamais tester une seed ou un PIN sur un hardware wallet sur place', 'Plusieurs PIN erronés peuvent réinitialiser l\'appareil et effacer les clés.'),
          c('Placer les écrits sensibles (seed, passphrase) sous scellé distinct, à accès restreint et tracé', 'Quiconque voit une seed peut vider le portefeuille.'),
        ],
      },
      {
        title: 'Décider et documenter',
        items: [
          t('Évaluer avec le magistrat un transfert immédiat vers le portefeuille de saisie du service', 'Un complice détenant une copie de la seed peut vider les fonds à tout moment : voir la fiche « Saisie de crypto-actifs ».'),
          t('Inventorier : support, lieu de découverte, état (allumé, verrouillé), numéro de scellé, personnes présentes'),
          t('Interroger la personne présente sur l\'existence de portefeuilles et de codes, dans le respect de ses droits'),
          t('Placer sous main de justice selon les règles du cadre procédural', 'Les données peuvent être saisies via le support ou une copie (art. 56 CPP) ; l\'accès à des données distantes (cloud, compte en ligne) obéit à des règles propres : s\'en assurer avec le parquet.'),
        ],
      },
    ],
    pitfalls: [
      'Photographier une seed avec un téléphone synchronisé dans le cloud.',
      'Laisser un téléphone connecté : effacement à distance ou vidage par un complice.',
      'Saisir le hardware wallet sans sa seed : si un tiers détient une copie, les fonds restent accessibles.',
      'Éteindre l\'ordinateur « par réflexe ».',
      'Oublier les autres pièces, dépendances et véhicules : les seeds sont souvent cachées hors du bureau.',
    ],
    lessons: ['saisie-avancee', 'forensique-supports', 'cles-portefeuilles', 'portefeuilles-hd', 'gel-saisie'],
    tools: ['Inventaire de saisie (modèle imprimable)'],
    modeles: ['inventaire-saisie'],
  },
  {
    id: 'saisie-crypto',
    title: 'Saisie de crypto-actifs',
    category: 'perquisition',
    icon: 'Vault',
    summary: 'Transférer des crypto-actifs sous main de justice de façon sûre, vérifiable et documentée — les principes, à décliner selon la doctrine du service.',
    when: 'Accès à des fonds (seed, appareil déverrouillé, compte d\'exchange) lors d\'une perquisition ou après réquisition, avec décision de saisie.',
    sections: [
      {
        title: 'Avant toute manipulation',
        items: [
          c('Recueillir les instructions du magistrat (cadre, nature de la saisie)', 'Les saisies pénales spéciales relèvent des articles 706-141 et suivants du CPP ; les modalités se déterminent avec le parquet ou le juge d\'instruction.'),
          c('Disposer d\'un portefeuille de saisie du service, créé et conservé selon la doctrine interne', 'Jamais un portefeuille personnel. Garde des clés et séparation des rôles selon les consignes du service.'),
          c('Désigner un opérateur et un contrôleur (double contrôle)'),
          t('Recenser les actifs et réseaux concernés', 'Prévoir de quoi payer les frais : pour déplacer des jetons sur Ethereum ou Tron, il faut de l\'ETH ou du TRX (ou de l\'énergie).'),
        ],
      },
      {
        title: 'Exécution',
        items: [
          t('Constater et capturer les soldes avant transfert (adresses, montants, horodatage)'),
          c('Vérifier l\'adresse de destination caractère par caractère, à deux', 'Contrôler début, milieu et fin : adresses sosies et logiciels malveillants de presse-papiers existent.'),
          t('Effectuer un transfert test de faible montant et vérifier sa réception on-chain'),
          t('Transférer le solde, actif par actif et réseau par réseau'),
          t('Attendre les confirmations et capturer chaque transaction sur un explorateur', 'Hash, bloc, date et heure UTC, frais.'),
          t('Contrôler l\'absence de reliquats : poussière, jetons secondaires, autres comptes de la même seed', 'Une seed peut contrôler plusieurs comptes et chemins de dérivation : vérifier avec le spécialiste.'),
        ],
      },
      {
        title: 'Formaliser',
        items: [
          c('Rédiger un procès-verbal détaillé : intervenants, appareils, adresses, hash, montants, cours indicatif daté'),
          t('Placer sous scellé supports, seed et éléments d\'accès selon les consignes'),
          t('Rendre compte au magistrat des montants saisis par actif'),
          t('Préparer, sur instruction du magistrat, la remise ou le transfert à l\'AGRASC', 'L\'AGRASC gère les biens saisis qui lui sont confiés et peut, sur décision judiciaire, les vendre avant jugement. Les modalités pratiques suivent les instructions de l\'agence et du magistrat.'),
          t('Fonds détenus sur un exchange : bloquer par réquisition, puis faire transférer par la plateforme vers le portefeuille désigné'),
        ],
      },
    ],
    pitfalls: [
      'Opérer seul, sans contrôleur ni captures.',
      'Saisir le support sans transférer alors qu\'un tiers détient une copie de la seed.',
      'Oublier les frais de réseau et rester bloqué au milieu d\'une saisie de jetons.',
      'Signer depuis un appareil non maîtrisé, potentiellement compromis.',
      'Omettre un chemin de dérivation ou une passphrase : des fonds restent hors de vue.',
    ],
    lessons: ['gel-saisie', 'saisie-avancee', 'portefeuilles-hd', 'address-poisoning'],
    tools: ['Inventaire de saisie (modèle imprimable)', 'Explorateur de blocs pour capturer chaque transfert'],
    modeles: ['inventaire-saisie', 'note-magistrat'],
  },
  {
    id: 'exploitation-supports',
    title: 'Exploitation d\'un téléphone ou d\'un ordinateur saisi',
    category: 'perquisition',
    icon: 'MonitorSmartphone',
    summary: 'Repérer sur un support saisi tout ce qui révèle portefeuilles, comptes et flux : applications, extensions, fichiers, captures, messageries.',
    when: 'Exploitation d\'un support saisi, en lien avec le service ou l\'expert chargé de l\'extraction.',
    sections: [
      {
        title: 'Cadre et méthode',
        items: [
          c('Vérifier le cadre de l\'exploitation (enquêteur, personne qualifiée requise, expertise)'),
          c('Travailler sur une extraction ou une copie plutôt que sur l\'original'),
          t('Garder l\'appareil isolé du réseau', 'Une application de portefeuille qui se synchronise modifie les données ; un complice peut agir à distance.'),
          t('Tracer chaque manipulation : heure, action, capture'),
        ],
      },
      {
        title: 'Applications et logiciels',
        items: [
          t('Portefeuilles mobiles (Trust Wallet, MetaMask, Exodus, Phantom, Tonkeeper, portefeuille intégré à Telegram…)', 'Relever nom, version, adresses affichées, réseaux activés, historique.'),
          t('Applications d\'exchange et de courtage : sessions ouvertes, notifications, e-mails de confirmation'),
          t('Extensions de navigateur (MetaMask, Phantom, Rabby…) et leurs coffres chiffrés', 'Les données des extensions résident dans le profil du navigateur : les signaler à l\'expert.'),
          t('Logiciels de bureau : Bitcoin Core (wallet.dat), Electrum, Sparrow, Wasabi, Monero GUI…'),
          t('Applications d\'authentification (2FA) et gestionnaires de mots de passe'),
        ],
      },
      {
        title: 'Données à rechercher',
        items: [
          c('Seeds, clés privées, xpub / ypub / zpub, fichiers de portefeuille', 'Mots-clés : seed, mnemonic, recovery, xpub, wallet.dat, keystore, « UTC-- », listes de 12/24 mots, captures de seed dans la galerie.'),
          t('Adresses copiées : presse-papiers, notes, carnets d\'adresses des portefeuilles'),
          t('Photos et captures : QR codes, seeds, soldes, confirmations de retrait'),
          t('Messageries (Telegram, Signal, WhatsApp, Session…) : adresses échangées, négociations, groupes OTC', 'Relever identifiants techniques et dates ; chaque adresse vue dans un message est un pivot.'),
          t('E-mails : confirmations de dépôt et de retrait, alertes de connexion, factures de hardware wallet', 'Ils désignent les plateformes à requérir.'),
          t('Navigateur : historique, favoris, mots de passe enregistrés, explorateurs consultés'),
        ],
      },
      {
        title: 'Exploiter',
        items: [
          c('Lister chaque adresse trouvée avec sa source (fichier, application, capture)'),
          t('Dériver les adresses d\'une xpub en mode lecture seule (watch-only)', 'Respecter le gap limit et tester les chemins usuels (BIP44, 49, 84, 86) : les adresses de rendu font partie du portefeuille.'),
          t('Analyser les adresses dans l\'outil d\'analyse, sans jamais envoyer de fonds'),
          t('En déduire les plateformes à requérir et les fonds à geler ou à saisir'),
        ],
      },
    ],
    pitfalls: [
      'Lancer une application de portefeuille connectée au réseau sur l\'original.',
      'Ignorer la galerie photo : les seeds y sont souvent photographiées.',
      'Oublier les comptes secondaires (autres chemins de dérivation, passphrase).',
      'Se contenter du nom affiché d\'un contact de messagerie sans son identifiant technique.',
    ],
    lessons: ['forensique-supports', 'portefeuilles-hd', 'cles-portefeuilles', 'saisie-avancee'],
    tools: ['Import et annotation des adresses dans l\'espace d\'enquête'],
    modeles: ['inventaire-saisie'],
  },
  {
    id: 'audition-suspect',
    title: 'Audition d\'un suspect : les questions crypto',
    category: 'perquisition',
    icon: 'Mic',
    summary: 'Faire le tour des avoirs d\'un mis en cause — portefeuilles, phrases de récupération, comptes, appareils, flux — sans fragiliser la procédure.',
    when: 'Audition, en garde à vue ou libre, d\'une personne soupçonnée d\'avoir reçu, détenu ou blanchi des crypto-actifs.',
    sections: [
      {
        title: 'Préparer',
        items: [
          t('Lister adresses, transactions, plateformes et montants du dossier'),
          t('Préparer captures et schéma simplifié des flux à présenter'),
          c('S\'assurer de la notification des droits (droit de se taire, avocat) et de la régularité de la mesure'),
          t('Anticiper la saisie ou le gel à déclencher si un accès est livré'),
        ],
      },
      {
        title: 'Les avoirs',
        items: [
          t('Détenez-vous ou avez-vous détenu des crypto-actifs ? Lesquels, depuis quand, pour quel montant ?'),
          t('Quels portefeuilles utilisez-vous (application, extension, hardware wallet, papier), sur quels appareils ?'),
          c('Où sont vos phrases de récupération et passphrases ? Qui d\'autre y a accès ?', 'Une copie détenue par un tiers impose une saisie rapide.'),
          t('Quels comptes d\'exchange ou de courtage, en France et à l\'étranger, sous quelle identité et quelle adresse e-mail ?'),
          t('Comment achetez-vous et revendez-vous : exchange, P2P, OTC, DAB, espèces ?'),
        ],
      },
      {
        title: 'Les flux',
        items: [
          t('Présenter les adresses : les reconnaissez-vous ? Qui les contrôle ?'),
          t('Faire expliquer chaque transaction clé : origine, destinataire, contrepartie, motif'),
          t('Qui vous a payé, qui avez-vous payé, par quel canal les adresses ont-elles été échangées ?'),
          t('Mixeurs, bridges, échangeurs instantanés, cryptos anonymes : pourquoi les avoir utilisés ?'),
        ],
      },
      {
        title: 'Codes et accès : prudence juridique',
        items: [
          c('Demander les codes de déverrouillage des appareils et des portefeuilles, et acter la réponse', 'La personne peut refuser de répondre. Le refus de remettre la convention secrète de déchiffrement d\'un moyen de cryptologie peut constituer une infraction (art. 434-15-2 du code pénal) ; son application à un code de téléphone dépend des caractéristiques de l\'appareil selon la jurisprudence de la Cour de cassation. Valider la démarche avec le magistrat.'),
          t('Ne pas assimiler sans précaution une seed ou un mot de passe d\'exchange à une convention de déchiffrement', 'Qualification incertaine : une menace de poursuite infondée pourrait fragiliser les déclarations recueillies.'),
          c('Si un accès est donné, ne pas laisser la personne manipuler l\'appareil ; appliquer la fiche « Saisie de crypto-actifs »'),
          t('Acter précisément les déclarations : adresses, applications, emplacement des seeds, identifiants'),
        ],
      },
    ],
    pitfalls: [
      'Laisser la personne « montrer » son portefeuille sur son téléphone : un transfert ou un effacement prend quelques secondes.',
      'Invoquer l\'article 434-15-2 du code pénal de façon systématique ou inexacte.',
      'Ne pas vérifier aussitôt on-chain une adresse déclarée.',
      'Poser des questions vagues (« avez-vous des cryptos ? ») sans support documentaire.',
    ],
    lessons: ['saisie-avancee', 'forensique-supports', 'cles-portefeuilles', 'blanchiment-pro'],
    tools: ['Schéma des flux exporté depuis le graphe de l\'espace d\'enquête'],
  },

  // ── Réquisitions ─────────────────────────────────────────────────────────
  {
    id: 'requisition-psan',
    title: 'Réquisition à un exchange ou à un PSAN / PSCA',
    category: 'requisitions',
    icon: 'Building2',
    summary: 'Obtenir l\'identité, les connexions, les flux et le blocage d\'un compte client à partir d\'une adresse de dépôt.',
    when: 'Des fonds ont atteint une adresse attribuée à un exchange, un courtier ou un conservateur (PSAN enregistré, PSCA agréé, plateforme étrangère).',
    sections: [
      {
        title: 'Avant de requérir',
        items: [
          c('Confirmer l\'attribution de l\'adresse et sa nature', 'Une adresse de dépôt identifie un client ; un hot wallet n\'identifie que la plateforme. Requérir sur un hot wallet donne rarement un résultat.'),
          t('Identifier l\'entité juridique et son pays d\'établissement', 'PSCA agréé dans l\'UE ou plateforme hors UE : dans le second cas, l\'entraide peut être nécessaire, même si beaucoup répondent à des demandes directes.'),
          t('Trouver le canal de la conformité (portail forces de l\'ordre, adresse dédiée)'),
          c('Rassembler adresses, hash, dates UTC, montants et memo / tag éventuels'),
        ],
      },
      {
        title: 'Rédiger',
        items: [
          c('Viser le bon fondement : art. 60-1 (flagrance), 77-1-1 (préliminaire, sur autorisation du procureur), 99-3 (commission rogatoire)'),
          t('Identité du titulaire et pièces KYC / KYB'),
          t('Coordonnées : e-mails, téléphones, adresse postale'),
          t('IP de création et de connexion horodatées (UTC), ports sources si disponibles, identifiants d\'appareils', 'Sans port source, une IP partagée (CGNAT) peut être inexploitable auprès de l\'opérateur.'),
          c('Historique des dépôts, retraits et conversions, avec adresses et réseaux de retrait'),
          t('Moyens de paiement fiat (IBAN, cartes) et opérations correspondantes'),
          t('Comptes liés (même identité, appareil, IP ou moyen de paiement) et solde actuel'),
          c('Blocage conservatoire des avoirs si les fonds sont présumés illicites, avec confirmation du montant bloqué'),
          t('Demande de non-information du client'),
          t('Période délimitée et fuseau horaire précisé (UTC)'),
        ],
      },
      {
        title: 'Suivre',
        items: [
          t('Envoyer par le canal sécurisé et noter la date d\'envoi'),
          t('Relancer en l\'absence de réponse', 'Pour une réquisition fondée sur l\'article 60-1 CPP, le fait de s\'abstenir d\'y répondre sans motif légitime est puni d\'une amende de 3 750 euros (prestataire soumis à la loi française).'),
          t('Exploiter la réponse : nouvelles adresses de retrait, IBAN, IP → nouveaux actes'),
          t('Verser la réponse en procédure avec un PV d\'exploitation'),
        ],
      },
    ],
    pitfalls: [
      'Requérir sur un hot wallet ou un cold wallet au lieu de l\'adresse de dépôt.',
      'Oublier le memo / destination tag (XRP, Stellar, TON…) : la plateforme ne peut pas identifier le client.',
      'Indiquer des heures locales sans le préciser.',
      'Demander « toutes informations utiles » : énumérer les données attendues.',
      'Oublier de demander le blocage en même temps que l\'identification.',
    ],
    lessons: ['requisitions', 'exchanges', 'attribution-sources', 'cooperation-internationale', 'cadre-reglementaire'],
    tools: ['Générateur de réquisition de l\'espace d\'enquête (pré-rempli depuis le graphe)'],
    modeles: ['requisition-psan'],
  },
  {
    id: 'requisition-dab',
    title: 'Réquisition à un opérateur de DAB crypto',
    category: 'requisitions',
    icon: 'Banknote',
    summary: 'Préserver vite la vidéosurveillance, puis obtenir le journal de transaction et les données KYC d\'un distributeur de crypto-actifs.',
    when: 'La victime a acheté des crypto-actifs à un DAB pour payer les escrocs, ou des fonds suspects y ont été convertis en espèces.',
    sections: [
      {
        title: 'Préserver en urgence',
        items: [
          t('Identifier l\'opérateur et la machine (adresse précise, identifiant)', 'Reçu, carte des machines de l\'opérateur, déclarations de la victime, relevés.'),
          c('Demander immédiatement la conservation des images', 'Les durées de conservation sont souvent courtes : demande de préservation par tout moyen, puis réquisition écrite.'),
          t('Requérir le commerce ou le lieu hôte pour ses propres caméras'),
        ],
      },
      {
        title: 'Données à requérir',
        items: [
          c('Journal de la transaction : date et heure, machine, espèces déposées ou retirées, actif, quantité, adresse de destination, hash'),
          t('Données KYC selon les seuils de l\'opérateur : numéro de téléphone vérifié, pièce d\'identité, selfie'),
          t('Autres transactions liées au même téléphone, à la même identité ou à la même adresse'),
          t('Images de la caméra intégrée à la machine'),
          t('Statut réglementaire de l\'opérateur (PSAN enregistré, PSCA agréé)'),
        ],
      },
      {
        title: 'Analyser',
        items: [
          t('Rapprocher l\'adresse de destination des transactions on-chain'),
          t('Pour une victime, l\'adresse de destination est en général celle des escrocs', 'La victime est souvent guidée par téléphone devant la machine : faire préciser l\'heure exacte et le déroulé.'),
          t('Rechercher d\'autres victimes ayant alimenté la même adresse'),
        ],
      },
    ],
    pitfalls: [
      'Attendre le retour des autres réquisitions avant de préserver la vidéo.',
      'Ne requérir que l\'opérateur et oublier le commerce hôte.',
      'Croire qu\'un achat sans KYC rend la réquisition inutile : journal, téléphone et images restent exploitables.',
    ],
    lessons: ['dab-cash-p2p', 'requisitions', 'typologies'],
    modeles: ['requisition-dab'],
  },

  // ── Analyse ──────────────────────────────────────────────────────────────
  {
    id: 'analyse-adresse',
    title: 'Analyser une adresse en 10 étapes',
    category: 'analyse',
    icon: 'Microscope',
    summary: 'La méthode SPECTRA pour passer d\'une adresse brute à des conclusions défendables, sourcées et assorties d\'un niveau de confiance.',
    when: 'Toute nouvelle adresse dans un dossier : celle de la victime, de l\'escroc, trouvée en perquisition ou dans une conversation.',
    sections: [
      {
        title: 'Identifier',
        items: [
          t('1. Valider l\'adresse : chaîne, format, réseaux possibles', 'Préfixe (1, 3, bc1q, bc1p, 0x, T, r, EQ/UQ…). Une adresse 0x… peut être active sur plusieurs chaînes EVM : les vérifier toutes.'),
          c('2. Attribution : l\'adresse est-elle étiquetée, par quelle source, avec quelle fiabilité ?', 'Réponse à réquisition et saisie > outil commercial > OSINT > heuristique. Toujours noter la source.'),
          t('3. Cluster : à quel ensemble est-elle rattachée, sur quelle heuristique ?', 'Entrées communes, rendus, dépôts : un cluster reste une hypothèse. Écarter une fausse fusion due à un CoinJoin.'),
          t('4. Profil : nature (EOA, contrat, adresse de dépôt, hot wallet), ancienneté, volume, solde, nombre de transactions'),
        ],
      },
      {
        title: 'Comprendre les flux',
        items: [
          t('5. Flux entrants : origine des fonds, premier financeur, activation du compte'),
          c('6. Flux sortants : suivre jusqu\'à un service identifié ou une impasse documentée'),
          t('7. Contreparties : entités directes (exchanges, mixeurs, bridges, services)'),
          t('8. Exposition directe et indirecte aux entités à risque (sanctions, mixeurs, darknet)', 'Préciser la méthode (poison, haircut / prorata, FIFO) : le résultat en dépend entièrement.'),
        ],
      },
      {
        title: 'Conclure',
        items: [
          t('9. Chronologie : horodatages UTC, rythme d\'activité, fuseau probable, concordance avec les faits'),
          c('10. Synthèse : conclusions, niveau de confiance, limites, actes proposés (réquisitions, gels)'),
          t('Archiver captures et exports à chaque étape (date de consultation, outil, version)'),
        ],
      },
    ],
    pitfalls: [
      'Prendre une étiquette d\'outil pour une preuve.',
      'Confondre le hot wallet d\'un exchange avec l\'adresse du suspect.',
      'Additionner des taints calculés selon des méthodes différentes.',
      'S\'arrêter au premier service rencontré sans regarder ce qui suit.',
      'Oublier les autres chaînes EVM pour une adresse 0x….',
    ],
    lessons: ['suivre-flux', 'attribution-sources', 'clustering', 'exposition-risque', 'explorateur-blocs', 'tracage-outille', 'analyse-comportementale'],
    tools: ['Graphe et fiche d\'entité', 'Traceur (poison, haircut, FIFO)', 'Frise chronologique', 'Signalements et journal d\'enquête'],
    modeles: ['pv-constatations'],
  },
  {
    id: 'changement-chaine',
    title: 'Suivre des fonds qui changent de chaîne',
    category: 'analyse',
    icon: 'Waypoints',
    summary: 'Retrouver les fonds de l\'autre côté d\'un bridge, d\'un échangeur instantané ou d\'un swap inter-chaînes, et qualifier la solidité du lien.',
    when: 'Les fonds partent vers un contrat de bridge, un routeur inter-chaînes ou un échangeur instantané, ou disparaissent d\'une chaîne pour réapparaître sur une autre.',
    sections: [
      {
        title: 'Identifier le passage',
        items: [
          c('Identifier le service : bridge (contrat), routeur ou agrégateur, échangeur instantané centralisé, atomic swap'),
          t('Relever hash, horodatage UTC, actif, montant de départ et frais'),
          t('Lire les événements (logs) du contrat : chaîne de destination, destinataire, identifiant ou nonce', 'Beaucoup de bridges inscrivent la destination et un identifiant de dépôt dans l\'événement : le lien est alors quasi certain.'),
        ],
      },
      {
        title: 'Retrouver l\'arrivée',
        items: [
          t('Bridge ou rollup : rechercher la livraison portant le même identifiant', 'Sur un rollup optimiste, le retrait par le bridge canonique subit une période de contestation (de l\'ordre d\'une semaine) : une fenêtre pour agir à l\'arrivée.'),
          c('Sans identifiant : corrélation montant et délai', 'Montant de départ diminué des frais et de l\'écart de cours, dans une fenêtre de temps compatible. Plusieurs candidats : confiance faible, à écrire comme telle.'),
          t('Échangeur instantané : l\'adresse de dépôt est propre à l\'ordre, seul l\'opérateur relie dépôt et retrait', 'La corrélation on-chain reste une hypothèse que la réquisition à l\'opérateur peut confirmer.'),
          t('Vérifier la même adresse 0x… sur la chaîne EVM d\'arrivée'),
        ],
      },
      {
        title: 'Consolider',
        items: [
          t('Requérir l\'opérateur centralisé : ordre, adresses, IP, e-mail'),
          c('Qualifier le lien : événement (certain), corrélation unique (probable), hypothèse (possible)'),
          t('Reprendre l\'analyse sur la nouvelle chaîne avec la même méthode'),
        ],
      },
    ],
    pitfalls: [
      'Présenter une corrélation montant / délai comme une certitude.',
      'Oublier que l\'actif change (ETH → USDT, BTC → XMR) et que le montant varie avec le cours.',
      'Chercher sur la mauvaise chaîne : lire l\'événement plutôt que deviner.',
      'Négliger les frais du bridge dans la corrélation.',
    ],
    lessons: ['bridges', 'chain-hopping', 'echangeurs-instantanes', 'layer2-rollups', 'smart-contracts-lecture'],
    tools: ['Corrélateur inter-chaînes (espace d\'enquête)', 'Traceur multi-chaînes'],
    modeles: ['requisition-psan'],
  },
  {
    id: 'osint-adresse',
    title: 'OSINT sur une adresse ou un pseudonyme',
    category: 'analyse',
    icon: 'Globe',
    summary: 'Relier une adresse ou un pseudonyme à une identité grâce aux sources ouvertes, de façon traçable et sans se dévoiler.',
    when: 'Adresse sans attribution, pseudonyme d\'escroc ou de vendeur, profil de réseau social ou de messagerie lié aux faits.',
    sections: [
      {
        title: 'Préparer',
        items: [
          c('Travailler depuis un environnement et des comptes d\'enquête dédiés (voir fiche OPSEC)'),
          t('Lister les sélecteurs : adresses, pseudonymes, e-mails, numéros, domaines, images'),
          t('Tenir un journal de recherche : requête, source, date, résultat'),
        ],
      },
      {
        title: 'Sur une adresse',
        items: [
          t('Moteurs de recherche (adresse entre guillemets) et explorateurs : étiquettes publiques, noms de domaine on-chain (ENS…)'),
          t('Réseaux sociaux, forums, dépôts de code, sites de partage de texte : adresses de dons, preuves de paiement publiées'),
          t('Bases de signalement d\'arnaques et listes de sanctions (liste SDN de l\'OFAC, sanctions de l\'UE)', 'Un signalement public est un indice, pas une preuve : le présenter comme tel.'),
          t('NFT, profils d\'agrégateurs, interactions avec des contrats identifiables'),
          t('Fuites et archives : uniquement dans le respect du cadre légal et des consignes du service'),
        ],
      },
      {
        title: 'Sur un pseudonyme',
        items: [
          t('Rechercher sa réutilisation sur d\'autres plateformes'),
          t('Messageries : identifiant technique, photo, bio, groupes publics, liens d\'invitation'),
          t('Métadonnées et recherche inversée d\'images'),
          t('Croiser : même e-mail, numéro ou portefeuille sur plusieurs profils'),
        ],
      },
      {
        title: 'Tracer et exploiter',
        items: [
          c('Capturer chaque résultat avec URL, date et heure, et l\'archiver', 'Les contenus disparaissent vite : capture complète de page, conservée sur les espaces du service.'),
          t('Qualifier chaque lien : confirmé, probable, possible'),
          t('Transformer en actes : réquisitions aux plateformes, hébergeurs, opérateurs, exchanges'),
        ],
      },
    ],
    pitfalls: [
      'Interagir avec la cible (message, ajout, réaction) depuis un compte non dédié.',
      'Soumettre une adresse à un service tiers qui la publie ou alerte son détenteur.',
      'Conclure sur une simple homonymie de pseudonyme.',
      'Oublier de capturer : la preuve disparaît.',
    ],
    lessons: ['osint', 'opsec-enqueteur', 'attribution-sources', 'ton-telegram'],
    tools: ['Journal d\'enquête et pièces à conviction de l\'espace d\'enquête'],
  },

  // ── Rédaction ────────────────────────────────────────────────────────────
  {
    id: 'rapport-analyse',
    title: 'Rédiger un rapport d\'analyse blockchain',
    category: 'redaction',
    icon: 'FileText',
    summary: 'Structurer un rapport lisible par un magistrat et solide face au contradictoire : plan type, niveaux de confiance, limites.',
    when: 'Restitution en procédure d\'une analyse de flux : rapport, PV d\'analyse, annexe à une note de synthèse.',
    sections: [
      {
        title: 'Plan type',
        items: [
          t('Objet et saisine : questions posées, cadre, période étudiée'),
          c('Synthèse en une page : conclusions principales et niveaux de confiance'),
          t('Sources et outils : explorateurs, outils d\'analyse (version, date), réponses aux réquisitions'),
          t('Méthodologie : heuristiques, méthode de traçage (poison, haircut / prorata, FIFO), seuils retenus'),
          t('Constatations : tableaux de transactions (hash, date UTC, montants, adresses)'),
          t('Schémas : graphe simplifié et légendé'),
          t('Analyse : attributions, interprétation, hypothèses alternatives examinées'),
          c('Limites et incertitudes'),
          t('Propositions d\'actes : réquisitions, gels, entraide, saisies'),
          t('Annexes : exports, captures, réponses des prestataires, glossaire'),
        ],
      },
      {
        title: 'Niveaux de confiance',
        items: [
          t('Certain : établi par la blockchain (transaction, événement) ou par une réponse officielle'),
          t('Probable : heuristique robuste ou corrélation forte et unique'),
          t('Possible : hypothèse plausible, corroboration nécessaire'),
          c('Indiquer pour chaque attribution sa source et son niveau'),
        ],
      },
      {
        title: 'Relecture',
        items: [
          c('Vérifier chaque hash et chaque adresse par copie, jamais par retranscription'),
          t('Montants avec unités, actifs et réseaux ; conversion en euros datée et sourcée'),
          t('Horodatages en UTC, avec l\'heure de Paris si utile'),
          t('Séparer nettement faits constatés et interprétations'),
          t('Vocabulaire accessible, termes techniques définis'),
        ],
      },
    ],
    pitfalls: [
      'Reprendre la conclusion d\'un outil commercial sans en expliquer la méthode.',
      'Taire les limites (CoinJoin, corrélation incertaine) : la défense les relèvera.',
      'Produire un graphe illisible de centaines de nœuds.',
      'Convertir en euros sans date ni source de cours.',
    ],
    lessons: ['rapport', 'expertise-judiciaire', 'tracage-outille', 'exposition-risque'],
    tools: ['Rapport d\'enquête de l\'espace d\'enquête'],
    modeles: ['note-magistrat', 'pv-constatations'],
  },

  // ── OPSEC ────────────────────────────────────────────────────────────────
  {
    id: 'opsec-enqueteur',
    title: 'OPSEC de l\'enquêteur',
    category: 'opsec',
    icon: 'EyeOff',
    summary: 'Enquêter sans se dévoiler, sans alerter les suspects et sans contaminer la preuve.',
    when: 'Avant toute recherche sur des adresses, pseudonymes ou services liés à une enquête — et en permanence.',
    sections: [
      {
        title: 'Poste et navigation',
        items: [
          c('Utiliser un poste ou un environnement dédié aux recherches en sources ouvertes, conforme aux règles du service'),
          t('Navigateur dédié, sans compte personnel connecté, extensions minimales'),
          t('Connexion conforme à la doctrine du service', 'Explorateurs et sites des suspects journalisent les IP ; un site piégé peut détecter une consultation.'),
          t('N\'ouvrir aucun lien ni fichier transmis par les suspects hors environnement isolé'),
        ],
      },
      {
        title: 'Comptes et identités',
        items: [
          t('Comptes d\'enquête dédiés, gérés selon les règles internes ; jamais de compte personnel'),
          t('Ne pas réutiliser pseudonymes, photos ou numéros d\'une enquête à l\'autre'),
          c('Toute interaction active sous pseudonyme obéit à un cadre juridique spécifique', 'S\'assurer de l\'habilitation et de l\'autorisation requises ; ne jamais improviser une conversation avec un suspect.'),
        ],
      },
      {
        title: 'Blockchain : ne pas interagir',
        items: [
          c('N\'envoyer ni fonds, ni poussière, ni message on-chain à une adresse d\'enquête', 'Toute transaction est publique et définitive : elle peut alerter, polluer l\'analyse et relier le service à l\'affaire.'),
          c('Ne jamais connecter un portefeuille à un site suspect (risque de drainer)'),
          t('Ne pas « tester » un contrat ou un service suspect'),
          t('Se méfier des outils en ligne qui publient les adresses recherchées ou alertent leurs détenteurs'),
        ],
      },
      {
        title: 'Données de l\'enquête',
        items: [
          t('Stocker exports et captures sur les espaces du service, jamais dans un cloud personnel'),
          t('Ne pas faire circuler adresses, hash ou seeds sur des canaux non sécurisés'),
          c('Ne jamais photographier une seed avec un téléphone synchronisé'),
        ],
      },
    ],
    pitfalls: [
      'Consulter une adresse depuis son téléphone personnel.',
      'Envoyer un petit montant « pour voir » : action irréversible et compromettante.',
      'Partager une capture d\'écran contenant une seed ou une clé.',
    ],
    lessons: ['opsec-enqueteur', 'osint', 'drainers-approvals'],
  },
]
