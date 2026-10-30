import { World, type Tx } from '../engine/world'
import { exchange, mixer, person, roundCoin, roundUsdAmount, HOUR, DAY, type ExchangeKit } from '../engine/patterns'
import { usd } from '../engine/chains'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, fakeCity, fakePerson, fmtDate, forwardAll, procedureFor } from './util'

const r8 = (v: number) => Math.round(v * 1e8) / 1e8
/** Arrondi par défaut à 8 décimales : la sortie ne dépasse jamais les entrées. */
const f8 = (v: number) => Math.floor(v * 1e8) / 1e8

type Src = 'coinhouse' | 'coinbase' | 'kraken' | 'huobex' | 'person' | 'repeat'
const REGULATED: Src[] = ['coinhouse', 'coinbase', 'kraken']

const GROUPS = ['Collectif Granit', 'Cercle Basalte', 'Mouvement Orage', 'Front Silex']

export const btcDonationFunding: ScenarioTemplate = {
  id: 'donation-funding',
  title: 'Collecte de fonds illicite sur les réseaux sociaux',
  tagline: 'Adresses rotatives, petits dons, un portefeuille unique : remonter de la publication aux donateurs.',
  description:
    'Un groupuscule violent dissous continue de lever des fonds en bitcoins sur Telegram et X, en changeant régulièrement d\'adresse. Reliez les adresses successives au même portefeuille, chiffrez la collecte, repérez les dons issus de plateformes régulées, choisissez la bonne réquisition, localisez la sortie vers un mixeur et rédigez avec prudence ce que l\'on sait des donateurs.',
  difficulty: 2,
  chains: ['btc'],
  skills: ['cioh', 'osint', 'exchange_id', 'requisition', 'typologies'],
  estMinutes: 45,
  lessons: ['osint', 'clustering', 'attribution-sources', 'exposition-risque', 'requisitions'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const city = fakeCity(r)
    const groupName = r.pick(GROUPS)
    const slug = groupName.toLowerCase().replace(/^\S+ /, '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    const tgChannel = `${groupName} — Soutien`
    const xHandle = `@${slug}_${r.pick(['info', 'media', 'fr'])}`
    const xCopy = `@${slug}_officiel`
    const dissolvedT = w.at(-r.float(150, 260) * 24)

    // ── Acteurs ──────────────────────────────────────────────────────────────
    const kits: Record<'coinhouse' | 'coinbase' | 'kraken' | 'huobex', ExchangeKit> = {
      coinhouse: exchange(w, 'coinhouse', 'btc'),
      coinbase: exchange(w, 'coinbase', 'btc'),
      kraken: exchange(w, 'kraken', 'btc'),
      huobex: exchange(w, 'huobex', 'btc'),
    }
    const mx = mixer(w, 'sinbad', 'btc')
    const hodl = w.entity('hodlhodl')
    const grp = w.customEntity({ name: `Groupuscule « ${groupName} »`, category: 'suspect', description: 'Groupement dissous (nom fictif) poursuivant une activité en ligne.' })
    const copycat = w.customEntity({ name: `Compte usurpateur ${xCopy}`, category: 'scam', description: 'Compte opportuniste qui reprend l\'identité du groupe pour détourner des dons.' })

    // ── Adresses de collecte successives (rotation) ──────────────────────────
    const nA = r.int(4, 6)
    const pub = w.addrs('btc', nA, { entity: grp, kind: 'p2wpkh' })
    const priv = w.addr('btc', { entity: grp, kind: 'p2wpkh' })
    const posts: number[] = [w.at(-r.float(75, 95) * 24)]
    for (let i = 1; i < nA; i++) posts.push(Math.round(posts[i - 1] + r.float(10, 17) * DAY))
    const end = Math.round(posts[nA - 1] + r.float(8, 14) * DAY)

    // ── Plan des dons ────────────────────────────────────────────────────────
    type Plan = { t: number; target: string; src: Src; big?: boolean }
    const plan: Plan[] = []
    for (let i = 0; i < nA; i++) {
      const until = i < nA - 1 ? posts[i + 1] : end
      for (let k = 0; k < r.int(5, 9); k++) plan.push({ t: Math.round(r.float(posts[i] + HOUR, until - HOUR)), target: pub[i], src: 'person' })
      // Des donateurs continuent d'utiliser l'ancienne adresse après la rotation
      if (i < nA - 1 && r.chance(0.6)) for (let k = 0; k < r.int(1, 2); k++) plan.push({ t: Math.round(posts[i + 1] + r.float(0.5, 7) * DAY), target: pub[i], src: 'person' })
    }
    // Au moins un don tardif sur une adresse déjà remplacée (exploité par l'analyse chronologique)
    if (!plan.some((p) => { const i = pub.indexOf(p.target); return i >= 0 && i < nA - 1 && p.t > posts[i + 1] }))
      plan.push({ t: Math.round(posts[1] + r.float(0.5, 7) * DAY), target: pub[0], src: 'person' })
    // Sources : quelques retraits de plateformes, le reste depuis des portefeuilles personnels
    const nCH = r.int(5, 8)
    const nCB = r.int(2, 4)
    const nKR = r.int(1, 3)
    const nHX = r.int(1, 2)
    const nRep = 3
    const srcs: Src[] = [
      ...Array.from({ length: nCH }, () => 'coinhouse' as Src),
      ...Array.from({ length: nCB }, () => 'coinbase' as Src),
      ...Array.from({ length: nKR }, () => 'kraken' as Src),
      ...Array.from({ length: nHX }, () => 'huobex' as Src),
      ...Array.from({ length: nRep }, () => 'repeat' as Src),
    ]
    while (srcs.length < plan.length - 4) srcs.push('person')
    while (plan.length < srcs.length + 4) plan.push({ t: Math.round(r.float(posts[0] + HOUR, end - HOUR)), target: pub[r.int(0, nA - 1)], src: 'person' })
    r.shuffle(srcs).forEach((s, i) => (plan[i].src = s))
    // Adresse non publiée : communiquée en privé à quelques soutiens, dons plus élevés
    for (let k = 0; k < r.int(2, 3); k++) plan.push({ t: Math.round(r.float(posts[1], end - HOUR)), target: priv, src: 'person', big: true })
    plan.sort((a, b) => a.t - b.t)

    const repeatDonor = person(w, 'btc', { history: 3, time: posts[0], kind: 'p2wpkh' })
    const donations: { tx: Tx; target: string; value: number; src: Src }[] = []
    for (const p of plan) {
      const value = p.big ? roundUsdAmount(w, 'BTC', 800, 3000) : roundUsdAmount(w, 'BTC', 20, 400)
      let tx: Tx
      if (p.src === 'person' || p.src === 'repeat') {
        const from = p.src === 'repeat' ? repeatDonor : person(w, 'btc', { history: r.int(0, 2), time: p.t })
        tx = w.utxoTx({ time: p.t, from: [from], to: [{ address: p.target, value }] })
      } else tx = kits[p.src].withdraw(p.target, value, p.t)
      donations.push({ tx, target: p.target, value, src: p.src })
    }

    // ── Fausse piste : compte X usurpateur ───────────────────────────────────
    const copyAddr = w.addr('btc', { entity: copycat, kind: r.pick(['p2pkh', 'p2wpkh', 'p2sh'] as const) })
    const copyPostT = Math.round(posts[r.int(1, nA - 1)] + r.float(1, 4) * DAY)
    for (let k = 0; k < r.int(3, 5); k++) {
      const t = Math.round(copyPostT + r.float(2, 9 * 24) * HOUR)
      w.utxoTx({ time: t, from: [person(w, 'btc', { history: 1, time: t })], to: [{ address: copyAddr, value: roundUsdAmount(w, 'BTC', 20, 300) }] })
    }
    const copyOutT = Math.round(copyPostT + r.float(10, 16) * DAY)
    const copyCash = kits.huobex.newDeposit()
    const copyTx = forwardAll(w, copyAddr, copyCash, copyOutT)
    kits.huobex.sweep([copyCash], Math.round(copyOutT + r.float(1, 6) * HOUR))

    // ── Regroupements (CIOH) : une adresse « pont » dépensée dans les deux ──
    const m = Math.floor(nA / 2)
    const bridgeAddr = pub[m]
    const bt = donations.filter((d) => d.target === bridgeAddr).map((d) => d.tx.time).sort((a, b) => a - b)
    let j = 0
    for (let k = 0; k < bt.length - 1; k++) if (bt[k + 1] - bt[k] > bt[j + 1] - bt[j]) j = k
    const T1 = Math.round(bt[j] + (bt[j + 1] - bt[j]) * r.float(0.3, 0.7))
    const cons = w.addr('btc', { entity: grp, kind: 'p2wpkh' })
    const collect = [...pub, priv]
    const consolidate = (from: string[], t: number): Tx => {
      const nIn = from.reduce((s, a) => s + w.utxosOf(a, t).length, 0)
      const total = from.reduce((s, a) => s + w.unspentValue(a, t), 0)
      const fee = w.estimateFee('btc', nIn, 1)
      return w.utxoTx({ time: t, from: r.shuffle([...from]), to: [{ address: cons, value: f8(total - fee) }], fee, change: null, spendAll: true, method: 'consolidation', tags: ['consolidation'] })
    }
    const c1 = consolidate(collect.filter((a) => w.utxosOf(a, T1).length > 0), T1)
    const lastDon = Math.max(...donations.map((d) => d.tx.time))
    const T2 = Math.round(lastDon + r.float(12, 48) * HOUR)
    const c2 = consolidate([cons, ...collect.filter((a) => w.utxosOf(a, T2).length > 0)], T2)
    const aggregate = w.unspentValue(cons)

    // ── Sorties : mixeur puis vente P2P ──────────────────────────────────────
    const next1 = w.addr('btc', { entity: grp, kind: 'p2wpkh' })
    const next2 = w.addr('btc', { entity: grp, kind: 'p2wpkh' })
    const T3 = Math.round(c2.time + r.float(1, 3) * DAY)
    const mixValue = Math.floor(aggregate * r.float(0.45, 0.6) * 1000) / 1000
    const mixOut = Array.from({ length: r.int(2, 3) }, () => w.addr('btc', { entity: grp, kind: 'p2wpkh' }))
    const mixRes = mx.mix({ from: cons, value: mixValue, time: T3, recipients: mixOut, change: next1, delayH: [4, 30] })
    const T4 = Math.round(T3 + r.float(1, 4) * DAY)
    const escrow = w.addr('btc', { entity: hodl, label: 'Hodl Hodl — Séquestre multisig', kind: 'p2sh', tags: ['escrow'] })
    const p2pValue = Math.floor(w.unspentValue(next1, T4) * r.float(0.55, 0.75) * 1e4) / 1e4
    const p2pTx = w.utxoTx({ time: T4, from: [next1], to: [{ address: escrow, value: p2pValue }], change: next2, spendAll: true })
    const release = forwardAll(w, escrow, w.addr('btc'), Math.round(T4 + r.float(2, 12) * HOUR), undefined, ['escrow-release'])
    const remainderValue = w.unspentValue(next2)

    // ── Bruit ────────────────────────────────────────────────────────────────
    const s0 = Math.round(posts[0] - 10 * DAY)
    const s1 = Math.round(T4 + 10 * DAY)
    kits.coinhouse.noise(14, s0, s1)
    kits.coinbase.noise(10, s0, s1)
    kits.kraken.noise(8, s0, s1)
    kits.huobex.noise(6, s0, s1)
    for (let i = 0; i < r.int(4, 6); i++) {
      const u = w.addr('btc')
      const ti = Math.round(r.float(T4 - 6 * DAY, T4 + 6 * DAY))
      w.fund(u, roundCoin(w, 0.01, 0.2, 0.001), ti - r.int(2, 72) * HOUR)
      const esc = w.addr('btc', { entity: hodl, label: 'Hodl Hodl — Séquestre multisig', kind: 'p2sh', tags: ['escrow'] })
      w.utxoTx({ time: ti, from: [u], to: [{ address: esc, value: Math.floor(w.unspentValue(u, ti) * r.float(0.4, 0.9) * 1e4) / 1e4 }] })
      forwardAll(w, esc, w.addr('btc'), Math.round(ti + r.float(1, 12) * HOUR), undefined, ['escrow-release'])
    }

    // ── Chiffres ─────────────────────────────────────────────────────────────
    const total = r8(donations.reduce((s, d) => s + d.value, 0))
    const nDon = donations.length
    const count = (s: Src) => donations.filter((d) => d.src === s).length
    const nReg = donations.filter((d) => REGULATED.includes(d.src)).length
    const privDons = donations.filter((d) => d.target === priv)
    const privTotal = r8(privDons.reduce((s, d) => s + d.value, 0))
    const krDon = donations.find((d) => d.src === 'kraken')!
    // Dons reçus par une adresse publiée après son remplacement par la suivante
    const lateDons = donations.filter((d) => { const i = pub.indexOf(d.target); return i >= 0 && i < nA - 1 && d.tx.time > posts[i + 1] })
    const lateAddrs = new Set(lateDons.map((d) => d.target)).size
    const donor = fakePerson(r)
    const dg = donor.g
    const donorYear = new Date(w.t0 * 1000).getUTCFullYear() - r.int(24, 58)
    const repTargets = [...new Set(donations.filter((d) => d.src === 'repeat').map((d) => d.target))]
    const partnerList = r.shuffle([pub[r.int(0, m)], pub[nA - 1], priv, repeatDonor])
    const followers = r.int(12, 40) * 100

    const tgLines: { t: number; s: string }[] = pub.map((a, i) => ({
      t: posts[i],
      s: i === 0
        ? `Message épinglé : « Pour soutenir le mouvement et les frais de défense de nos membres poursuivis : ${A(w, a)} »`
        : `« Nouvelle adresse de soutien, l'ancienne n'est plus utilisée : ${A(w, a)} »`,
    }))
    tgLines.push({ t: copyPostT + r.int(6, 30) * HOUR, s: `« Attention : le compte ${xCopy} n'est pas le nôtre. Ne donnez qu'aux adresses publiées ici ou transmises par un administrateur. »` })
    tgLines.push({ t: posts[1] + r.int(2, 6) * DAY, s: '« Pour les dons importants, contactez un administrateur en privé. »' })
    const postLines = tgLines.sort((a, b) => a.t - b.t).map((l) => `[${fmtDate(l.t)}] ${l.s}`).join('\n')

    return {
      world: w,
      title: `Dossier « ${groupName} » — ${city}`,
      briefing:
        `Le groupuscule « ${groupName} » (nom fictif), connu pour des violences commises en réunion, a été dissous par décret le ${fmtDate(dissolvedT, false)}. Il continue pourtant d'animer un canal Telegram et un compte X, sur lesquels il appelle régulièrement aux dons en bitcoins.\n\n` +
        `Une enquête est ouverte à ${city}, notamment pour maintien ou reconstitution d'un groupement dissous. L'adresse de collecte change à chaque nouvel appel : il faut établir qu'il s'agit d'un même portefeuille, mesurer la collecte et savoir où vont les fonds.\n\n` +
        `Objectifs : regrouper les adresses de collecte, chiffrer les dons et leur chronologie, repérer ceux qui transitent par des plateformes régulées, choisir la réquisition prioritaire, suivre les sorties (mixeur, vente P2P, reliquat) et qualifier avec prudence la situation des donateurs.`,
      evidence: [
        {
          id: 'telegram', type: 'telegram', title: `Canal Telegram « ${tgChannel} » — extraits`, date: end, author: 'Capture réalisée par l\'enquêteur',
          body:
            `Canal public, environ ${followers.toLocaleString('fr-FR')} abonnés. Passages à caractère violent expurgés ; seuls les appels aux dons sont reproduits.\n\n` +
            postLines,
        },
        {
          id: 'x', type: 'capture', title: 'Publications X (extraits)', date: end + r.int(1, 3) * DAY, author: 'Capture réalisée par l\'enquêteur',
          body:
            `${xHandle} — [${fmtDate(posts[0] + r.int(1, 12) * HOUR)}] « Soutenez la cause : ${A(w, pub[0])} »\n` +
            `${xHandle} — [${fmtDate(posts[nA - 1] + r.int(1, 12) * HOUR)}] « Adresse mise à jour : ${A(w, pub[nA - 1])} »\n\n` +
            `${xCopy} — [${fmtDate(copyPostT)}] « Compte officiel. Nouvelle adresse de soutien, la seule valable : ${A(w, copyAddr)} »\n` +
            `(compte créé ${r.int(3, 20)} jours plus tôt, aucune publication antérieure)`,
        },
        {
          id: 'renseignement', type: 'note', title: 'Note de partage — service de renseignement', date: end + r.int(2, 5) * DAY, author: 'Service de renseignement (note déclassifiée pour l\'enquête)',
          body:
            `• Depuis sa dissolution, « ${groupName} » communique via le canal « ${tgChannel} » et le compte ${xHandle}. Les appels aux dons financeraient du matériel, des déplacements et les frais de défense de membres poursuivis.\n` +
            `• Selon une source, les administrateurs communiquent une adresse distincte, non publiée, aux soutiens qui proposent des montants importants.\n` +
            `• Un compte ${xCopy}, apparu récemment, est désavoué par le canal : usurpation possible.\n` +
            `• Les éléments de la présente note ne peuvent fonder à eux seuls une mise en cause : ils orientent les investigations.`,
        },
        {
          id: 'partenaire', type: 'rapport', title: 'Adresses signalées par un service partenaire', date: end + r.int(3, 8) * DAY, author: 'Service partenaire étranger (via Europol)',
          body:
            `Adresses BTC associées à « ${groupName} » d'après des observations de messageries, attribution non vérifiée on-chain :\n` +
            partnerList.map((a) => `• ${A(w, a)}`).join('\n') +
            `\n\nLe partenaire précise que cette liste est transmise à titre de renseignement et doit être vérifiée.`,
        },
        {
          id: 'kraken', type: 'rapport', title: 'Réponse de Kraken (demande préalable)', date: end + r.int(6, 12) * DAY, author: 'Service des demandes des forces de l\'ordre de Kraken',
          body:
            `Réponse à la demande transmise lors de la phase de renseignement, portant sur la transaction ${krDon.tx.hash}.\n\n` +
            `Retrait du ${fmtDate(krDon.tx.time)} de ${amt(krDon.value, 'BTC')} vers ${A(w, krDon.target)}.\n` +
            `Titulaire du compte : ${donor.name}, ${dg('né', 'née')} en ${donorYear}, ${dg('domicilié', 'domiciliée')} à ${fakeCity(r)}. Compte ouvert depuis ${r.int(2, 6)} ans, activité d'investissement régulière.\n` +
            `Aucun autre retrait vers cette adresse. Le client n'a pas renseigné de motif pour ce retrait.`,
        },
      ],
      seeds: [],
      objectives: [
        {
          id: 'o1', type: 'addresses', points: 14,
          prompt: 'Sélectionnez toutes les adresses de collecte du groupe (publiées ou non), c\'est-à-dire les adresses qui reçoivent des dons et appartiennent au même portefeuille.',
          answer: [...collect],
          hint: 'Partez d\'une adresse publiée et suivez sa dépense : les regroupements ont de nombreuses entrées. Vérifiez une à une les adresses de la liste du partenaire.',
          explanation:
            `${nA} adresses publiées successivement et 1 adresse non publiée (${A(w, priv).slice(0, 14)}…, communiquée en privé) sont co-dépensées dans deux regroupements vers ${A(w, cons).slice(0, 14)}…. ${A(w, bridgeAddr).slice(0, 14)}…, dépensée dans les deux, soude le cluster. ` +
            `La liste du partenaire contient une erreur : ${A(w, repeatDonor).slice(0, 14)}… n'est jamais co-dépensée avec le cluster ; c'est le portefeuille d'un donateur récurrent, qui a envoyé ${nRep} dons ${repTargets.length > 1 ? `à ${repTargets.length} adresses différentes` : 'à la même adresse'} du groupe. Envoyer des fonds à une adresse ne fait pas entrer l'expéditeur dans le portefeuille du destinataire. L'adresse de ${xCopy} relève d'un autre portefeuille.`,
        },
        {
          id: 'o8', type: 'address', points: 10,
          prompt: 'Quelle adresse de collecte n\'a jamais été publiée, ni sur Telegram ni sur X ?',
          answer: [priv],
          hint: 'Comparez les entrées des regroupements avec la liste des adresses publiées : l\'une d\'elles n\'apparaît dans aucune capture.',
          explanation: `${A(w, priv)} est co-dépensée avec les adresses publiées, mais n'apparaît dans aucune publication : c'est l'adresse « privée » évoquée par la note de renseignement, transmise par un administrateur aux soutiens proposant des montants importants. Elle a reçu ${privDons.length} dons pour ${amt(privTotal, 'BTC')}, nettement plus élevés que la moyenne. Seul le clustering permet de la découvrir ; ses donateurs, en contact direct avec les administrateurs, sont des cibles prioritaires pour l'enquête (proximité avec le groupe, échanges en messagerie privée).`,
        },
        {
          id: 'o7', type: 'choice', points: 8,
          prompt: `Que conclure de l'adresse publiée par le compte ${xCopy} ?`,
          ...choice(r,
            'Elle n\'est pas rattachée au groupe : aucune dépense commune, fonds sortis ailleurs, compte désavoué ; à traiter comme une possible escroquerie distincte',
            [
              'Elle appartient au groupe : elle a été publiée sous son nom et reçoit des dons à la même période',
              'Elle appartient au groupe : elle figure dans la liste du service partenaire',
              'Elle appartient au groupe : les montants reçus sont du même ordre que les autres dons',
            ]),
          hint: 'Suivez la dépense de cette adresse : est-elle un jour dépensée avec une adresse du cluster ? Où partent ses fonds ?',
          explanation: `${A(w, copyAddr).slice(0, 14)}… n'est jamais co-dépensée avec le cluster et ses fonds partent vers Huobex le ${fmtDate(copyTx.time, false)}, sans passer par l'adresse de regroupement. Le canal officiel désavoue le compte, et l'adresse ne figure pas dans la liste du partenaire. Un nom repris sur un réseau social n'est pas une attribution : c'est la donnée on-chain qui tranche. Les donateurs de cette adresse sont peut-être des victimes d'escroquerie.`,
        },
        {
          id: 'o2', type: 'amount', points: 10, unit: 'BTC', tolerance: 0.03,
          prompt: 'Quel montant total (en BTC) les donateurs ont-ils versé sur les adresses de collecte du groupe ?',
          answer: total,
          hint: 'Additionnez les dons reçus par chaque adresse du cluster, avant regroupement. Ne comptez ni les regroupements ni l\'adresse usurpatrice.',
          explanation: `${nDon} dons pour ${amt(total, 'BTC')} (≈ ${Math.round(usd('BTC', total)).toLocaleString('fr-FR')} $), dont ${privDons.length} dons plus élevés (${amt(privTotal, 'BTC')}) sur l'adresse non publiée. La plupart des dons sont modestes (quelques dizaines à quelques centaines de dollars) : la collecte repose sur le nombre.`,
        },
        {
          id: 'o9', type: 'number', points: 9, tolerance: 0, unit: 'dons',
          prompt: 'Combien de dons ont été reçus par une adresse publiée après que le canal l\'a remplacée par une nouvelle ?',
          answer: lateDons.length,
          hint: 'Datez chaque publication d\'adresse grâce à la capture Telegram, puis comparez avec la date des dons reçus par l\'adresse précédente.',
          explanation: `${lateDons.length} don${lateDons.length > 1 ? 's' : ''}, sur ${lateAddrs} adresse${lateAddrs > 1 ? 's' : ''} déjà remplacée${lateAddrs > 1 ? 's' : ''} : des soutiens continuent d'utiliser une adresse enregistrée ou copiée d'une ancienne publication (relais, captures partagées). La rotation n'est donc pas étanche, et c'est ce qui permet au groupe de continuer à les dépenser avec les nouvelles. Pour l'enquête, ces dons tardifs datent l'audience réelle de chaque publication et montrent que les adresses restent surveillées et regroupées par les administrateurs : une ancienne adresse n'est pas « abandonnée ».`,
        },
        {
          id: 'o3', type: 'number', points: 10, tolerance: 0, unit: 'dons',
          prompt: 'Combien de dons ont été envoyés directement depuis le hot wallet d\'une plateforme régulée en France ou dans l\'UE (KYC complet) ?',
          answer: nReg,
          hint: 'Regardez l\'origine de chaque don : une entrée étiquetée comme hot wallet d\'exchange signe un retrait client. Une plateforme offshore à KYC allégé ne compte pas.',
          explanation: `${nReg} dons : ${count('coinhouse')} depuis Coinhouse, ${count('coinbase')} depuis Coinbase et ${count('kraken')} depuis Kraken (ces deux derniers servent leurs clients européens via des entités agréées dans l'UE). ${count('huobex') > 1 ? `Les ${count('huobex')} dons depuis Huobex sont exclus` : 'Le don depuis Huobex est exclu'} : plateforme offshore, KYC allégé, réponses irrégulières. Les autres dons viennent de portefeuilles personnels, non identifiables sans autre élément.`,
        },
        {
          id: 'o4', type: 'entity', points: 9,
          prompt: 'Quelle plateforme requérir en priorité pour identifier des donateurs ?',
          answer: ['coinhouse'],
          hint: 'Croisez le nombre de dons par plateforme et la voie procédurale (délais, caractère contraignant).',
          explanation: `Coinhouse cumule le plus de dons (${count('coinhouse')}) et la voie la plus directe : ${procedureFor(kits.coinhouse.entity)} Une seule réquisition listant les hash et montants de chaque retrait identifie tous les titulaires concernés. En parallèle : ${procedureFor(kits.coinbase.entity)} ${procedureFor(kits.kraken.entity)}`,
        },
        {
          id: 'o6', type: 'choice', points: 8,
          prompt: `Comment présenter ${donor.name}, ${dg('identifié', 'identifiée')} par Kraken, dans le rapport ?`,
          ...choice(r,
            `${dg('Titulaire identifié', 'Titulaire identifiée')} d'un retrait vers une adresse du groupe ; sa connaissance de la destination des fonds reste à établir`,
            [
              `${dg('Auteur', 'Autrice')} d'un financement illicite caractérisé du seul fait de ce retrait`,
              `Membre du groupuscule, puisque son adresse appartient au cluster de collecte`,
              'Hors de cause : un don en crypto-actifs à un compte public ne peut pas être répréhensible',
            ]),
          hint: 'Distinguez ce que prouve la blockchain (un flux daté vers une adresse) de ce qui relève de l\'intention. L\'adresse du donateur est-elle dans le cluster ?',
          explanation: `Le retrait prouve un flux, pas une intention. Le donateur a pu répondre à un appel en connaissant le groupe, ou être trompé par la présentation (« frais de défense »). Son adresse n'est d'ailleurs pas dans le cluster : envoyer à une adresse n'en fait pas un co-titulaire. Le rapport constate le flux (hash, montant, date, adresse publiée à cette date) ; l'élément intentionnel relève de l'audition et du contexte (abonnement au canal, messages, autres dons).`,
        },
        {
          id: 'o5', type: 'tx', points: 9,
          prompt: 'Quelle transaction envoie une partie des fonds regroupés vers le mixeur ?',
          answer: [mixRes.depositTx.id],
          hint: 'Suivez la dépense de l\'adresse de regroupement : une sortie part vers une adresse de dépôt attribuée à un mixeur.',
          explanation: `Le ${fmtDate(mixRes.depositTx.time)}, ${amt(mixValue, 'BTC')} partent de ${A(w, cons).slice(0, 14)}… vers une adresse de dépôt Sinbad, mixeur centralisé sanctionné : la traçabilité s'interrompt, et toute adresse en aval est exposée à un service à risque sévère. Le rendu (${A(w, next1).slice(0, 14)}…) finance ensuite une vente P2P de ${amt(p2pValue, 'BTC')} via un séquestre Hodl Hodl. ${procedureFor(hodl)}`,
        },
        {
          id: 'o10', type: 'amount', points: 9, unit: 'BTC', tolerance: 0.01,
          prompt: 'Quel montant (en BTC) le groupe a-t-il placé en séquestre pour une vente de gré à gré (P2P) ?',
          answer: p2pValue,
          hint: 'Suivez le rendu de la transaction vers le mixeur : il alimente ensuite une adresse multisignature attribuée à une place de marché P2P.',
          explanation: `Le ${fmtDate(p2pTx.time)}, ${A(w, next1).slice(0, 14)}… (rendu du dépôt au mixeur) envoie ${amt(p2pValue, 'BTC')} vers un séquestre multisignature Hodl Hodl (${A(w, escrow).slice(0, 14)}…), libéré quelques heures plus tard vers une adresse inconnue : celle de l'acheteur, qui a payé le groupe hors chaîne (virement, espèces…). C'est la conversion en monnaie fiat de la part non mixée.`,
        },
        {
          id: 'o12', type: 'choice', points: 8,
          prompt: 'Que peut-on attendre de Hodl Hodl au sujet de la vente P2P ?',
          ...choice(r,
            'Des données limitées (annonces, échanges entre utilisateurs) : la plateforme ne détient pas les fonds et ne pratique pas de KYC ; l\'acheteur se recherche surtout via l\'adresse de libération du séquestre et le moyen de paiement',
            [
              'Le gel immédiat des fonds placés en séquestre, la plateforme en ayant la garde',
              'L\'identité vérifiée du vendeur, comme pour un exchange régulé soumis aux obligations de vigilance',
              'Rien : le séquestre est un auto-transfert du groupe, sans contrepartie',
            ]),
          hint: 'Relisez la fiche de l\'entité : modèle custodial ou non, niveau de KYC, possibilité de gel.',
          explanation: `Hodl Hodl est une place de marché P2P non-custodial : le séquestre est une adresse multisignature dont la plateforme détient une clé, mais elle ne garde pas les fonds et ne vérifie pas l'identité des utilisateurs. ${procedureFor(hodl)} La demande reste utile (pseudonymes, annonces, messages, moyen de paiement convenu), mais l'identification de l'acheteur passera surtout par l'adresse de libération (${A(w, release.outputs[0].address).slice(0, 14)}…) et son devenir, ou par le virement reçu par le vendeur.`,
        },
        {
          id: 'o11', type: 'address', points: 8,
          prompt: 'Sur quelle adresse le groupe conserve-t-il la part des fonds qui n\'a été ni mixée ni vendue ?',
          answer: [next2],
          hint: 'La transaction vers le séquestre a deux sorties : l\'une vers l\'adresse multisignature, l\'autre est un rendu.',
          explanation: `${A(w, next2)} est le rendu de la vente P2P : ${amt(remainderValue, 'BTC')} y restent à la date des faits. C'est la dernière position connue des fonds du groupe hors mixeur. Aucun intermédiaire ne la détient, donc aucun gel immédiat n'est possible, mais l'adresse doit être mise sous surveillance (alerte sur toute dépense) : un futur dépôt sur une plateforme régulée ouvrirait une réquisition et une saisie.`,
        },
      ],
      truth: {
        path: [...donations.map((d) => d.tx.id), c1.id, c2.id, mixRes.depositTx.id, p2pTx.id, release.id],
        addresses: [...collect, cons, next1, next2, mixRes.deposit, escrow],
        debrief:
          `1. Du ${fmtDate(posts[0], false)} au ${fmtDate(end, false)}, le groupe publie ${nA} adresses successives sur Telegram et X, et en communique une autre en privé aux soutiens importants.\n` +
          `2. ${nDon} dons arrivent sur ces adresses, pour ${amt(total, 'BTC')} : ${nReg} depuis des plateformes régulées (${count('coinhouse')} Coinhouse, ${count('coinbase')} Coinbase, ${count('kraken')} Kraken), ${count('huobex')} depuis Huobex, le reste depuis des portefeuilles personnels. Un donateur récurrent a donné ${nRep} fois depuis le même portefeuille. ${lateDons.length} don${lateDons.length > 1 ? 's arrivent' : ' arrive'} sur des adresses déjà remplacées : la rotation n'empêche ni les dons tardifs ni leur regroupement.\n` +
          `3. Regroupements le ${fmtDate(c1.time, false)} et le ${fmtDate(c2.time, false)} vers ${A(w, cons)} ; ${A(w, bridgeAddr).slice(0, 14)}… figure dans les deux et soude le cluster.\n` +
          `4. Sorties : ${amt(mixValue, 'BTC')} vers le mixeur Sinbad, puis ${amt(p2pValue, 'BTC')} vendus en P2P via un séquestre Hodl Hodl. Reliquat : ${amt(remainderValue, 'BTC')} sur ${A(w, next2).slice(0, 14)}….\n` +
          `5. Fausses pistes : l'adresse du compte usurpateur ${xCopy} (portefeuille distinct, encaissé chez Huobex) et l'adresse du donateur récurrent, signalée à tort par le partenaire.\n\n` +
          `Leçon : face à une collecte en ligne, l'OSINT donne les adresses publiées et leur chronologie ; le clustering (CIOH) relie les adresses rotatives et révèle celles qui n'ont jamais été publiées. Une liste transmise par un tiers est une source d'attribution à vérifier, pas une preuve. Les donateurs passés par une plateforme régulée sont identifiables par réquisition, mais un don établit un flux, pas une intention : la rédaction doit rester factuelle.`,
      },
      hints: [
        'Ajoutez au graphe les adresses publiées sur Telegram et X, dans l\'ordre chronologique, puis suivez leur dépense.',
        'Ouvrez le panneau cluster de l\'adresse de regroupement : une adresse du cluster n\'a jamais été publiée. Confrontez chaque adresse de la liste du partenaire à ce cluster.',
        'Pour les dons, regardez l\'origine de chaque transaction entrante : une entrée étiquetée hot wallet signe un retrait de plateforme. Suivez ensuite la dépense de l\'adresse de regroupement.',
        'Après le mixeur, le rendu continue sa route : séquestre P2P, puis nouveau rendu. Datez aussi les dons par rapport aux publications.',
      ],
    }
  },
}
