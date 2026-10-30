import { World, type Tx } from '../engine/world'
import { lnCustodial, openChannel, roundCoin, HOUR, DAY, type LnRecord } from '../engine/patterns'
import { fromUsd, roundAsset, usd } from '../engine/chains'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, fakeCity, fakeHandle, fakePerson, fmtDate, procedureFor } from './util'

const r8 = (v: number) => Math.round(v * 1e8) / 1e8
const btc = (v: number) => amt(r8(v), 'BTC')
const SAT = 1e8
const sats = (v: number) => Math.round(v * SAT)
const fmtSat = (n: number) => n.toLocaleString('fr-FR')

export const btcLightningCashout: ScenarioTemplate = {
  id: 'lightning-cashout',
  title: 'Sortie par Lightning',
  tagline: 'Des canaux qui s\'ouvrent et se ferment, des paiements invisibles, et un prestataire qui, lui, a tout noté.',
  description:
    'Le produit d\'une campagne de sextorsion part dans le réseau Lightning : des canaux ouverts avec un fournisseur de liquidité, des paiements hors chaîne, des fermetures de canal, puis un retour vers la blockchain. Distinguez ce que la blockchain montre de ce qu\'elle tait, reconstituez les entrées et sorties on-chain et identifiez le prestataire qui détient l\'historique des paiements.',
  difficulty: 4,
  chains: ['btc'],
  skills: ['utxo', 'lecture_tx', 'privacy', 'exchange_id', 'requisition'],
  estMinutes: 80,
  lessons: ['lightning', 'requisitions', 'cooperation-internationale', 'typologies', 'utxo'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const city = fakeCity(r)
    const sp = fakePerson(r)
    const ge = sp.g
    const handle = fakeHandle(r)
    const complainant = fakePerson(r, 'm')

    const vp = lnCustodial(w, 'voltpocket')
    const lumen = w.entity('lumen_lsp')
    const suspect = w.customEntity({ name: `${sp.name} (mis en cause)`, category: 'suspect' })
    const victimE = w.customEntity({ name: complainant.name, category: 'victim' })
    const mine = (kind: 'p2wpkh' | 'p2tr' = 'p2wpkh') => w.addr('btc', { entity: suspect, kind })

    // ── Paiements des victimes de sextorsion (adresse unique réutilisée) ─────
    const S = mine()
    const nV = r.int(12, 17)
    const named = r.int(2, 6)
    const pays: { tx: Tx; value: number; time: number }[] = []
    let t = w.at(0)
    for (let i = 0; i < nV; i++) {
      const va = i === named ? w.addr('btc', { entity: victimE, kind: 'p2wpkh' }) : w.addr('btc')
      const value = roundAsset('BTC', fromUsd('BTC', r.float(350, 1600)))
      pays.push({ tx: w.fund(S, value, t, { from: [va] }), value, time: t })
      t += Math.round(r.float(0.4, 2.2) * DAY)
    }
    const victimPay = pays[named]
    const demand = victimPay.value
    const totalVictims = r8(pays.reduce((s, p) => s + p.value, 0))

    // ── Canal 1 : ouvert à mi-campagne depuis l'adresse de collecte ──────────
    const k1 = Math.floor(nV * 0.5)
    const tOpen1 = pays[k1].time + Math.round(r.float(3, 12) * HOUR)
    const cap1 = Math.max(0.01, Math.floor((w.unspentValue(S, tOpen1) * r.float(0.75, 0.9)) / 0.005) * 0.005)
    const S2 = mine()
    const ch1 = openChannel(w, { from: S, peer: lumen, capacity: r8(cap1), time: tOpen1, change: S2 })

    // ── Regroupement puis canal 2 ────────────────────────────────────────────
    const tCons = pays[nV - 1].time + Math.round(r.float(6, 30) * HOUR)
    const S3 = mine()
    const consIn = w.unspentValue(S, tCons) + w.unspentValue(S2, tCons)
    const consN = w.utxosOf(S, tCons).length + w.utxosOf(S2, tCons).length
    const consFee = w.estimateFee('btc', consN, 1)
    const consTx = w.utxoTx({ time: tCons, from: [S, S2], to: [{ address: S3, value: r8(consIn - consFee) }], fee: consFee, change: null, spendAll: true })
    const tOpen2 = tCons + Math.round(r.float(1, 8) * HOUR)
    const cap2 = Math.max(0.01, Math.floor((w.unspentValue(S3, tOpen2) * r.float(0.85, 0.95)) / 0.005) * 0.005)
    const S4 = mine()
    const ch2 = openChannel(w, { from: S3, peer: lumen, capacity: r8(cap2), time: tOpen2, change: S4 })

    // ── Paiements Lightning (hors chaîne) vers le compte custodial ───────────
    const acct = `VP-${r.int(100000, 999999)}`
    const lnIn: LnRecord[] = []
    const lnOut: LnRecord[] = []
    const payIn = (time: number, satsV: number) => lnIn.push(vp.pay({ time, account: acct, sats: satsV, direction: 'receive', description: r.pick(['recharge', 'top-up', '', 'épargne']) }))
    const tClose1 = tOpen2 + Math.round(r.float(1, 3) * DAY)
    const via1 = Math.round(sats(cap1) * r.float(0.4, 0.6) / 1000) * 1000
    const n1 = r.int(2, 3)
    for (let i = 0; i < n1; i++) payIn(Math.round(r.float(tOpen1 + 2 * HOUR, tClose1 - 2 * HOUR)), Math.round(via1 / n1))
    const tClose2 = tOpen2 + Math.round(r.float(4, 8) * DAY)
    const via2 = Math.round(sats(cap2) * r.float(0.3, 0.5) / 1000) * 1000
    const n2 = r.int(2, 3)
    for (let i = 0; i < n2; i++) payIn(Math.round(r.float(tOpen2 + 2 * HOUR, tClose2 - 2 * HOUR)), Math.round(via2 / n2))

    // ── Fermetures ───────────────────────────────────────────────────────────
    const C1 = mine()
    const coopTx = ch1.cooperativeClose({ time: tClose1, toLocal: r8(cap1 - (n1 * Math.round(via1 / n1)) / SAT - 0.00002), localAddr: C1 })
    const C2 = mine(r.pick(['p2wpkh', 'p2tr'] as const))
    const fc = ch2.forceClose({ time: tClose2, toLocal: r8(cap2 - (n2 * Math.round(via2 / n2)) / SAT - 0.00002), by: 'local', sweepTo: C2 })
    const sweepTx = fc.sweepTx!
    const c1Value = coopTx.outputs.find((o) => o.address === C1)!.value
    const c2Value = sweepTx.outputs[0].value
    const recovered = r8(c1Value + c2Value)

    // ── Dépôt on-chain sur le compte custodial, puis retrait ─────────────────
    const tDep = tClose1 + Math.round(r.float(2, 10) * HOUR)
    const dep = vp.deposit(C1, r8(w.unspentValue(C1, tDep) - 0.00005), tDep, { change: null, sweepDelayH: r.float(0.5, 4) })
    const depValue = dep.tx.outputs.find((o) => o.address === dep.deposit)!.value
    // Dépenses depuis le compte custodial (cartes cadeaux, abonnements)
    for (let i = 0; i < r.int(2, 4); i++) {
      const eur = r.pick([25, 50, 100, 150, 200])
      lnOut.push(vp.pay({ time: Math.round(r.float(tDep + HOUR, tClose2 + 20 * HOUR)), account: acct, sats: sats(fromUsd('BTC', eur * 1.08)), direction: 'send', counterparty: 'nœud marchand', description: r.pick([`carte cadeau ${eur} €`, `bon d'achat ${eur} €`, `abonnement VPN`, `crédit jeu en ligne ${eur} €`]) }))
    }
    const balanceSat = sats(depValue) + lnIn.reduce((s, x) => s + x.sats, 0) - lnOut.reduce((s, x) => s + x.sats, 0)
    const wSat = Math.floor(balanceSat * r.float(0.86, 0.95) / 1000) * 1000
    const tW = Math.max(sweepTx.time, ...lnOut.map((x) => x.time)) + Math.round(r.float(10, 50) * HOUR)
    const W = mine(r.pick(['p2wpkh', 'p2tr'] as const))
    const wTx = vp.withdraw(W, wSat / SAT, tW)

    // ── Bruit : autres clients du service, autres canaux du LSP, coffre multisig ──
    vp.noise(14, w.at(-5 * 24), tW + 4 * DAY)
    // Retraits d'autres clients, de montant voisin, autour du retrait du suspect
    for (let i = 0; i < r.int(2, 3); i++) {
      vp.withdraw(w.addr('btc'), r8(Math.round((wSat / SAT) * r.float(0.9, 1.1) * 1e5) / 1e5), tW + Math.round(r.float(-30, 30) * HOUR))
    }
    const otherChannels: Tx[] = []
    for (let i = 0; i < r.int(2, 4); i++) {
      const u = w.addr('btc', { kind: 'p2wpkh' })
      const cap = roundCoin(w, 0.01, 0.15, 0.005)
      const to = Math.round(r.float(w.at(-10 * 24), tW))
      w.fund(u, r8(cap + r.float(0.001, 0.05)), to - Math.round(r.float(2, 72) * HOUR))
      const oc = openChannel(w, { from: u, peer: lumen, capacity: r8(cap), time: to })
      otherChannels.push(oc.tx)
      if (r.chance(0.6)) oc.cooperativeClose({ time: to + Math.round(r.float(1, 20) * DAY), toLocal: r8(cap * r.float(0.1, 0.9)) })
    }
    const vaultOwner = w.addr('btc', { kind: 'p2wpkh' })
    const vault = w.addr('btc', { kind: 'p2wsh' })
    const tVault = Math.round(r.float(tOpen1, tW))
    w.fund(vaultOwner, roundCoin(w, 0.3, 1.2, 0.01), tVault - Math.round(r.float(5, 40) * DAY))
    w.utxoTx({ time: tVault, from: [vaultOwner], to: [{ address: vault, value: roundCoin(w, 0.2, 0.25, 0.01) }] })

    const tArrest = tW + Math.round(r.float(4, 14) * DAY)
    const tExtract = tArrest + Math.round(r.float(3, 8) * DAY)
    const fmtCsv = (ts: number) => new Date(ts * 1000).toISOString().slice(0, 16).replace('T', ' ')
    const rows: { time: number; line: string }[] = [
      ...vp.records.map((x) => ({ time: x.time, line: `${fmtCsv(x.time)};ln_${x.direction === 'receive' ? 'reçu' : 'envoyé'};${x.direction === 'receive' ? '+' : '-'}${x.sats};${x.paymentHash.slice(0, 16)}…;${x.description ?? ''}` })),
      { time: dep.tx.time, line: `${fmtCsv(dep.tx.time)};dépôt_onchain;+${sats(depValue)};—;confirmé` },
      { time: wTx.time, line: `${fmtCsv(wTx.time)};retrait_onchain;-${wSat};—;envoyé (frais réseau inclus)` },
    ].sort((a, b) => a.time - b.time)

    return {
      world: w,
      title: `Sextorsion et Lightning — ${city}`,
      briefing:
        `Une campagne de courriels de sextorsion (« j'ai piraté votre webcam, payez ou j'envoie la vidéo à vos contacts ») a visé des milliers d'adresses électroniques francophones. ${nV} paiements ont été identifiés sur l'adresse bitcoin réutilisée dans les messages. ${complainant.name} (${city}) a payé et porté plainte.\n\n` +
        `Les investigations ont conduit à l'interpellation de ${sp.name}, ${ge('connu', 'connue')} sous le pseudonyme @${handle}. En audition, ${ge('il', 'elle')} affirme avoir « tout passé en Lightning, donc intraçable ». L'exploitation de son ordinateur a permis de retrouver un fichier d'export d'un portefeuille Lightning, sans nom de service.\n\n` +
        `Reconstituez la partie visible du circuit : ouvertures et fermetures de canaux, fonds récupérés on-chain, prestataire custodial et retrait final. Mesurez aussi ce qui restera hors de portée de la blockchain.`,
      evidence: [
        {
          id: 'mail', type: 'email', title: 'Courriel de sextorsion reçu par le plaignant', date: victimPay.time - Math.round(r.float(5, 30) * HOUR), author: 'expéditeur usurpé (adresse du destinataire)',
          body:
            `Bonjour,\nJ'ai pris le contrôle de votre appareil il y a plusieurs mois et j'ai enregistré une vidéo de vous pendant que vous visitiez certains sites.\n` +
            `Pour que cette vidéo ne soit pas envoyée à tous vos contacts, transférez ${btc(demand)} à l'adresse suivante :\n${A(w, S)}\n` +
            `Vous avez 48 heures. Ne répondez pas à ce message.`,
        },
        {
          id: 'plainte', type: 'plainte', title: 'Procès-verbal de plainte (extrait)', date: victimPay.time + Math.round(r.float(1, 4) * DAY), author: complainant.name,
          body: `« J'ai paniqué et j'ai payé. J'ai acheté les bitcoins sur une application et j'ai envoyé ${btc(victimPay.value)} le ${fmtDate(victimPay.time)}. La transaction est ${victimPay.tx.hash}. Je me rends compte que c'était une arnaque : je n'ai jamais eu de webcam sur cet ordinateur. »`,
        },
        {
          id: 'audition', type: 'pv', title: `Procès-verbal d'audition de ${sp.name} (extrait)`, date: tArrest + Math.round(r.float(5, 20) * HOUR), author: 'Section de recherches',
          body:
            `Question : Que sont devenus les bitcoins reçus sur l'adresse figurant dans les courriels ?\n` +
            `Réponse : Je les ai mis sur Lightning. J'ai ouvert des canaux avec un fournisseur, j'ai payé des trucs, j'ai tout refermé. Sur Lightning, personne ne voit rien.\n` +
            `Question : Combien de canaux avez-vous ouverts, et avec qui ?\n` +
            `Réponse : Un ou deux, je ne sais plus. Avec le fournisseur proposé par défaut dans l'application.\n` +
            `Question : Où sont les fonds aujourd'hui ?\n` +
            `Réponse : Il ne reste rien.`,
        },
        {
          id: 'csv', type: 'releve', title: 'Fichier d\'export retrouvé sur l\'ordinateur (scellé n° 2) — relevé d\'opérations', date: tExtract, author: 'Cellule d\'appui numérique',
          body:
            `Fichier « export_operations.csv », dossier Téléchargements. Aucun nom de service dans le fichier ; horodatage en UTC.\n` +
            `Compte : ${acct}\n\n` +
            `date;type;montant_sat;hash_paiement;description\n` +
            rows.map((x) => x.line).join('\n'),
        },
        {
          id: 'fiche', type: 'note', title: 'Fiche technique — Lightning vu de la blockchain', date: tArrest - 60 * DAY, author: 'Groupe d\'appui crypto-actifs',
          body:
            `- Ouverture de canal : une transaction dont une sortie est un script P2WSH (multisignature 2-de-2 entre les deux pairs).\n` +
            `- Fermeture coopérative : la sortie du canal est dépensée vers une ou deux adresses ordinaires, sans délai.\n` +
            `- Fermeture forcée : la sortie du canal est dépensée par une transaction d'engagement ; le solde de celui qui force est bloqué sur une sortie à délai (souvent 144 blocs), puis récupéré par une seconde transaction ; deux petites sorties de 330 sats (« ancres ») servent à relever les frais.\n` +
            `- Un portefeuille Lightning custodial fonctionne comme un compte : dépôts et retraits on-chain, paiements internes inscrits dans ses propres registres.`,
        },
      ],
      seeds: [],
      objectives: [
        {
          id: 'o8', type: 'amount', points: 8, unit: 'BTC', tolerance: 0.01,
          prompt: 'Montant total (en BTC) versé par les victimes sur l\'adresse de collecte indiquée dans les courriels ?',
          answer: totalVictims,
          hint: 'Ouvrez l\'adresse du courriel et additionnez toutes ses entrées : les paiements s\'étalent sur plusieurs jours, avant et après sa première dépense.',
          explanation: `${nV} paiements entre le ${fmtDate(pays[0].time, false)} et le ${fmtDate(pays[nV - 1].time, false)}, de ${btc(Math.min(...pays.map((p) => p.value)))} à ${btc(Math.max(...pays.map((p) => p.value)))}, soit ${btc(totalVictims)} (≈ ${Math.round(usd('BTC', totalVictims)).toLocaleString('fr-FR')} $). C'est la base du préjudice global et du produit de l'infraction : chaque paiement est une victime potentielle à identifier (par le service qui lui a vendu les bitcoins) et à entendre.`,
        },
        {
          id: 'o1', type: 'tx', points: 10,
          prompt: 'Identifiez une transaction d\'ouverture de canal Lightning financée avec les fonds des victimes.',
          answer: [ch1.tx.id, ch2.tx.id],
          hint: 'Suivez les sorties de l\'adresse indiquée dans le courriel : cherchez une sortie de type script (P2WSH) de montant rond. L\'inspecteur affiche un badge « Lightning ».',
          explanation: `Deux ouvertures : ${btc(cap1)} le ${fmtDate(ch1.tx.time)} directement depuis l'adresse de collecte, puis ${btc(cap2)} le ${fmtDate(ch2.tx.time)} après un regroupement (${consTx.hash.slice(0, 12)}…). Chaque fois, une sortie P2WSH (2-de-2 avec le nœud de ${lumen.name}) et un rendu vers le portefeuille du suspect. Attention : un coffre multisignature a la même apparence (une telle sortie, jamais dépensée, existe dans le bruit) ; c'est la fermeture ultérieure, et l'attribution du pair, qui confirment le canal.`,
        },
        {
          id: 'o9', type: 'address', points: 8,
          prompt: 'Avant l\'ouverture du second canal, sur quelle adresse le suspect regroupe-t-il le reste de l\'adresse de collecte et le rendu du premier canal ?',
          answer: [S3],
          hint: 'Après le dernier paiement de victime, l\'adresse de collecte est dépensée avec une autre adresse du suspect dans une transaction à une seule sortie.',
          explanation: `${consTx.hash.slice(0, 14)}… dépense ensemble l'adresse de collecte et ${A(w, S2)} (rendu de l'ouverture du premier canal) vers ${A(w, S3)}. Par entrées communes, le rendu du premier canal est rattaché au suspect ; et c'est ${A(w, S3)} qui finance, quelques heures plus tard, l'ouverture du second canal (${btc(cap2)}), avec un nouveau rendu sur ${A(w, S4)}.`,
        },
        {
          id: 'o2', type: 'choice', points: 12,
          prompt: 'Comment le second canal ouvert par le suspect a-t-il été fermé ?',
          ...choice(r,
            'Fermeture forcée par le suspect : son solde a été bloqué par un délai puis récupéré',
            [
              'Fermeture coopérative : les deux pairs ont signé ensemble la répartition du solde',
              'Fermeture forcée par le fournisseur : le solde du suspect lui revient immédiatement',
              'Transaction de pénalité : le fournisseur a sanctionné la diffusion d\'un ancien état',
            ]),
          hint: 'Ouvrez la transaction qui dépense la sortie du canal : quelles sorties sont des scripts, lesquelles sont attribuées, laquelle est dépensée plus tard ?',
          explanation: `La transaction d'engagement ${fc.commitTx.hash.slice(0, 12)}… verse la part du fournisseur immédiatement sur une adresse ${lumen.name}, place ${btc(fc.commitTx.outputs.find((o) => o.address === fc.delayed)!.value)} sur une sortie P2WSH à délai et ajoute deux ancres de 330 sats ; son nLockTime commence par 0x20. La sortie à délai est récupérée ${Math.round((sweepTx.time - fc.commitTx.time) / HOUR)} h plus tard (délai CSV de 144 blocs) vers ${A(w, C2)}, adresse non attribuée : c'est le diffuseur, donc le suspect, qui a forcé la fermeture. Une pénalité aurait tout attribué à une seule partie.`,
        },
        {
          id: 'o10', type: 'number', points: 8, tolerance: 1, unit: 'heures',
          prompt: 'Combien d\'heures séparent la transaction d\'engagement (fermeture forcée) de la récupération de la sortie à délai ?',
          answer: (sweepTx.time - fc.commitTx.time) / HOUR,
          hint: 'Comparez l\'horodatage de la transaction qui dépense la sortie du second canal et celui de la transaction qui dépense ensuite sa sortie P2WSH à délai.',
          explanation: `Engagement le ${fmtDate(fc.commitTx.time)}, récupération le ${fmtDate(sweepTx.time)} : environ ${Math.round((sweepTx.time - fc.commitTx.time) / HOUR)} h. Le délai CSV de 144 blocs (≈ 24 h à 10 min par bloc) laisse au pair le temps de contester un état périmé ; le diffuseur ne peut récupérer qu'ensuite. Ce délai, mesuré sur la chaîne, confirme que la sortie à délai appartenait à celui qui a forcé la fermeture, et date le moment où les fonds redeviennent disponibles : une fenêtre utile si l'on veut agir avant leur récupération.`,
        },
        {
          id: 'o3', type: 'amount', points: 12, unit: 'BTC', tolerance: 0.005,
          prompt: 'Combien de BTC le suspect a-t-il récupérés on-chain à la fermeture de ses deux canaux (hors part du fournisseur) ?',
          answer: recovered,
          hint: 'Fermeture coopérative : une sortie pour chaque pair (celle du fournisseur est attribuée). Fermeture forcée : comptez ce que le suspect récupère réellement, après le délai.',
          explanation: `${btc(c1Value)} à la fermeture coopérative (vers ${A(w, C1)}) et ${btc(c2Value)} récupérés après la fermeture forcée (vers ${A(w, C2)}), soit ${btc(recovered)}. Pour mémoire, ${btc(r8(cap1 + cap2))} avaient été engagés dans les canaux : la différence correspond aux paiements effectués hors chaîne (revenus au fournisseur, qui les a routés) et aux frais.`,
        },
        {
          id: 'o5', type: 'tx', points: 10,
          prompt: 'Quelle transaction on-chain correspond à la ligne « dépôt_onchain » du fichier d\'export ?',
          answer: [dep.tx.id],
          hint: 'Le montant du fichier est en satoshis (1 BTC = 100 000 000 sats) et l\'heure en UTC. Partez de l\'adresse qui reçoit le solde du suspect à la fermeture coopérative.',
          explanation: `${dep.tx.hash.slice(0, 16)}… envoie ${btc(depValue)} (${fmtSat(sats(depValue))} sats) depuis ${A(w, C1)}, le ${fmtDate(dep.tx.time)}, vers ${A(w, dep.deposit)}. Montant au satoshi près et heure identiques à la ligne du fichier : le compte ${acct} appartient bien au détenteur de l'ordinateur.`,
        },
        {
          id: 'o4', type: 'entity', points: 12,
          prompt: 'Quel prestataire faut-il requérir pour obtenir l\'identité du titulaire du compte décrit dans le fichier d\'export et l\'historique complet de ses paiements ?',
          answer: ['voltpocket'],
          hint: 'Rapprochez la ligne « dépôt_onchain » du fichier d\'une transaction on-chain du suspect (montant et heure), puis regardez qui contrôle l\'adresse de destination.',
          explanation: `Le dépôt du fichier correspond au versement des fonds de la fermeture coopérative sur une adresse de dépôt ${vp.entity.name}, balayée vers son portefeuille chaud. ${vp.entity.name} est un portefeuille Lightning custodial : contrairement au fournisseur de liquidité, il tient un registre de chaque paiement (facture, hash, date, montant) et des connexions. ${procedureFor(vp.entity)} ${lumen.name} peut compléter (dates des canaux, identifiant de nœud, IP), mais ne connaît ni l'identité ni les paiements au-delà du saut suivant.`,
        },
        {
          id: 'o11', type: 'number', points: 10, tolerance: 0, unit: 'sats',
          prompt: 'D\'après le fichier d\'export, combien de satoshis le compte a-t-il reçus au total par Lightning (hors dépôt on-chain) ?',
          answer: lnIn.reduce((s, x) => s + x.sats, 0),
          hint: 'Dans le relevé, additionnez uniquement les lignes « ln_reçu » ; le dépôt on-chain est une ligne à part.',
          explanation: `${lnIn.length} paiements Lightning reçus pour ${fmtSat(lnIn.reduce((s, x) => s + x.sats, 0))} sats. Ils tombent pendant que les deux canaux sont ouverts et totalisent à peu près la différence entre la capacité engagée et ce que le suspect récupère à la fermeture : le suspect s'est payé lui-même, à travers le fournisseur de liquidité, sur son propre compte custodial. Aucun de ces paiements n'est visible on-chain : seul le relevé (et le registre du service) les établit.`,
        },
        {
          id: 'o12', type: 'number', points: 10, tolerance: 1, unit: 'sats',
          prompt: 'D\'après le fichier d\'export, quel solde (en satoshis) reste sur le compte custodial après le retrait on-chain ?',
          answer: balanceSat - wSat,
          hint: 'Solde = dépôt on-chain + paiements reçus − paiements envoyés − retrait on-chain, ligne par ligne.',
          explanation: `${fmtSat(sats(depValue))} (dépôt) + ${fmtSat(lnIn.reduce((s, x) => s + x.sats, 0))} (reçus) − ${fmtSat(lnOut.reduce((s, x) => s + x.sats, 0))} (dépenses) − ${fmtSat(wSat)} (retrait) = ${fmtSat(balanceSat - wSat)} sats, soit ${btc((balanceSat - wSat) / SAT)}. Contrairement à ce que déclare le suspect (« il ne reste rien »), ce solde est toujours détenu par le prestataire pour son compte : il doit figurer dans la réquisition, avec une demande de gel conservatoire, selon la voie de coopération applicable.`,
        },
        {
          id: 'o6', type: 'address', points: 12,
          prompt: 'Sur quelle adresse le retrait on-chain mentionné dans le fichier d\'export a-t-il été versé ?',
          answer: [W],
          hint: `Cherchez, parmi les paiements du portefeuille chaud du service, celui qui correspond au montant et à l'heure du retrait. Le corrélateur (sans filtre d'émetteur, chaîne Bitcoin, fenêtre courte, tolérance faible) fonctionne aussi.`,
          explanation: `Le ${fmtDate(wTx.time)}, le portefeuille chaud de ${vp.entity.name} verse ${btc(wSat / SAT)} (${fmtSat(wSat)} sats) à ${A(w, W)}. D'autres clients reçoivent des montants voisins le même jour, mais un seul correspond au satoshi et à la minute. Les fonds y sont toujours : surveillance de l'adresse et saisie à envisager (la clé est sur les supports du suspect, ce qui contredit sa déclaration « il ne reste rien »).`,
        },
        {
          id: 'o7', type: 'choice', points: 10,
          prompt: 'Dans ce dossier, qu\'est-ce que la blockchain Bitcoin ne permet pas de voir ?',
          ...choice(r,
            'Les paiements faits dans les canaux : leurs montants, leurs dates et leurs destinataires',
            [
              'La capacité de chaque canal et l\'adresse qui a financé son ouverture',
              'Les adresses où le suspect a récupéré ses fonds à la fermeture des canaux',
              'Le montant revenu au fournisseur de liquidité lors de chaque fermeture',
            ]),
          hint: 'Reprenez ce que vous avez établi sur le graphe (ouvertures, fermetures, récupérations), puis ce que seul le fichier d\'export vous a appris.',
          explanation: `Ouvertures, capacités, fermetures, répartition finale et adresses de récupération sont visibles on-chain. Les paiements dans les canaux, eux, sont hors chaîne et routés en oignon : seuls les prestataires qui les voient passer (portefeuille custodial du destinataire, nœuds de routage pour le saut suivant) en gardent une trace. D'où l'importance des réquisitions et de l'exploitation des supports (fichier d'export, base de données du nœud ou de l'application).`,
        },
      ],
      truth: {
        path: [
          ...pays.map((p) => p.tx.id), ch1.tx.id, consTx.id, ch2.tx.id, coopTx.id, fc.commitTx.id, sweepTx.id,
          dep.tx.id, ...(dep.sweep ? [dep.sweep.id] : []), wTx.id,
        ],
        addresses: [S, S2, S3, S4, ch1.funding, ch2.funding, C1, C2, dep.deposit, W, fc.delayed],
        debrief:
          `1. ${nV} victimes paient au total ${btc(totalVictims)} sur ${A(w, S)}.\n` +
          `2. À mi-campagne, ${btc(cap1)} servent à ouvrir un canal avec ${lumen.name} ; plus tard, le reste est regroupé et ouvre un second canal de ${btc(cap2)} (regroupement sur ${A(w, S3)}).\n` +
          `3. Hors chaîne, le suspect paie ${lnIn.length} factures émises par son propre compte ${vp.entity.name} (${acct}) pour ${fmtSat(lnIn.reduce((s, x) => s + x.sats, 0))} sats, puis dépense une partie de ce compte en cartes cadeaux et services. Rien de tout cela n'apparaît on-chain.\n` +
          `4. Le premier canal est fermé de façon coopérative (${btc(c1Value)} pour le suspect) ; le second est fermé de force par le suspect (${btc(c2Value)} récupérés après le délai).\n` +
          `5. Les fonds de la fermeture coopérative sont déposés on-chain sur le compte ${vp.entity.name}, qui verse enfin ${btc(wSat / SAT)} sur ${A(w, W)}, où ils dorment encore. D'après le relevé, ${fmtSat(balanceSat - wSat)} sats restent en outre sur le compte custodial : deux cibles de gel et de saisie, contrairement à « il ne reste rien ».\n\n` +
          `À retenir : Lightning n'efface pas tout. Les entrées et sorties du réseau sont des transactions Bitcoin ordinaires, reconnaissables à leur structure (sortie P2WSH, ancres, délais). Ce qui se passe entre les deux est invisible on-chain, mais pas forcément perdu : les prestataires custodiaux tiennent des registres, et les supports saisis (exports, bases de données de nœud) en contiennent souvent une copie. L'identification d'un canal reste une présomption tant qu'elle n'est pas confirmée par la fermeture, l'attribution du pair ou une réquisition.`,
      },
      hints: [
        'Partez de l\'adresse du courriel de sextorsion et dépliez ses sorties : une sortie de type script (P2WSH) au montant rond signe une ouverture de canal probable.',
        'Suivez chaque sortie de canal jusqu\'à sa dépense : une ou deux sorties ordinaires sans délai = fermeture coopérative ; sortie à délai et ancres de 330 sats = fermeture forcée.',
        'Le fichier d\'export ne nomme pas le service : rapprochez ses lignes on-chain (montant en sats, heure UTC) des transactions du suspect.',
        'Le retrait final est payé par le portefeuille chaud du service : cherchez le paiement exact au satoshi près, à la minute indiquée.',
        'Le relevé d\'opérations est un livre de compte : en additionnant ses lignes, on reconstitue ce qui est passé par Lightning et ce qui reste chez le prestataire.',
      ],
    }
  },
}
