// Niveau 2 — Stablecoins : DAB crypto, échanges d'espèces et P2P, mules et
// courtiers OTC. Les seuils et statuts réglementaires évoluent : à vérifier.
// Règle : les acteurs fautifs des exemples sont fictifs.
import type { Lesson } from '../model'

export const LESSON_DAB_CASH_P2P: Lesson = {
  id: 'dab-cash-p2p',
  title: 'DAB crypto, cash et P2P : les portes d’entrée',
  level: 2,
  track: 'stablecoins',
  minutes: 35,
  summary: `Les espèces restent la porte d'entrée et de sortie favorite de nombreux schémas : distributeurs automatiques de crypto-actifs vers lesquels les escrocs envoient leurs victimes, échanges « cash contre USDT » organisés sur messageries, places de marché P2P, mules et courtiers OTC. Fonctionnement d'un DAB crypto, statut des opérateurs, données exploitables (journal, téléphone, identité, vidéo), escroqueries typiques, économie parallèle du cash, et stratégie d'enquête : localiser, préserver la vidéo, réquisitionner, tracer.`,
  objectives: [
    `Décrire le fonctionnement d'un DAB crypto, du billet inséré à la transaction émise depuis le portefeuille de l'opérateur.`,
    `Connaître les données qu'un opérateur peut fournir et l'urgence de préserver les images de vidéoprotection.`,
    `Reconnaître les escroqueries qui envoient les victimes au distributeur et les indicateurs associés.`,
    `Comprendre les circuits P2P et « cash contre USDT », le rôle des mules et des courtiers OTC, et les données de chaque acteur.`,
    `Dérouler une stratégie d'enquête complète à partir d'un dépôt d'espèces dans un DAB.`,
  ],
  prerequisites: ['stablecoins', 'tron-usdt', 'typologies', 'requisitions'],
  practice: ['money-mules', 'sextortion-cluster', 'recovery-scam'],
  blocks: [
    {
      type: 'text',
      md: `« Madame, votre compte est en train d'être vidé. Retirez vos économies au guichet, je vous guide pour les mettre en sécurité. » Une heure plus tard, la victime glisse 4 800 € en billets dans une borne installée au fond d'un bureau de tabac, après avoir présenté au lecteur un QR code reçu sur WhatsApp. Les fonds partent en quelques minutes sur une adresse Bitcoin contrôlée par l'escroc.

Le **distributeur automatique de crypto-actifs** (DAB crypto) n'est pas un outil criminel en soi : c'est un moyen légal, pour qui en accepte le coût, d'acheter des crypto-actifs avec des espèces. Mais avec les échanges d'espèces entre particuliers, les places de marché P2P et les courtiers de gré à gré, il forme la **frontière entre l'argent liquide et la blockchain**, que les criminels franchissent dans les deux sens. Pour l'enquêteur, cette frontière est précieuse : c'est là que des personnes physiques, des caméras et des opérateurs régulés apparaissent.`,
    },
    { type: 'heading', text: 'Comment fonctionne un DAB crypto' },
    {
      type: 'steps',
      items: [
        { title: 'Choix de l’actif', md: `L'utilisateur choisit l'actif (BTC, USDT, ETH… selon la borne) et le montant. Le taux affiché inclut une marge souvent élevée (plusieurs pour cent).` },
        { title: 'Adresse de destination', md: `Il présente au lecteur le **QR code** de l'adresse qui recevra les fonds. Dans les escroqueries, ce QR code a été envoyé par l'auteur, souvent par messagerie, parfois imprimé.` },
        { title: 'Vérification', md: `Selon l'opérateur et le montant : numéro de téléphone avec code SMS, puis, au-delà de certains seuils, scan de pièce d'identité et photo du visage. Les seuils varient selon l'opérateur, le pays et la réglementation.` },
        { title: 'Insertion des billets', md: `Les billets sont comptés ; le montant en crypto est figé.` },
        { title: 'Émission', md: `L'opérateur envoie les crypto-actifs **depuis son propre portefeuille** (hot wallet) vers l'adresse indiquée, parfois en regroupant plusieurs clients dans une même transaction.` },
        { title: 'Reçu', md: `La borne imprime ou envoie un reçu : date, heure, terminal, montant, adresse de destination, parfois le txid. C'est une pièce essentielle.` },
      ],
    },
    {
      type: 'flow',
      caption: `Un dépôt d'espèces dans une borne : sur la chaîne, la transaction part du hot wallet de l'opérateur. Le lien avec la victime, le terminal et l'heure n'existe que chez l'opérateur, et sur la vidéo.`,
      nodes: [
        { id: 'v', label: 'Victime', kind: 'victim', sub: '4 800 € en espèces' },
        { id: 'atm', label: 'Borne n° 4471', kind: 'service', sub: 'bureau de tabac, 14:12 locale' },
        { id: 'op', label: 'Hot wallet de l’opérateur', kind: 'hot', sub: 'des centaines d’envois par jour' },
        { id: 'col', label: 'Collecteur de l’escroc', kind: 'suspect', sub: 'bc1q…9xrk' },
        { id: 'sw', label: 'Échangeur instantané', kind: 'service', sub: 'BTC → USDT-TRC20' },
        { id: 'otc', label: 'SatsDesk OTC', kind: 'service', sub: 'remise d’espèces (fictif)' },
      ],
      edges: [
        { from: 'v', to: 'atm', label: 'billets + QR reçu par messagerie' },
        { from: 'atm', to: 'op', label: 'ordre d’envoi', dashed: true },
        { from: 'op', to: 'col', label: '0,0712 BTC · 13:14 UTC' },
        { from: 'col', to: 'sw', label: 'regroupement de 46 dépôts' },
        { from: 'sw', to: 'otc', label: 'USDT' },
      ],
    },
    {
      type: 'callout',
      kind: 'law',
      title: 'Statut des opérateurs (à vérifier)',
      md: `Acheter ou vendre des crypto-actifs contre des espèces est un **service sur crypto-actifs** : en France, l'opérateur d'une borne relevait du régime des **PSAN** (enregistrement auprès de l'AMF) et relève désormais de l'agrément **PSCA** prévu par MiCA, avec les obligations de lutte contre le blanchiment (identification de la clientèle selon les seuils et les risques, conservation des données, déclarations de soupçon à TRACFIN). Vérifiez le statut de l'opérateur à la date des faits sur les listes de l'AMF ; une borne exploitée sans statut est en soi une infraction et un signal fort. Certains pays ont interdit ou fortement restreint ces distributeurs ; les seuils d'identification diffèrent selon les opérateurs et évoluent avec la réglementation.`,
    },
    {
      type: 'table',
      caption: 'Ce que l’opérateur (et son environnement) peut fournir',
      headers: ['Donnée', 'Détenteur', 'Conservation', 'Utilité'],
      rows: [
        ['Journal de transaction : terminal, lieu, heure, montant en euros, montant crypto, taux, adresse de destination, txid', 'Opérateur', 'Durée des obligations anti-blanchiment', 'Relie le dépôt physique à la transaction on-chain'],
        ['Numéro de téléphone vérifié par SMS', 'Opérateur', 'Idem', 'Souvent une ligne fournie ou contrôlée par l’escroc'],
        ['Pièce d’identité, photo du visage', 'Opérateur', 'Idem', 'Identité de l’utilisateur au-delà des seuils'],
        ['Photos ou vidéo de la caméra de la borne', 'Opérateur', 'Variable, souvent courte', 'Qui était devant la borne, au téléphone, accompagné ?'],
        ['Vidéoprotection du commerce ou de la galerie', 'Commerçant, gestionnaire du site', 'Courte (souvent de quelques jours à un mois)', 'Arrivée, départ, véhicule, complice'],
        ['Autres transactions vers la même adresse', 'Opérateur', 'Durée des obligations', 'Autres victimes, autres bornes'],
        ['Autres transactions avec le même téléphone ou la même identité', 'Opérateur', 'Durée des obligations', 'Mules, utilisateurs récurrents'],
      ],
    },
    {
      type: 'callout',
      kind: 'field',
      title: 'La vidéo n’attend pas',
      md: `Les images de vidéoprotection sont écrasées vite. Dès que la borne est identifiée, **réquisition immédiate** au commerçant ou au gestionnaire du site, et demande de conservation à l'opérateur pour les images de sa propre caméra. Relevez le **décalage d'horloge** entre l'enregistreur vidéo, la borne et l'heure UTC de la transaction : il servira à rapprocher précisément les images du txid.`,
    },
    { type: 'heading', text: 'Les escroqueries qui mènent au distributeur' },
    {
      type: 'table',
      caption: 'Scénarios fréquents et indicateurs',
      headers: ['Scénario', 'Discours de l’auteur', 'Indicateurs'],
      rows: [
        ['Faux conseiller bancaire', '« Votre compte est piraté, retirez vos espèces et mettez-les sur un coffre sécurisé »', 'Retrait au guichet puis dépôt en borne le même jour ; victime guidée au téléphone pendant le dépôt'],
        ['Faux policier ou faux gendarme', '« Une enquête est en cours, protégez votre épargne en la convertissant »', 'Usurpation de numéro, faux documents envoyés par messagerie'],
        ['Faux support technique', '« Votre ordinateur est infecté, payez la réparation ou le remboursement »', 'Prise de contrôle à distance de l’ordinateur, QR affiché à l’écran'],
        ['Sextorsion', '« Payez sous 24 heures ou la vidéo sera diffusée »', 'Victime jeune ou isolée, honte, dépôts fractionnés'],
        ['Faux placement, arnaque sentimentale', '« Alimentez votre compte d’investissement »', 'Dépôts répétés sur plusieurs semaines'],
        ['Fausse amende, faux huissier', '« Réglez immédiatement pour éviter la saisie »', 'Urgence, montants « officiels »'],
      ],
    },
    {
      type: 'text',
      md: `Points communs : **l'urgence**, l'**isolement** de la victime (« ne raccrochez pas, n'en parlez pas au guichetier »), le **QR code fourni** par l'auteur, et souvent **plusieurs dépôts** successifs dans une ou plusieurs bornes, pour rester sous les seuils de vérification. Côté chaîne, la même adresse de collecte reçoit fréquemment des fonds de **plusieurs opérateurs** et de **plusieurs victimes** : un traçage bien conduit permet de regrouper des plaintes déposées dans des départements différents.`,
    },
    {
      type: 'callout',
      kind: 'tip',
      title: 'Le reçu de la borne',
      md: `Demandez systématiquement à la victime le **reçu** (papier, SMS ou courriel) et les **messages** contenant le QR code. Le reçu donne l'adresse, l'heure et le terminal ; le QR décodé donne l'adresse exacte (et donc la chaîne). Avec ces deux éléments, la transaction se retrouve en quelques minutes sur un explorateur, avant même la réponse de l'opérateur.`,
    },
    {
      type: 'widget',
      id: 'address-anatomy',
      caption: `QR décodé, reçu de borne, capture de conversation : identifiez d'abord la chaîne et le type d'adresse pour choisir l'explorateur et les leviers (une adresse Tron d'USDT ouvre la voie d'un gel émetteur).`,
    },
    {
      type: 'check',
      q: `Une victime a déposé 4 800 € dans une borne après l'appel d'un faux conseiller. Quelle première série d'actions est la plus efficace ?`,
      options: [
        `Attendre la réponse de la banque avant toute démarche`,
        `Demander à la victime de rappeler l'escroc pour négocier`,
        `Classer : les espèces ne laissent aucune trace`,
        `Recueillir reçu et QR code, identifier borne et opérateur, faire préserver la vidéo, réquisitionner l'opérateur et tracer l'adresse de destination`,
      ],
      answer: 3,
      explain: `Le reçu et le QR donnent la transaction ; la vidéo disparaît vite ; l'opérateur détient le journal et le téléphone vérifié ; le traçage révèle la suite et d'éventuels points de gel.`,
    },
    { type: 'heading', text: 'Cash et P2P : l’économie parallèle' },
    {
      type: 'text',
      md: `Hors des bornes, les échanges d'espèces contre crypto-actifs passent par plusieurs circuits :

- **Places de marché P2P des exchanges** : des particuliers et des « marchands » publient des annonces ; la plateforme tient les crypto-actifs en séquestre pendant que l'acheteur paie (virement, parfois espèces en main propre). Les deux parties sont en général vérifiées, et la plateforme conserve les **conversations** et les **preuves de paiement**.
- **P2P non custodial** (par exemple Hodl Hodl) : séquestre multisignature, pas de vérification d'identité ; le service ne détient pas les fonds et ses données se limitent aux annonces et aux échanges entre utilisateurs.
- **Changeurs sur messageries** : groupes et canaux « cash contre USDT » par ville, rendez-vous en main propre, commission de quelques pour cent. Aucune vérification, mais des téléphones, des pseudonymes et des adresses Tron.
- **Réseaux de compensation** : des espèces collectées dans un pays (souvent issues du trafic de stupéfiants) sont « transformées » en USDT livrés ailleurs, sans que l'argent liquide ne traverse de frontière.
- **Courtiers OTC** : gros volumes, contrepartie unique ; certains, comme SatsDesk OTC (fictif), pratiquent une vérification faible et servent de sortie en espèces à plusieurs réseaux.
- **Mules** : particuliers recrutés pour déposer des espèces en borne, acheter des crypto-actifs avec leur compte bancaire ou prêter leur compte d'exchange, contre rémunération.`,
    },
    {
      type: 'table',
      caption: 'Les acteurs de la frontière espèces / crypto et leurs données',
      headers: ['Acteur', 'Rôle', 'Données exploitables', 'Voie'],
      rows: [
        ['Opérateur de bornes (PSAN / PSCA)', 'Achat ou vente contre espèces', 'Journal, téléphone, identité, images', 'Réquisition'],
        ['P2P d’un exchange', 'Séquestre entre particuliers', 'Identités des deux parties, conversations, preuves de paiement', 'Réquisition ou coopération selon l’établissement'],
        ['P2P non custodial (Hodl Hodl)', 'Mise en relation, séquestre multisignature', 'Annonces, échanges entre utilisateurs', 'Coopération volontaire'],
        ['Changeur sur messagerie', 'Échange en main propre', 'Téléphones, comptes de messagerie, adresses Tron, carnets de comptes', 'Exploitation des supports, enquête sous pseudonyme'],
        ['Courtier OTC (SatsDesk OTC, fictif)', 'Gros volumes, remise d’espèces', 'Contreparties, montants, adresses', 'Entraide si à l’étranger'],
        ['Mule', 'Prête son identité ou ses comptes', 'Comptes bancaires et d’exchange, téléphone, recruteur', 'Audition, réquisitions bancaires et prestataires'],
      ],
    },
    {
      type: 'compare',
      left: {
        title: 'P2P d’un exchange',
        md: `- Deux parties **vérifiées**.
- Séquestre tenu par la plateforme : chaque échange est une ligne de base de données.
- Conversations et preuves de paiement conservées.
- Une réquisition peut livrer l'ensemble des échanges d'un marchand suspect.`,
      },
      right: {
        title: 'Changeur sur messagerie',
        md: `- Aucune vérification d'identité.
- Échange en main propre, preuve uniquement dans les téléphones.
- Traces : adresses Tron récurrentes, numéros, pseudonymes, rendez-vous.
- L'exploitation des supports et l'enquête sous pseudonyme sont les voies principales.`,
      },
    },
    {
      type: 'callout',
      kind: 'warn',
      title: 'Infiltrer un groupe ou organiser une transaction',
      md: `Échanger avec un changeur, rejoindre un groupe fermé ou organiser un achat pour identifier un vendeur relève de l'**enquête sous pseudonyme** (article 230-46 du CPP, à vérifier), réservée à des enquêteurs habilités et à des infractions déterminées, sans provocation à l'infraction. Une transaction en espèces en main propre expose aussi à un **guet-apens** : elle se prépare comme une opération, jamais en improvisation.`,
    },
    { type: 'heading', text: 'Stratégie d’enquête : du dépôt d’espèces à l’auteur' },
    {
      type: 'steps',
      items: [
        { title: 'Audition ciblée', md: `Lieu, date, heure, nombre de dépôts et de bornes, montants, retraits bancaires préalables, reçus, messages et QR codes, numéros et identités de l'interlocuteur, applications installées à sa demande.` },
        { title: 'Localiser la borne', md: `Par le reçu (identifiant de terminal), le récit, la géolocalisation du téléphone de la victime, les retraits bancaires, et les annuaires publics de bornes. Identifier l'opérateur et vérifier son statut auprès de l'AMF.` },
        { title: 'Préserver les images', md: `Réquisition immédiate au commerçant ou au gestionnaire du site ; demande de conservation à l'opérateur. Noter les décalages d'horloge.` },
        { title: 'Réquisitionner l’opérateur', md: `Journal de la transaction, téléphone vérifié, identité et photo éventuelles, images de la borne, **toutes les transactions vers la même adresse** et avec le même téléphone sur une période.` },
        { title: 'Tracer l’adresse de destination', md: `Collecteur commun à plusieurs victimes ? Regroupement avec d'autres plaintes. Suite des flux : exchange (réquisition), échangeur, OTC ; gel émetteur si des USDT sont détenus en auto-hébergement.` },
        { title: 'Remonter vers les auteurs', md: `Lignes téléphoniques (y compris celle vérifiée par SMS à la borne), comptes de messagerie, mules qui déposent ou retirent ; réquisitions aux opérateurs dans le respect des conditions applicables aux données de connexion.` },
        { title: 'Agréger', md: `Une adresse de collecte relie souvent des dizaines de victimes : signaler le dossier aux structures centrales et rapprocher les procédures.` },
      ],
    },
    {
      type: 'case',
      title: 'Cas pratique — trois bornes, un collecteur',
      md: `Le 21 janvier 2026, Mme R., 78 ans, est appelée par un « conseiller » de sa banque. Guidée au téléphone pendant trois heures, elle retire 12 700 € en deux agences puis effectue trois dépôts dans deux bornes de la même ville : 4 800 € (14:12 locale), 4 900 € (15:03) et 3 000 € (15:41). Le QR code lui a été envoyé sur WhatsApp ; elle a lu à voix haute à son interlocuteur le code SMS affiché par la borne.

- **Reçus** retrouvés dans son sac : adresse bc1q…9xrk, terminaux 4471 et 4502.
- **Vidéo** du tabac (conservée 14 jours) : la victime seule, téléphone à l'oreille.
- **Opérateur** (réquisition le 22 janvier) : le numéro vérifié par SMS n'est pas celui de la victime mais une **ligne prépayée** déjà utilisée pour 9 autres transactions ; l'adresse bc1q…9xrk a reçu **46 dépôts** de bornes de trois opérateurs en trois semaines, pour 1,94 BTC.
- **Traçage** : regroupement des 46 dépôts puis envoi vers un échangeur instantané (BTC → USDT-TRC20), puis vers une adresse de dépôt d'un exchange : réquisitions en cours.

La ligne prépayée, activée avec une identité usurpée, borne régulièrement dans un même quartier : elle devient l'axe principal de l'enquête. Onze plaintes d'autres départements sont jointes grâce à l'adresse de collecte.`,
    },
    {
      type: 'case',
      title: 'Cas pratique — le changeur de quartier',
      md: `Dans un dossier de trafic de stupéfiants, l'exploitation du téléphone d'un intermédiaire révèle un canal Telegram « Cash ⇄ USDT » et des échanges avec un changeur : 37 remises d'espèces entre septembre et décembre 2025, de 8 000 à 60 000 €, contre des USDT-TRC20 livrés sur 4 adresses Tron. Le traçage montre que ces USDT proviennent d'un même portefeuille, alimenté par des retraits d'un courtier OTC offshore et par la place de marché P2P d'un exchange, sur laquelle le changeur opère comme « marchand ». La réquisition à l'exchange livre son identité, 1 140 échanges P2P et les coordonnées bancaires de ses contreparties : la cartographie d'un réseau de compensation.`,
    },
    {
      type: 'terms',
      items: [
        { term: 'DAB crypto', def: `Borne qui vend (et parfois rachète) des crypto-actifs contre des espèces ; l'envoi part du portefeuille de l'opérateur.` },
        { term: 'Reçu de borne', def: `Ticket ou message indiquant terminal, heure, montant et adresse de destination, parfois le txid.` },
        { term: 'Seuil de vérification', def: `Montant au-delà duquel l'opérateur exige téléphone, pièce d'identité ou photo ; variable selon l'opérateur et la réglementation.` },
        { term: 'P2P custodial', def: `Échange entre particuliers avec séquestre tenu par une plateforme qui vérifie les parties et conserve les échanges.` },
        { term: 'Réseau de compensation', def: `Espèces collectées à un endroit, valeur livrée ailleurs en USDT, sans transport physique d'argent.` },
        { term: 'Mule', def: `Personne qui prête son identité, ses comptes ou ses déplacements (dépôts en borne) pour faire circuler des fonds d'autrui.` },
      ],
    },
    {
      type: 'callout',
      kind: 'example',
      title: 'Messages de prévention à relayer',
      md: `- Aucune banque, aucun service de police ou de gendarmerie ne demande de retirer des espèces ni de les convertir en crypto-actifs « pour les protéger ».
- Personne de légitime ne fournit un QR code à présenter à une borne pour « sécuriser » de l'argent.
- Un interlocuteur qui exige de rester en ligne pendant un retrait ou un dépôt est un escroc.
- En cas de doute : raccrocher, rappeler sa banque au numéro habituel, parler au commerçant.`,
    },
    {
      type: 'check',
      q: `Lors de la réquisition d'un opérateur de bornes, quelle demande permet le plus souvent d'identifier d'autres victimes ?`,
      options: [
        `La liste de toutes les transactions envoyées vers la même adresse de destination, toutes bornes confondues`,
        `La marque des billets insérés`,
        `L'heure de la dernière maintenance de la borne`,
        `Le modèle de la borne`,
      ],
      answer: 0,
      explain: `Un collecteur d'escroc reçoit des dépôts de nombreuses victimes, souvent sur plusieurs bornes et plusieurs opérateurs : chaque opérateur peut lister ceux qui le concernent.`,
    },
    {
      type: 'check',
      q: `Le numéro de téléphone vérifié par SMS lors du dépôt n'est pas celui de la victime. Que faut-il en penser ?`,
      options: [
        `C'est une erreur de l'opérateur, sans intérêt`,
        `Cela prouve que la victime est complice`,
        `C'est probablement une ligne contrôlée par l'escroc, qui a fait lire le code à la victime : une piste majeure`,
        `Cela signifie que la transaction n'a pas eu lieu`,
      ],
      answer: 2,
      explain: `Les escrocs fournissent souvent leur propre ligne pour la vérification et dictent la procédure. Cette ligne, réutilisée pour d'autres dépôts, relie les affaires et mène aux auteurs.`,
    },
  ],
  keyPoints: [
    `Un DAB crypto convertit des espèces en crypto-actifs envoyés depuis le portefeuille de l'opérateur vers l'adresse du QR code présenté.`,
    `L'opérateur, PSAN puis PSCA sous MiCA, est soumis aux obligations anti-blanchiment : journal, téléphone vérifié, identité au-delà des seuils, images. Statut à vérifier auprès de l'AMF.`,
    `La vidéoprotection est conservée peu de temps : réquisition immédiate, relevé des décalages d'horloge.`,
    `Faux conseiller, faux policier, faux support, sextorsion : urgence, isolement, QR fourni, dépôts fractionnés, collecteur commun à plusieurs victimes.`,
    `Circuits cash : P2P d'exchange (données riches), P2P non custodial (données limitées), changeurs sur messageries, réseaux de compensation, OTC, mules.`,
    `Stratégie : audition ciblée, reçu et QR, localisation de la borne, vidéo, réquisition de l'opérateur (y compris transactions liées), traçage, gel, téléphonie, agrégation des plaintes.`,
    `Infiltrer un groupe ou organiser une transaction relève de l'enquête sous pseudonyme, par des enquêteurs habilités.`,
  ],
  quiz: [
    {
      q: `D'où part, sur la blockchain, la transaction déclenchée par un dépôt d'espèces dans une borne ?`,
      options: [
        `Du portefeuille de la victime`,
        `Du portefeuille (hot wallet) de l'opérateur de la borne`,
        `De la banque de la victime`,
        `Du portefeuille de l'escroc`,
      ],
      answer: 1,
      explain: `La victime n'a pas de portefeuille : l'opérateur envoie les crypto-actifs depuis le sien. Le lien entre le dépôt physique et la transaction est dans son journal.`,
    },
    {
      kind: 'multi',
      q: `Quelles données un opérateur de bornes peut-il typiquement fournir ? (plusieurs réponses)`,
      options: [
        `La clé privée de l'adresse de destination`,
        `Le journal de la transaction avec terminal, heure, montants et adresse de destination`,
        `Le numéro de téléphone vérifié par SMS`,
        `Les transactions envoyées vers la même adresse depuis ses autres bornes`,
      ],
      answer: [1, 2, 3],
      explain: `L'opérateur ne détient jamais la clé de l'adresse de destination, qui appartient à l'utilisateur (ou à l'escroc).`,
    },
    {
      kind: 'truefalse',
      q: `Les images de vidéoprotection d'un commerce hébergeant une borne peuvent être demandées sans urgence : elles sont conservées plusieurs années.`,
      options: ['Vrai', 'Faux'],
      answer: 1,
      explain: `La conservation est courte, souvent de quelques jours à un mois : la réquisition doit partir dès l'identification de la borne.`,
    },
    {
      kind: 'multi',
      q: `Quels indicateurs orientent vers une escroquerie au faux conseiller bancaire avec dépôt en borne ? (plusieurs réponses)`,
      options: [
        `Retrait d'espèces au guichet puis dépôt en borne le même jour`,
        `Achat de crypto-actifs planifié depuis des mois par la victime elle-même`,
        `Victime guidée au téléphone pendant le dépôt`,
        `QR code reçu par messagerie`,
      ],
      answer: [0, 2, 3],
      explain: `Retrait suivi d'un dépôt, guidage téléphonique et QR fourni sont caractéristiques de l'emprise exercée à distance ; un achat réfléchi et autonome n'en relève pas.`,
    },
    {
      q: `Quelle différence principale entre le P2P d'un exchange et un changeur sur messagerie, pour l'enquêteur ?`,
      options: [
        `Le P2P d'un exchange vérifie les parties et conserve échanges et preuves de paiement ; le changeur ne laisse de traces que dans les téléphones et sur la chaîne`,
        `Aucune`,
        `Le changeur est toujours régulé par l'AMF`,
        `Le P2P d'un exchange n'utilise pas de crypto-actifs`,
      ],
      answer: 0,
      explain: `La plateforme custodiale est un point de données centralisé ; l'échange en main propre exige l'exploitation des supports et des techniques d'enquête adaptées.`,
    },
    {
      q: `Un opérateur de bornes en France doit :`,
      options: [
        `N'avoir aucun statut, puisqu'il manipule des espèces`,
        `Être une banque`,
        `Être agréé par la CNIL`,
        `Disposer du statut requis (PSAN hier, agrément PSCA sous MiCA) et respecter les obligations anti-blanchiment`,
      ],
      answer: 3,
      explain: `L'achat et la vente de crypto-actifs contre monnaie légale sont des services sur crypto-actifs ; le statut se vérifie sur les listes de l'AMF à la date des faits.`,
    },
    {
      kind: 'truefalse',
      q: `Rejoindre sous une fausse identité un groupe Telegram « cash contre USDT » pour identifier un changeur peut être fait par n'importe quel enquêteur, sans cadre particulier.`,
      options: ['Vrai', 'Faux'],
      answer: 1,
      explain: `Cela relève de l'enquête sous pseudonyme, encadrée (enquêteurs habilités, infractions visées, absence de provocation) : à vérifier dans les textes en vigueur.`,
    },
  ],
  flashcards: [
    { front: 'DAB crypto', back: `Espèces → crypto-actifs envoyés depuis le hot wallet de l'opérateur vers l'adresse du QR présenté.` },
    { front: 'Statut d’un opérateur de bornes', back: `PSAN hier, PSCA sous MiCA (AMF) ; obligations anti-blanchiment. Vérifier à la date des faits.` },
    { front: 'Reçu de borne', back: `Terminal, heure, montant, adresse de destination, parfois txid : à réclamer à la victime.` },
    { front: 'Vidéoprotection', back: `Conservation courte : réquisition immédiate, relevé des décalages d'horloge.` },
    { front: 'Réquisition de l’opérateur', back: `Journal, téléphone vérifié, identité, images, transactions vers la même adresse et avec le même téléphone.` },
    { front: 'Téléphone vérifié ≠ victime', back: `Ligne souvent contrôlée par l'escroc : piste majeure, relie d'autres dépôts.` },
    { front: 'Faux conseiller bancaire', back: `Urgence, retrait au guichet, dépôt en borne guidé au téléphone, QR envoyé par messagerie.` },
    { front: 'P2P custodial', back: `Parties vérifiées, conversations et preuves de paiement conservées par la plateforme.` },
    { front: 'Changeur « cash contre USDT »', back: `Main propre, aucune vérification : traces dans les téléphones et adresses Tron récurrentes.` },
    { front: 'Réseau de compensation', back: `Espèces collectées ici, USDT livrés ailleurs, sans transport physique.` },
    { front: 'Enquête sous pseudonyme', back: `Art. 230-46 CPP (à vérifier) : enquêteurs habilités, pas de provocation à l'infraction.` },
  ],
}
