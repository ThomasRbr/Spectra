import { World, type Tx } from '../engine/world'
import { exchange, DAY, HOUR } from '../engine/patterns'
import { adaEnterprise, adaScript, adaWallet, lockToScript, stakeSiblings } from '../engine/cardano'
import { cardanoStakeAddress, cardanoStakeTail } from '../engine/addressgen'
import { keccak256 } from '../engine/keccak'
import { priorHistory } from '../engine/realism'
import { roundAsset, usd } from '../engine/chains'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, de, fakeCity, fakeHandle, fakePerson, fmtDate, procedureFor } from './util'

const ada = (v: number) => amt(roundAsset('ADA', v), 'ADA')
const r6 = (v: number) => roundAsset('ADA', v)
// Arrondi par défaut : une sortie arrondie au-dessus de l'entrée déclencherait un financement fantôme
// (un lovelace de marge : les erreurs d'arrondi flottant ne doivent jamais faire dépasser l'entrée)
const floor6 = (v: number) => (Math.floor(v * 1e6) - 1) / 1e6
const usdFmt = (v: number) => `${Math.round(v).toLocaleString('fr-FR')} $`
const hm = (t: number) => new Date(t * 1000).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })

const POOLS = [
  { name: 'HelioStake', ticker: 'HELIO' },
  { name: 'AdaRendement Pro', ticker: 'ARPRO' },
  { name: 'Cardano Yield Club', ticker: 'CYCLB' },
  { name: 'StakeNova', ticker: 'NOVA' },
]

export const adaCardanoStaking: ScenarioTemplate = {
  id: 'cardano-staking',
  title: 'Le faux pool de staking',
  tagline: 'Un « rendement garanti » sur Cardano : la clé de staking trahit le portefeuille, le datum désigne le bénéficiaire, et trois lots identiques partent dans la même demi-heure.',
  description:
    'Un prétendu pool de staking Cardano promet un rendement garanti et demande aux investisseurs d\'envoyer leurs ADA sur des adresses « personnelles ». Toutes ces adresses partagent pourtant la même clé de staking. Regroupez le portefeuille sans attendre la moindre entrée commune, écartez les adresses qui lui ressemblent sans lui appartenir, chiffrez la collecte, lisez le datum d\'un contrat de verrouillage, puis départagez trois lots de même montant envoyés dans la même demi-heure : un seul mène à la plateforme.',
  difficulty: 3,
  chains: ['ada'],
  skills: ['utxo', 'lecture_tx', 'cioh', 'exchange_id', 'typologies', 'requisition'],
  estMinutes: 60,
  lessons: ['cardano-eutxo', 'cardano-staking', 'clustering', 'ponzi-mlm'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const T = w.at(0)
    const P = r.pick(POOLS)
    const plaig = fakePerson(r)
    const g = plaig.g
    const lp = { la: g('le plaignant', 'la plaignante'), de: g('du plaignant', 'de la plaignante'), a: g('au plaignant', 'à la plaignante'), comprise: g('plaignant compris', 'plaignante comprise') }
    const city = fakeCity(r)
    const handle = fakeHandle(r)
    const exKey = r.pick(['binance', 'kraken', 'coinbase', 'okx'] as const)
    const seedKey = r.pick((['binance', 'kraken', 'coinbase', 'okx', 'bitstamp'] as const).filter((k) => k !== exKey))

    const scamE = w.customEntity({ name: `${P.name} (faux pool de staking)`, category: 'scam' })
    const victimE = w.customEntity({ name: plaig.name, category: 'victim' })
    const ex = exchange(w, exKey, 'ada')
    const exSeed = exchange(w, seedKey, 'ada')
    const cv = exchange(w, 'coinhouse', 'ada')
    const W = adaWallet(w, { entity: scamE })

    // ── Adresses de l'escroc : adresse « du pool » publiée sur le site + adresses « personnelles » ──
    const site = W.newAddress()
    // Mise de départ : retrait d'un exchange vers l'adresse du site, un mois avant les premiers versements
    const seedTx = exSeed.withdraw(site, r6(r.int(4, 12) * 100 + r.float(0, 99)), T - Math.round(r.float(28, 40) * DAY))
    const nV = r.int(5, 7)
    const k = r.int(0, nV - 1) // la plaignante ou le plaignant
    const sharedIdx = new Set(r.shuffle([...Array(nV).keys()].filter((i) => i !== k)).slice(0, 2))
    const victims = Array.from({ length: nV }, (_, i) => {
      const addr = i === k ? w.addr('ada', { entity: victimE, kind: 'ada_base' }) : w.addr('ada', { kind: 'ada_base' })
      const dep = sharedIdx.has(i) ? site : W.newAddress()
      return { addr, dep }
    })

    // ── Versements des victimes (1 à 3 chacune) ─────────────────────────────
    const pays: { tx: Tx; value: number; victim: number }[] = []
    let t = T
    const vk = victims[k]
    victims.forEach((v, i) => {
      const n = i === k ? 2 : r.int(1, 3)
      const values = Array.from({ length: n }, () => r.int(i === k ? 30 : 8, i === k ? 90 : 160) * 100)
      const times = values.map((_, j) => t + j * Math.round(r.float(2, 9) * DAY))
      for (let j = 1; j < times.length; j++) times[j] = Math.max(times[j], times[j - 1] + 2 * DAY)
      // La plaignante achète ses ADA sur Coinhouse avant chaque versement
      if (i === k) values.forEach((value, j) => cv.withdraw(v.addr, r6(value + r.float(20, 300)), times[j] - Math.round(r.float(6, 40) * HOUR)))
      values.forEach((value, j) => {
        pays.push({ tx: w.utxoTx({ time: times[j], from: [v.addr], to: [{ address: v.dep, value }] }), value, victim: i })
      })
      t += Math.round(r.float(1, 4) * DAY)
    })
    const lastIdentified = Math.max(...pays.map((p) => p.tx.time))
    // Versements directs sur l'adresse publiée par le site (investisseurs non identifiés)
    const nX = r.int(4, 5)
    const direct: { tx: Tx; value: number }[] = []
    for (let i = 0; i < nX; i++) {
      const a = w.addr('ada', { kind: 'ada_base' })
      const value = r.int(5, 60) * 100
      direct.push({ tx: w.utxoTx({ time: Math.round(r.float(T + DAY, lastIdentified)), from: [a], to: [{ address: site, value }] }), value })
    }
    const allPays = [...pays.map((p) => ({ tx: p.tx, value: p.value })), ...direct]
    const collected = r6(allPays.reduce((s, p) => s + p.value, 0))
    const plaigPays = pays.filter((p) => p.victim === k)
    const plaigTotal = r6(plaigPays.reduce((s, p) => s + p.value, 0))
    const lastPay = Math.max(...allPays.map((p) => p.tx.time))
    const nPayers = nV + nX

    // ── « Rendements » (schéma de Ponzi) : à la plaignante, et une fois à un autre investisseur ──
    const yieldFrom = (time: number) => W.addresses.filter((a) => w.unspentValue(a, time) > 500).sort((a, b) => w.unspentValue(b, time) - w.unspentValue(a, time))[0]
    const yields: Tx[] = []
    let ty = plaigPays[0].tx.time + Math.round(r.float(6, 8) * DAY)
    for (let j = 0; j < 2; j++) {
      const y = r6(plaigPays[0].value * r.float(0.018, 0.022))
      yields.push(w.utxoTx({ time: ty, from: [yieldFrom(ty)], to: [{ address: vk.addr, value: y }] }))
      ty += 7 * DAY + Math.round(r.float(-6, 6) * HOUR)
    }
    const yieldTotal = r6(yields.reduce((s, x) => s + x.outputs.find((o) => o.address === vk.addr)!.value, 0))
    const jIdx = r.pick([...Array(nV).keys()].filter((i) => i !== k))
    const vj = victims[jIdx]
    const vjFirst = pays.find((p) => p.victim === jIdx)!
    const tyj = vjFirst.tx.time + Math.round(r.float(6, 9) * DAY)
    const yieldJ = w.utxoTx({ time: tyj, from: [yieldFrom(tyj)], to: [{ address: vj.addr, value: r6(vjFirst.value * r.float(0.018, 0.022)) }] })

    // ── Regroupement de toutes les adresses du portefeuille ─────────────────
    const consT = Math.max(lastPay, ty, tyj) + Math.round(r.float(1, 4) * DAY)
    const holders = [...new Set(stakeSiblings(w, site))].filter((a) => w.unspentValue(a, consT) > 0)
    const main = W.newAddress()
    const consIn = holders.reduce((s, a) => s + w.unspentValue(a, consT), 0)
    const consFee = w.estimateFee('ada', holders.length, 1)
    const cons = w.utxoTx({ time: consT, from: holders, to: [{ address: main, value: floor6(consIn - consFee) }], fee: consFee, change: null, spendAll: true })

    // ── Verrouillage sur un contrat avec datum (bénéficiaire = portefeuille de l'escroc) ──
    const script = adaScript(w, { label: 'Contrat de verrouillage à échéance (vesting)', name: 'Vesting à échéance (Plutus V2)' })
    const ben = W.newAddress()
    const lockT = consT + Math.round(r.float(3, 20) * HOUR)
    const lockVal = r6(Math.round(cons.outputs[0].value * r.float(0.25, 0.35) / 1000) * 1000)
    const deadline = lockT + r.int(150, 330) * DAY
    const pkh = keccak256(`pkh:${A(w, ben)}`).slice(0, 56)
    const datum =
      `{"constructor":0,"fields":[{"bytes":"${pkh}"},{"int":${deadline * 1000}}]}\n` +
      `Décodé : beneficiaire = ${A(w, ben)}\n` +
      `         echeance = ${deadline * 1000} (POSIX ms, ${fmtDate(deadline, false)})`
    const lock = lockToScript(w, { from: main, script, value: lockVal, time: lockT, datum })
    const afterLock = lock.outputs.find((o) => o.address !== script)!.address

    // ── Découpage en lots : trois lots quasi identiques et deux petites sorties ──
    const fanT = lockT + Math.round(r.float(1, 4) * DAY)
    const avail = w.unspentValue(afterLock, fanT)
    const X = Math.round((avail * r.float(0.2, 0.24)) / 500) * 500
    const lots = [W.newAddress(), W.newAddress(), W.newAddress()]
    const lotVals = [X, r6(X * (1 + r.float(0.001, 0.0035))), r6(X * (1 - r.float(0.001, 0.0035)))]
    const smalls = [W.newAddress(), W.newAddress()]
    const smallVals = smalls.map(() => r6(Math.round(avail * r.float(0.025, 0.05))))
    const fan = w.utxoTx({ time: fanT, from: [afterLock], to: [...lots.map((a, i) => ({ address: a, value: lotVals[i] })), ...smalls.map((a, i) => ({ address: a, value: smallVals[i] }))] })
    const restOut = fan.outputs.find((o) => !lots.includes(o.address) && !smalls.includes(o.address))!

    // Trois lots envoyés dans la même demi-heure : plateforme, tiers (autre clé de staking), adresse neuve du portefeuille
    const exDep = adaEnterprise(w, { entity: ex.entity, label: `${ex.entity.name} — Adresse de dépôt`, tags: ['deposit'] })
    // Le tiers : un acheteur de gré à gré, avec son propre portefeuille et sa propre vie
    const buyer = adaWallet(w, {})
    const buyerAddr = buyer.newAddress()
    const ownDormant = W.newAddress()
    const dests = [exDep, buyerAddr, ownDormant]
    const roles = r.shuffle([0, 1, 2]) // roles[i] : destination du lot i
    const twinT = fanT + Math.round(r.float(2, 10) * HOUR)
    const slots = r.shuffle([0, 1, 2]).map((s) => twinT + s * r.int(4, 11) * 60 + r.int(0, 59))
    const lotTx: Tx[] = []
    lots.forEach((a, i) => {
      const fee = w.estimateFee('ada', 1, 1)
      lotTx[roles[i]] = w.utxoTx({ time: slots[i], from: [a], to: [{ address: dests[roles[i]], value: floor6(lotVals[i] - fee) }], fee, change: null, spendAll: true })
    })
    const exTx = lotTx[0]
    const buyerTx = lotTx[1]
    const ownTx = lotTx[2]
    const deposit = exTx.outputs[0].value

    // Balayage vers le portefeuille chaud, avec les dépôts d'autres clients
    const swT = exTx.time + Math.round(r.float(1, 6) * HOUR)
    const others = Array.from({ length: r.int(2, 5) }, () => {
      const d = adaEnterprise(w, { entity: ex.entity, label: `${ex.entity.name} — Adresse de dépôt`, tags: ['deposit'] })
      w.fund(d, r.int(3, 400) * 50, swT - r.int(600, 20 * 3600))
      return d
    })
    const swFrom = r.shuffle([exDep, ...others])
    const swIn = swFrom.reduce((s, d) => s + w.unspentValue(d, swT), 0)
    const swFee = w.estimateFee('ada', swFrom.length, 1)
    const sweep = w.utxoTx({ time: swT, from: swFrom, to: [{ address: ex.hot, value: floor6(swIn - swFee) }], fee: swFee, change: null, spendAll: true, tags: ['sweep'], method: 'consolidation' })

    // ── Habillage (après le flux réel) ──────────────────────────────────────
    // La plaignante : une petite épargne en ADA avant les faits
    const tSave = T - Math.round(r.float(60, 90) * DAY)
    cv.withdraw(vk.addr, r6(r.int(3, 8) * 100 + r.float(0, 50)), tSave)
    w.utxoTx({ time: tSave + Math.round(r.float(10, 25) * DAY), from: [vk.addr], to: [{ address: w.addr('ada', { kind: 'ada_base' }), value: r6(r.int(40, 150)) }], change: vk.addr })
    // L'investisseur payé en « intérêts » : vie ordinaire avant les faits
    priorHistory(w, vj.addr, { start: T - 70 * DAY, end: vjFirst.tx.time - 3 * DAY, nIn: r.int(4, 5), nOut: r.int(2, 3), maxUsd: 900, sources: [cv.hot, exSeed.hot] })
    // L'acheteur de gré à gré : une vie ordinaire avant et après (retraits d'exchange, achats, transferts)
    for (let i = 0; i < r.int(3, 4); i++) ex.withdraw(buyerAddr, r6(r.int(4, 40) * 50), twinT - Math.round(r.float(5, 60) * DAY))
    const nft = w.customEntity({ name: 'Bazar CNFT', category: 'nft_marketplace', known: true, description: 'Place de marché (fictive) de NFT Cardano : paiement en ADA à un contrat de vente, sans compte obligatoire.' })
    w.utxoTx({ time: twinT + Math.round(r.float(2, 6) * DAY), from: [buyerAddr], to: [{ address: w.addr('ada', { entity: nft, label: `${nft.name} — Vente` }), value: r6(r.int(2, 9) * 100) }], change: buyerAddr })
    w.utxoTx({ time: twinT + Math.round(r.float(6, 15) * DAY), from: [buyerAddr], to: [{ address: w.addr('ada', { kind: 'ada_base' }), value: r6(X * r.float(0.4, 0.7)) }], change: buyerAddr })
    // Petites sorties du découpage : l'une sert à des achats, l'autre est ré-éclatée dans le portefeuille
    const watch = w.customEntity({ name: 'Maison Ferval (horlogerie)', category: 'merchant', known: true, description: 'Horloger-bijoutier (fictif) acceptant les paiements en ADA via un prestataire de paiement : facture nominative et livraison à une adresse postale.' })
    const shops = [watch, nft]
    const paidShops = new Set<string>()
    const buyTimes = Array.from({ length: r.int(2, 3) }, () => fanT + Math.round(r.float(1, 9) * DAY)).sort((a, b) => a - b)
    for (const tt of buyTimes) {
      const v = r6(smallVals[0] * r.float(0.15, 0.3))
      const shop = r.pick(shops)
      if (w.unspentValue(smalls[0], tt) < v + 1) continue
      w.utxoTx({ time: tt, from: [smalls[0]], to: [{ address: w.addr('ada', { entity: shop, label: `${shop.name} — Paiement` }), value: v }], change: smalls[0] })
      paidShops.add(shop.name)
    }
    const nSub = r.int(2, 3)
    const tSub = fanT + Math.round(r.float(1, 3) * DAY)
    for (let i = 0; i < nSub; i++) {
      const tt = tSub + i * 900
      w.utxoTx({ time: tt, from: [smalls[1]], to: [{ address: W.newAddress(), value: r6(smallVals[1] / (nSub + 1)) }], change: smalls[1] })
    }

    // ── Bruit : autres utilisateurs de Cardano, activité des plateformes ───
    ex.noise(14, T - 3 * DAY, exTx.time + 5 * DAY)
    exSeed.noise(6, seedTx.time - 5 * DAY, seedTx.time + 5 * DAY)
    cv.noise(6, T - 5 * DAY, T + 20 * DAY)
    const strangers = [w.addr('ada', { kind: 'ada_base' }), w.addr('ada', { kind: 'ada_base' })]
    for (const d of strangers) {
      for (let j = 0; j < r.int(1, 3); j++) w.fund(d, r.int(5, 120) * 100, T + r.int(-20, 20) * DAY)
      w.utxoTx({ time: exTx.time + r.int(1, 10) * DAY, from: [d], to: [{ address: w.addr('ada'), value: r.int(2, 40) * 100 }] })
    }

    // ── Réponses (monde final) ──────────────────────────────────────────────
    const family = stakeSiblings(w, site)
    const nFamily = family.length
    const fakeStakes = Array.from({ length: 3 }, () => cardanoStakeAddress(cardanoStakeTail(r)))
    const forumW = r.shuffle([site, ...victims.filter((v, i) => i !== k && v.dep !== site).map((v) => v.dep)]).slice(0, 4)
    const forumDecoys = [vj.addr, strangers[0]]
    const forum = r.shuffle([...forumW, ...forumDecoys])
    const name = ex.entity.name
    const collectedUsd = usd('ADA', collected)
    const tail = W.tail
    const stakeOf = (a: string) => w.get(a).stake ?? '—'
    const restNow = w.unspentValue(restOut.address)
    const seedDays = Math.round((T - seedTx.time) / DAY)
    const shopTxt = [...paidShops].join(' et ')
    // Pièces rédigées en journée (heure de Paris ≈ UTC + 1 ou 2)
    const dayTime = (t: number) => Math.floor(t / DAY) * DAY + r.int(8, 15) * HOUR + r.int(0, 59) * 60
    const lotLine = (tx: Tx) => `${hm(tx.time)} · ${ada(tx.outputs[0].value)} → ${A(w, tx.outputs[0].address).slice(0, 14)}…`

    return {
      world: w,
      title: `Faux pool de staking « ${P.name} »`,
      briefing:
        `${plaig.name}, ${g('domicilié', 'domiciliée')} à ${city}, a investi ${ada(plaigTotal)} dans « ${P.name} » (ticker ${P.ticker}), présenté sur les réseaux sociaux comme un pool de staking Cardano offrant un « rendement garanti de 2 % par semaine ». Après deux versements de « rendement », plus rien ; le site a fermé. ${g('Il', 'Elle')} a porté plainte pour escroquerie.\n\n` +
        `Sur Cardano, une adresse de base (addr1q…) combine une partie « paiement » et une partie « staking ». Un même portefeuille réutilise sa clé de staking pour toutes ses adresses : elle se lit à la fin de chaque adresse et regroupe le portefeuille sans qu'aucune transaction commune soit nécessaire. Les adresses « enterprise » (addr1v…) n'ont pas de partie staking ; les adresses de script (addr1w…) verrouillent des fonds avec une donnée (datum) que le contrat lira.\n\n` +
        `Attention : avoir échangé des fonds avec le portefeuille ne fait pas partie du portefeuille. Seule la clé de staking fait foi pour le regroupement ; les flux servent à corroborer.\n\n` +
        `Votre mission : établir que toutes les adresses de dépôt appartiennent au même portefeuille, écarter celles qui lui ressemblent, chiffrer la collecte, lire le contrat sur lequel une partie des fonds est verrouillée, puis suivre les lots jusqu'à la plateforme.`,
      evidence: [
        {
          id: 'plainte', type: 'plainte', title: 'Procès-verbal de plainte (extrait)', date: dayTime(exTx.time + r.int(2, 6) * DAY), author: plaig.name,
          body:
            `« Sur le site, chaque investisseur avait un « espace client » qui affichait une adresse de dépôt personnelle. La mienne : ${A(w, vk.dep)}.\n\n` +
            `J'achetais mes ADA sur Coinhouse et je les envoyais depuis mon portefeuille ${A(w, vk.addr)} : deux virements, le ${fmtDate(plaigPays[0].tx.time, false)} et le ${fmtDate(plaigPays[1].tx.time, false)}. On m'a versé deux fois des « intérêts », ce qui m'a ${g('mis', 'mise')} en confiance, puis plus rien. Le support m'a parlé d'un « blocage des fonds dans le contrat de staking jusqu'à l'échéance ». »`,
        },
        {
          id: 'site', type: 'capture', title: `Capture du site de « ${P.name} » (archive)`, date: T - r.int(5, 20) * DAY,
          body:
            `${P.name} — Pool de staking ${P.ticker}\n` +
            `★ Rendement GARANTI : 2 % par semaine, versé chaque semaine sur votre adresse\n` +
            `★ Vos ADA sont « stakés » dans notre contrat sécurisé et vous sont restitués à l'échéance\n\n` +
            `Pour participer : connectez-vous à votre espace client et envoyez vos ADA à votre adresse personnelle, ou directement à l'adresse du pool :\n${A(w, site)}`,
        },
        {
          id: 'forum', type: 'forum', title: 'Fil de discussion de victimes sur un forum', date: exTx.time + r.int(1, 4) * DAY, author: `@${handle}`,
          body:
            `On recense les adresses ${de(P.name)} pour les transmettre à la police. Voilà celles que les membres m'ont envoyées :\n` +
            forum.map((a) => `- ${A(w, a)}`).join('\n') +
            `\n\nCertaines apparaissent dans les versements d'« intérêts » reçus par des membres, c'est bien la preuve que c'est leur caisse ! Attention quand même, certains ont pu se tromper et coller leur propre adresse…`,
        },
        {
          id: 'otc', type: 'telegram', title: 'Extraction Telegram : annonce sur un groupe de gré à gré', date: twinT - Math.round(r.float(6, 30) * HOUR), author: `@${P.ticker.toLowerCase()}_ops (compte supprimé depuis)`,
          body:
            `[annonce] Vends ${(X / 1000).toLocaleString('fr-FR')}k ADA contre espèces ou virement SEPA, remise 4 %. Un seul lot, paiement d'abord, ADA envoyés dans la foulée. MP.\n` +
            `[réponse privée, capturée par un membre du groupe] OK pour le lot. Paiement fait, j'attends les ADA sur mon adresse habituelle.`,
        },
        {
          id: 'note', type: 'note', title: 'Note du chef de groupe — Cardano', date: dayTime(exTx.time + r.int(3, 7) * DAY), author: 'Chef de groupe — Section de recherches',
          body:
            `• Dans l'inspecteur, une adresse de base affiche sa clé de staking (stake1u…) et les autres adresses connues qui la partagent ; le cluster les regroupe.\n` +
            `• Une adresse qui a reçu des fonds du portefeuille (« intérêts », lot vendu) n'en fait pas partie pour autant : comparez la clé de staking.\n` +
            `• Une sortie envoyée à une adresse de script porte un datum : le panneau « Datums (eUTXO) » de la transaction l'affiche, avec sa forme décodée.\n` +
            `• Les plateformes utilisent souvent des adresses « enterprise » (addr1v…) pour les dépôts de leurs clients, ensuite balayées avec d'autres dépôts vers un portefeuille chaud.\n` +
            `• Rappel : déléguer ses ADA à un vrai pool de staking ne les déplace pas. Ils restent dans le portefeuille de leur propriétaire.`,
        },
      ],
      seeds: [vk.addr],
      objectives: [
        {
          id: 'o1', type: 'choice', points: 7,
          prompt: `Quelle est la clé de staking de l'adresse de dépôt « personnelle » communiquée ${lp.a} ?`,
          ...choice(r, W.stake, fakeStakes),
          hint: 'Sélectionnez l\'adresse de dépôt citée dans la plainte : l\'inspecteur affiche sa clé de staking sous l\'en-tête.',
          explanation: `${W.stake}. La partie staking est encodée à la fin de l'adresse de base (avant les 6 caractères de somme de contrôle) : …${tail.slice(0, 12)}…${tail.slice(-6)}. Toute adresse qui porte ce même segment est dérivée du même portefeuille, à une réserve près (voir la question sur les limites).`,
        },
        {
          id: 'o2', type: 'number', points: 8,
          prompt: `Combien d'adresses connues (en comptant celle ${lp.de}) partagent cette clé de staking ?`,
          answer: nFamily,
          hint: 'Le panneau de la clé de staking indique combien d\'autres adresses connues la partagent ; le cluster les liste.',
          explanation: `${nFamily} adresses : l'adresse « du pool » publiée sur le site, ${victims.filter((v) => v.dep !== site).length} adresses « personnelles » remises aux investisseurs, les adresses de rendu créées par le portefeuille à chaque dépense, l'adresse de regroupement, l'adresse désignée dans le datum, les adresses du découpage en lots et celles qui en sont issues. Les « espaces clients » ne faisaient que dériver de nouvelles adresses du même portefeuille : l'escroc n'avait qu'une seule caisse. L'acheteur de gré à gré et les investisseurs qui ont touché des « intérêts » ont reçu des fonds du portefeuille, mais pas sa clé : ils n'entrent pas dans ce compte.`,
        },
        {
          id: 'o3', type: 'addresses', points: 9,
          prompt: 'Parmi les adresses recensées sur le forum des victimes, lesquelles appartiennent au portefeuille de l\'escroc ?',
          answer: forumW,
          hint: `Ouvrez chaque adresse et comparez sa clé de staking à celle de l'adresse de dépôt ${lp.de}. Avoir reçu des fonds du portefeuille ne suffit pas.`,
          explanation: `${forumW.length} adresses portent la clé ${W.stake.slice(0, 16)}… : ${forumW.map((a) => A(w, a).slice(0, 12) + '…').join(', ')}. Les deux autres sont des pièges. ${A(w, vj.addr).slice(0, 12)}… a bien reçu un « intérêt » du portefeuille (${yieldJ.hash.slice(0, 10)}…), ce qui a convaincu l'auteur du fil, mais sa clé de staking est ${stakeOf(vj.addr).slice(0, 16)}… : c'est l'adresse d'un investisseur, donc d'une victime, qui a lui-même versé des ADA au pool. ${A(w, strangers[0]).slice(0, 12)}… n'a aucun lien, ni de clé ni de flux. Les intégrer à la procédure aurait mis en cause des tiers.`,
        },
        {
          id: 'o4', type: 'amount', points: 9, unit: 'ADA', tolerance: 0.01,
          prompt: 'Quel montant total (en ADA) les investisseurs ont-ils versé sur les adresses du portefeuille ?',
          answer: collected,
          hint: 'Additionnez les entrées venues de particuliers sur les adresses de la famille de staking. Écartez les mouvements internes (rendus, regroupement) et l\'apport initial venu d\'un exchange.',
          explanation: `${allPays.length} versements de ${nPayers} investisseurs (dont ${nX} investisseurs non identifiés qui ont payé directement sur l'adresse publiée par le site, sans espace client), soit ${ada(collected)} (environ ${usdFmt(collectedUsd)}), dont ${ada(plaigTotal)} pour ${lp.la}. Les mouvements entre adresses de la même clé de staking ne sont pas de la collecte, et les ${ada(seedTx.outputs.find((o) => o.address === site)!.value)} reçus ${de(exSeed.entity.name)} ${seedDays} jours avant les premiers versements sont la mise de départ de l'escroc : les compter gonflerait le préjudice.`,
        },
        {
          id: 'o5', type: 'amount', points: 7, unit: 'ADA', tolerance: 0.01,
          prompt: `Combien d'ADA ont été reversés ${lp.a} sous forme de « rendements » ?`,
          answer: yieldTotal,
          hint: `Regardez les entrées de l'adresse ${lp.de} qui viennent d'adresses de la même clé de staking que le pool (et non de Coinhouse).`,
          explanation: `Deux versements, ${yields.map((y) => ada(y.outputs.find((o) => o.address === vk.addr)!.value)).join(' et ')}, soit ${ada(yieldTotal)}, environ 2 % de son premier dépôt par semaine. Ils viennent des adresses de l'escroc, c'est-à-dire de l'argent des autres investisseurs : la mécanique d'un schéma de Ponzi. Ces sommes viennent en déduction du préjudice ${lp.de} ; ses autres entrées sont ses achats sur Coinhouse.`,
        },
        {
          id: 'o6', type: 'tx', points: 8,
          prompt: 'Quelle transaction verrouille une partie des fonds sur un contrat ?',
          answer: [lock.id],
          hint: 'Après le regroupement de toutes les adresses, une dépense envoie des ADA vers une adresse addr1w… (adresse de script).',
          explanation: `${lock.hash.slice(0, 16)}… envoie ${ada(lockVal)} vers ${A(w, script).slice(0, 16)}…, une adresse de script (contrat « vesting » à échéance), avec un datum sur la sortie ; le reste revient en rendu à une adresse de la même clé de staking. C'est le « contrat de staking » invoqué par le support : un simple coffre, immobile jusqu'au ${fmtDate(deadline, false)}, dont le bénéficiaire est l'escroc. L'échéance donne une date à surveiller pour une saisie.`,
        },
        {
          id: 'o8', type: 'address', points: 9,
          prompt: 'Quelle adresse le datum désigne-t-il comme bénéficiaire ?',
          answer: [ben],
          hint: 'Ouvrez la transaction de verrouillage, panneau « Datums (eUTXO) » : la forme décodée donne le bénéficiaire. Cherchez ensuite cette adresse.',
          explanation: `Le datum contient le hash de la clé de paiement du bénéficiaire et l'échéance (POSIX en millisecondes) ; décodé, il désigne ${A(w, ben)}. Cette adresse n'a encore jamais reçu de transaction, mais elle porte la même clé de staking que les adresses de dépôt : seul le portefeuille de l'escroc pourra récupérer les fonds à l'échéance.`,
        },
        {
          id: 'o13', type: 'tx', points: 12,
          prompt: `Le ${fmtDate(Math.min(...slots))}, trois transactions de près de ${ada(X)} quittent le portefeuille en moins d'une demi-heure. Laquelle alimente une plateforme ?`,
          answer: [exTx.id],
          hint: 'Suivez chacun des trois lots. Regardez le type d\'adresse de destination, sa clé de staking, et ce qu\'elle fait ensuite.',
          explanation:
            `Les trois lots :\n${[exTx, buyerTx, ownTx].sort((a, b) => a.time - b.time).map(lotLine).join('\n')}\n` +
            `Seul ${exTx.hash.slice(0, 14)}… envoie vers une adresse enterprise (addr1v…, sans clé de staking) étiquetée ${name}, balayée ${((swT - exTx.time) / 3600).toFixed(1).replace('.', ',')} h plus tard avec d'autres dépôts vers le portefeuille chaud : c'est le schéma d'un dépôt client.\n` +
            `${buyerTx.hash.slice(0, 14)}… part vers une adresse de base dont la clé de staking (${stakeOf(buyerAddr).slice(0, 16)}…) n'est pas celle de l'escroc : c'est un tiers, l'acheteur du lot annoncé sur le groupe de gré à gré, avec son propre historique (retraits d'exchange, achats). Une piste de témoin, pas une sortie vers un service.\n` +
            `${ownTx.hash.slice(0, 14)}… part vers une adresse neuve qui porte la clé de l'escroc : les ADA ne quittent pas son portefeuille.`,
        },
        {
          id: 'o14', type: 'address', points: 9,
          prompt: 'Parmi les trois destinataires de ces lots, lequel appartient encore au portefeuille de l\'escroc ?',
          answer: [ownDormant],
          hint: 'Comparez la clé de staking de chaque destinataire à celle de l\'adresse « du pool ».',
          explanation: `${A(w, ownDormant)} porte la clé ${W.stake.slice(0, 16)}… : l'escroc y a simplement « rangé » un lot. Les ${ada(ownTx.outputs[0].value)} n'en ont pas bougé : ils restent saisissables avec le portefeuille (phrase de récupération, appareil). L'adresse de l'acheteur, elle aussi addr1q…, ressemble à une adresse sœur mais porte une autre clé de staking ; l'adresse de dépôt ${name} n'a pas de partie staking du tout.`,
        },
        {
          id: 'o9', type: 'entity', points: 8,
          prompt: 'Vers quelle plateforme un lot est-il rapatrié ?',
          answer: [exKey],
          hint: 'Suivez le lot qui part vers une adresse addr1v… étiquetée, puis son balayage.',
          explanation: `${ada(deposit)} arrivent sur une adresse de dépôt ${de(name)}, balayée vers son portefeuille chaud. ${procedureFor(ex.entity)} Avec l'adresse de dépôt et le hash, la plateforme identifie le compte, son KYC et ses retraits ; une demande de gel s'impose.`,
        },
        {
          id: 'o10', type: 'address', points: 8,
          prompt: 'Quelle est l\'adresse de dépôt utilisée sur cette plateforme ?',
          answer: [exDep],
          hint: 'Une adresse addr1v… : « enterprise », sans partie staking.',
          explanation: `${A(w, exDep)} : adresse « enterprise » (addr1v…), sans clé de staking, courante pour les adresses de dépôt des plateformes. Elle ne se rattache au portefeuille de l'escroc que par la transaction qui l'alimente (${exTx.hash.slice(0, 12)}…). Le reste du découpage (${ada(restNow)} sur ${A(w, restOut.address).slice(0, 14)}…) n'a pas bougé.`,
        },
        {
          id: 'o12', type: 'entity', points: 7,
          prompt: 'Quel exchange a fourni les tout premiers ADA du portefeuille, avant l\'ouverture du « pool » ?',
          answer: [seedKey],
          hint: 'Remontez l\'entrée la plus ancienne de l\'adresse publiée sur le site.',
          explanation: `Le ${fmtDate(seedTx.time, false)}, ${seedDays} jours avant les premiers versements, le portefeuille chaud ${de(exSeed.entity.name)} verse ${ada(seedTx.outputs.find((o) => o.address === site)!.value)} sur l'adresse du site : un retrait client, qui fait du titulaire de ce compte un suspect sérieux. Deuxième réquisition, indépendante de la sortie. ${procedureFor(exSeed.entity)}`,
        },
        {
          id: 'o11', type: 'choice', points: 7,
          prompt: 'Que vaut l\'heuristique de la clé de staking partagée ?',
          ...choice(r,
            'Elle est forte (visible sans transaction, propre au portefeuille) mais pas absolue : n\'importe qui peut fabriquer une adresse avec la partie staking d\'un tiers, et les adresses enterprise y échappent',
            [
              'Elle est infaillible : une clé de staking prouve à elle seule l\'identité du propriétaire',
              'Elle est plus faible que les flux : toute adresse qui a reçu des fonds du portefeuille en fait partie',
              'Elle ne vaut rien sur Cardano, où chaque adresse est indépendante comme sur Bitcoin',
            ]),
          hint: 'Qui choisit la partie staking d\'une adresse ? Et que contient une adresse addr1v… ?',
          explanation: `Un portefeuille met sa propre clé de staking dans toutes ses adresses de base : le regroupement est immédiat, avant même la première dépense, et plus robuste que les entrées communes (pas d'exception de type CoinJoin). Mais la partie staking n'est qu'une donnée de l'adresse : on peut construire une adresse dont la partie paiement est à soi et la partie staking à quelqu'un d'autre, et les adresses enterprise n'ont pas de partie staking. À l'inverse, recevoir des fonds du portefeuille (un « intérêt », un lot vendu) ne fait pas entrer une adresse dans le portefeuille. On corrobore donc par les flux (regroupement, rendus), comme ici. Rappel : une vraie délégation ne déplace jamais les ADA ; exiger un envoi avec 2 % garantis par semaine signe l'escroquerie.`,
        },
      ],
      truth: {
        path: [seedTx.id, ...allPays.map((p) => p.tx.id), ...yields.map((y) => y.id), yieldJ.id, cons.id, lock.id, fan.id, exTx.id, sweep.id],
        addresses: [...new Set([vk.dep, site, ...victims.map((v) => v.dep)]), main, ben, afterLock, ...lots, exDep, script, ownDormant],
        debrief:
          `1. ${P.name} remet à chaque investisseur une adresse « personnelle » : ce sont des adresses de base du même portefeuille, toutes porteuses de la clé de staking ${W.stake} (${nFamily} adresses connues au total). Le portefeuille avait reçu une mise de départ ${de(exSeed.entity.name)}.\n` +
          `2. ${nPayers} investisseurs versent ${ada(collected)} en ${allPays.length} virements ; ${lp.la} reçoit ${ada(yieldTotal)} de « rendements », un autre investisseur un versement du même genre : de l'argent prélevé sur les dépôts des autres (Ponzi).\n` +
          `3. ${cons.hash.slice(0, 12)}… regroupe toutes les adresses sur ${A(w, main).slice(0, 16)}… ; ${lock.hash.slice(0, 12)}… verrouille ${ada(lockVal)} sur un contrat de vesting dont le datum désigne ${A(w, ben).slice(0, 16)}… (même clé de staking), échéance au ${fmtDate(deadline, false)}.\n` +
          `4. ${fan.hash.slice(0, 12)}… découpe le reste en trois lots d'environ ${ada(X)} et deux petites sorties (l'une dépensée chez ${shopTxt}, l'autre ré-éclatée dans le portefeuille). Le ${fmtDate(twinT, false)}, les trois lots partent en moins d'une demi-heure : ${ada(deposit)} chez ${name} (${A(w, exDep).slice(0, 16)}…), un lot vendu de gré à gré à un tiers (autre clé de staking), un lot rangé sur une adresse neuve du portefeuille, qui dort.\n\n` +
          `À retenir : sur Cardano, la clé de staking regroupe un portefeuille dès sa première adresse, sans attendre une dépense commune ; c'est un indice fort, à corroborer. Elle sert aussi à exclure : une adresse qui a reçu des fonds du portefeuille (investisseur payé en « intérêts », acheteur d'un lot) mais porte une autre clé n'en fait pas partie. Face à des lots jumeaux, on départage par le type d'adresse (enterprise de plateforme, base d'un tiers, base du portefeuille) et par le comportement ultérieur (balayage). Les datums sont publics et lisibles : ils disent qui pourra récupérer des fonds verrouillés, et quand.`,
      },
      hints: [
        `Ouvrez l'adresse de dépôt ${lp.de} : sa clé de staking et les adresses qui la partagent s'affichent sous l'en-tête.`,
        'Le cluster d\'une adresse de base inclut toutes les adresses de la même clé de staking : partez de là pour chiffrer la collecte, sans compter l\'apport venu d\'un exchange.',
        'Une adresse qui a reçu des fonds du portefeuille n\'en fait pas partie si sa clé de staking diffère.',
        'La transaction qui envoie des ADA vers une adresse addr1w… porte un datum : sa forme décodée désigne une adresse à rechercher.',
        'Pour les trois lots jumeaux, regardez le type d\'adresse de chaque destinataire (addr1v ou addr1q, et quelle clé) puis ce qu\'elle devient.',
      ],
    }
  },
}
