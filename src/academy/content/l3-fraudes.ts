// Niveau 3 — Typologies : address poisoning, drainers et approvals, rug pulls.
// Entités citées : FICTIVES (voir src/engine/entities.ts).
import type { Lesson } from '../model'

export const L3_FRAUDES: Lesson[] = [
  // ══════════════════════════════════════════════════════════════════════════
  // ADDRESS POISONING
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'address-poisoning',
    title: 'Address poisoning : l’adresse sosie',
    level: 3,
    track: 'typologies',
    minutes: 25,
    summary: `L'empoisonnement d'historique : l'attaquant glisse dans l'historique de la victime une adresse sosie de l'un de ses correspondants habituels et attend le copier-coller fatal. Mécanisme, techniques d'injection, signes on-chain (Ethereum et Tron), cartographie de l'infrastructure et conduite de l'enquête.`,
    objectives: [
      `Expliquer le mécanisme de l'address poisoning et ses trois techniques d'injection (valeur nulle, faux jeton, poussière).`,
      `Repérer l'adresse sosie et la transaction d'empoisonnement dans l'historique d'une victime.`,
      `Cartographier l'infrastructure de l'attaquant (financeur du gaz, contrat d'envoi, autres victimes).`,
      `Prioriser les actes : gel du stablecoin, suivi rapide des fonds, rapprochement des plaintes.`,
      `Rassurer et conseiller la victime sur l'état de son portefeuille.`,
    ],
    prerequisites: ['tokens-erc20', 'tron-usdt', 'typologies', 'exchanges'],
    practice: ['address-poisoning'],
    blocks: [
      {
        type: 'text',
        md: `Une indépendante paie chaque mois ses USDT vers son compte d'exchange. Ce mois-ci, elle a fait exactement comme d'habitude : ouvert son historique, copié l'adresse de son dernier virement, collé, envoyé. Les 38 400 USDT ne sont jamais arrivés.

Elle n'a pas été piratée. Elle n'a rien signé d'anormal. Elle a copié une adresse qui **ressemblait trait pour trait** à la bonne, glissée dans son historique quelques minutes après son paiement précédent. C'est l'**address poisoning** : une escroquerie industrielle, peu coûteuse pour l'attaquant, qui repose entièrement sur l'affichage abrégé des adresses.`,
      },
      { type: 'heading', text: 'Le mécanisme en quatre temps' },
      {
        type: 'steps',
        items: [
          { title: 'Surveillance', md: `Des robots scrutent en continu les transferts de stablecoins ou d'ETH d'un montant significatif, sur Ethereum, Tron, BNB Chain et les L2.` },
          { title: 'Génération du sosie', md: `Pour chaque destinataire repéré, l'attaquant génère une **adresse sosie** (vanity address) dont les premiers et derniers caractères sont identiques. Avec du matériel dédié, obtenir 4 à 6 caractères identiques à chaque extrémité est rapide et peu coûteux.` },
          { title: 'Injection', md: `Quelques minutes après le transfert légitime, il fait apparaître le sosie dans l'historique de la victime : transfert de valeur nulle, faux jeton ou poussière.` },
          { title: 'Attente', md: `Au paiement suivant, la victime copie l'adresse depuis son historique, choisit la mauvaise ligne et envoie les fonds à l'attaquant. Celui-ci vide immédiatement le sosie.` },
        ],
      },
      {
        type: 'flow',
        caption: `L'historique de la victime est pollué juste après un paiement légitime ; le paiement suivant part vers le sosie.`,
        nodes: [
          { id: 'v', label: 'Victime', kind: 'victim', sub: 'indépendante' },
          { id: 'leg', label: 'Dépôt Coinvault', kind: 'deposit', sub: 'TXk3m…A4gZ6r' },
          { id: 'hub', label: 'Financeur', kind: 'suspect', sub: 'TRX + USDT' },
          { id: 'sos', label: 'Adresse sosie', kind: 'suspect', sub: 'TXk3m…9hgZ6r' },
          { id: 'col', label: 'Collecteur', kind: 'wallet' },
          { id: 'ex', label: 'Dépôt Huobex', kind: 'deposit', sub: 'exchange' },
        ],
        edges: [
          { from: 'v', to: 'leg', label: 'paiements mensuels' },
          { from: 'hub', to: 'sos', label: 'TRX (énergie) + 1 USDT' },
          { from: 'sos', to: 'v', label: '0,01 USDT · poussière' },
          { from: 'v', to: 'sos', label: '38 400 USDT (copier-coller)' },
          { from: 'sos', to: 'col', label: 'vidé en 12 min' },
          { from: 'col', to: 'ex', label: '34 500 USDT' },
        ],
      },
      {
        type: 'table',
        caption: `Les trois techniques d'injection`,
        headers: ['Technique', 'Ce que voit la victime', 'Signature on-chain', 'À noter'],
        rows: [
          ['Transfert de valeur nulle', `Une ligne « envoi de 0 USDT » vers le sosie, comme si elle l'avait faite`, `\`transferFrom\` de 0 émis par l'attaquant, avec la victime comme expéditeur`, `Certains contrats acceptent un transferFrom de 0 sans approbation : la victime n'a rien signé`],
          ['Faux jeton', `Une ligne « USDT » du même montant que le vrai paiement`, `Événement Transfer émis par un contrat imitant l'USDT (nom et symbole copiés)`, `Vérifier l'adresse du contrat du jeton, pas son symbole`],
          ['Poussière', `Une petite réception (0,01 à 1 USDT) depuis le sosie`, `Vrai transfert du vrai jeton depuis le sosie`, `Le sosie doit être préalablement approvisionné en jeton et en gaz`],
        ],
      },
      {
        type: 'compare',
        left: {
          title: 'Adresse légitime',
          md: `\`0x8a3F4e1b7C92d0A5e6F3b8D1c4A7e9B2d102c91E\`

Affichage abrégé : \`0x8a3F…c91E\``,
        },
        right: {
          title: 'Adresse sosie',
          md: `\`0x8a3F9b06E4a1C7f2B5d8E3a6F0c9D2b7a771c91E\`

Affichage abrégé : \`0x8a3F…c91E\``,
        },
      },
      {
        type: 'callout',
        kind: 'warn',
        title: 'Comparez l’adresse entière',
        md: `L'œil humain se fie aux extrémités : c'est exactement ce que l'attaquant exploite. Pour votre propre travail, comparez **l'adresse complète** avec un outil (recherche de chaîne exacte, comparaison caractère par caractère). Une seule lettre différente au milieu = un autre titulaire.`,
      },
      {
        type: 'check',
        q: `L'historique d'une victime montre un « envoi de 0 USDT » vers une adresse sosie, qu'elle affirme n'avoir jamais fait. Qu'en déduisez-vous ?`,
        options: [
          `Elle ment : seule sa clé peut émettre un transfert depuis son adresse`,
          `Son portefeuille est compromis, sa clé privée a été volée`,
          `L'attaquant a probablement émis lui-même un transferFrom de 0, accepté sans approbation par le contrat`,
          `C'est un CoinJoin`,
        ],
        answer: 2,
        explain: `Un transferFrom de valeur nulle peut être accepté sans autorisation par certains contrats : l'attaquant l'émet, la victime apparaît comme expéditrice sans avoir rien signé.`,
      },
      { type: 'heading', text: 'Les signes on-chain' },
      {
        type: 'table',
        caption: `Indicateurs d'empoisonnement`,
        headers: ['Indicateur', 'Où le voir', 'Valeur probante'],
        rows: [
          ['Transaction de valeur nulle, faux jeton ou poussière peu après un paiement légitime', 'Historique de la victime, onglet transferts de jetons', 'Forte si le délai est de quelques minutes'],
          ['Préfixe et suffixe identiques à un correspondant habituel, milieu différent', 'Comparaison complète des adresses', 'Forte'],
          ['Paiements répétés vers l’adresse légitime, puis un seul vers le sosie', 'Historique de la victime', 'Forte'],
          ['Sosie vidé dans les minutes qui suivent', 'Historique du sosie', 'Moyenne à forte'],
          ['Sosie financé (gaz, poussière) par une adresse qui en finance des centaines', 'Historique du financeur', 'Forte : relie la campagne'],
          ['Contrat d’envoi par lots qui empoisonne des milliers de cibles', 'Appels de contrat, événements groupés', 'Forte : signature d’infrastructure'],
        ],
      },
      { type: 'heading', text: 'Spécificités de Tron' },
      {
        type: 'text',
        md: `Sur Tron, les adresses sont en **base58**, commencent par **T** et comptent 34 caractères (\`TXk3mPq7Rv9sWbN2cJd5hYt8LuEfA4gZ6r\`). Les portefeuilles mobiles les abrègent aussi : \`TXk3m…gZ6r\`. Le phénomène y est massif en raison du volume d'USDT-TRC20.

Points d'attention :

- tout transfert TRC-20 consomme de l'**énergie** et de la **bande passante**, obtenues en brûlant ou en gelant des TRX : le sosie doit donc être **approvisionné en TRX** avant d'envoyer sa poussière. Cet approvisionnement est la signature de l'infrastructure ;
- l'émetteur de l'USDT peut **geler** une adresse Tron : tant que les fonds sont en USDT sur le sosie ou le collecteur, la demande de gel est la priorité absolue ;
- les attaquants convertissent souvent rapidement en TRX via un DEX, ou déposent sur un exchange peu regardant.`,
      },
      { type: 'heading', text: 'Conduire l’enquête' },
      {
        type: 'steps',
        items: [
          { title: 'Figer le mode opératoire', md: `Identifiez le paiement détourné, l'adresse sosie, puis la **transaction d'empoisonnement** qui l'a précédé (type, heure, délai après le dernier paiement légitime).` },
          { title: 'Agir sur les fonds', md: `Si des stablecoins sont encore sur le sosie ou le collecteur : **demande de gel immédiate** à l'émetteur, puis suivi rapide jusqu'au premier service identifiable (exchange) pour un gel de compte.` },
          { title: 'Suivre les fonds', md: `Sosie → collecteur → exchange, DEX ou bridge. Les montants sont souvent transférés en bloc : la trace est généralement simple, mais rapide.` },
          { title: `Cartographier l'infrastructure`, md: `Remontez le **financeur** du sosie (TRX, poussière) : il a financé d'autres sosies, donc d'autres victimes. Repérez un éventuel contrat d'envoi par lots.` },
          { title: 'Rapprocher les plaintes', md: `Une même infrastructure fait des victimes dans le monde entier : signalez-la aux partenaires et aux structures spécialisées, recherchez d'autres plaintes en France.` },
          { title: 'Requérir', md: `Exchange de destination (identité, connexions, autres dépôts), et exchange qui a approvisionné le financeur s'il est identifiable.` },
        ],
      },
      { type: 'widget', id: 'amm-swap', caption: `Les fonds détournés sont souvent échangés aussitôt sur un DEX pour sortir du stablecoin gelable : lisez les jambes du swap.` },
      {
        type: 'case',
        title: 'Cas pratique — le sosie du dépôt Coinvault',
        md: `La victime a effectué cinq virements mensuels d'USDT-TRC20 vers son adresse de dépôt Coinvault \`TXk3mPq7Rv9sWbN2cJd5hYt8LuEfA4gZ6r\`. Le dernier, le 2 avril à 09:14 UTC.

- 2 avril, 07:50 UTC : un financeur \`TFv8…\` envoie 35 TRX puis 1 USDT à \`TXk3mW8aHnQe2RzVyKp4oT7cBxDs9hgZ6r\` (le sosie).
- 2 avril, 09:31 UTC (17 minutes après le virement légitime) : le sosie envoie **0,01 USDT** à la victime.
- 2 mai, 10:02 UTC : la victime envoie **38 400 USDT** au sosie.
- 2 mai, 10:14 UTC : le sosie transfère la totalité à un collecteur, qui dépose 34 500 USDT chez Huobex à 15:40 UTC. Il reste 3 900 USDT sur le collecteur.

Actes : demande de gel immédiate des 3 900 USDT auprès de l'émetteur ; demande de gel et réquisition à Huobex pour les 34 500 USDT ; analyse du financeur \`TFv8…\`, qui a approvisionné six autres sosies le même mois.`,
      },
      {
        type: 'flow',
        caption: `L'infrastructure : un financeur commun relie plusieurs campagnes et plusieurs victimes.`,
        nodes: [
          { id: 'cex', label: 'Exchange', kind: 'exchange', sub: 'retrait de TRX' },
          { id: 'hub', label: 'Financeur', kind: 'suspect', sub: 'TFv8…' },
          { id: 's1', label: 'Sosie A', kind: 'suspect', sub: 'victime en France' },
          { id: 's2', label: 'Sosie B', kind: 'suspect', sub: 'victime à l’étranger' },
          { id: 's3', label: 'Sosie C', kind: 'suspect', sub: 'aucun paiement reçu' },
          { id: 'col', label: 'Collecteur commun', kind: 'wallet' },
        ],
        edges: [
          { from: 'cex', to: 'hub', label: '60 000 TRX' },
          { from: 'hub', to: 's1', label: 'TRX + USDT' },
          { from: 'hub', to: 's2', label: 'TRX + USDT' },
          { from: 'hub', to: 's3', label: 'TRX + USDT' },
          { from: 's1', to: 'col', label: 'butin' },
          { from: 's2', to: 'col', label: 'butin' },
        ],
      },
      {
        type: 'callout',
        kind: 'field',
        title: 'Sur le terrain : l’audition de la victime',
        md: `Demandez une **capture de l'historique** de l'application telle qu'elle l'a vue au moment du paiement, le nom de l'application, la façon dont elle a obtenu l'adresse (historique, carnet d'adresses, message) et l'adresse **complète** qu'elle pensait payer. Ces éléments établissent le mode opératoire et écartent l'hypothèse d'une compromission du portefeuille.`,
      },
      {
        type: 'callout',
        kind: 'tip',
        title: 'Message à la victime',
        md: `Aucune approbation n'a été signée et la clé n'a pas fuité : son portefeuille **n'est pas compromis**. Conseils : vérifier l'adresse **complète** avant chaque envoi, utiliser le carnet d'adresses de l'application plutôt que l'historique, faire un petit envoi test pour les montants importants, et masquer les transactions de valeur nulle ou de jetons inconnus si l'application le permet.`,
      },
      {
        type: 'callout',
        kind: 'example',
        title: 'Un phénomène à grande échelle',
        md: `En mai 2024, une victime a perdu en une seule transaction environ 68 millions de dollars en WBTC après avoir copié une adresse sosie ; les fonds ont finalement été restitués après négociation publique avec l'attaquant. Les études publiées depuis montrent des millions de tentatives d'empoisonnement sur Ethereum et Tron : la rentabilité repose sur le volume, une victime sur des milliers suffit.`,
      },
      {
        type: 'check',
        q: `Comment relier plusieurs empoisonnements au même acteur ?`,
        options: [
          `Par l'heuristique des entrées communes`,
          `Par le financeur commun des sosies et le contrat d'envoi par lots`,
          `Par le destination tag`,
          `C'est impossible`,
        ],
        answer: 1,
        explain: `Les sosies d'une même campagne sont approvisionnés en gaz et en poussière par les mêmes adresses, souvent pilotées par un même contrat.`,
      },
    ],
    keyPoints: [
      `L'attaquant génère une adresse sosie d'un correspondant de la victime (mêmes premiers et derniers caractères).`,
      `Injection dans l'historique par transfert de valeur nulle, faux jeton ou poussière, quelques minutes après un paiement légitime.`,
      `La victime n'a rien signé : son portefeuille n'est pas compromis, elle a copié la mauvaise adresse.`,
      `Comparer toujours l'adresse complète, jamais les seules extrémités.`,
      `Le financeur des sosies (gaz, poussière) et le contrat d'envoi relient campagnes et victimes.`,
      `Priorité : demande de gel tant que les fonds sont en stablecoin, puis suivi rapide jusqu'à l'exchange.`,
    ],
    quiz: [
      {
        q: `Quel est le principal indice d'une adresse sosie ?`,
        options: [
          `Elle commence par 0x ou par T`,
          `Elle est vide depuis sa création`,
          `Elle appartient à un exchange`,
          `Ses premiers et derniers caractères coïncident avec un correspondant habituel, mais le milieu diffère`,
        ],
        answer: 3,
        explain: `Les attaquants génèrent des adresses dont les extrémités imitent celles du correspondant légitime, pour tromper l'affichage abrégé.`,
      },
      {
        kind: 'multi',
        q: `Quelles techniques permettent d'injecter un sosie dans l'historique d'une victime ? (plusieurs réponses)`,
        options: [
          `Un transferFrom de valeur nulle « depuis » la victime vers le sosie`,
          `Un faux jeton imitant l'USDT qui émet un Transfer du même montant`,
          `Une petite quantité de vrai jeton envoyée depuis le sosie`,
          `Une modification de l'historique stocké sur le serveur de l'exchange`,
        ],
        answer: [0, 1, 2],
        explain: `Valeur nulle, faux jeton et poussière sont les trois techniques. L'historique on-chain ne peut pas être modifié.`,
      },
      {
        kind: 'truefalse',
        q: `Après un address poisoning, il faut considérer que la clé privée de la victime est compromise et lui faire changer immédiatement de portefeuille.`,
        options: ['Vrai', 'Faux'],
        answer: 1,
        explain: `L'attaque repose sur une erreur de copier-coller, pas sur un vol de clé ni sur une approbation. Le portefeuille n'est pas compromis ; il faut surtout changer les habitudes de vérification.`,
      },
      {
        q: `Sur Tron, pourquoi le sosie est-il approvisionné en TRX avant d'envoyer sa poussière d'USDT ?`,
        options: [
          `Pour payer l'énergie et la bande passante consommées par le transfert TRC-20`,
          `Pour obtenir un destination tag`,
          `Pour s'enregistrer auprès de l'émetteur de l'USDT`,
          `Pour rendre l'adresse gelable`,
        ],
        answer: 0,
        explain: `Un transfert TRC-20 consomme des ressources obtenues avec des TRX. Cet approvisionnement trahit le financeur de la campagne.`,
      },
      {
        q: `Les fonds détournés sont encore en USDT sur l'adresse collectrice. Quel est l'acte prioritaire ?`,
        options: [
          `Attendre la réponse de l'exchange de destination`,
          `Demander immédiatement le gel de l'adresse à l'émetteur de l'USDT`,
          `Envoyer un message on-chain à l'attaquant`,
          `Clôturer la procédure faute d'identification`,
        ],
        answer: 1,
        explain: `Le gel par l'émetteur est rapide et efficace même sur un portefeuille auto-hébergé ; il faut le demander avant que les fonds ne soient convertis.`,
      },
      {
        kind: 'multi',
        q: `Quels éléments demander à la victime lors de son audition ? (plusieurs réponses)`,
        options: [
          `Une capture de l'historique de son application au moment du paiement`,
          `L'adresse complète qu'elle pensait payer et sa provenance (historique, carnet, message)`,
          `Sa phrase de récupération, pour vérifier son portefeuille`,
          `Le nom de l'application de portefeuille utilisée`,
        ],
        answer: [0, 1, 3],
        explain: `Ces éléments établissent le mode opératoire. On ne demande jamais la phrase de récupération d'une victime.`,
      },
    ],
    flashcards: [
      { front: 'Address poisoning', back: `Injection d'une adresse sosie dans l'historique de la victime pour provoquer un copier-coller erroné.` },
      { front: 'Adresse sosie (vanity)', back: `Adresse dont les premiers et derniers caractères imitent ceux d'un correspondant légitime.` },
      { front: 'Trois techniques d’injection', back: `Transfert de valeur nulle, faux jeton, poussière du vrai jeton.` },
      { front: 'Transfert de 0 « depuis » la victime', back: `transferFrom de valeur nulle émis par l'attaquant, accepté sans approbation par certains contrats.` },
      { front: 'Faux jeton', back: `Contrat qui copie nom et symbole de l'USDT : vérifier l'adresse du contrat, pas le symbole.` },
      { front: 'Portefeuille de la victime compromis ?', back: `Non en général : aucune signature d'approbation, aucune fuite de clé.` },
      { front: 'Ce qui relie les campagnes', back: `Le financeur commun des sosies (gaz, poussière) et le contrat d'envoi par lots.` },
      { front: 'Adresse Tron', back: `Base58, commence par T, 34 caractères.` },
      { front: 'Priorité opérationnelle', back: `Gel par l'émetteur tant que les fonds sont en stablecoin, puis gel au premier exchange.` },
      { front: 'Conseil de prévention', back: `Vérifier l'adresse complète, utiliser le carnet d'adresses, envoi test pour les gros montants.` },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // DRAINERS ET APPROVALS
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'drainers-approvals',
    title: 'Phishing, drainers et approvals',
    level: 3,
    track: 'typologies',
    minutes: 30,
    summary: `Signer n'est pas envoyer… sauf quand la signature autorise quelqu'un d'autre à prendre vos jetons. Approvals, signatures hors chaîne (permit), autorisations sur les NFT, kits de drainers vendus « as a service », lecture d'un vol sur la chaîne, et conduite de l'enquête.`,
    objectives: [
      `Expliquer les mécanismes d'autorisation : approve, allowance, transferFrom, setApprovalForAll, permit.`,
      `Distinguer une transaction signée on-chain d'une signature hors chaîne, et savoir où chercher chacune.`,
      `Décrire l'économie d'un drainer « as a service » (opérateur, affiliés, partage du butin).`,
      `Analyser un vol : retrouver l'autorisation, le bénéficiaire (spender), l'exécutant et le partage.`,
      `Conseiller la victime (révocation, migration) et préserver les preuves.`,
    ],
    prerequisites: ['tokens-erc20', 'comptes-evm', 'dex-defi', 'typologies'],
    practice: ['dex-swap'],
    blocks: [
      {
        type: 'text',
        md: `Un collectionneur reçoit un lien vers un « airdrop » d'un projet qu'il suit. Le site est parfait : logo, design, compte à rebours. Il connecte son portefeuille, clique sur **Claim** et valide la fenêtre de son portefeuille. Trente secondes plus tard, ses ETH, ses USDC et ses NFT ont disparu.

Il n'a jamais donné sa phrase de récupération. Il a **signé** quelque chose. Comprendre ce qu'il a signé, c'est comprendre où chercher sur la chaîne.`,
      },
      { type: 'heading', text: 'Signer une autorisation' },
      {
        type: 'terms',
        items: [
          { term: 'approve(spender, montant)', def: `Fonction ERC-20 par laquelle le titulaire autorise une adresse (le spender) à prélever jusqu'à un montant de ses jetons. C'est une transaction on-chain.` },
          { term: 'Allowance', def: `Montant restant autorisé pour un spender. Une autorisation « illimitée » vaut la valeur maximale possible (2^256 − 1).` },
          { term: 'transferFrom(from, to, montant)', def: `Prélèvement effectué par le spender en vertu d'une allowance. C'est le spender qui signe cette transaction, pas la victime.` },
          { term: 'setApprovalForAll', def: `Autorisation donnée à un opérateur de transférer tous les NFT d'une collection (ERC-721 / ERC-1155).` },
          { term: 'Permit (EIP-2612)', def: `Autorisation donnée par une **signature hors chaîne** ; n'importe qui peut ensuite la soumettre on-chain. Aucune transaction d'approbation de la victime n'apparaît.` },
          { term: 'Permit2', def: `Contrat d'autorisation partagé utilisé par de nombreuses applications : une approbation initiale, puis des autorisations par signature hors chaîne.` },
          { term: 'Signature aveugle', def: `Signature d'un message dont le portefeuille n'affiche pas le contenu en clair : la victime ne sait pas ce qu'elle autorise.` },
        ],
      },
      {
        type: 'compare',
        left: {
          title: 'Transaction signée (on-chain)',
          md: `- La victime paie le gaz.
- Elle apparaît dans son historique : \`approve\`, \`setApprovalForAll\`, ou un appel « Claim » qui envoie des ETH.
- Horodatage et bénéficiaire lisibles dans l'explorateur.`,
        },
        right: {
          title: 'Signature hors chaîne (permit, ordres)',
          md: `- Gratuite, aucune transaction pour la victime.
- L'autorisation n'apparaît **qu'au moment de l'exécution**, dans une transaction signée par l'attaquant.
- Il faut lire les événements \`Approval\` et \`Transfer\` de cette transaction.`,
        },
      },
      {
        type: 'callout',
        kind: 'tip',
        title: 'Et les ETH natifs ?',
        md: `L'ETH natif ne se prête pas à une approbation : pour le prendre, le drainer doit amener la victime à signer une **transaction qui l'envoie** (un faux « Claim » payant, une fausse « vérification »). Dans l'historique, c'est un appel de contrat avec une valeur en ETH. Les jetons, eux, partent par approbation ou par signature.`,
      },
      { type: 'heading', text: 'Le drainer : un kit industriel' },
      {
        type: 'text',
        md: `Un **drainer** est un logiciel qui, une fois le portefeuille connecté, inventorie les actifs de la victime et lui présente, dans l'ordre le plus rentable, les demandes de signature qui permettront de tout prendre.

Il est souvent vendu ou loué **« as a service »** :

- un **opérateur** développe le kit, maintient les contrats et le tableau de bord ;
- des **affiliés** montent les faux sites et apportent le trafic (comptes de réseaux sociaux piratés, publicités sponsorisées, serveurs de discussion, faux supports) ;
- le butin est **partagé automatiquement** par un contrat ou par l'opérateur, une part pour l'affilié et une commission pour l'opérateur (de l'ordre de 20 % pour plusieurs kits documentés publiquement).

Pour l'enquêteur, ce partage est une aubaine : comme pour un rançongiciel, l'adresse de l'**opérateur** reçoit la commission de **milliers de victimes** et relie les affaires entre elles.`,
      },
      {
        type: 'flow',
        caption: `Schéma type d'un drain : signature, prélèvement par le contrat du drainer, partage, puis conversion et sortie.`,
        nodes: [
          { id: 'v', label: 'Victime', kind: 'victim', sub: 'portefeuille connecté' },
          { id: 'site', label: 'Faux site « Claim »', kind: 'service', sub: 'affilié' },
          { id: 'dr', label: 'Contrat drainer', kind: 'contract', sub: 'spender' },
          { id: 'aff', label: 'Affilié', kind: 'suspect', sub: '80 %' },
          { id: 'op', label: 'Opérateur du kit', kind: 'suspect', sub: '20 % de milliers de vols' },
          { id: 'dex', label: 'OmniSwap', kind: 'dex', sub: 'ETH → USDT' },
          { id: 'ex', label: 'Dépôt exchange', kind: 'deposit' },
        ],
        edges: [
          { from: 'site', to: 'v', label: 'demande de signature' },
          { from: 'v', to: 'dr', label: 'approve / permit / ETH' },
          { from: 'dr', to: 'aff', label: 'part affilié' },
          { from: 'dr', to: 'op', label: 'commission' },
          { from: 'aff', to: 'dex', label: 'swap' },
          { from: 'dex', to: 'ex', label: 'USDT' },
        ],
      },
      {
        type: 'table',
        caption: `Vecteurs d'hameçonnage fréquents`,
        headers: ['Vecteur', 'Mise en scène', 'Pistes'],
        rows: [
          ['Faux airdrop / faux claim', 'Récompense gratuite à réclamer avant expiration', 'Nom de domaine, hébergeur, certificat, date de création'],
          ['Faux mint de NFT', 'Lancement « exclusif » avec places limitées', 'Annonces, comptes promoteurs'],
          ['Compte officiel piraté', 'Lien publié depuis le vrai compte d’un projet ou d’une personnalité', 'Plateforme du réseau social (journaux de connexion)'],
          ['Publicité sponsorisée', 'Résultat de recherche imitant un site connu', 'Régie publicitaire, annonceur'],
          ['Faux support', 'Un « modérateur » propose d’aider à résoudre un problème', 'Pseudonymes, serveurs de discussion'],
          ['Faux outil de « vérification »', 'Valider son portefeuille pour débloquer un service', 'Domaine, scripts du site'],
        ],
      },
      {
        type: 'check',
        q: `La victime affirme n'avoir signé aucune transaction, et son historique ne montre aucun approve. Pourtant, ses USDC ont été prélevés par transferFrom. Hypothèse la plus probable ?`,
        options: [
          `Un bug du contrat USDC`,
          `Une signature hors chaîne de type permit, soumise ensuite par l'attaquant`,
          `Un address poisoning`,
          `Une erreur de l'explorateur`,
        ],
        answer: 1,
        explain: `Avec un permit, la victime signe un message gratuit, sans transaction. L'approbation apparaît dans la transaction de l'attaquant, juste avant le transferFrom.`,
      },
      { type: 'heading', text: 'Lire le vol sur la chaîne' },
      {
        type: 'table',
        caption: 'Signature on-chain selon la méthode de drain',
        headers: ['Méthode', 'Transaction signée par la victime ?', 'Ce que l’on voit', 'Qui envoie la transaction de prélèvement'],
        rows: [
          ['approve + transferFrom', 'Oui (approve)', 'approve vers le spender, puis transferFrom quelques secondes ou jours plus tard', 'Le spender ou un exécutant de l’attaquant'],
          ['permit', 'Non', 'Approval et Transfer dans une même transaction', 'L’attaquant, qui paie le gaz'],
          ['setApprovalForAll (NFT)', 'Oui', 'Autorisation sur la collection, puis transferts de NFT', 'L’opérateur autorisé'],
          ['Ordre de vente signé (place de marché NFT)', 'Non', 'Vente des NFT à prix nul ou dérisoire', 'L’attaquant, qui exécute l’ordre'],
          ['Faux « Claim » payant', 'Oui', 'Appel de contrat avec valeur en ETH', 'La victime elle-même'],
        ],
      },
      {
        type: 'steps',
        items: [
          { title: 'Lister les pertes', md: `Pour chaque actif perdu : transaction de sortie, heure UTC, montant, jeton (adresse du contrat).` },
          { title: `Retrouver l'autorisation`, md: `Transaction \`approve\` / \`setApprovalForAll\` signée par la victime, ou événement \`Approval\` dans la transaction de prélèvement (permit). Notez le **spender**.` },
          { title: `Identifier l'exécutant`, md: `Qui a envoyé la transaction de prélèvement (champ « From » de la transaction) ? Souvent une adresse d'exécution qui sert à de nombreux vols.` },
          { title: 'Décrire le partage', md: `Le contrat ou l'exécutant répartit-il le butin entre deux adresses selon une proportion fixe ? Identifiez la part de l'opérateur.` },
          { title: 'Suivre chaque part', md: `Swaps sur DEX (pour sortir des jetons gelables), bridges, pools de confidentialité, dépôts sur exchanges.` },
          { title: 'Élargir', md: `Autres victimes du même spender, du même exécutant, de la même adresse opérateur : rapprochements de plaintes.` },
        ],
      },
      {
        type: 'case',
        title: 'Cas pratique — le faux airdrop « Claim »',
        md: `Le 18 juin à 19:42:11 UTC, la victime appelle la fonction \`Claim\` d'un contrat non vérifié, avec **4,2 ETH** de valeur : c'est le faux claim payant. À 19:42:35, une transaction signée par une adresse d'exécution \`0x91c4…\` soumet un **permit** sur ses 12 800 USDC puis un \`transferFrom\` vers le contrat drainer.

Le contrat répartit chaque entrée : **80 %** vers \`0x3ab0…\` (affilié), **20 %** vers \`0xe77d…\` (opérateur). L'adresse opérateur a reçu des fonds de 2 300 adresses distinctes en six semaines.

L'affilié échange les ETH contre de l'USDT sur OmniSwap à 20:05, puis dépose 23 900 USDT sur un exchange à 21:30. Actes : gel et réquisition de l'exchange, signalement de l'adresse opérateur aux partenaires, recherche d'autres plaintes liées au même contrat.`,
      },
      { type: 'widget', id: 'amm-swap', caption: `Le drainer convertit les jetons volés sur un DEX : routeur, pool, jeton entrant et jeton sortant.` },
      {
        type: 'callout',
        kind: 'tip',
        title: 'Le piège du permit',
        md: `Avec un permit, cherchez l'événement \`Approval\` **dans la transaction de prélèvement**, pas dans l'historique de transactions de la victime. Sur un explorateur, ouvrez les **logs** de la transaction : vous y verrez l'autorisation (propriétaire = victime, spender = drainer) immédiatement suivie du \`Transfer\`.`,
      },
      { type: 'heading', text: 'Remédiation et preuve' },
      {
        type: 'compare',
        left: {
          title: 'Hameçonnage de phrase de récupération',
          md: `- La victime a saisi sa seed sur un faux site ou l'a donnée à un faux support.
- L'attaquant contrôle **tout** le portefeuille, sur toutes les chaînes.
- Sorties signées par la clé de la victime, souvent tout d'un coup.
- Remède : abandonner le portefeuille, en créer un neuf.`,
        },
        right: {
          title: `Hameçonnage d'autorisation (drainer)`,
          md: `- La victime a signé une autorisation précise.
- L'attaquant ne peut prendre que ce qui est autorisé… y compris des fonds reçus **plus tard**.
- Prélèvements par transferFrom signés par l'attaquant.
- Remède : **révoquer** les autorisations, puis migrer par précaution.`,
        },
      },
      {
        type: 'callout',
        kind: 'warn',
        title: 'Une autorisation ne s’éteint pas toute seule',
        md: `Tant qu'une autorisation illimitée n'est pas révoquée, tout nouveau dépôt du jeton concerné sur le portefeuille de la victime peut être prélevé. Faites révoquer les autorisations (approve à 0, retrait de setApprovalForAll) avec un outil de consultation des autorisations, depuis un appareil sain, et documentez l'état des autorisations **avant** révocation (capture horodatée).`,
      },
      {
        type: 'callout',
        kind: 'field',
        title: 'Sur le terrain : questions à poser',
        md: `- Quel lien, reçu comment et quand ? (copie du message, URL exacte)
- Quel portefeuille (extension, mobile, matériel) et quelle fenêtre de signature a été affichée ? (capture si possible)
- La phrase de récupération a-t-elle été saisie quelque part ?
- D'autres fonds sont-ils encore sur le portefeuille ?

Préservez l'URL et le contenu du faux site sans le visiter depuis un poste ordinaire (voir la leçon OPSEC) : nom de domaine, date d'enregistrement, hébergeur, scripts.`,
      },
      {
        type: 'callout',
        kind: 'law',
        title: 'Qualification',
        md: `Le recours à un faux site et à des manœuvres destinées à obtenir une signature relève typiquement de l'**escroquerie** (article 313-1 du code pénal), le cas échéant en bande organisée, avec des infractions connexes possibles (atteintes aux systèmes de traitement automatisé de données, association de malfaiteurs, blanchiment pour les intermédiaires). La qualification retenue appartient au parquet : décrivez précisément le mécanisme technique.`,
      },
      {
        type: 'check',
        q: `Pourquoi l'adresse « opérateur » qui reçoit 20 % de chaque vol est-elle prioritaire ?`,
        options: [
          `Elle appartient à la victime`,
          `Elle est automatiquement gelée`,
          `Elle ne reçoit que des NFT`,
          `Elle reçoit la commission de très nombreuses victimes et relie les affaires entre elles`,
        ],
        answer: 3,
        explain: `Comme dans le modèle RaaS, la commission de l'opérateur crée un point de convergence entre des milliers de vols commis par différents affiliés.`,
      },
    ],
    keyPoints: [
      `Approve / setApprovalForAll autorisent un tiers (spender) à prélever les actifs ; le prélèvement par transferFrom est signé par le tiers.`,
      `Un permit est une signature hors chaîne : l'autorisation n'apparaît que dans la transaction de prélèvement de l'attaquant.`,
      `L'ETH natif ne s'approuve pas : il part par une transaction signée par la victime (faux claim payant).`,
      `Les drainers sont vendus « as a service » : affiliés et opérateur se partagent le butin, souvent automatiquement.`,
      `L'adresse de l'opérateur relie les vols de milliers de victimes.`,
      `Une autorisation illimitée reste active : faire révoquer, après avoir documenté l'état des autorisations.`,
      `Distinguer hameçonnage de seed (tout le portefeuille compromis) et hameçonnage d'autorisation (actifs autorisés).`,
    ],
    quiz: [
      {
        q: `Dans un vol par approve + transferFrom, qui signe la transaction de prélèvement ?`,
        options: [
          `La victime`,
          `L'émetteur du jeton`,
          `Le spender autorisé (ou un exécutant de l'attaquant)`,
          `Le validateur du bloc`,
        ],
        answer: 2,
        explain: `La victime a signé l'approve ; le transferFrom est ensuite signé par le bénéficiaire de l'autorisation.`,
      },
      {
        kind: 'truefalse',
        q: `Avec une signature de type permit, une transaction « approve » de la victime apparaît toujours dans son historique.`,
        options: ['Vrai', 'Faux'],
        answer: 1,
        explain: `Le permit est signé hors chaîne, gratuitement. L'autorisation n'apparaît que dans la transaction de l'attaquant qui la soumet.`,
      },
      {
        kind: 'multi',
        q: `Quels éléments caractérisent un drainer « as a service » ? (plusieurs réponses)`,
        options: [
          `Un opérateur qui fournit le kit et les contrats`,
          `Des affiliés qui créent les faux sites et apportent les victimes`,
          `Un partage du butin entre affilié et opérateur`,
          `Un KYC des affiliés par une autorité de régulation`,
        ],
        answer: [0, 1, 2],
        explain: `Opérateur, affiliés et partage automatique caractérisent le modèle. Il n'y a évidemment aucun KYC régulé.`,
      },
      {
        q: `Comment un drainer prend-il les ETH natifs d'une victime ?`,
        options: [
          `Par un approve sur l'ETH`,
          `En amenant la victime à signer une transaction qui envoie elle-même ses ETH (faux claim payant)`,
          `Par un transferFrom sur l'ETH`,
          `Par un permit sur l'ETH`,
        ],
        answer: 1,
        explain: `L'ETH natif n'est pas un jeton ERC-20 : pas d'approve possible. Le drainer fait signer une transaction qui l'envoie.`,
      },
      {
        q: `Une victime de drainer a révoqué ses autorisations. Pourquoi lui conseiller quand même de migrer vers un portefeuille neuf ?`,
        options: [
          `Parce que la révocation est illégale`,
          `Parce que l'adresse est désormais gelée`,
          `Parce que les explorateurs vont supprimer l'historique`,
          `Par précaution : d'autres signatures ou autorisations inconnues ont pu être données, et la seed a peut-être aussi été saisie`,
        ],
        answer: 3,
        explain: `On ne sait pas toujours tout ce qui a été signé ; un portefeuille neuf, créé sur un appareil sain, élimine le risque résiduel.`,
      },
      {
        kind: 'multi',
        q: `Dans quelle(s) situation(s) l'attaquant contrôle-t-il tout le portefeuille de la victime, sur toutes les chaînes ? (plusieurs réponses)`,
        options: [
          `La victime a saisi sa phrase de récupération sur un faux site`,
          `La victime a donné sa phrase de récupération à un faux support`,
          `La victime a signé un approve illimité sur ses USDC`,
          `La victime a signé un setApprovalForAll sur une collection de NFT`,
        ],
        answer: [0, 1],
        explain: `Seule la fuite de la seed donne le contrôle total. Une autorisation ne porte que sur le jeton ou la collection concernés.`,
      },
      {
        q: `Dans une transaction de prélèvement par permit, où lire l'autorisation ?`,
        options: [
          `Dans les logs de la transaction : événement Approval suivi du Transfer`,
          `Dans le mempool`,
          `Dans l'historique des transactions sortantes de la victime`,
          `Nulle part : elle est invisible`,
        ],
        answer: 0,
        explain: `La soumission du permit émet un événement Approval (propriétaire = victime, spender = drainer) dans la même transaction que le transferFrom.`,
      },
    ],
    flashcards: [
      { front: 'approve(spender, montant)', back: `Autorise un tiers à prélever des jetons ERC-20 du titulaire, jusqu'au montant fixé.` },
      { front: 'transferFrom', back: `Prélèvement exécuté par le spender en vertu d'une allowance ; signé par le spender.` },
      { front: 'Autorisation illimitée', back: `Allowance à la valeur maximale (2^256 − 1) : reste active jusqu'à révocation.` },
      { front: 'setApprovalForAll', back: `Autorise un opérateur à transférer tous les NFT d'une collection.` },
      { front: 'Permit (EIP-2612)', back: `Autorisation par signature hors chaîne ; visible seulement dans la transaction de l'attaquant.` },
      { front: 'ETH natif et drainer', back: `Pas d'approve possible : la victime signe une transaction qui envoie ses ETH (faux claim).` },
      { front: 'Drainer as a service', back: `Opérateur (kit, contrats) + affiliés (faux sites) ; butin partagé, souvent automatiquement.` },
      { front: 'Adresse opérateur du drainer', back: `Reçoit la commission de milliers de vols : point de convergence entre affaires.` },
      { front: 'Seed volée vs autorisation signée', back: `Seed : tout le portefeuille compromis. Autorisation : seuls les actifs autorisés, mais y compris les dépôts futurs.` },
      { front: 'Avant de révoquer', back: `Documenter l'état des autorisations (capture horodatée), depuis un appareil sain.` },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // RUG PULLS
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'rug-pulls',
    title: 'Rug pulls et fraudes aux jetons',
    level: 3,
    track: 'typologies',
    minutes: 30,
    summary: `Un jeton lancé, une communauté enthousiaste, un pool de liquidité… puis le développeur part avec la caisse. Typologie des rug pulls (retrait de liquidité, honeypot, mint caché, prévente vidée), lecture du contrat, mesure du préjudice et remontée vers les auteurs par le financement du gaz.`,
    objectives: [
      `Décrire le cycle de vie d'un jeton (déploiement, prévente, pool de liquidité, échanges) et ses points de fraude.`,
      `Distinguer hard rug, soft rug, honeypot, mint caché et prévente vidée.`,
      `Repérer dans un contrat les fonctions à risque (mint, blacklist, taxes modifiables, retrait de liquidité).`,
      `Mesurer le préjudice à partir des contributions on-chain des investisseurs.`,
      `Remonter aux auteurs : financement du déployeur, réutilisation d'adresses, OSINT.`,
    ],
    prerequisites: ['dex-defi', 'tokens-erc20', 'typologies', 'bridges'],
    practice: ['rugpull-bsc'],
    blocks: [
      {
        type: 'text',
        md: `N'importe qui peut créer un jeton en quelques minutes : un contrat ERC-20 (ou BEP-20 sur BNB Chain), un nom accrocheur, un site, une chaîne Telegram. Pour qu'il s'échange, le créateur dépose une **liquidité** dans un pool de DEX (son jeton + du BNB, de l'ETH ou de l'USDT). Les acheteurs apportent ensuite leurs BNB… qui s'accumulent dans le pool.

Le **rug pull** (« tirer le tapis ») consiste à récupérer cette valeur et à disparaître. La blockchain enregistre tout : le déploiement, la prévente, chaque achat, le retrait. C'est l'une des typologies où l'analyse on-chain permet le mieux de **chiffrer le préjudice** et d'identifier chaque victime.`,
      },
      { type: 'heading', text: 'Le cycle de vie d’un jeton' },
      {
        type: 'terms',
        items: [
          { term: 'Déployeur', def: `Adresse qui a créé le contrat du jeton. Elle doit avoir été approvisionnée en gaz : point de départ de l'enquête.` },
          { term: 'Owner', def: `Adresse qui détient les droits d'administration du contrat (modifier les taxes, minter, blacklister…).` },
          { term: 'Prévente (presale)', def: `Vente du jeton avant son lancement : les investisseurs envoient des BNB/USDT à un contrat de prévente.` },
          { term: 'Pool de liquidité', def: `Réserve « jeton + actif de valeur » sur un DEX AMM, qui permet d'acheter et de vendre.` },
          { term: 'Jetons LP', def: `Jetons remis à qui fournit la liquidité ; les détruire (removeLiquidity) restitue la part du pool.` },
          { term: 'Verrou de liquidité', def: `Contrat qui bloque les jetons LP jusqu'à une date : un gage (relatif) de sérieux.` },
          { term: 'Renonciation (renounceOwnership)', def: `Abandon des droits d'owner. Rassure… sauf si des privilèges ont été cachés ailleurs.` },
          { term: 'Honeypot', def: `Jeton qu'on peut acheter mais pas revendre (ou avec une taxe de vente confiscatoire).` },
        ],
      },
      {
        type: 'table',
        caption: 'Typologie des fraudes aux jetons',
        headers: ['Type', 'Mécanisme', 'Signature on-chain', 'Indice d’intention'],
        rows: [
          ['Hard rug (retrait de liquidité)', 'Le créateur retire toute la liquidité du pool', '`removeLiquidity` par l’adresse qui détient les LP ; prix du jeton effondré', 'Fort : retrait brutal juste après les achats'],
          ['Soft rug (dump)', 'L’équipe vend massivement ses jetons', 'Ventes répétées depuis les portefeuilles de l’équipe', 'Variable : à confronter aux promesses'],
          ['Honeypot', 'Vente impossible ou taxée à 100 % pour les acheteurs', 'Achats nombreux, aucune vente réussie hors portefeuilles autorisés', 'Très fort : codé dès le départ'],
          ['Mint caché', 'Fonction qui crée des jetons à volonté', 'Création massive de jetons puis vente dans le pool', 'Très fort'],
          ['Prévente vidée', 'Le contrat de prévente est vidé avant ou au lancement', 'Retrait des BNB/USDT de la prévente vers des portefeuilles de l’équipe', 'Fort'],
          ['Pump and dump', 'Hausse orchestrée puis vente coordonnée', 'Achats initiaux concentrés, ventes au sommet', 'Variable'],
        ],
      },
      {
        type: 'flow',
        caption: `Hard rug : les investisseurs remplissent le pool, le créateur détient les jetons LP et retire tout.`,
        nodes: [
          { id: 'cex', label: 'Exchange', kind: 'exchange', sub: 'retrait de gaz' },
          { id: 'dep', label: 'Déployeur', kind: 'suspect', sub: '0x5d02…' },
          { id: 'tok', label: 'Contrat $ZPHR', kind: 'contract' },
          { id: 'pool', label: 'Pool ZPHR/BNB', kind: 'dex', sub: 'SyrupSwap' },
          { id: 'inv', label: 'Investisseurs', kind: 'victim', sub: '640 adresses' },
          { id: 'w', label: 'Portefeuilles relais', kind: 'wallet' },
        ],
        edges: [
          { from: 'cex', to: 'dep', label: '0,3 BNB (gaz)' },
          { from: 'dep', to: 'tok', label: 'déploie' },
          { from: 'dep', to: 'pool', label: 'addLiquidity' },
          { from: 'inv', to: 'pool', label: 'achats (BNB)' },
          { from: 'pool', to: 'dep', label: 'removeLiquidity' },
          { from: 'dep', to: 'w', label: 'dispersion' },
        ],
      },
      { type: 'widget', id: 'amm-swap', caption: `Observez l'effet d'un retrait de liquidité sur un pool AMM : le prix s'effondre, les détenteurs ne peuvent plus revendre.` },
      {
        type: 'check',
        q: `Des centaines d'adresses ont acheté un jeton, mais aucune n'a jamais réussi à le revendre ; seules deux adresses liées au créateur ont vendu. Typologie ?`,
        options: ['Soft rug', 'Honeypot', 'Address poisoning', 'Pump and dump classique'],
        answer: 1,
        explain: `Un jeton qu'on peut acheter mais pas revendre (sauf adresses autorisées) est un honeypot : la fraude est codée dans le contrat dès l'origine.`,
      },
      { type: 'heading', text: 'Lire le contrat' },
      {
        type: 'table',
        caption: `Fonctions et indices à rechercher dans un contrat de jeton`,
        headers: ['Élément', 'Risque', 'Où regarder'],
        rows: [
          ['Fonction `mint` accessible à l’owner', 'Création illimitée de jetons', 'Code vérifié, onglet « Write Contract »'],
          ['Taxes d’achat/vente modifiables', 'Taxe de vente portée à 100 % après le lancement', 'Fonctions de type setFee / setTax, événements correspondants'],
          ['Liste noire / liste blanche', 'Blocage des ventes pour tous sauf l’équipe', 'Fonctions blacklist, mappings d’exclusion'],
          ['Owner non renoncé ou proxy modifiable', 'Le comportement du contrat peut changer', 'Champ owner, contrat proxy et son administrateur'],
          ['Jetons LP non verrouillés', 'Retrait de liquidité possible à tout moment', 'Détenteurs des jetons LP du pool'],
          ['Concentration des détenteurs', 'Quelques portefeuilles peuvent écraser le prix', 'Onglet « Holders » du jeton'],
          ['Code non vérifié', 'Impossible à auditer publiquement', 'Absence de code source sur l’explorateur'],
        ],
      },
      {
        type: 'callout',
        kind: 'tip',
        title: 'Le code est une preuve d’intention',
        md: `Une fonction qui bloque les ventes, une taxe modifiable à 100 % ou un mint caché, présents **dès le déploiement**, sont des éléments forts pour établir l'intention frauduleuse. Conservez le code source vérifié (copie et empreinte), l'adresse du contrat, la transaction de déploiement et les appels aux fonctions sensibles avec leur horodatage.`,
      },
      { type: 'heading', text: 'Mesurer le préjudice' },
      {
        type: 'steps',
        items: [
          { title: 'Délimiter la période', md: `Du déploiement au retrait (ou à la dernière vente de l'équipe). Notez les blocs de début et de fin.` },
          { title: 'Lister les contributions', md: `Transferts vers le contrat de prévente, achats dans le pool (swaps entrants de BNB/USDT). Une ligne par adresse investisseuse.` },
          { title: 'Déduire les sorties', md: `Ventes réussies et remboursements éventuels : le préjudice est le **solde net** de chaque investisseur.` },
          { title: 'Valoriser', md: `Contre-valeur en euros à la date de chaque contribution (source du cours indiquée).` },
          { title: 'Isoler l’équipe', md: `Écartez les adresses de l'équipe et leurs prête-noms (financées par le déployeur, achats dans le premier bloc, ventes coordonnées).` },
          { title: 'Suivre la sortie', md: `BNB/USDT retirés : dispersion, bridge, exchanges. Calculez ce qui reste saisissable ou gelable.` },
        ],
      },
      {
        type: 'case',
        title: 'Cas pratique — la prévente Zephyrion ($ZPHR)',
        md: `Le contrat de prévente de $ZPHR, sur BNB Chain, reçoit en neuf jours **412 BNB** et **186 000 USDT** de 640 adresses. Le jour du lancement, à 16:00 UTC, le pool ZPHR/BNB est créé avec seulement 40 BNB.

À 16:47 UTC, l'adresse \`0x5d02…\` (owner) appelle \`withdrawAll\` sur la prévente : 372 BNB et 186 000 USDT partent vers quatre portefeuilles. À 17:05, retrait de la liquidité du pool. Puis :

- 180 BNB bridgés vers Ethereum via ArcBridge (nonce 63 118), convertis en ETH à l'arrivée ;
- 186 000 USDT déposés en trois fois chez Kaizen ;
- 220 BNB restants dormants sur deux portefeuilles.

Préjudice lié à la prévente : 412 BNB + 186 000 USDT bruts ; net, après déduction des remboursements obtenus par 31 investisseurs qui ont réclamé avant le lancement : 398 BNB + 186 000 USDT. Les achats dans le pool après le lancement s'y ajoutent, calculés de la même façon. Actes : demande de gel de l'USDT déposé chez Kaizen et réquisition, surveillance des portefeuilles dormants, poursuite côté Ethereum.`,
      },
      {
        type: 'compare',
        left: {
          title: 'Projet raté',
          md: `- Liquidité verrouillée, retirée à l'échéance ou jamais.
- Équipe qui communique, rembourse, publie des comptes.
- Pas de fonction cachée dans le code.
- Ventes de l'équipe progressives et annoncées.`,
        },
        right: {
          title: 'Escroquerie',
          md: `- Retrait brutal juste après l'afflux d'acheteurs.
- Fonctions de blocage ou de mint présentes dès le déploiement.
- Comptes sociaux supprimés dans l'heure.
- Fonds dispersés, bridgés, envoyés vers des exchanges.`,
        },
      },
      { type: 'heading', text: 'Remonter aux auteurs' },
      {
        type: 'text',
        md: `Un contrat ne se déploie pas gratuitement : le déployeur doit recevoir du gaz. **D'où vient ce premier BNB ou ETH ?** C'est souvent la meilleure piste.

- **Retrait d'exchange** vers le déployeur : réquisition de l'exchange, identité du titulaire du compte.
- **Réutilisation** : le même déployeur, ou son financeur, a lancé d'autres jetons, parfois d'autres rug pulls. Cherchez les autres contrats créés par l'adresse.
- **Prête-noms** : les portefeuilles qui achètent dans le tout premier bloc (« snipers » de l'équipe) sont souvent financés par la même source.
- **OSINT** : site, nom de domaine, comptes de réseaux sociaux, chaîne de discussion, « audits » et badges « KYC » délivrés par des plateformes de lancement, qui peuvent détenir des documents d'identité.
- **Sortie** : les exchanges de destination, comme toujours.`,
      },
      {
        type: 'flow',
        caption: `Le financement du gaz relie le déployeur à un compte d'exchange et à d'autres lancements.`,
        nodes: [
          { id: 'cex', label: 'Hot wallet Binova', kind: 'hot', sub: 'retrait client' },
          { id: 'fund', label: 'Financeur', kind: 'suspect' },
          { id: 'd1', label: 'Déployeur $ZPHR', kind: 'suspect' },
          { id: 'd2', label: 'Déployeur d’un jeton antérieur', kind: 'suspect', sub: 'rug il y a 4 mois' },
          { id: 'sn', label: 'Snipers du 1er bloc', kind: 'wallet', sub: '5 adresses' },
        ],
        edges: [
          { from: 'cex', to: 'fund', label: '2 BNB' },
          { from: 'fund', to: 'd1', label: 'gaz' },
          { from: 'fund', to: 'd2', label: 'gaz' },
          { from: 'fund', to: 'sn', label: 'gaz + BNB d’achat' },
        ],
      },
      {
        type: 'callout',
        kind: 'field',
        title: 'Sur le terrain',
        md: `Les victimes de rug pull sont nombreuses, dispersées et souvent à l'étranger : la liste on-chain des contributions vous donne **toutes** les adresses lésées, bien au-delà des plaignants. Elle sert à mesurer le préjudice global, à rapprocher les plaintes et, plus tard, à organiser d'éventuelles restitutions.`,
      },
      {
        type: 'callout',
        kind: 'law',
        title: 'Cadre juridique',
        md: `Selon les faits, les qualifications envisageables incluent l'**escroquerie** (article 313-1 du code pénal), l'abus de confiance, les pratiques commerciales trompeuses, et le blanchiment pour les intermédiaires. L'offre au public de crypto-actifs est par ailleurs encadrée au niveau européen par le règlement MiCA (livre blanc notamment) ; la violation de ces obligations relève d'un autre registre que la fraude elle-même. Vérifiez les textes applicables à la date des faits avec le parquet.`,
      },
      {
        type: 'callout',
        kind: 'example',
        title: 'Un cas public',
        md: `En novembre 2021, le jeton « SQUID », surfant sur une série télévisée à succès, a vu son cours s'envoler alors que les acheteurs ne pouvaient pas revendre ; les créateurs ont retiré la liquidité et emporté plusieurs millions de dollars. Un schéma de manuel : honeypot puis hard rug.`,
      },
      {
        type: 'check',
        q: `Quelle est souvent la meilleure piste pour identifier l'auteur d'un rug pull ?`,
        options: [
          `Le nom du jeton`,
          `Le nombre d'investisseurs`,
          `L'origine du gaz qui a financé l'adresse de déploiement`,
          `Le prix maximal atteint par le jeton`,
        ],
        answer: 2,
        explain: `Le déployeur doit être approvisionné en gaz ; ce premier financement vient souvent d'un retrait d'exchange identifiable, ou relie à d'autres lancements.`,
      },
    ],
    keyPoints: [
      `Rug pull : récupérer la valeur apportée par les investisseurs (prévente, pool) puis disparaître.`,
      `Typologies : hard rug (retrait de liquidité), soft rug (dump), honeypot, mint caché, prévente vidée.`,
      `Les fonctions présentes dans le code dès le déploiement (blocage des ventes, mint, taxes modifiables) prouvent l'intention.`,
      `Préjudice : solde net de chaque adresse investisseuse, valorisé à la date de chaque contribution.`,
      `La liste on-chain des contributions identifie toutes les victimes, pas seulement les plaignants.`,
      `Le financement en gaz du déployeur est souvent la meilleure piste vers l'auteur.`,
      `Suivre la sortie : dispersion, bridges, exchanges, portefeuilles dormants à surveiller.`,
    ],
    quiz: [
      {
        q: `Qu'est-ce qu'un hard rug ?`,
        options: [
          `Une vente progressive et annoncée des jetons de l'équipe`,
          `Le retrait brutal de la liquidité du pool par le détenteur des jetons LP`,
          `Une faille exploitée par un pirate extérieur`,
          `Un airdrop gratuit`,
        ],
        answer: 1,
        explain: `Le détenteur des jetons LP les détruit (removeLiquidity) et récupère l'actif de valeur du pool : le jeton ne vaut plus rien.`,
      },
      {
        kind: 'multi',
        q: `Quels éléments du contrat sont des signaux d'alerte ? (plusieurs réponses)`,
        options: [
          `Une fonction mint réservée à l'owner`,
          `Des taxes de vente modifiables sans plafond`,
          `Un code source vérifié publiquement`,
          `Une liste noire qui peut bloquer les ventes`,
        ],
        answer: [0, 1, 3],
        explain: `Mint, taxes modifiables et liste noire permettent de spolier les détenteurs. Un code vérifié est au contraire une bonne pratique (qui n'exclut pas la fraude).`,
      },
      {
        kind: 'truefalse',
        q: `La renonciation à l'ownership (renounceOwnership) garantit à elle seule qu'un jeton ne peut pas être une escroquerie.`,
        options: ['Vrai', 'Faux'],
        answer: 1,
        explain: `Des privilèges peuvent être cachés ailleurs (proxy, adresses exclues, fonctions non protégées), et la liquidité peut toujours être retirée si les LP ne sont pas verrouillés.`,
      },
      {
        q: `Comment calculer le préjudice d'un investisseur ?`,
        options: [
          `Contributions (prévente, achats) moins sorties (ventes réussies, remboursements), valorisées à la date de chaque opération`,
          `Prix maximal atteint × nombre de jetons détenus`,
          `Montant total retiré par le développeur divisé par le nombre de plaignants`,
          `Nombre de jetons × prix au jour de la plainte`,
        ],
        answer: 0,
        explain: `Le préjudice est le solde net réellement apporté. La valorisation « au plus haut » n'a pas de sens pour un préjudice.`,
      },
      {
        q: `Cinq adresses ont acheté le jeton dans le tout premier bloc après création du pool, et ont été financées par la même source que le déployeur. Interprétation ?`,
        options: [
          `Des investisseurs chanceux`,
          `Des robots d'arbitrage sans lien`,
          `L'exchange de destination`,
          `Des portefeuilles de l'équipe (snipers, prête-noms), à exclure des victimes`,
        ],
        answer: 3,
        explain: `Un financement commun avec le déployeur et un achat au premier bloc signent des portefeuilles de l'équipe.`,
      },
      {
        kind: 'multi',
        q: `Quelles sources OSINT peuvent aider à identifier l'équipe d'un projet frauduleux ? (plusieurs réponses)`,
        options: [
          `Les plateformes de lancement qui ont délivré un badge « KYC »`,
          `L'enregistrement du nom de domaine du site`,
          `Les comptes de réseaux sociaux et la chaîne de discussion du projet`,
          `Le chainId de BNB Chain`,
        ],
        answer: [0, 1, 2],
        explain: `Plateformes de lancement, domaine et réseaux sociaux sont des pivots classiques. Le chainId n'identifie personne.`,
      },
    ],
    flashcards: [
      { front: 'Rug pull', back: `Le créateur d'un jeton récupère la valeur apportée par les investisseurs et disparaît.` },
      { front: 'Hard rug', back: `Retrait brutal de la liquidité (removeLiquidity) par le détenteur des jetons LP.` },
      { front: 'Soft rug', back: `Vente massive de ses jetons par l'équipe, qui écrase le prix.` },
      { front: 'Honeypot', back: `Jeton qu'on peut acheter mais pas revendre (ou taxé à 100 % à la vente).` },
      { front: 'Jetons LP', back: `Preuve de fourniture de liquidité ; les détruire restitue la part du pool.` },
      { front: 'Verrou de liquidité', back: `Contrat bloquant les jetons LP jusqu'à une date ; gage relatif.` },
      { front: 'Preuve d’intention dans le code', back: `Mint caché, taxes modifiables, liste noire présents dès le déploiement.` },
      { front: 'Préjudice d’un investisseur', back: `Solde net (contributions − sorties), valorisé à la date de chaque opération.` },
      { front: 'Meilleure piste vers l’auteur', back: `L'origine du gaz du déployeur (souvent un retrait d'exchange).` },
      { front: 'Snipers du premier bloc', back: `Souvent des portefeuilles de l'équipe financés par la même source que le déployeur.` },
    ],
  },
]
