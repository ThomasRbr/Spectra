// Niveau 3 — Bitcoin : SegWit, Taproot et témoins. Lire les scripts de
// verrouillage et de déverrouillage, calculer poids, taille virtuelle et frais,
// exploiter le témoin d'une dépense multisig et reconnaître les dépenses Taproot.
import type { Lesson } from '../model'

export const LESSON_BITCOIN_MODERNE: Lesson = {
  id: 'bitcoin-moderne',
  title: 'SegWit, Taproot et témoins : lire une transaction Bitcoin moderne',
  level: 3,
  track: 'bitcoin',
  minutes: 45,
  summary: `Derrière chaque adresse se cache un script de verrouillage, et derrière chaque dépense une preuve : scriptSig pour les anciens formats, témoin (witness) depuis SegWit. Savoir lire ces éléments, c'est calculer exactement le poids, la taille virtuelle et le taux de frais d'une transaction, reconnaître le SegWit imbriqué, identifier quelles clés d'un coffre multisignature ont signé une dépense frauduleuse, distinguer une dépense Taproot par clé d'une dépense par script, et tirer du type des entrées et des sorties des indices sur le logiciel utilisé.`,
  objectives: [
    `Associer chaque type de sortie (P2PKH, P2SH, P2WPKH, P2WSH, P2TR) à son scriptPubKey, à sa taille et au préfixe de son adresse.`,
    `Expliquer où se trouve la preuve de dépense (scriptSig ou témoin) et pourquoi le témoin bénéficie d'une remise de poids.`,
    `Calculer à la main le poids, la taille virtuelle et le taux de frais d'une transaction SegWit, et vérifier le résultat affiché par l'outil.`,
    `Lire le témoin d'une dépense P2WSH multisig pour déterminer quelles clés ont signé, et relier ces clés à des personnes grâce au descripteur du coffre.`,
    `Distinguer une dépense Taproot par la clé (indiscernable) d'une dépense par script (qui révèle la feuille utilisée).`,
    `Utiliser les types de scripts des entrées et des sorties comme indices d'empreinte de portefeuille, sans les surinterpréter.`,
  ],
  prerequisites: ['utxo', 'frais-mempool', 'change-heuristics'],
  practice: ['multisig-taproot'],
  blocks: [
    {
      type: 'text',
      md: `Une PME de négoce conserve sa trésorerie dans un **coffre multisignature 2-sur-3** : une clé pour la gérante, une pour le directeur financier, une confiée à un prestataire de garde qui ne cosigne qu'après un rappel téléphonique. Un lundi matin, le coffre est vide : **41,8 BTC** sont partis vers une adresse \`bc1p…\` inconnue. Les deux dirigeants jurent n'avoir rien signé ; le prestataire affirme n'avoir reçu aucune demande.

Au moins deux personnes, ou deux clés, mentent. La blockchain, elle, ne ment pas : la transaction de dépense contient un **témoin** qui publie les trois clés publiques du coffre **et** les deux signatures utilisées. En vérifiant chaque signature contre chaque clé, on sait **exactement quelles clés ont signé**. Encore faut-il savoir lire ce témoin, et savoir quelle clé appartient à qui.

Cette leçon prolonge « Le modèle UTXO et les types de scripts » : on y passe de l'adresse (ce que voit l'explorateur) au **script** (ce que vérifient les nœuds), puis au **poids** (ce que paient les utilisateurs).`,
    },
    { type: 'heading', text: 'Du script de verrouillage à l’adresse' },
    {
      type: 'text',
      md: `Une sortie Bitcoin ne contient pas d'adresse : elle contient un **scriptPubKey**, c'est-à-dire la condition à remplir pour la dépenser. L'adresse n'est qu'un **encodage lisible** de ce script, avec une somme de contrôle : Base58Check pour les formats \`1…\` et \`3…\`, **bech32** (BIP 173) pour SegWit version 0 (\`bc1q…\`), **bech32m** (BIP 350) pour la version 1, Taproot (\`bc1p…\`).

Les formats SegWit suivent tous le même gabarit : un **numéro de version** (\`OP_0\` ou \`OP_1\`) suivi d'un **programme témoin** de 20 ou 32 octets. Le « q » de \`bc1q\` encode la version 0, le « p » de \`bc1p\` la version 1.`,
    },
    {
      type: 'table',
      caption: 'Les scripts de verrouillage courants. Les tailles de scriptPubKey sont exactes ; une sortie complète ajoute 8 octets de montant et 1 octet de longueur.',
      headers: ['Type', 'scriptPubKey (asm)', 'Taille du script', 'Adresse', 'Taille d’une sortie'],
      rows: [
        ['P2PKH', '`OP_DUP OP_HASH160 <20 o> OP_EQUALVERIFY OP_CHECKSIG`', '25 o', '1… (26 à 34 car.)', '34 o'],
        ['P2SH', '`OP_HASH160 <20 o> OP_EQUAL`', '23 o', '3… (34 car.)', '32 o'],
        ['P2WPKH (SegWit v0)', '`OP_0 <20 o : HASH160 de la clé>`', '22 o', 'bc1q… (42 car.)', '31 o'],
        ['P2WSH (SegWit v0)', '`OP_0 <32 o : SHA-256 du script>`', '34 o', 'bc1q… (62 car.)', '43 o'],
        ['P2TR (SegWit v1, Taproot)', '`OP_1 <32 o : clé publique ajustée>`', '34 o', 'bc1p… (62 car.)', '43 o'],
        ['OP_RETURN', '`OP_RETURN <données>`', 'variable', 'aucune', '0 BTC, non dépensable'],
      ],
    },
    {
      type: 'widget',
      id: 'address-anatomy',
      caption: `Entraînez-vous : à partir du préfixe et de la longueur, retrouvez le script de verrouillage. Un \`bc1q\` de 42 caractères engage le hash d'une clé, un \`bc1q\` de 62 caractères le hash d'un script.`,
    },
    {
      type: 'callout',
      kind: 'tip',
      title: 'Ce qu’un script de verrouillage cache encore',
      md: `P2PKH, P2WPKH et P2SH/P2WSH ne publient qu'un **hash** : la clé publique ou le script n'apparaissent qu'à la **première dépense**. Une adresse qui n'a jamais dépensé ne révèle donc ni son type de multisig, ni ses clés. Taproot va plus loin : sa sortie contient une clé publique (ajustée) et rien ne permet de savoir, même après une dépense par la clé, si des scripts alternatifs existaient.`,
    },
    { type: 'heading', text: 'scriptSig ou témoin : où se trouve la preuve de dépense' },
    {
      type: 'compare',
      left: {
        title: 'Avant SegWit (P2PKH, P2SH)',
        md: `- La preuve (signatures, clé publique, script de rachat) est dans le **scriptSig** de l'entrée.
- Le scriptSig fait partie des données hachées pour calculer le **txid** : un tiers pouvait modifier la forme d'une signature et changer le txid sans invalider la transaction (**malléabilité**).
- Chaque octet compte **plein tarif** (4 unités de poids).`,
      },
      right: {
        title: 'Depuis SegWit (BIP 141, activé en août 2017)',
        md: `- La preuve est déplacée dans le **témoin**, une structure séparée attachée à chaque entrée ; le scriptSig est vide (SegWit natif) ou réduit au programme témoin (SegWit imbriqué).
- Le **txid** n'inclut plus le témoin : la malléabilité par la signature disparaît, ce qui a rendu possibles les canaux Lightning. Le **wtxid** inclut, lui, le témoin.
- Chaque octet du témoin ne compte que **pour 1 unité de poids** au lieu de 4.`,
      },
    },
    {
      type: 'terms',
      items: [
        { term: 'scriptPubKey', def: `Script de verrouillage d'une sortie : la condition de dépense. Visible dès la création de la sortie.` },
        { term: 'scriptSig', def: `Champ de l'entrée qui fournit les données de déverrouillage des anciens formats. Vide en SegWit natif, réduit à 23 octets en P2SH-P2WPKH.` },
        { term: 'Témoin (witness)', def: `Pile d'éléments (signatures, clés, script) fournie hors scriptSig pour les entrées SegWit. Chaque élément est précédé de sa longueur ; la pile est précédée du nombre d'éléments.` },
        { term: 'Programme témoin', def: `Les 20 ou 32 octets qui suivent le numéro de version dans un scriptPubKey SegWit : hash de clé (P2WPKH), hash de script (P2WSH) ou clé Taproot (P2TR).` },
        { term: 'Poids (weight units, WU)', def: `Octets hors témoin × 4 + octets du témoin × 1. Un bloc est limité à 4 000 000 WU.` },
        { term: 'Taille virtuelle (vsize, vB)', def: `Poids / 4, arrondi à l'unité supérieure. C'est l'unité de facturation : le taux de frais s'exprime en sat/vB.` },
        { term: 'BIP 143', def: `Nouvel algorithme de hachage des signatures SegWit v0 : la signature engage le montant de l'entrée dépensée, ce qui permet à un portefeuille matériel de vérifier les frais et supprime le hachage quadratique.` },
        { term: 'wtxid', def: `Identifiant de transaction calculé témoin compris. Les explorateurs affichent le txid ; deux transactions de même txid peuvent différer par leur témoin.` },
      ],
    },
    { type: 'heading', text: 'Poids, taille virtuelle et frais : le calcul complet' },
    {
      type: 'text',
      md: `La règle de BIP 141 tient en une ligne : **poids = octets hors témoin × 4 + octets du témoin**, et **vsize = poids / 4** (arrondi supérieur). Les frais, eux, sont simplement la différence entre la somme des entrées et la somme des sorties ; le **taux** se calcule en divisant ces frais par la vsize.

Faisons le calcul complet pour la transaction la plus banale du réseau : **une entrée P2WPKH, deux sorties P2WPKH** (un paiement et un rendu).`,
    },
    {
      type: 'steps',
      items: [
        { title: '1. Partie fixe hors témoin', md: `Version (4 o) + nombre d'entrées (1 o) + nombre de sorties (1 o) + nLockTime (4 o) = **10 octets**.` },
        { title: '2. Entrée, partie hors témoin', md: `Référence de la sortie dépensée (txid 32 o + index 4 o) + longueur du scriptSig (1 o, valeur 0) + nSequence (4 o) = **41 octets**.` },
        { title: '3. Sorties', md: `Chaque sortie P2WPKH = montant (8 o) + longueur du script (1 o) + script (22 o) = 31 o ; deux sorties = **62 octets**. Total hors témoin : 10 + 41 + 62 = **113 octets**.` },
        { title: '4. Témoin', md: `Marqueur et drapeau SegWit (2 o) + nombre d'éléments (1 o) + longueur et signature ECDSA (1 + 72 o) + longueur et clé publique compressée (1 + 33 o) = **110 octets**.` },
        { title: '5. Poids et taille virtuelle', md: `Poids = 113 × 4 + 110 = 452 + 110 = **562 WU**. vsize = 562 / 4 = 140,5, arrondi à **141 vB**. Taille sérialisée réelle : 113 + 110 = 223 octets.` },
        { title: '6. Frais et taux', md: `Entrée de 1 500 000 sats ; sorties de 1 000 000 et 498 308 sats. Frais = 1 500 000 − 1 498 308 = **1 692 sats**, soit 1 692 / 141 = **12 sat/vB**.` },
        { title: '7. Ce que rapporte la remise', md: `Sans remise, les 223 octets auraient coûté 223 × 12 = 2 676 sats : la remise SegWit économise environ **37 %**. La même opération en P2PKH (une entrée de 148 o, deux sorties de 34 o) ferait 226 vB, soit 2 712 sats au même taux.` },
      ],
    },
    {
      type: 'table',
      caption: 'Tailles typiques à retenir (signatures ECDSA de 72 octets sighash compris ; une signature « low-R » de 71 octets retire 0,25 vB par signature en SegWit, 1 vB en legacy)',
      headers: ['Élément', 'Hors témoin', 'Témoin', 'Taille virtuelle'],
      rows: [
        ['Partie fixe (transaction SegWit)', '10 o', '2 o (marqueur + drapeau)', '10,5 vB'],
        ['Entrée P2PKH', '148 o', '—', '148 vB'],
        ['Entrée P2SH-P2WPKH (SegWit imbriqué)', '64 o', '108 o', '91 vB'],
        ['Entrée P2WPKH', '41 o', '108 o', '68 vB'],
        ['Entrée P2WSH multisig 2-sur-3', '41 o', '254 o', '104,5 vB'],
        ['Entrée P2TR, dépense par la clé', '41 o', '66 o', '57,5 vB'],
        ['Sortie P2WPKH / P2PKH / P2SH', '31 / 34 / 32 o', '—', '31 / 34 / 32 vB'],
        ['Sortie P2WSH ou P2TR', '43 o', '—', '43 vB'],
      ],
    },
    {
      type: 'callout',
      kind: 'field',
      title: 'Dans Spectra : la carte « Taille et poids »',
      md: `L'inspecteur d'une transaction Bitcoin affiche la **taille** (octets, témoin compris), le **poids** (WU), la **taille virtuelle** (vB), le **taux** en sat/vB et le pourcentage économisé grâce à la remise. Refaites le calcul à la main sur une ou deux transactions : c'est la meilleure façon de comprendre pourquoi une consolidation de 40 entrées coûte cher, et de repérer un taux de frais atypique (valeur ronde, taux très bas d'un service qui consolide la nuit, taux très haut d'un auteur pressé).`,
    },
    {
      type: 'widget',
      id: 'fee-mempool',
      caption: `Taille virtuelle × taux = frais. Faites varier le taux pour voir l'effet sur la priorité de confirmation : c'est la vsize, pas la taille brute, qui détermine le coût.`,
    },
    {
      type: 'check',
      q: `Une transaction comporte 94 octets hors témoin et 256 octets de témoin. Elle paie 3 160 sats de frais. Quel est son taux ?`,
      options: [
        `9 sat/vB (3 160 / 350 octets)`,
        `20 sat/vB (poids 632 WU, vsize 158 vB)`,
        `33,6 sat/vB (3 160 / 94)`,
        `5 sat/vB (3 160 / 632)`,
      ],
      answer: 1,
      explain: `Poids = 94 × 4 + 256 = 632 WU ; vsize = 632 / 4 = 158 vB ; taux = 3 160 / 158 = 20 sat/vB. Diviser par la taille brute (350 o) ou par le poids sous-estime le taux.`,
    },
    { type: 'heading', text: 'Le SegWit imbriqué : une adresse en 3… qui cache un témoin' },
    {
      type: 'text',
      md: `En 2017, beaucoup de services ne savaient pas encore envoyer vers des adresses \`bc1\`. Pour profiter de la remise sans casser la compatibilité, BIP 141 prévoit d'**imbriquer** un programme témoin dans un script P2SH : l'adresse reste en \`3…\`, mais le script de rachat est simplement \`OP_0 <hash de 20 octets>\`.

À la dépense, le **scriptSig** ne contient que ce programme (23 octets : \`16 00 14 <20 o>\`) et le **témoin** contient la signature et la clé publique, exactement comme en P2WPKH. Résultat : 91 vB par entrée au lieu de 68 vB en natif et 148 vB en legacy.

Pour l'enquêteur, deux conséquences :

- une adresse \`3…\` **n'est pas forcément un multisig** : avant la première dépense, impossible de savoir s'il s'agit d'un coffre P2SH ou d'un P2SH-P2WPKH ; après, le scriptSig tranche ;
- le P2SH-P2WPKH est **daté** : il signe des portefeuilles configurés entre 2017 et 2020 environ (chemin BIP 49, clés « ypub »), ou des services qui n'ont jamais migré. Des entrées en \`3…\` imbriqué au milieu d'un flux entièrement \`bc1q\` sont un indice de portefeuille différent.`,
    },
    { type: 'heading', text: 'Multisig P2WSH : le témoin dit qui a signé' },
    {
      type: 'text',
      md: `Un coffre 2-sur-3 en P2WSH est verrouillé par le SHA-256 du script \`OP_2 <clé 1> <clé 2> <clé 3> OP_3 OP_CHECKMULTISIG\` (105 octets). Tant qu'il n'a pas dépensé, rien ne dit que c'est un multisig, ni combien de clés il compte. **À la première dépense**, le témoin publie tout :`,
    },
    {
      type: 'table',
      caption: 'Témoin d’une dépense P2WSH 2-sur-3 (4 éléments, 254 octets avec deux signatures de 72 octets)',
      headers: ['Rang', 'Élément du témoin', 'Taille', 'Ce qu’il révèle'],
      rows: [
        ['0', 'Élément vide', '0 o (+1 o de longueur)', 'Exigé par un défaut historique d’OP_CHECKMULTISIG, qui dépile un élément de trop'],
        ['1', 'Première signature ECDSA', '71-72 o', 'Signature d’une des trois clés'],
        ['2', 'Seconde signature ECDSA', '71-72 o', 'Signature d’une autre clé, de rang supérieur dans le script'],
        ['3', 'Script témoin', '105 o', 'Le seuil (2), les trois clés publiques, le total (3)'],
      ],
    },
    {
      type: 'text',
      md: `OP_CHECKMULTISIG impose que les signatures soient fournies **dans l'ordre des clés** du script. En vérifiant chaque signature contre chaque clé publique (un calcul que fait l'outil), on obtient la combinaison exacte : par exemple « clés n° 1 et n° 3 ». C'est un **fait cryptographique**, pas une heuristique : seule la clé privée correspondante a pu produire une signature valide sur cette transaction.

Dans Spectra, la carte **« Scripts et témoins »** de l'inspecteur affiche pour chaque entrée multisig la mention « Multisig 2-sur-3 · ont signé : clé n° 1, clé n° 3 », les trois clés publiques (celles qui ont signé en surbrillance) et le détail des éléments du témoin avec leur taille.`,
    },
    {
      type: 'callout',
      kind: 'warn',
      title: 'Clé n° 1 ne veut pas dire « cosignataire n° 1 »',
      md: `Le rang d'une clé dans le script n'est **pas** celui de la configuration du coffre. Les portefeuilles modernes utilisent \`sortedmulti\` (BIP 67) : les clés sont **triées par ordre lexicographique**, et cet ordre change à chaque adresse du coffre, puisque chaque adresse dérive de nouvelles clés. Pour relier une clé à une personne, il faut le **descripteur** du coffre, par exemple \`wsh(sortedmulti(2,[fp1/48h/0h/0h/2h]xpubA/0/*,[fp2/…]xpubB/0/*,[fp3/…]xpubC/0/*))\`, trouvé dans la configuration d'un logiciel (Sparrow, Electrum, Nunchuk…), chez le prestataire de garde ou dans les sauvegardes de l'entreprise. On dérive alors les trois clés de l'adresse concernée et on les compare aux clés du témoin.`,
    },
    {
      type: 'case',
      title: 'Cas pratique — le coffre de la PME',
      md: `Reprenons le vol de 41,8 BTC. La transaction de dépense comporte **une entrée P2WSH** et **une sortie P2TR** de 41,7999684 BTC. Inspecteur, carte « Taille et poids » : 94 octets hors témoin, 256 octets de témoin, poids 632 WU, **158 vB**, 3 160 sats de frais, soit **20 sat/vB**.

Carte « Scripts et témoins » : multisig 2-sur-3, **ont signé : clé n° 2 et clé n° 3**.

Le fichier de configuration Sparrow saisi sur le poste de la gérante contient le descripteur du coffre. L'analyste dérive les trois clés à l'index de l'adresse vidée (\`/0/14\`) : après tri lexicographique, la clé n° 2 est celle du **directeur financier** (empreinte \`9a41c07e\`), la clé n° 3 celle du **prestataire de garde** (empreinte \`e2d05b13\`). La clé de la gérante n'a pas signé.

Suites : réquisition au prestataire pour le journal de ses signatures (horodatage, canal de la demande, vérification téléphonique effectuée ou non), forensique du poste et du portefeuille matériel du directeur financier. Le prestataire découvre qu'une demande de cosignature a été validée par un opérateur à 2 h 14, après un appel provenant d'un numéro usurpant celui du directeur financier. L'enquête porte désormais sur une **compromission de la clé du directeur financier** couplée à une **ingénierie sociale** du prestataire.`,
    },
    {
      type: 'callout',
      kind: 'law',
      title: 'Une signature prouve l’usage d’une clé, pas l’identité de celui qui l’a utilisée',
      md: `Le témoin établit qu'une **clé** a signé ; il n'établit pas **qui** la détenait à ce moment. Une clé peut avoir été volée, copiée, ou utilisée sous la contrainte. Dans le rapport, formulez : « la transaction a été signée par les clés correspondant aux empreintes 9a41c07e et e2d05b13, attribuées d'après le descripteur saisi au directeur financier et au prestataire de garde ». L'imputation à une personne relève du reste de l'enquête (forensique, journaux, auditions).`,
    },
    { type: 'heading', text: 'Taproot : une clé, ou un arbre de scripts caché' },
    {
      type: 'text',
      md: `Taproot (BIP 340, 341 et 342, activé en novembre 2021 au bloc 709 632) combine trois idées :

- les **signatures Schnorr** (BIP 340) : 64 octets, clés publiques de 32 octets (coordonnée x seule), et surtout l'**agrégation** : plusieurs signataires peuvent produire ensemble une seule clé et une seule signature (MuSig2, FROST) ;
- une sortie \`OP_1 <32 o>\` qui contient une **clé publique ajustée** (BIP 341) : la clé interne, « ajustée » par le hash d'un éventuel **arbre de scripts** (arbre de Merkle de « feuilles ») ;
- un nouveau langage de script, **Tapscript** (BIP 342), où \`OP_CHECKMULTISIG\` est remplacé par \`OP_CHECKSIGADD\`.

On peut alors dépenser de deux façons.`,
    },
    {
      type: 'compare',
      left: {
        title: 'Dépense par la clé (key path)',
        md: `- Témoin : **un seul élément**, une signature Schnorr de 64 octets (65 si un type de sighash explicite est ajouté).
- 57,5 vB par entrée, la dépense la moins chère.
- **Indiscernable** : une clé simple, un multisig MuSig2 à 3 participants ou un coffre muni de scripts de secours produisent exactement le même témoin.
- Ce qui n'a pas servi reste caché pour toujours.`,
      },
      right: {
        title: 'Dépense par script (script path)',
        md: `- Témoin : les arguments du script (signatures…), **le script de la feuille** utilisée, puis le **bloc de contrôle** (33 + 32 × m octets : version de feuille et parité, clé interne, chemin de Merkle de profondeur m).
- Révèle **une seule feuille** et la profondeur de l'arbre : les autres feuilles restent cachées.
- Signale une configuration élaborée : timelock de secours, multisig en Tapscript, ou… enveloppe d'inscription ordinale (leçon suivante).`,
      },
    },
    {
      type: 'callout',
      kind: 'example',
      title: 'Multisig en Tapscript : les signataires restent lisibles',
      md: `Un 2-sur-3 écrit en Tapscript prend la forme \`<clé A> OP_CHECKSIG <clé B> OP_CHECKSIGADD <clé C> OP_CHECKSIGADD OP_2 OP_NUMEQUAL\`. Le témoin doit fournir **un élément par clé** : une signature pour chaque clé qui signe, un **élément vide** pour chaque clé qui ne signe pas. Les signataires se lisent donc directement, comme en P2WSH. En revanche, un multisig **agrégé** (MuSig2, FROST) dépensé par la clé ne laisse voir qu'une signature : le nombre de participants et leur identité sont invisibles sur la chaîne.`,
    },
    {
      type: 'check',
      q: `Une entrée P2TR ne comporte qu'un élément de témoin de 64 octets. Que pouvez-vous affirmer ?`,
      options: [
        `Le propriétaire est une personne seule disposant d'une clé unique`,
        `Il s'agit d'une dépense par la clé : impossible de savoir s'il s'agissait d'une clé simple, d'un multisig agrégé ou d'une sortie munie de scripts de secours`,
        `La transaction est invalide : il manque la clé publique`,
        `C'est une inscription ordinale`,
      ],
      answer: 1,
      explain: `Une seule signature Schnorr de 64 octets caractérise la dépense par la clé. La clé publique figure déjà dans la sortie dépensée. Rien ne permet de déduire le nombre de participants ni l'existence de scripts non utilisés.`,
    },
    { type: 'heading', text: 'Ce que les types d’entrées et de sorties révèlent du portefeuille' },
    {
      type: 'text',
      md: `Un logiciel de portefeuille a des habitudes : un type d'adresse par compte, un format de signature, des réglages de version, de nLockTime et de nSequence. Le type de script s'ajoute ainsi aux éléments d'**empreinte** étudiés dans la leçon « Empreintes de portefeuilles et analyse comportementale ». Quelques lectures utiles :`,
    },
    {
      type: 'table',
      caption: 'Indices tirés des scripts et des témoins, à combiner avec les autres éléments d’empreinte',
      headers: ['Observation', 'Lecture probable', 'Prudence'],
      rows: [
        ['Toutes les entrées en P2WPKH, une sortie P2WPKH et une sortie P2TR', 'Le rendu est vraisemblablement la sortie P2WPKH (même type que les entrées)', 'Certains portefeuilles alignent volontairement le rendu sur le type du destinataire'],
        ['Entrées P2SH-P2WPKH (3… imbriqué)', 'Portefeuille configuré en BIP 49, souvent ancien, ou service jamais migré', 'Des exchanges utilisent encore des adresses 3… de dépôt'],
        ['Entrée P2WSH 2-sur-3 dont les mêmes clés signent toujours', 'Coffre d’entreprise ou de service, routine de signature stable', 'Un changement de combinaison de signataires est un événement à expliquer'],
        ['Entrée P2WSH 2-sur-2 et sorties vers des clés distinctes', 'Fermeture coopérative d’un canal Lightning', 'Voir la leçon « Le Lightning Network »'],
        ['Signatures toujours de 71 octets', 'Portefeuille qui force les signatures « low-R » (Bitcoin Core et logiciels dérivés)', 'Une signature de 71 octets peut aussi survenir par hasard (une fois sur deux environ)'],
        ['Dépense P2TR par script avec enveloppe « ord »', 'Inscription ordinale (révélation)', 'Ce n’est pas un paiement : voir la leçon « Ordinals, inscriptions, BRC-20 et Runes »'],
        ['Mélange de types d’entrées dans une même transaction', 'Portefeuille multi-comptes ou consolidation par un service', 'Peut aussi signaler une transaction collaborative (CoinJoin, PayJoin)'],
      ],
    },
    {
      type: 'callout',
      kind: 'warn',
      title: 'Une empreinte se construit, elle ne se décrète pas',
      md: `Un indice isolé (le type du rendu, la taille d'une signature) a une valeur faible. C'est la **convergence** de plusieurs indices stables sur une série de transactions (type d'adresse, version, nLockTime anti-fee-sniping, signalement RBF, ordre des sorties, taux de frais ronds) qui permet de suivre un portefeuille et de départager deux sorties candidates. Notez chaque indice et son poids dans le rapport.`,
    },
    {
      type: 'check',
      q: `Un coffre P2WSH 2-sur-3 a toujours été dépensé par les clés n° 1 et n° 2 de chaque adresse. La dernière dépense, frauduleuse, est signée par les clés n° 2 et n° 3. Quelle est la démarche correcte ?`,
      options: [
        `Conclure que le titulaire de la clé n° 3 est l'auteur, puisque sa clé apparaît pour la première fois`,
        `Récupérer le descripteur du coffre, dériver les clés de chaque adresse concernée, puis attribuer les clés aux cosignataires avant toute conclusion`,
        `Ignorer le témoin, qui n'est qu'une heuristique`,
        `Demander aux mineurs l'identité des signataires`,
      ],
      answer: 1,
      explain: `Avec sortedmulti, le rang d'une clé change d'une adresse à l'autre : « clé n° 3 » ne désigne pas forcément la même personne à chaque dépense. Seul le descripteur permet de faire correspondre clés et cosignataires, et l'usage d'une clé ne prouve pas l'identité de son utilisateur.`,
    },
  ],
  keyPoints: [
    `Une adresse encode un scriptPubKey : P2PKH 25 o (1…), P2SH 23 o (3…), P2WPKH 22 o (bc1q, 42 car.), P2WSH 34 o (bc1q, 62 car.), P2TR 34 o (bc1p, 62 car.).`,
    `Depuis SegWit, la preuve de dépense est dans le témoin, exclu du txid (fin de la malléabilité) et compté à 1 WU par octet au lieu de 4.`,
    `Poids = octets hors témoin × 4 + octets du témoin ; vsize = poids / 4 arrondi au supérieur ; taux = frais / vsize (1 entrée P2WPKH + 2 sorties P2WPKH = 141 vB).`,
    `Une adresse 3… peut être un multisig P2SH ou un SegWit imbriqué (P2SH-P2WPKH, 91 vB par entrée) : seule la dépense tranche.`,
    `Le témoin d'une dépense P2WSH multisig révèle toutes les clés et les signatures : on sait quelles clés ont signé ; le descripteur du coffre relie ces clés aux personnes.`,
    `Taproot : la dépense par la clé (une signature Schnorr de 64 o) est indiscernable ; la dépense par script révèle une seule feuille et le bloc de contrôle.`,
    `Les types de scripts sont des indices d'empreinte, à combiner avec d'autres ; une signature prouve l'usage d'une clé, pas l'identité de son utilisateur.`,
  ],
  quiz: [
    {
      q: `Quel scriptPubKey correspond à une adresse bc1q de 62 caractères ?`,
      options: [
        `OP_0 suivi d'un hash de 20 octets (P2WPKH)`,
        `OP_1 suivi d'une clé de 32 octets (P2TR)`,
        `OP_0 suivi du SHA-256 de 32 octets d'un script (P2WSH)`,
        `OP_HASH160 suivi d'un hash de 20 octets et OP_EQUAL (P2SH)`,
      ],
      answer: 2,
      explain: `Les adresses bc1q encodent la version 0 de SegWit. 42 caractères = programme de 20 octets (P2WPKH) ; 62 caractères = programme de 32 octets, le SHA-256 d'un script (P2WSH). Les adresses Taproot commencent par bc1p.`,
    },
    {
      q: `Une transaction SegWit compte 113 octets hors témoin et 110 octets de témoin. Quelle est sa taille virtuelle ?`,
      options: [`223 vB`, `141 vB`, `562 vB`, `113 vB`],
      answer: 1,
      explain: `Poids = 113 × 4 + 110 = 562 WU ; vsize = 562 / 4 = 140,5, arrondi à 141 vB. 223 est la taille brute, 562 le poids.`,
    },
    {
      q: `La même transaction paie 1 692 sats de frais. Quel est son taux ?`,
      options: [`7,6 sat/vB`, `3 sat/vB`, `12 sat/vB`, `15 sat/vB`],
      answer: 2,
      explain: `1 692 / 141 = 12 sat/vB. Diviser par la taille brute (223 o) donnerait 7,6, une erreur fréquente qui fait croire à un taux anormalement bas.`,
    },
    {
      kind: 'truefalse',
      q: `Le txid d'une transaction SegWit est calculé sans le témoin, ce qui empêche un tiers de le modifier en altérant la forme d'une signature.`,
      options: ['Vrai', 'Faux'],
      answer: 0,
      explain: `C'est la correction de la malléabilité apportée par BIP 141. Le wtxid, lui, inclut le témoin. Cette stabilité du txid a permis de construire des transactions dépendantes non encore diffusées, base des canaux Lightning.`,
    },
    {
      q: `Une entrée dépense une adresse 3… : son scriptSig fait 23 octets et son témoin contient une signature et une clé publique. De quoi s'agit-il ?`,
      options: [
        `D'un multisig P2SH 2-sur-3`,
        `D'une dépense P2PKH`,
        `D'une dépense Taproot par script`,
        `D'un SegWit imbriqué P2SH-P2WPKH`,
      ],
      answer: 3,
      explain: `Le scriptSig ne contient que le programme témoin (OP_0 <20 octets>, 23 octets avec son push) et la preuve est dans le témoin : c'est la signature du P2SH-P2WPKH, typique des portefeuilles BIP 49.`,
    },
    {
      kind: 'multi',
      q: `Le témoin d'une dépense P2WSH 2-sur-3 contient… (plusieurs réponses)`,
      options: [
        `un élément vide exigé par OP_CHECKMULTISIG`,
        `deux signatures, dans l'ordre des clés du script`,
        `le script complet avec les trois clés publiques`,
        `l'identité civile des signataires`,
        `la phrase de récupération du coffre`,
      ],
      answer: [0, 1, 2],
      explain: `Le témoin publie l'élément vide, les m signatures et le script témoin (seuil, n clés, total). Il ne contient évidemment aucune donnée d'identité ni aucun secret : c'est le rapprochement avec le descripteur et l'enquête qui relient clés et personnes.`,
    },
    {
      q: `Pourquoi la « clé n° 2 » affichée par l'outil ne désigne-t-elle pas forcément le même cosignataire d'une adresse du coffre à l'autre ?`,
      options: [
        `Parce que les clés sont tirées au hasard par les mineurs`,
        `Parce que les portefeuilles trient les clés de chaque adresse par ordre lexicographique (sortedmulti, BIP 67) et que chaque adresse dérive des clés différentes`,
        `Parce que la clé n° 2 est toujours celle du prestataire`,
        `Parce que le témoin est chiffré`,
      ],
      answer: 1,
      explain: `Chaque adresse du coffre utilise de nouvelles clés dérivées des xpub des cosignataires ; leur tri change donc d'une adresse à l'autre. Il faut dériver les clés de l'adresse concernée à partir du descripteur pour savoir à qui elles appartiennent.`,
    },
    {
      q: `Que révèle une dépense Taproot par script ?`,
      options: [
        `L'ensemble des scripts de l'arbre`,
        `Uniquement la feuille utilisée, ses arguments et le bloc de contrôle (clé interne et chemin de Merkle) ; les autres feuilles restent cachées`,
        `Rien du tout : elle est identique à une dépense par la clé`,
        `La phrase de récupération du portefeuille`,
      ],
      answer: 1,
      explain: `Le bloc de contrôle prouve que la feuille appartient à l'arbre engagé dans la clé ajustée, sans dévoiler les autres feuilles. Sa longueur (33 + 32 × m) indique la profondeur de l'arbre.`,
    },
    {
      kind: 'truefalse',
      q: `Une entrée P2TR dépensée avec une seule signature de 64 octets prouve que l'adresse appartenait à une personne seule.`,
      options: ['Vrai', 'Faux'],
      answer: 1,
      explain: `Un multisig agrégé (MuSig2, FROST) produit une seule clé et une seule signature, indiscernables d'une clé simple. La dépense par la clé ne dit rien du nombre de participants.`,
    },
    {
      q: `Toutes les entrées d'une transaction sont en P2WPKH ; elle a une sortie P2WPKH et une sortie P2SH. Quelle lecture est la plus prudente ?`,
      options: [
        `La sortie P2SH est certainement le rendu`,
        `La sortie P2WPKH est vraisemblablement le rendu (même type que les entrées), indice à confirmer par d'autres heuristiques et l'empreinte du portefeuille`,
        `Les deux sorties appartiennent au destinataire`,
        `La transaction est un CoinJoin`,
      ],
      answer: 1,
      explain: `Le rendu reprend généralement le type des entrées. C'est un indice, pas une preuve : certains portefeuilles alignent le rendu sur le type du destinataire pour brouiller cette lecture.`,
    },
  ],
  flashcards: [
    { front: 'Tailles de scriptPubKey', back: `P2PKH 25 o · P2SH 23 o · P2WPKH 22 o · P2WSH 34 o · P2TR 34 o.` },
    { front: 'bc1q / bc1p', back: `bc1q = SegWit v0 (bech32, BIP 173) : 42 car. P2WPKH, 62 car. P2WSH. bc1p = SegWit v1 Taproot (bech32m, BIP 350), 62 car.` },
    { front: 'Formule du poids', back: `Poids (WU) = octets hors témoin × 4 + octets du témoin. vsize = poids / 4, arrondi au supérieur.` },
    { front: 'Transaction de référence', back: `1 entrée P2WPKH + 2 sorties P2WPKH : 113 o hors témoin + 110 o de témoin = 562 WU = 141 vB (223 o bruts).` },
    { front: 'Entrées typiques (vB)', back: `P2PKH 148 · P2SH-P2WPKH 91 · P2WPKH 68 · P2WSH 2-sur-3 104,5 · P2TR par clé 57,5.` },
    { front: 'scriptSig vs témoin', back: `scriptSig : preuve des anciens formats, comptée plein tarif et incluse dans le txid. Témoin : preuve SegWit, remise ×4, exclue du txid.` },
    { front: 'P2SH-P2WPKH', back: `SegWit imbriqué dans une adresse 3… : scriptSig de 23 o (programme témoin), signature et clé dans le témoin. Typique BIP 49 (2017-2020).` },
    { front: 'Témoin P2WSH 2-sur-3', back: `Élément vide + 2 signatures (dans l'ordre des clés) + script de 105 o (OP_2, 3 clés, OP_3, OP_CHECKMULTISIG).` },
    { front: 'sortedmulti (BIP 67)', back: `Clés triées par ordre lexicographique à chaque adresse : le rang « clé n° k » ne désigne pas un cosignataire fixe. Il faut le descripteur.` },
    { front: 'Taproot : dépense par la clé', back: `Une signature Schnorr de 64 o. Indiscernable : clé simple, MuSig2 ou scripts de secours non utilisés.` },
    { front: 'Taproot : dépense par script', back: `Arguments + script de la feuille + bloc de contrôle (33 + 32 × m o). Révèle une seule feuille.` },
    { front: 'BIP 340 / 341 / 342', back: `340 : signatures Schnorr. 341 : Taproot (sorties v1, clé ajustée, arbre de scripts). 342 : Tapscript (OP_CHECKSIGADD).` },
  ],
}
