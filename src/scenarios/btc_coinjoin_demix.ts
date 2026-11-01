import { World, type Tx } from '../engine/world'
import { coinjoin, exchange, roundCoin, HOUR, DAY } from '../engine/patterns'
import { detectCoinjoin } from '../engine/analysis'
import { dusting, personalSpending, priorHistory } from '../engine/realism'
import type { AddrKind } from '../engine/addressgen'
import { fromUsd, roundAsset } from '../engine/chains'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, de, fakeCity, fakeName, fmtDate, procedureFor } from './util'

const r8 = (v: number) => Math.round(v * 1e8) / 1e8
const sat = (n: number) => Math.round(n) / 1e8
const PREMIX_EXTRA = 0.00025 // frais de mixage + réseau prépayés dans chaque UTXO pré-mix
const hm = (t: number) => new Date(t * 1000).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })

export const btcCoinjoinDemix: ScenarioTemplate = {
  id: 'coinjoin-demix',
  title: 'Démixer un CoinJoin',
  tagline: 'Sorties égales, rendu toxique, regroupement maladroit et une base de booter saisie : percez un CoinJoin sans tomber dans les faux positifs.',
  description:
    'Un maître-chanteur au déni de service passe ses bitcoins dans un CoinJoin à dénomination fixe, précédé d\'une transaction de pré-mix (« Tx0 »). En théorie, ses sorties se fondent dans la masse. En pratique, le rendu toxique de la Tx0 et un regroupement post-mix trahissent une partie des fonds, et la base de données saisie du service de DDoS qu\'il a payé permet d\'en rattacher une autre. Mais attention : d\'autres participants dépensent des sorties identiques à la même heure, et l\'adresse de paiement a une histoire.',
  difficulty: 3,
  chains: ['btc'],
  skills: ['coinjoin', 'change', 'cioh', 'exchange_id', 'osint', 'mixer'],
  estMinutes: 70,
  lessons: ['utxo', 'change-heuristics', 'clustering', 'coinjoin', 'demixage-avance', 'mixeurs', 'exchanges'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const city = fakeCity(r)
    const ceo = fakeName(r)
    const company = `${r.pick(['Transports', 'Menuiserie', 'Laboratoires', 'Groupe', 'Imprimerie', 'Clinique vétérinaire'])} ${r.pick(['Durand', 'Lacoste', 'Vasseur', 'Arnaud', 'Brunet', 'Leclerc'])}`
    const domain = `${company.split(' ').pop()!.toLowerCase()}-${r.pick(['commande', 'pro', 'shop', 'direct'])}.fr`

    const cv = exchange(w, 'coinhouse', 'btc')
    const outKey = r.pick(['binance', 'okx', 'huobex', 'bitstamp'] as const)
    const out = exchange(w, outKey, 'btc')
    // Coordinateur du CoinJoin : le kit coinjoin() étiquette ses frais avec l'entité « wasabi » (zkSNACKs, arrêté en
    // juin 2024). Une Tx0 suivie de pools à dénomination fixe, c'est le protocole Whirlpool : on redéfinit l'entité
    // avant tout appel pour que l'étiquette corresponde au schéma et à l'époque de l'affaire.
    w.entity('wasabi', {
      name: 'Coordinateur Whirlpool (instance indépendante)',
      description: 'Coordinateur de CoinJoin (fictif) qui fait tourner le protocole open source Whirlpool, hérité de Samourai Wallet (dont le coordinateur d\'origine a été saisi en avril 2024) : une transaction de pré-mix (Tx0) découpe les fonds en UTXO de taille fixe, puis des CoinJoin à sorties égales (pools de 0,01 ou 0,05 BTC). Aucun compte, aucune donnée d\'identité.',
    })
    // Hébergeur payé par le suspect (ses serveurs d'attaque et de messagerie)
    const vps = w.customEntity({ name: 'CloudBunker (hébergement VPS)', category: 'merchant', known: true, description: 'Hébergeur (fictif) de serveurs privés virtuels, payables en bitcoin, prisé pour sa tolérance. Conserve l\'e-mail du compte, les factures, les adresses IP de connexion et les serveurs loués.' })
    const gameShop = w.customEntity({ name: 'PixelVault (crédits de jeux en ligne)', category: 'merchant', known: true, description: 'Revendeur (fictif) de crédits et d\'objets de jeux vidéo payables en cryptomonnaies ; conserve le compte de jeu crédité.' })
    // Mixeur centralisé de la campagne précédente (fictif : Sinbad, saisi en novembre 2023, n'existait plus à l'époque des faits)
    const mist = w.customEntity({ name: 'MistMix', category: 'mixer', known: true, country: 'Inconnu', description: 'Mixeur centralisé (fictif, custodial) : reçoit des bitcoins sur une adresse de dépôt, les mélange à ceux d\'autres clients et restitue des pièces « propres » après un délai, moins une commission. Aucune coopération connue.' })
    const hodl = w.entity('hodlhodl')
    const booter = w.customEntity({ name: 'StressForge (booter, saisi)', category: 'hack', known: true, description: 'Service (fictif) de « stress test » vendant des attaques par déni de service à la demande (booter). Infrastructure saisie lors d\'une opération internationale ; la base clients (commandes, cibles, paiements) a été communiquée aux services d\'enquête.' })
    const suspect = w.customEntity({ name: 'Maître-chanteur « DDoS » (inconnu)', category: 'suspect' })
    const victimE = w.customEntity({ name: company, category: 'victim' })

    // ── Adresse de paiement : déjà utilisée lors d'une campagne précédente ──
    const denom = r.pick([0.01, 0.05, 0.05] as const)
    const m = r.int(4, 5)
    const s0Kind: AddrKind = r.pick(['p2pkh', 'p2sh', 'p2wpkh', 'p2tr'] as const)
    const s0 = w.addr('btc', { entity: suspect, kind: s0Kind })
    const nOld = r.int(2, 3)
    const oldPays: Tx[] = []
    for (let i = 0; i < nOld; i++) oldPays.push(w.fund(s0, r8(roundCoin(w, denom * 0.4, denom * 1.4, 0.001)), w.at(-r.float(26, 48) * 24)))
    const sinDep = w.addr('btc', { entity: mist, label: `${mist.name} — Adresse de dépôt`, tags: ['deposit'] })
    const sinRes = w.addr('btc', { entity: mist, label: `${mist.name} — Réserve`, tags: ['liquid'] })
    const oldSweepT = w.at(-r.float(14, 22) * 24)
    const oldIn = w.unspentValue(s0, oldSweepT)
    const oldFee = w.estimateFee('btc', w.utxosOf(s0, oldSweepT).length, 1)
    const oldSweep = w.utxoTx({ time: oldSweepT, from: [s0], to: [{ address: sinDep, value: r8(oldIn - oldFee) }], fee: oldFee, change: null, spendAll: true })
    w.utxoTx({ time: oldSweepT + r.int(1, 4) * HOUR, from: [sinDep], to: [{ address: sinRes, value: r8(oldIn - oldFee - 0.00002) }], fee: 0.00002, change: null, spendAll: true, tags: ['sweep'] })

    // ── Portefeuille personnel du suspect : achats P2P, booter, dépenses ─────
    const P = w.addr('btc', { entity: suspect, kind: 'p2wpkh' })
    const escrows = [0, 1].map(() => w.addr('btc', { entity: hodl, label: 'Hodl Hodl — Séquestre multisig', kind: 'p2wsh', multisig: { m: 2, n: 3 } }))
    priorHistory(w, P, { start: w.at(-75 * 24), end: w.at(-12 * 24), nIn: 3, nOut: 0, maxUsd: 900, sources: escrows })
    const tBoot = w.at(-r.float(6, 10) * 24)
    const booterAddr = w.addr('btc', { entity: booter, label: 'StressForge — Paiements', tags: ['liquid'] })
    const bootUsd = r.pick([49, 79, 99, 149])
    const bootTx = w.utxoTx({ time: tBoot, from: [P], to: [{ address: booterAddr, value: roundAsset('BTC', fromUsd('BTC', bootUsd)) }], change: P })
    personalSpending(w, P, { start: w.at(-60 * 24), end: w.at(-2 * 24), n: 3, merchants: ['mullvad', vps, gameShop], maxUsd: 120 })

    // ── Paiement de la rançon DDoS ───────────────────────────────────────────
    const Pay = r8(roundCoin(w, m * denom * 1.1, m * denom * 1.4, denom >= 0.05 ? 0.01 : 0.001))
    const victimAddr = w.addr('btc', { entity: victimE })
    cv.withdraw(victimAddr, r8(Pay + r.float(0.001, 0.004)), w.at(-r.float(6, 20)))
    const ransomTx = w.utxoTx({ time: w.at(0), from: [victimAddr], to: [{ address: s0, value: Pay }] })

    // ── Seconde victime : même adresse de paiement, montant négocié à la baisse ─
    // La société accepte le bitcoin de ses clients : son adresse a une vie normale.
    const company2 = `${r.pick(['Agence', 'Cabinet', 'Société', 'Atelier'])} ${r.pick(['Morel', 'Perrin', 'Gauthier', 'Masson', 'Renaud', 'Colin'])}`
    const victim2E = w.customEntity({ name: company2, category: 'victim' })
    const victim2Addr = w.addr('btc', { entity: victim2E, kind: 'p2wpkh' })
    const P2 = r8(roundCoin(w, m * denom * 0.3, m * denom * 0.6, denom >= 0.05 ? 0.005 : 0.001))
    const clientTimes = Array.from({ length: r.int(6, 7) }, () => w.at(-r.float(5, 120) * 24)).sort((a, b) => a - b)
    for (const t of clientTimes) w.fund(victim2Addr, r8(roundCoin(w, P2 * 0.15, P2 * 0.5, 0.0001)), t)
    const supplierT = w.at(-r.float(2, 4) * 24)
    if (w.unspentValue(victim2Addr, supplierT) > P2 * 0.2) w.utxoTx({ time: supplierT, from: [victim2Addr], to: [{ address: w.addr('btc'), value: r8(w.unspentValue(victim2Addr, supplierT) * r.float(0.1, 0.25)) }], change: victim2Addr })
    const ransom2Tx = w.utxoTx({ time: w.at(r.float(1, 3.5)), from: [victim2Addr], to: [{ address: s0, value: P2 }], change: victim2Addr })
    const totalIn = r8(Pay + P2)

    // ── Tx0 : découpage en UTXO pré-mix + rendu toxique ─────────────────────
    const premix = Array.from({ length: m }, () => w.addr('btc', { entity: suspect, kind: 'p2wpkh' }))
    const toxic = w.addr('btc', { entity: suspect, kind: s0Kind })
    const tx0 = w.utxoTx({
      time: w.at(r.float(4, 20)),
      from: [s0],
      to: premix.map((p) => ({ address: p, value: r8(denom + PREMIX_EXTRA) })),
      change: toxic,
      fee: sat(r.int(2500, 9000)),
      spendAll: true,
      tags: ['tx0'],
      method: 'Tx0 (pré-mix)',
    })
    const toxicValue = tx0.outputs.find((o) => o.address === toxic)!.value

    // ── CoinJoin (1 ou 2 tours) ──────────────────────────────────────────────
    const extra1 = r.int(6, 8)
    const cj1 = coinjoin(w, {
      chain: 'btc', time: tx0.time + r.float(1, 10) * HOUR, denom,
      participants: premix.map((p) => ({ from: p, changeTo: null })),
      extra: extra1,
      coordinatorFee: r8(0.00002 * (m + extra1)),
    })
    const cjs: Tx[] = [cj1.tx]
    let mixed = cj1.mixed
    if (r.chance(0.5)) {
      const extra2 = r.int(6, 8)
      const cj2 = coinjoin(w, {
        chain: 'btc', time: cj1.tx.time + r.float(2, 30) * HOUR, denom,
        participants: mixed.map((p) => ({ from: p, changeTo: null })),
        extra: extra2,
        coordinatorFee: r8(0.00001 * extra2),
      })
      cjs.push(cj2.tx)
      mixed = cj2.mixed
    }
    const lastCj = cjs[cjs.length - 1]

    // ── Activité post-mix des autres participants ───────────────────────────
    const othersOut = (tx: Tx) => tx.outputs.filter((o) => o.value.toFixed(8) === denom.toFixed(8) && !mixed.includes(o.address) && !cj1.mixed.includes(o.address)).map((o) => o.address)
    const strangers = othersOut(lastCj)
    r.shuffle(strangers)
    // Un faux positif : deux sorties de participants différents dépensées ensemble
    const fpPair = strangers.splice(0, 2)
    w.utxoTx({ time: lastCj.time + r.float(4, 60) * HOUR, from: fpPair, to: [{ address: w.addr('btc'), value: r8(denom * 2 - 0.00006) }], fee: 0.00006, change: null, spendAll: true })
    // Des sorties de même dénomination dépensées seules, à la même heure que celle du suspect
    const sameHour = strangers.splice(0, 3)

    // ── L'erreur : regroupement post-mix avec le rendu toxique ──────────────
    const q = r.int(2, m - 2)
    const used = r.shuffle([...mixed]).slice(0, q)
    const deposit = out.newDeposit()
    const inputs = r.shuffle([...used, toxic])
    const consIn = used.length * denom + toxicValue
    const consFee = w.estimateFee('btc', inputs.length, 1)
    const consTx = w.utxoTx({ time: lastCj.time + r.float(10, 70) * HOUR, from: inputs, to: [{ address: deposit, value: r8(consIn - consFee) }], fee: consFee, change: null, spendAll: true })
    const sweep = out.sweep([deposit], consTx.time + r.float(1, 6) * HOUR)[0]

    // ── Les sorties mixées restantes : dépensées seules, au milieu de jumelles ──
    const leftover = mixed.filter((a) => !used.includes(a))
    const tLeft = Math.round(lastCj.time + r.float(8, 60) * HOUR)
    const single = (from: string, to: string, t: number) => {
      const fee = sat(r.int(141, 420))
      return w.utxoTx({ time: t, from: [from], to: [{ address: to, value: r8(denom - fee) }], fee, change: null, spendAll: true })
    }
    const toP = single(leftover[0], P, tLeft)
    const Q = w.addr('btc', { entity: suspect, kind: 'p2wpkh' })
    const toQ = single(leftover[1], Q, tLeft + r.int(-25, 25) * 60)
    const lookalikes = sameHour.map((a) => single(a, w.addr('btc', { kind: 'p2wpkh' }), tLeft + r.int(-40, 40) * 60))
    // Les autres sorties de tiers : dépensées plus tard, montants quelconques
    for (const a of strangers) {
      if (!r.chance(0.6)) continue
      w.utxoTx({ time: lastCj.time + r.float(2, 96) * HOUR, from: [a], to: [{ address: w.addr('btc'), value: r8(denom * r.float(0.3, 0.8)) }] })
    }
    // Rendus des autres participants du 1er tour : parfois dépensés
    for (const o of cj1.tx.outputs) {
      const v = o.value.toFixed(8)
      if (v === denom.toFixed(8) || w.get(o.address).entityId === 'wasabi') continue
      if (r.chance(0.5)) w.utxoTx({ time: cj1.tx.time + r.float(3, 80) * HOUR, from: [o.address], to: [{ address: w.addr('btc'), value: r8(o.value * r.float(0.4, 0.9)) }] })
    }

    // Le portefeuille personnel regroupe toutes ses pièces pour régler une facture CloudBunker (fin du flux réel)
    const tCard = Math.max(tLeft, sweep.time) + Math.round(r.float(24, 100) * HOUR)
    const inv = w.addr('btc', { entity: vps, label: `${vps.name} — Facture`, tags: ['invoice'] })
    const cardTx = w.utxoTx({ time: tCard, from: [P], to: [{ address: inv, value: r8(denom * r.float(0.4, 0.8)) }], change: P, spendAll: true })
    personalSpending(w, P, { start: tCard + DAY, end: tCard + 12 * DAY, n: 2, merchants: ['mullvad', gameShop], maxUsd: 90 })
    // Poussière sur l'adresse de paiement, devenue publique (jamais dépensée)
    const dust = dusting(w, s0, { time: tx0.time + 5 * DAY, n: r.int(2, 3), spreadH: 72 })

    // ── Bruit exchanges ──────────────────────────────────────────────────────
    out.noise(12, w.at(-2 * 24), w.at(10 * 24))
    cv.noise(8, w.at(-5 * 24), w.at(5 * 24))

    // ── Réponses (monde final) ──────────────────────────────────────────────
    const exName = out.entity.name
    const nRounds = cjs.length
    const cjInfo = detectCoinjoin(cj1.tx)
    const deposited = consTx.outputs[0].value
    const waitH = Math.round(((consTx.time - lastCj.time) / 3600) * 10) / 10
    const singles = [toP, toQ, ...lookalikes].sort((a, b) => a.time - b.time)
    const span = Math.round((singles[singles.length - 1].time - singles[0].time) / 60)
    const oldTotal = r8(oldPays.reduce((s, t) => s + (t.outputs.find((o) => o.address === s0)?.value ?? 0), 0))

    return {
      world: w,
      title: `Chantage au déni de service — ${city}`,
      briefing:
        `La société ${company} (${city}) a subi plusieurs attaques par déni de service (DDoS) paralysant son site de commande ${domain}. Un message exigeait le paiement de ${amt(Pay, 'BTC')} pour que les attaques cessent. La direction (${ceo}) a payé depuis un compte Coinhouse ouvert pour l'occasion.\n\n` +
        `Le maître-chanteur a fait passer les fonds par un CoinJoin coordonné à dénomination fixe, sur le modèle Whirlpool (protocole hérité de Samourai Wallet : transaction de pré-mix « Tx0 », puis pools à montant fixe) : plusieurs participants mettent en commun des UTXO et reçoivent chacun une sortie de montant identique (${amt(denom, 'BTC')}). Impossible, en principe, de savoir quelle sortie appartient à qui.\n\n` +
        `Entre-temps, une seconde entreprise, ${company2}, a signalé le même chantage. Et une coopération internationale vient de livrer la base clients d'un service de DDoS à la demande, saisi.\n\n` +
        `Mesurez l'ampleur de la campagne, retracez l'histoire de l'adresse de paiement, retrouvez la transaction de pré-mix, le CoinJoin, le rendu « toxique », la transaction qui trahit le suspect et la plateforme de destination. Puis tentez de rattacher une sortie mixée de plus, sans vous laisser piéger par les sorties identiques d'autres participants.`,
      evidence: [
        {
          id: 'menace', type: 'email', title: 'Message de chantage', date: w.at(-r.float(20, 44)), author: 'contact anonyme (messagerie chiffrée)',
          body:
            `Votre site ${domain} est tombé trois fois cette semaine. Ce n'est qu'un début.\n` +
            `Pour que cela cesse : ${amt(Pay, 'BTC')} à envoyer sur\n${A(w, s0)}\n` +
            `Délai : 48 heures. Après paiement, plus aucune attaque. Sinon, nous passerons à vos clients.`,
        },
        {
          id: 'pv', type: 'pv', title: 'PV d\'audition de la direction (extrait)', date: w.at(3 * 24), author: ceo,
          body:
            `« Sur conseil de mon prestataire informatique, j'ai payé pour faire cesser les attaques. ` +
            `J'ai acheté les bitcoins sur Coinhouse et je les ai envoyés le ${fmtDate(ransomTx.time)}. ` +
            `Identifiant de transaction : ${ransomTx.hash} »`,
        },
        {
          id: 'signalement', type: 'email', title: `Signalement ${de(company2)}`, date: w.at(5 * 24), author: `Gérance ${de(company2)}`,
          body:
            `« Nous avons reçu le même message de menace, avec la même adresse bitcoin. Après négociation par messagerie, l'auteur a accepté un montant inférieur à sa demande initiale. ` +
            `Nous acceptons le bitcoin de quelques clients depuis plusieurs mois, nous avons donc payé depuis notre propre portefeuille, le ${fmtDate(ransom2Tx.time, false)}. Notre comptable n'a conservé ni le montant exact ni la référence de la transaction. ` +
            `Nous déposerons plainte dès que possible. »`,
        },
        {
          id: 'booter', type: 'rapport', title: 'Extrait de la base clients du booter StressForge (saisie, coopération Europol)', date: w.at(8 * 24), author: 'Officier de liaison — C3N',
          body:
            `Recherche sur le domaine ${domain} dans la base saisie :\n` +
            `Commande n° ${r.int(40000, 99999)} — formule « ${r.pick(['Pro', 'Ultimate', 'VIP'])} 30 jours » (${bootUsd} $)\n` +
            `Cibles déclarées : ${domain}, ${domain.replace('.fr', '.com')}\n` +
            `Compte client : « ${r.pick(['nullroute', 'k1ll3r', 'zeroday', 'stormcat'])}${r.int(10, 99)} », inscription via adresse e-mail jetable\n` +
            `Paiement : ${fmtDate(bootTx.time)}, transaction ${bootTx.hash}\n` +
            `Adresse de paiement du client (relevée par le service) : ${A(w, P)}\n` +
            `Aucune autre donnée exploitable (connexions via VPN).`,
        },
        {
          id: 'note', type: 'note', title: 'Note technique — CoinJoin', date: w.at(4 * 24), author: 'Cellule d\'appui',
          body:
            `Rappels :\n` +
            `• Avant le CoinJoin, une transaction « Tx0 » découpe les fonds en UTXO de taille fixe (dénomination + frais). Ce qui ne rentre pas dans une dénomination revient en rendu : c'est le rendu toxique, toujours relié à l'origine des fonds.\n` +
            `• Le CoinJoin lui-même : nombreuses entrées, nombreuses sorties de montant égal. L'heuristique des entrées communes ne s'y applique pas.\n` +
            `• Après le CoinJoin, dépenser ensemble plusieurs sorties mixées, ou une sortie mixée avec un rendu toxique, recrée un lien de propriété.\n` +
            `• Méfiance : deux sorties de même dénomination dépensées ensemble ne prouvent rien à elles seules, et des sorties identiques dépensées seules à la même heure peuvent appartenir à n'importe quel participant. Seul un lien indépendant (adresse connue, pièce de procédure) permet d'en rattacher une.\n` +
            `• Une adresse de paiement réutilisée garde la mémoire de ses usages précédents ; les micro-montants de 546 sats qui y arrivent après coup sont de la poussière, pas des paiements.`,
        },
      ],
      seeds: [],
      objectives: [
        {
          id: 'o5', type: 'tx', points: 8,
          prompt: `Quelle transaction correspond au paiement de la seconde victime, ${company2} ?`,
          answer: [ransom2Tx.id],
          hint: 'Ajoutez l\'adresse du message de chantage au graphe et listez ses paiements entrants autour des faits : un seul n\'est pas celui de la première victime. Les entrées d\'il y a plusieurs semaines et les micro-montants ultérieurs sont autre chose.',
          explanation: `Autour des faits, l'adresse de paiement reçoit deux versements : celui ${de(company)} (${ransomTx.hash.slice(0, 14)}…) et, le ${fmtDate(ransom2Tx.time)}, la transaction ${ransom2Tx.hash}, venue d'une adresse qui reçoit depuis des mois des paiements de clients, cohérent avec le signalement. Les ${nOld} entrées d'il y a plusieurs semaines appartiennent à une campagne antérieure, et les ${dust.txs.length} entrées de 546 sats postérieures sont de la poussière.`,
        },
        {
          id: 'o6', type: 'amount', points: 8, unit: 'BTC', tolerance: 0.01,
          prompt: 'Quel montant total (BTC) l\'adresse de paiement a-t-elle reçu des deux victimes de cette campagne ?',
          answer: totalIn,
          hint: 'Faites la somme des deux paiements de la campagne actuelle, sans les entrées antérieures ni la poussière.',
          explanation: `${amt(Pay, 'BTC')} + ${amt(P2, 'BTC')} = ${amt(totalIn, 'BTC')}. C'est l'assiette du préjudice de cette campagne et exactement ce qui entre dans la Tx0 : la somme des UTXO pré-mix, du rendu et des frais retombe sur ce total. Les ${amt(oldTotal, 'BTC')} de la campagne précédente étaient déjà partis.`,
        },
        {
          id: 'o7', type: 'tx', points: 8,
          prompt: 'Quelle transaction de pré-mix (« Tx0 ») a découpé les fonds avant le CoinJoin ?',
          answer: [tx0.id],
          hint: 'C\'est la transaction qui dépense les paiements de la campagne actuelle : plusieurs sorties identiques, une sortie différente.',
          explanation: `La transaction ${tx0.hash} (${fmtDate(tx0.time)}) dépense les deux paiements reçus et produit ${m} sorties identiques de ${amt(r8(denom + PREMIX_EXTRA), 'BTC')} (dénomination + frais prépayés), signature typique d'une Tx0 préparant un CoinJoin, plus une sortie de montant quelconque.`,
        },
        {
          id: 'o8', type: 'number', points: 7, unit: 'UTXO pré-mix',
          prompt: 'Combien d\'UTXO pré-mix la Tx0 a-t-elle créées ?',
          answer: m,
          hint: 'Comptez les sorties de la Tx0 de valeur égale à la dénomination augmentée de quelques satoshis.',
          explanation: `${m} sorties de ${amt(r8(denom + PREMIX_EXTRA), 'BTC')} : le suspect entre donc dans le CoinJoin avec ${m} participations. C'est le nombre maximal de sorties mixées qu'on cherchera ensuite à lui rattacher.`,
        },
        {
          id: 'o2', type: 'address', points: 10,
          prompt: 'Quelle est l\'adresse du rendu toxique (la partie des fonds qui n\'est pas entrée dans le CoinJoin) ?',
          answer: [toxic],
          hint: 'Dans la Tx0, toutes les sorties sauf une ont la même valeur.',
          explanation: `La Tx0 crée ${m} UTXO de ${amt(r8(denom + PREMIX_EXTRA), 'BTC')} et un rendu de ${amt(toxicValue, 'BTC')} vers ${A(w, toxic)}, du même type que l'adresse de la rançon. Ce rendu n'est pas mixé : il reste directement relié aux paiements des victimes.`,
        },
        {
          id: 'o1', type: 'tx', points: 8,
          prompt: nRounds > 1 ? 'Identifiez une transaction CoinJoin dans laquelle les fonds du suspect ont été mélangés.' : 'Identifiez la transaction CoinJoin dans laquelle les fonds du suspect ont été mélangés.',
          answer: cjs.map((t) => t.id),
          hint: 'Suivez les sorties de la transaction Tx0 (sorties égales à la dénomination + quelques satoshis).',
          explanation: `${nRounds > 1 ? `Les fonds passent par ${nRounds} tours de CoinJoin. ` : ''}Le premier CoinJoin compte ${cj1.tx.inputs.length} entrées et ${cjInfo.equalCount ?? '?'} sorties de ${amt(denom, 'BTC')} : chaque participant reçoit le même montant, ce qui casse le lien entrée → sortie.`,
        },
        {
          id: 'o3', type: 'tx', points: 12,
          prompt: 'Quelle transaction post-mix permet, par les entrées communes, de rattacher des sorties du CoinJoin au suspect ?',
          answer: [consTx.id],
          hint: 'Où le rendu toxique est-il dépensé, et avec quoi ?',
          explanation: `La transaction ${consTx.hash.slice(0, 14)}… dépense ensemble le rendu toxique et ${q} sorties mixées de ${amt(denom, 'BTC')}. Par entrées communes, ces sorties mixées appartiennent donc au propriétaire du rendu toxique, c'est-à-dire au maître-chanteur. Attention au faux positif : une autre transaction regroupe aussi deux sorties de ${amt(denom, 'BTC')}, mais rien ne la relie au suspect.`,
        },
        {
          id: 'o10', type: 'number', points: 7, tolerance: 2, unit: 'heures',
          prompt: `Combien d'heures le suspect a-t-il attendu entre le ${nRounds > 1 ? 'dernier tour de CoinJoin' : 'CoinJoin'} et ce regroupement ?`,
          answer: waitH,
          hint: 'Comparez les horodatages des deux transactions (frise chronologique ou fiches de transaction).',
          explanation: `${nRounds > 1 ? 'Dernier tour' : 'CoinJoin'} le ${fmtDate(lastCj.time)}, regroupement le ${fmtDate(consTx.time)} : environ ${waitH.toFixed(1).replace('.', ',')} h. ${waitH < 24 ? 'Un délai aussi court annule une bonne part de l\'intérêt du mixage et s\'ajoute au faisceau d\'indices présenté au magistrat.' : 'Le délai importe moins que l\'erreur elle-même : quel que soit le temps d\'attente, dépenser des sorties mixées avec le rendu toxique recrée le lien que le mixage devait effacer.'}`,
        },
        {
          id: 'o9', type: 'choice', points: 8,
          prompt: `Une autre transaction dépense ensemble deux sorties de ${amt(denom, 'BTC')} du même CoinJoin. Que pouvez-vous en conclure ?`,
          ...choice(r,
            'Rien contre le suspect : ces deux sorties ne sont rattachées à lui par aucun autre lien (rendu toxique, adresse connue)',
            [
              'Elles appartiennent au suspect, puisque toute dépense commune de sorties mixées désigne le même propriétaire',
              'Elles appartiennent au coordinateur du CoinJoin, qui récupère ainsi ses frais',
              'Elles prouvent que le suspect a fait un second tour de CoinJoin avec ses propres sorties',
            ]),
          hint: 'Qu\'est-ce qui, dans la transaction de regroupement du suspect, faisait le lien avec lui ? Retrouvez-vous cet élément ici ?',
          explanation: `La dépense commune montre seulement que ces deux sorties ont un même propriétaire, pas qui il est. Dans la transaction du suspect, c'est la présence du rendu toxique (issu de la Tx0, donc des paiements des victimes) qui fait le rattachement. Ici, aucune entrée n'est reliée au suspect : imputer ces fonds serait un faux positif, à écarter explicitement dans le rapport.`,
        },
        {
          id: 'o12', type: 'tx', points: 12,
          prompt: `En ${span} minutes, ${singles.length} sorties de ${amt(denom, 'BTC')} du ${nRounds > 1 ? 'dernier ' : ''}CoinJoin sont dépensées seules, chacune vers une seule adresse, pour un montant quasi identique. Laquelle peut être rattachée au suspect ?`,
          answer: [toP.id],
          hint: 'Aucune ne touche le rendu toxique. Cherchez un lien indépendant : une des adresses de destination figure-t-elle dans une pièce du dossier ?',
          explanation:
            `Les dépenses seules :\n${singles.map((t) => `${hm(t.time)} · ${amt(t.outputs[0].value, 'BTC')} → ${A(w, t.outputs[0].address).slice(0, 14)}…`).join('\n')}\n` +
            `${toP.hash.slice(0, 14)}… verse sur ${A(w, P).slice(0, 14)}…, l'adresse qui a payé l'abonnement StressForge visant ${domain} (base clients saisie, ${bootTx.hash.slice(0, 10)}…, ${fmtDate(bootTx.time, false)}). Le commanditaire des attaques et le destinataire de cette sortie mixée ne font qu'un : rattachement par une source indépendante de la blockchain. Ce portefeuille personnel regroupe ensuite toutes ses pièces pour régler une facture ${vps.name}, autre erreur de confidentialité, et nouvelle piste de réquisition (compte client, IP de connexion).\n` +
            `Les autres dépenses ont le même montant, la même heure, le même schéma : rien ne permet de les imputer à qui que ce soit. Les retenir sur la seule coïncidence temporelle serait un faux positif.`,
        },
        {
          id: 'o11', type: 'address', points: 8,
          prompt: 'Quelle adresse de dépôt reçoit les fonds regroupés avec le rendu toxique ?',
          answer: [deposit],
          hint: 'C\'est l\'unique sortie de la transaction de regroupement.',
          explanation: `${A(w, deposit)} reçoit ${amt(deposited, 'BTC')} puis est balayée avec d'autres dépôts vers un portefeuille chaud étiqueté : c'est le comportement d'une adresse de dépôt client, propre à un compte. C'est elle que viseront la réquisition et, le cas échéant, la demande de gel.`,
        },
        {
          id: 'o4', type: 'entity', points: 10,
          prompt: 'Vers quelle plateforme les fonds regroupés ont-ils été envoyés ?',
          answer: [outKey],
          hint: 'Suivez le balayage de l\'adresse de dépôt jusqu\'au portefeuille chaud étiqueté.',
          explanation: `La transaction de regroupement envoie ${amt(deposited, 'BTC')} vers une adresse de dépôt ${exName}, ensuite balayée. Réquisition à ${exName} sur cette adresse de dépôt, en joignant la démonstration (Tx0 → rendu toxique → regroupement). ${procedureFor(out.entity)}`,
        },
        {
          id: 'o13', type: 'entity', points: 8,
          prompt: 'L\'adresse de paiement avait déjà servi quelques semaines plus tôt. Vers quel service les fonds de cette campagne précédente sont-ils partis ?',
          answer: [mist.id],
          hint: 'Remontez l\'historique de l\'adresse de paiement : plusieurs entrées anciennes, puis une sortie unique qui les vide.',
          explanation: `${nOld} paiements (${amt(oldTotal, 'BTC')} au total), reçus entre le ${fmtDate(oldPays.map((t) => t.time).sort((a, b) => a - b)[0], false)} et le ${fmtDate(Math.max(...oldPays.map((t) => t.time)), false)}, sont vidés le ${fmtDate(oldSweep.time, false)} vers une adresse de dépôt de ${mist.name}, mixeur centralisé sans KYC. Même adresse, même mode de paiement : la campagne actuelle n'est pas la première, et d'autres victimes restent à identifier. Côté ${mist.name}, l'impasse est réelle : aucune coopération à attendre.`,
        },
      ],
      truth: {
        path: [ransomTx.id, ransom2Tx.id, tx0.id, ...cjs.map((t) => t.id), consTx.id, sweep.id, toP.id, cardTx.id],
        addresses: [s0, toxic, ...premix, ...mixed, deposit, P],
        debrief:
          `0. L'adresse de paiement ${A(w, s0)} n'est pas neuve : ${nOld} paiements d'une campagne antérieure (${amt(oldTotal, 'BTC')}) en sont partis le ${fmtDate(oldSweep.time, false)} vers le mixeur ${mist.name}.\n` +
          `1. ${company} paie ${amt(Pay, 'BTC')} ; ${company2}, victime du même chantage, y verse ${amt(P2, 'BTC')} (${ransom2Tx.hash.slice(0, 14)}…). Total : ${amt(totalIn, 'BTC')}.\n` +
          `2. Tx0 (${tx0.hash.slice(0, 14)}…) : le suspect découpe les fonds en ${m} UTXO pré-mix de ${amt(r8(denom + PREMIX_EXTRA), 'BTC')} et renvoie le reste (${amt(toxicValue, 'BTC')}) vers ${A(w, toxic)} : le rendu toxique.\n` +
          `3. ${nRounds > 1 ? `Deux tours de CoinJoin (${fmtDate(cjs[0].time)} puis ${fmtDate(cjs[1].time)})` : `Un CoinJoin (${fmtDate(cjs[0].time)})`} : les ${m} UTXO deviennent ${m} sorties de ${amt(denom, 'BTC')} indiscernables de celles des autres participants.\n` +
          `4. Erreur n° 1 : environ ${waitH.toFixed(1).replace('.', ',')} h plus tard, ${q} sorties mixées sont dépensées avec le rendu toxique dans ${consTx.hash.slice(0, 14)}…, vers l'adresse de dépôt ${exName} ${A(w, deposit)} (${amt(deposited, 'BTC')}).\n` +
          `5. Erreur n° 2 : une sortie mixée part seule vers ${A(w, P)}, portefeuille personnel qui avait payé le booter StressForge pour attaquer ${domain} ; il regroupe ensuite ses pièces pour régler une facture ${vps.name} (${cardTx.hash.slice(0, 12)}…).\n` +
          `6. Ce qu'on ne peut pas prouver : à la même heure, une autre sortie du suspect part seule vers ${A(w, Q).slice(0, 14)}…, au milieu de ${lookalikes.length} dépenses identiques d'autres participants${leftover.length > 2 ? (leftover.length === 3 ? ' (et une dernière sortie mixée du suspect n\'a pas encore bougé)' : ` (et ${leftover.length - 2} dernières sorties mixées du suspect n'ont pas encore bougé)`) : ''}. Sans lien indépendant, elle reste non attribuable, et c'est la bonne conclusion.\n\n` +
          `Leçon : un CoinJoin n'est pas une impasse. On cherche (a) le rendu toxique de la Tx0, (b) les dépenses communes post-mix, (c) les liens indépendants (pièces de procédure, bases saisies) vers des adresses de destination. Mais on se garde des faux positifs : deux sorties de même dénomination dépensées ensemble, ou des sorties identiques dépensées à la même heure, ne désignent quelqu'un que si l'une d'elles est déjà rattachée au suspect.`,
      },
      hints: [
        'L\'adresse de paiement figure dans le message de chantage : ajoutez-la au graphe et lisez tout son historique, avant et après les faits.',
        'La Tx0 produit plusieurs sorties identiques et une sortie différente : cette dernière est le rendu toxique.',
        'Le CoinJoin est repéré automatiquement (nombreuses sorties égales). Ne cherchez pas à le « démêler » directement.',
        'Suivez la dépense du rendu toxique : sa sortie unique est une adresse de dépôt.',
        'Relisez l\'extrait de la base du booter : une adresse y figure. Recevait-elle une sortie mixée ?',
      ],
    }
  },
}
