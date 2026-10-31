import { World } from '../engine/world'
import { exchange, roundCoin, HOUR, DAY } from '../engine/patterns'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, fakeCity, fakePerson, fakePhone, fmtDate, forwardAll, procedureFor, receivedIn } from './util'

/**
 * Tutoriel 1 : premier traçage Bitcoin, pas à pas.
 * Victime → adresse de l'escroc → un saut → adresse de dépôt d'un exchange → hot wallet.
 */
export const guidePremiersPas: ScenarioTemplate = {
  id: 'guide-premiers-pas',
  guided: true,
  title: 'Tutoriel 1 : votre premier traçage',
  tagline: 'Pas à pas : lire une adresse, ouvrir une transaction, suivre les bitcoins jusqu\'à un exchange.',
  description:
    'Mission guidée pour débuter, sans prérequis. Une victime a payé en bitcoins un véhicule d\'occasion qui n\'existait pas. Le guide vous montre, clic par clic, comment partir de son adresse, lire une transaction, repérer le rendu, marquer l\'escroc et remonter jusqu\'à la plateforme où les fonds ont été déposés.',
  difficulty: 1,
  chains: ['btc'],
  skills: ['lecture_tx', 'utxo', 'change', 'exchange_id', 'requisition'],
  estMinutes: 40,
  lessons: ['bases-blockchain', 'explorateur-blocs', 'utxo', 'premiers-reflexes', 'suivre-flux', 'exchanges', 'requisitions'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const victimP = fakePerson(r)
    const victimName = victimP.name
    const g = victimP.g
    const city = fakeCity(r)
    const vehicle = r.pick(['un scooter 125 cm³', 'une moto d\'occasion', 'un camping-car', 'une voiture citadine'])

    const cv = exchange(w, 'coinhouse', 'btc')
    const destKey = r.pick(['binance', 'kraken', 'coinbase'] as const)
    const dest = exchange(w, destKey, 'btc')

    const victimE = w.customEntity({ name: victimName, category: 'victim' })
    const victim = w.addr('btc', { entity: victimE, kind: 'p2wpkh' })
    const scamE = w.customEntity({ name: 'Faux vendeur (inconnu)', category: 'suspect' })

    // Achat des bitcoins par la victime sur Coinhouse, retirés vers son portefeuille
    const amount = roundCoin(w, 0.06, 0.2, 0.005)
    const buyT = w.at(-r.int(20, 40))
    const buyTx = cv.withdraw(victim, +(amount + r.float(0.004, 0.012)).toFixed(6), buyT)

    // Paiement au faux vendeur : montant rond, rendu vers une adresse neuve de la victime
    const s1 = w.addr('btc', { entity: scamE, kind: 'p2sh' })
    const t1 = w.utxoTx({ time: w.at(0), from: [victim], to: [{ address: s1, value: amount }] })
    // Le rendu de la victime : une adresse neuve de son propre portefeuille (même type que l'entrée)
    const victimChange = t1.outputs.find((o) => o.address !== s1)!.address

    // Saut intermédiaire : l'escroc vide l'adresse vers une autre adresse à lui
    const s2 = w.addr('btc', { entity: scamE, kind: 'p2sh' })
    const t2 = forwardAll(w, s1, s2, w.at(r.float(2, 7)))

    // Dépôt sur l'exchange : le reste revient à l'escroc en rendu (s3, jamais dépensé : c'est le
    // reliquat qu'il détient encore), puis balayage du dépôt vers le hot wallet
    const deposit = dest.newDeposit()
    const depValue = +(w.unspentValue(s2) * r.float(0.86, 0.94)).toFixed(5)
    const s3 = w.addr('btc', { entity: scamE, kind: 'p2sh' })
    const t3 = w.utxoTx({ time: w.at(r.float(14, 30)), from: [s2], to: [{ address: deposit, value: depValue }], change: s3 })
    const sweep = dest.sweep([deposit], t3.time + r.float(1, 6) * HOUR)[0]

    // Bruit de fond léger (activité normale des deux plateformes)
    dest.noise(8, w.at(-48), w.at(72))
    cv.noise(5, buyT - DAY, w.at(48))

    const depositReceived = receivedIn(w, t3, deposit)
    const leftover = Math.round(receivedIn(w, t3, s3) * 1e8) / 1e8
    const exName = dest.entity.name
    // Délai entre le paiement de la victime et le dépôt sur la plateforme (en heures, au dixième)
    const delayH = Math.round(((t3.time - t1.time) / 3600) * 10) / 10
    const changeValue = Math.round(receivedIn(w, t1, victimChange) * 1e8) / 1e8

    return {
      world: w,
      title: `Fausse annonce de ${vehicle.replace(/^(un|une) /, '')} — ${city}`,
      briefing:
        `${victimName}, demeurant à ${city}, a répondu à une annonce en ligne pour ${vehicle}. Le « vendeur », prétendument muté à l'étranger, exigeait un paiement en bitcoins avant livraison. ${g('Il', 'Elle')} a acheté ${amt(amount, 'BTC')} sur Coinhouse, les a retirés vers son portefeuille personnel puis les a envoyés à l'adresse indiquée. Le véhicule n'a jamais existé et le vendeur ne répond plus.\n\n` +
        `Votre mission : suivre les bitcoins depuis le portefeuille de la victime jusqu'à la plateforme où l'escroc les a déposés, et préparer la suite d'enquête.\n\n` +
        `C'est une **mission guidée** : le guide pas à pas flotte en haut à gauche du graphe. Chaque étape se valide toute seule quand vous faites la bonne action, et le bouton « Je bloque » donne le chemin exact. Les indices sont gratuits.`,
      evidence: [
        {
          id: 'plainte',
          type: 'plainte',
          title: 'Procès-verbal de plainte (extrait)',
          date: w.at(3 * 24),
          author: victimName,
          body:
            `« J'ai vu l'annonce sur un site de petites annonces. Le vendeur m'a appelé${g('', 'e')} depuis le ${fakePhone(r)} et m'a expliqué qu'il ne prenait que les bitcoins, "pour aller plus vite".\n\n` +
            `Le ${fmtDate(buyT)}, j'ai acheté des bitcoins sur Coinhouse et je les ai retirés vers mon portefeuille sur mon téléphone. Le ${fmtDate(t1.time)}, j'ai envoyé ${amt(amount, 'BTC')} à l'adresse qu'il m'a donnée par message.\n\n` +
            `L'adresse de mon portefeuille : ${A(w, victim)} »`,
        },
        {
          id: 'message',
          type: 'sms',
          title: 'Message du « vendeur »',
          date: w.at(-3),
          author: 'Numéro masqué',
          body: `Bonjour, comme convenu le paiement se fait en BTC uniquement. Montant : ${amt(amount, 'BTC')}.\nAdresse de paiement :\n${A(w, s1)}\nDès réception, le transporteur part avec le véhicule.`,
        },
      ],
      seeds: [],
      objectives: [
        {
          id: 'o1', type: 'address', points: 10,
          prompt: 'Quelle est l\'adresse de l\'escroc qui a reçu le paiement de la victime ?',
          answer: [s1],
          hint: 'C\'est l\'adresse qui reçoit le montant rond annoncé dans la plainte, et qui figure aussi dans le message du vendeur.',
          explanation: `La transaction de paiement envoie exactement ${amt(amount, 'BTC')} vers ${A(w, s1)}, l'adresse donnée par message. L'autre sortie de la transaction est le rendu : elle revient à la victime.`,
        },
        {
          id: 'o6', type: 'address', points: 10,
          prompt: 'Dans la transaction de paiement, quelle sortie est le rendu qui revient au portefeuille de la victime ?',
          answer: [victimChange],
          hint: 'La transaction de paiement a deux sorties : celle qui ne va pas à l\'escroc, au montant non rond, revient à la victime.',
          explanation: `${A(w, victimChange)} reçoit ${amt(changeValue, 'BTC')} : un montant non rond, sur une adresse neuve du même type (SegWit natif, bc1q…) que l'adresse de la victime. Le portefeuille de ${victimName} a dépensé une « pièce » plus grosse que le prix et s'est renvoyé la différence. Ce rendu appartient à la victime : on le note, mais on ne le suit pas, ce n'est pas une piste.`,
        },
        {
          id: 'o11', type: 'choice', points: 8,
          prompt: 'Quels indices, combinés, désignent cette sortie comme le rendu de la victime ?',
          ...choice(r,
            'Montant non rond, adresse neuve du même type que l\'adresse d\'entrée, l\'autre sortie étant le montant rond convenu',
            [
              'C\'est forcément la plus grosse des deux sorties de la transaction',
              'C\'est toujours la première sortie de la liste (sortie n° 0)',
              'Le rendu est la sortie qui part vers une adresse d\'un type différent de l\'entrée',
            ]),
          hint: 'Comparez les deux sorties : montant (rond ou non), type d\'adresse (bc1q…, 3…), adresse neuve ou déjà connue.',
          explanation: `Aucune heuristique n'est infaillible seule, mais ici elles concordent : le paiement est le montant rond de la plainte (${amt(amount, 'BTC')}) vers l'adresse du message, tandis que l'autre sortie, non ronde, part vers une adresse neuve du même type que celle de la victime. La taille d'une sortie n'est pas un critère, et l'ordre des sorties est mélangé par les portefeuilles modernes. Le panneau « Rendu probable » de l'outil reprend ces raisons.`,
        },
        {
          id: 'o7', type: 'address', points: 8,
          prompt: 'Vers quelle adresse l\'escroc transfère-t-il d\'abord la totalité des fonds reçus ?',
          answer: [s2],
          hint: 'Dépliez les sorties de l\'adresse de l\'escroc : la transaction suivante n\'a qu\'une seule sortie.',
          explanation: `Quelques heures après le paiement, ${A(w, s1)} est vidée en une seule sortie vers ${A(w, s2)}. Une transaction sans rendu, qui envoie tout le solde vers une adresse non attribuée, est un simple saut au sein du portefeuille de l'escroc : il éloigne les fonds de l'adresse communiquée à la victime.`,
        },
        {
          id: 'o2', type: 'entity', points: 8,
          prompt: 'Sur quelle plateforme l\'escroc a-t-il déposé les bitcoins ?',
          answer: [destKey],
          hint: 'Suivez les fonds jusqu\'à une adresse dont l\'étiquette porte le nom d\'une plateforme.',
          explanation: `Après un saut par une seconde adresse, l'escroc envoie ${amt(depositReceived, 'BTC')} vers une adresse étiquetée « ${exName} — Adresse de dépôt ». Elle est ensuite balayée vers le hot wallet de ${exName}.`,
        },
        {
          id: 'o3', type: 'address', points: 12,
          prompt: 'Quelle adresse de dépôt faut-il citer dans la réquisition ?',
          answer: [deposit],
          hint: 'Pas le hot wallet : l\'adresse propre au client, juste avant le balayage.',
          explanation: `Sur Bitcoin, l'exchange attribue à chaque client une adresse de dépôt qui lui est propre : c'est elle qui permet à ${exName} de retrouver le titulaire du compte. Le hot wallet, lui, regroupe les fonds de milliers de clients et ne désigne personne.`,
        },
        {
          id: 'o9', type: 'tx', points: 10,
          prompt: 'Quelle transaction alimente l\'adresse de dépôt ? (elle sera citée dans la réquisition)',
          answer: [t3.id],
          hint: 'C\'est le carré situé juste avant l\'adresse de dépôt, entre la seconde adresse de l\'escroc et la plateforme.',
          explanation: `La transaction ${t3.hash.slice(0, 16)}… du ${fmtDate(t3.time)} dépense la seconde adresse de l'escroc et crédite l'adresse de dépôt de ${exName}. Une réquisition précise cite l'adresse de dépôt ET cette transaction (hash, date, montant) : la plateforme retrouve alors immédiatement l'opération et le compte crédité.`,
        },
        {
          id: 'o4', type: 'amount', points: 8, unit: 'BTC', tolerance: 0.005,
          prompt: 'Quel montant (en BTC) a été crédité sur cette adresse de dépôt ?',
          answer: depositReceived,
          hint: 'Ouvrez la transaction qui alimente l\'adresse de dépôt et lisez la sortie qui lui est destinée (pas le total de la transaction).',
          explanation: `${amt(depositReceived, 'BTC')}. Le reste de la transaction (${amt(leftover, 'BTC')}) est revenu à l'escroc sous forme de rendu, et une petite partie a payé les frais de réseau.`,
        },
        {
          id: 'o8', type: 'number', points: 8, unit: 'heures', tolerance: 1.5,
          prompt: 'Combien d\'heures se sont écoulées entre le paiement de la victime et le dépôt sur la plateforme ?',
          answer: delayH,
          hint: 'Le panneau de chaque transaction indique sa « Date (Paris) » : comparez la transaction de paiement et celle du dépôt.',
          explanation: `Paiement le ${fmtDate(t1.time)}, dépôt le ${fmtDate(t3.time)} : environ ${delayH.toLocaleString('fr-FR')} heures. Ce délai est typique : l'escroc encaisse dans la journée, avant que la victime ne comprenne. Pour l'enquêteur, cela situe la fenêtre de connexion au compte ${exName} à demander dans la réquisition (adresses IP autour du dépôt), et rappelle que chaque heure compte.`,
        },
        {
          id: 'o10', type: 'address', points: 8,
          prompt: 'Sur quelle adresse l\'escroc conserve-t-il encore une partie des fonds, jamais dépensée ?',
          answer: [s3],
          hint: 'La transaction de dépôt a deux sorties : l\'adresse de dépôt et une autre, non attribuée, qui revient à l\'escroc.',
          explanation: `${A(w, s3)} est le rendu de l'escroc dans la transaction de dépôt : ${amt(leftover, 'BTC')}, toujours là (solde non nul, aucune dépense). On la marque Suspect et on la place sous surveillance : si elle bouge, elle pourrait mener à un autre point d'encaissement. Contrairement à un stablecoin, du bitcoin ne se gèle pas à distance : seule une saisie, une fois le titulaire identifié, permettrait de le récupérer.`,
        },
        {
          id: 'o5', type: 'choice', points: 10,
          prompt: 'Quelle est la suite d\'enquête la plus pertinente ?',
          ...choice(r,
            `Requérir ${exName} sur l'adresse de dépôt (identité, IP, IBAN) et demander un blocage`,
            [
              `Requérir ${exName} sur son hot wallet, qui centralise l'ensemble des fonds reçus`,
              'Requérir Coinhouse, qui a vendu les bitcoins à la victime avant le paiement',
              'Clôturer le volet financier, les bitcoins devenant intraçables chez l\'exchange',
            ]),
          hint: 'Qui sait à quel client appartient l\'adresse de dépôt ?',
          explanation: `${exName} connaît le titulaire de l'adresse de dépôt (pièce d'identité, adresses IP de connexion, comptes bancaires liés, historique des retraits) et peut bloquer son compte. ${procedureFor(dest.entity)} Coinhouse n'a fait que vendre ses bitcoins à la victime : elle peut confirmer l'achat, pas identifier l'escroc.`,
        },
      ],
      truth: {
        path: [t1.id, t2.id, t3.id, sweep.id],
        addresses: [s1, s2, s3, deposit],
        debrief:
          `Ce qui s'est passé :\n\n` +
          `1. ${victimName} achète des bitcoins sur Coinhouse et les retire vers son portefeuille ${A(w, victim)}.\n` +
          `2. ${g('Il', 'Elle')} paie ${amt(amount, 'BTC')} à l'adresse du faux vendeur ${A(w, s1)}. Son portefeuille renvoie automatiquement la monnaie (le rendu, ${amt(changeValue, 'BTC')}) vers une nouvelle adresse à ${g('lui', 'elle')} (${A(w, victimChange)}) : sur Bitcoin, on dépense toujours une « pièce » entière.\n` +
          `3. L'escroc vide l'adresse vers une seconde adresse ${A(w, s2)} : un saut sans rendu, toute la somme part d'un bloc.\n` +
          `4. Environ ${delayH.toLocaleString('fr-FR')} heures après le paiement, il envoie ${amt(depositReceived, 'BTC')} sur l'adresse de dépôt ${exName} ${A(w, deposit)} (transaction ${t3.hash.slice(0, 12)}…) et garde ${amt(leftover, 'BTC')} en rendu sur ${A(w, s3)}, toujours non dépensés.\n` +
          `5. ${exName} balaie (sweep) l'adresse de dépôt vers son hot wallet, avec les dépôts d'autres clients : c'est la fin du traçage on-chain.\n\n` +
          `Les réflexes à retenir :\n\n` +
          `- Partir d'un fait sûr (l'adresse de la victime, sa plainte) et avancer saut par saut.\n` +
          `- Dans une transaction Bitcoin, distinguer le paiement (souvent un montant rond) du rendu (qui revient à l'émetteur, sur une adresse neuve du même type). Le rendu de la victime n'est pas une piste ; celui de l'escroc, si.\n` +
          `- S'arrêter à l'adresse de dépôt de l'exchange : c'est elle qu'on réquisitionne, en citant la transaction de dépôt (hash, date, montant), avec une demande de blocage. Suivre le hot wallet n'apporte plus rien.\n` +
          `- Noter les horaires : le délai entre paiement et dépôt mesure l'urgence et cadre la période des connexions à demander.\n` +
          `- Le reliquat resté chez l'escroc se surveille : s'il bouge, il peut révéler un autre point de sortie.\n` +
          `- Marquer au fil de l'eau (suspect, victime) : le rapport reprend ces marquages.`,
      },
      hints: [
        'Le guide flotte en haut à gauche du graphe. Le bouton « Je bloque » de chaque étape donne le chemin exact.',
        'Double-cliquer sur une adresse du graphe déplie ses sorties : les transactions qui dépensent ses bitcoins apparaissent, avec leurs destinataires.',
        'Une adresse dont l\'étiquette contient « Adresse de dépôt » appartient à une plateforme : c\'est là que le traçage on-chain s\'arrête.',
        'La date et l\'heure de chaque transaction figurent dans son panneau (« Date (Paris) ») : pratique pour mesurer un délai.',
      ],
      guide: [
        {
          title: 'Prenez vos repères',
          text:
            `Bienvenue ! Le **graphe** occupe le centre (vide pour l'instant). À gauche, le rail du **Dossier** ouvre ses onglets : Objectifs, Pièces, Marquages, Journal. Le panneau **Analyse** s'ouvre à droite dès que vous sélectionnez une adresse ou une transaction.\n\n` +
            `Le résumé de l'affaire est dans l'**Ordre de mission** (icône de presse-papiers dans le rail, ou menu **Outils**). Un enquêteur commence toujours par relire les faits : montant, date, adresse de la victime.\n\n` +
            `Ce guide flotte en haut à gauche du graphe ; cliquez son titre pour le replier. Suivez les étapes dans l'ordre, elles se valident toutes seules.`,
          check: { kind: 'manual' },
        },
        {
          title: 'Ajoutez l\'adresse de la victime au graphe',
          text:
            `Ouvrez l'onglet **Pièces** et dépliez la plainte. Les adresses et identifiants de transaction connus sont **surlignés** : un clic les ajoute au graphe.\n\n` +
            `Cliquez l'adresse du portefeuille de la victime. C'est notre point de départ : un fait établi par la plainte, pas une hypothèse.`,
          tip: 'Dossier (à gauche) ▸ onglet **Pièces** ▸ « Procès-verbal de plainte » ▸ cliquez l\'adresse surlignée en bleu après « L\'adresse de mon portefeuille ».',
          check: { kind: 'onGraph', address: victim },
        },
        {
          title: 'Lisez le panneau d\'adresse',
          text:
            `L'adresse est sélectionnée : le panneau **Analyse** (à droite) affiche son solde actuel, son nombre de transactions, le total reçu et envoyé. Elle est « non attribuée » : la base ne la connaît pas, c'est un portefeuille de particulier.\n\n` +
            `Dans l'onglet **Historique** du panneau, chaque ligne est une transaction : flèche verte = entrée, flèche rouge = sortie. Cliquez la transaction **entrante** venant de « Coinhouse — Hot Wallet » : c'est l'achat de la victime, qui confirme sa déclaration.`,
          tip: 'Si le panneau Analyse est fermé ou montre autre chose, cliquez le nœud de l\'adresse sur le graphe. Puis panneau Analyse ▸ onglet **Historique** ▸ cliquez la ligne à flèche verte « Coinhouse — Hot Wallet ».',
          check: { kind: 'selected', id: buyTx.id },
        },
        {
          title: 'Dépliez les sorties de la victime',
          text:
            `Le panneau affiche maintenant la transaction d'achat. Revenez à l'adresse de la victime : cliquez son nœud sur le graphe.\n\n` +
            `Pour voir où sont partis ses bitcoins, **dépliez ses sorties** : double-clic sur le nœud, ou bouton **Sorties** du panneau. Un petit carré apparaît (la transaction de paiement), relié à ses destinataires.`,
          tip: 'Double-cliquez le nœud de la victime sur le graphe. Autres chemins : clic droit sur le nœud ▸ « Déplier les sorties », ou bouton **Sorties** (flèche rouge) dans le panneau d\'adresse.',
          check: { kind: 'txRevealed', tx: t1.id },
        },
        {
          title: 'Ouvrez la transaction de paiement',
          text:
            `Cliquez le **carré** : le panneau affiche la transaction. Lisez ses **Entrées** (les bitcoins dépensés, venant de la victime) et ses **Sorties** (où ils vont). La différence entre les deux, ce sont les **Frais** payés aux mineurs.\n\n` +
            `Il y a deux sorties : le paiement de ${amt(amount, 'BTC')} (montant rond, celui de la plainte) et une autre somme qui **revient à la victime** : le **rendu**. Sur Bitcoin, on dépense des « pièces » entières et la monnaie revient sur une adresse neuve. La barre « Rendu probable » le signale. Le rendu n'est pas une piste : ne le suivez pas.`,
          tip: 'Cliquez le petit carré entre la victime et ses deux destinataires. Dans le panneau, dépliez la barre « Rendu probable » pour voir les raisons (type d\'adresse identique à l\'entrée, montant non rond…).',
          check: { kind: 'selected', id: t1.id },
        },
        {
          title: 'Marquez l\'adresse de l\'escroc',
          text:
            `L'adresse qui reçoit le montant rond est celle du faux vendeur : comparez-la avec celle du **message** dans les Pièces, c'est la même.\n\n` +
            `Marquez-la **Suspect**. Marquer au fur et à mesure évite de se perdre dans un graphe qui grandit, et le rapport final reprendra vos marquages.`,
          tip: 'Clic droit sur le nœud qui a reçu le montant rond ▸ « Marquer : Suspect ». Ou sélectionnez-le puis bouton **Marquer** du panneau ▸ Suspect.',
          check: { kind: 'flagged', address: s1, flag: 'suspect' },
        },
        {
          title: 'Répondez avec l\'adresse sélectionnée',
          text:
            `Faisons une pause pour remplir les premiers objectifs (en dessous de ce guide). Pour une réponse de type adresse, **sélectionnez l'adresse sur le graphe** puis cliquez **« Utiliser l'adresse sélectionnée »** dans l'objectif : pas de copier-coller, pas d'erreur de recopie.\n\n` +
            `Sélectionnez l'adresse de l'escroc (marquée Suspect) et utilisez-la pour l'objectif 1. En mission guidée, l'étape ne se valide que si la réponse est juste.`,
          tip: 'Cliquez le nœud marqué Suspect sur le graphe ▸ dans l\'objectif 1, bouton « Utiliser l\'adresse sélectionnée ».',
          check: { kind: 'correct', objective: 'o1' },
        },
        {
          title: 'Désignez le rendu de la victime',
          text:
            `Même méthode pour l'objectif 2 : sélectionnez l'**autre** sortie de la transaction de paiement, celle qui revient à la victime, puis « Utiliser l'adresse sélectionnée ».\n\n` +
            `Savoir reconnaître le rendu est la compétence de base du traçage Bitcoin : si on le prend pour un paiement, on part sur une fausse piste (ici, chez la victime elle-même !).`,
          tip: 'Cliquez le nœud non marqué relié au carré du paiement (montant non rond, adresse bc1q… comme la victime) ▸ objectif 2 ▸ « Utiliser l\'adresse sélectionnée ».',
          check: { kind: 'correct', objective: 'o6' },
        },
        {
          title: 'Pourquoi est-ce le rendu ?',
          text:
            `Objectif 3 : choisissez les indices qui justifient votre réponse. Relisez le panneau de la transaction : **montant** de chaque sortie (rond ou non), **type d'adresse** (bc1q…, 3…, 1…) comparé à celui de l'entrée, adresse **neuve** ou déjà utilisée.\n\n` +
            `Dans un rapport, on n'écrit jamais « c'est le rendu » sans dire pourquoi : ce sont ces indices que le magistrat lira.`,
          tip: 'Losange du paiement ▸ barre « Rendu probable » ▸ lisez les raisons listées. Puis cochez la réponse de l\'objectif 3 qui les reprend.',
          check: { kind: 'answered', objective: 'o11' },
        },
        {
          title: 'Suivez les fonds jusqu\'à la plateforme',
          text:
            `Continuez saut par saut : double-cliquez l'adresse suspecte. Ses bitcoins partent en totalité vers une **seconde adresse** de l'escroc (une seule sortie : pas de rendu). C'est un saut classique pour brouiller les pistes.\n\n` +
            `Double-cliquez cette seconde adresse à son tour. L'une des sorties porte une étiquette de plateforme : **« ${exName} — Adresse de dépôt »**. L'autre, non étiquetée, est le rendu de l'escroc.`,
          tip: 'Double-clic sur l\'adresse marquée Suspect, puis double-clic sur l\'adresse non attribuée qui apparaît à sa droite. Appuyez sur L pour réorganiser le graphe si les nœuds se chevauchent, et sur F pour tout recadrer.',
          check: { kind: 'onGraph', address: deposit },
        },
        {
          title: 'Désignez l\'adresse de rebond',
          text:
            `Sélectionnez la seconde adresse de l'escroc (celle qui a reçu tout le solde de l'adresse suspecte) et utilisez-la pour l'objectif 4. Marquez-la aussi **Suspect** : elle appartient au même portefeuille.`,
          tip: 'Clic sur le nœud situé entre l\'adresse suspecte et l\'adresse de dépôt ▸ objectif 4 ▸ « Utiliser l\'adresse sélectionnée ». Puis clic droit ▸ « Marquer : Suspect ».',
          check: { kind: 'correct', objective: 'o7' },
        },
        {
          title: 'Observez le balayage vers le hot wallet',
          text:
            `Double-cliquez l'adresse de dépôt. Quelques heures après le dépôt, ses fonds sont regroupés avec ceux d'autres adresses de dépôt vers le **« ${exName} — Hot Wallet »** : c'est un **balayage** (sweep), une opération interne de la plateforme.`,
          tip: 'Double-cliquez le nœud « ' + exName + ' — Adresse de dépôt » (ou clic droit ▸ « Déplier les sorties »).',
          check: { kind: 'txRevealed', tx: sweep.id },
        },
        {
          title: 'Adresse de dépôt ou hot wallet ?',
          text:
            `Point clé du métier. L'**adresse de dépôt** est attribuée à **un seul client** de ${exName} : la plateforme sait qui l'utilise (identité vérifiée, adresses IP, compte bancaire). Le **hot wallet** mélange les fonds de milliers de clients : le requérir ne désigne personne.\n\n` +
            `Le traçage on-chain s'arrête donc ici : on ne suit pas le hot wallet. La suite se joue par **réquisition** sur l'adresse de dépôt. Pour voir la fiche de la plateforme, sélectionnez l'adresse de dépôt puis ouvrez l'onglet **Entité** du panneau.`,
          check: { kind: 'manual' },
        },
        {
          title: 'Désignez l\'adresse de dépôt',
          text:
            `Objectif 6 : sélectionnez l'adresse de dépôt de ${exName}, puis « Utiliser l'adresse sélectionnée ».\n\n` +
            `Pour l'objectif 5, choisissez la plateforme dans la liste : elle figure dans le groupe « Entités présentes sur votre graphe ».`,
          tip: `Clic sur le nœud « ${exName} — Adresse de dépôt » ▸ objectif 6 ▸ « Utiliser l'adresse sélectionnée ». Objectif 5 : menu déroulant ▸ ${exName}.`,
          check: { kind: 'correct', objective: 'o3' },
        },
        {
          title: 'Citez la transaction de dépôt',
          text:
            `Une réquisition ne cite pas seulement une adresse : elle cite aussi la **transaction** de dépôt, pour que la plateforme retrouve l'opération sans ambiguïté.\n\n` +
            `Cliquez le **carré** juste avant l'adresse de dépôt, puis, dans l'objectif 7, **« Utiliser la transaction sélectionnée »**. Profitez-en pour lire son hash complet, sa date et ses sorties.`,
          tip: 'Clic sur le carré relié à « ' + exName + ' — Adresse de dépôt » (côté gauche) ▸ objectif 7 ▸ « Utiliser la transaction sélectionnée ».',
          check: { kind: 'correct', objective: 'o9' },
        },
        {
          title: 'Relevez le montant déposé',
          text:
            `Toujours dans cette transaction, lisez la **sortie** destinée à l'adresse de dépôt, pas le total : l'autre sortie est le rendu de l'escroc. Reportez le montant dans l'objectif 8 (la virgule est acceptée, ex. 0,0815).`,
          tip: 'Losange du dépôt ▸ section **Sorties** ▸ montant en face de « ' + exName + ' — Adresse de dépôt ». Recopiez-le dans l\'objectif 8.',
          check: { kind: 'correct', objective: 'o4' },
        },
        {
          title: 'Mesurez le délai',
          text:
            `Combien de temps l'escroc a-t-il attendu avant d'encaisser ? Ouvrez la transaction de **paiement** de la victime puis celle du **dépôt** : chacune affiche sa **Date (Paris)**. Calculez l'écart en heures (une marge d'une heure et demie est tolérée) et saisissez-le dans l'objectif 9.\n\n` +
            `Ce délai mesure l'urgence et indique à la plateforme sur quelle période rechercher les connexions du titulaire.`,
          tip: 'Clic sur le carré du paiement ▸ notez « Date (Paris) ». Clic sur le carré du dépôt ▸ notez sa date. Écart en heures (ex. de 10 h la veille à 14 h le lendemain = 28 h).',
          check: { kind: 'correct', objective: 'o8' },
        },
        {
          title: 'Repérez le reliquat',
          text:
            `La transaction de dépôt a une seconde sortie, non étiquetée : le **rendu de l'escroc**. Cliquez-la : son **Solde actuel** n'est pas nul et elle n'a jamais été dépensée. L'escroc détient donc encore une partie des fonds.\n\n` +
            `Marquez-la **Suspect** et désignez-la dans l'objectif 10. Ce rendu-là, contrairement à celui de la victime, est une piste : s'il bouge un jour, il peut mener à un autre point d'encaissement.`,
          tip: 'Clic sur le nœud non étiqueté relié au carré du dépôt (pas l\'adresse de dépôt) ▸ objectif 10 ▸ « Utiliser l\'adresse sélectionnée ».',
          check: { kind: 'correct', objective: 'o10' },
        },
        {
          title: 'Terminez et remettez le rapport',
          text:
            `Objectif 11 : choisissez la suite d'enquête, en vous appuyant sur l'étape « Adresse de dépôt ou hot wallet ? ». Quand tout est rempli, cliquez **Remettre le rapport** : le débriefing explique chaque réponse.`,
          tip: 'Cochez une réponse à l\'objectif 11, puis bouton **Remettre le rapport** en bas de l\'onglet Objectifs.',
          check: { kind: 'answered', objective: 'o5' },
        },
      ],
    }
  },
}
