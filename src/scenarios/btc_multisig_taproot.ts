import { World, type Tx, type TxFingerprint } from '../engine/world'
import { exchange, openChannel, roundCoin, HOUR, DAY } from '../engine/patterns'
import { priorHistory } from '../engine/realism'
import { txSize } from '../engine/script'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, de, fakeCity, fakePerson, fmtDate, procedureFor, type FakePerson } from './util'

const r8 = (v: number) => Math.round(v * 1e8) / 1e8
const sat = (n: number) => Math.round(n) / 1e8
const btc = (v: number) => amt(r8(v), 'BTC')

const ASSOS = [
  { name: 'Les Voiles du Ponant', what: 'école de voile associative', why: 'les dons de ses adhérents et le produit de ses régates caritatives', campaign: 'la régate caritative d\'automne', supplier: 'voilerie' },
  { name: 'Les Ateliers du Littoral', what: 'ressourcerie et atelier de réparation de vélos', why: 'les dons de soutien collectés lors de ses campagnes en ligne', campaign: 'la campagne « Un vélo pour tous »', supplier: 'grossiste en pièces détachées de cycles' },
  { name: 'Rando Partage', what: 'association de randonnée adaptée aux personnes à mobilité réduite', why: 'les dons de ses sympathisants, qu\'elle accepte en bitcoins depuis 2021', campaign: 'l\'achat d\'une joëlette tout-terrain', supplier: 'fabricant de matériel de randonnée adaptée' },
  { name: 'Le Fil d\'Ariane', what: 'association d\'aide aux devoirs', why: 'un legs et les dons de parrains, convertis en bitcoins sur décision de l\'assemblée générale', campaign: 'la rentrée solidaire', supplier: 'librairie et papeterie scolaire' },
]
/** Heure de Paris (0–23) d'un horodatage. */
const parisHour = (ts: number) => Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Europe/Paris' }).format(new Date(ts * 1000)))

type Role = 'pres' | 'tres' | 'sec'

export const btcMultisigTaproot: ScenarioTemplate = {
  id: 'multisig-taproot',
  title: 'Le coffre à trois clés',
  tagline: 'Un coffre 2-sur-3 vidé : le témoin dit quelles clés ont signé, Taproot brouille la suite, et le butin dort dans un second coffre.',
  description:
    'La trésorerie en bitcoins d\'une association, protégée par un coffre multisignature 2-sur-3, a été entièrement vidée. Lisez les témoins des dépenses pour savoir quelles clés ont signé, comparez-les avec une dépense légitime, suivez les fonds dans un portefeuille Taproot (empreinte, taille et poids, rendu, consolidation, dépôt), puis démêlez trois transferts jumeaux pour localiser le coffre 2-sur-2 où les auteurs ont mis le reste du butin à l\'abri.',
  difficulty: 3,
  chains: ['btc'],
  skills: ['lecture_tx', 'utxo', 'change', 'cioh', 'exchange_id', 'gel'],
  estMinutes: 65,
  lessons: ['bitcoin-moderne', 'change-heuristics', 'analyse-comportementale'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const T = w.at(0)
    const AS = r.pick(ASSOS)
    const city = fakeCity(r)
    const pres = fakePerson(r)
    let tres = fakePerson(r)
    while (tres.name === pres.name) tres = fakePerson(r)
    let anc = fakePerson(r)
    while (anc.name === pres.name || anc.name === tres.name) anc = fakePerson(r)
    const holder: Record<Role, FakePerson> = { pres, tres, sec: anc }
    const roleLabel: Record<Role, string> = {
      pres: pres.g('président', 'présidente'),
      tres: tres.g('trésorier', 'trésorière'),
      sec: `${anc.g('ancien trésorier', 'ancienne trésorière')}, ${anc.g('détenteur', 'détentrice')} de la clé de secours`,
    }

    const assoE = w.customEntity({ name: `Association « ${AS.name} »`, category: 'victim' })
    const thiefE = w.customEntity({ name: 'Auteur du détournement (non identifié)', category: 'suspect' })
    const supplierE = w.customEntity({ name: `Fournisseur de l'association (${AS.supplier})`, category: 'individual' })
    const exKey = r.pick(['kraken', 'bitstamp', 'binance', 'okx', 'coinbase'] as const)
    const ex = exchange(w, exKey, 'btc')
    const cv = exchange(w, 'coinhouse', 'btc')
    /** Même jour (heure de Paris), entre `hMin` et `hMax` heures. */
    const atHour = (ts: number, hMin: number, hMax: number) => ts - parisHour(ts) * HOUR - (ts % HOUR) + Math.round(r.float(hMin, hMax) * HOUR)
    // Commerçants propres au dossier (fictifs) : revendeur de cartes cadeaux (adresses de paiement
    // balayées vers son portefeuille) et casino en ligne
    const shopE = w.customEntity({ name: 'Kdo Express', category: 'merchant', known: true, description: 'Revendeur en ligne (fictif) de cartes cadeaux payables en bitcoin : une adresse de paiement par commande, balayée vers le portefeuille du marchand ; le code est livré par courriel.' })
    const shopHot = w.addr('btc', { entity: shopE, label: `${shopE.name} — Portefeuille du marchand`, tags: ['liquid', 'hot'], kind: 'p2wpkh' })
    const shopAddr = () => w.addr('btc', { entity: shopE, label: `${shopE.name} — Adresse de paiement`, tags: ['deposit'], kind: 'p2wpkh' })
    const shopSweep = (addrs: string[], time: number) => {
      const others = Array.from({ length: r.int(2, 5) }, () => {
        const d = shopAddr()
        w.fund(d, roundCoin(w, 0.0005, 0.02, 0.0001), time - r.int(600, 20 * HOUR))
        return d
      })
      const all = r.shuffle([...addrs, ...others])
      const total = all.reduce((s, d) => s + w.unspentValue(d, time), 0)
      const fee = w.estimateFee('btc', all.length, 1)
      return w.utxoTx({ time, from: all, to: [{ address: shopHot, value: r8(total - fee) }], fee, change: null, spendAll: true, tags: ['sweep'], method: 'consolidation' })
    }
    const casinoE = w.customEntity({ name: 'Casino Nébuleuse', category: 'gambling', known: true, description: 'Casino en ligne (fictif) acceptant le bitcoin, sans vérification d\'identité.' })

    // ── Garde des clés : rang dans le descripteur (multi, ordre fixe) ────────
    const order = r.shuffle(['pres', 'tres', 'sec'] as Role[])
    const keyOf = (role: Role) => order.indexOf(role) + 1
    const accomplice: Role = r.pick(['pres', 'tres'] as const)
    const L = [keyOf('pres'), keyOf('tres')].sort((a, b) => a - b)
    const F = [keyOf('sec'), keyOf(accomplice)].sort((a, b) => a - b)
    const signAll = (tx: Tx, keys: number[]) => {
      tx.multisigSigners = Object.fromEntries(tx.inputs.map((_, n) => [n, [...keys]]))
    }

    // ── Le coffre : adresses P2WSH 2-sur-3 d'un même portefeuille ────────────
    // V : adresse des dons publiée sur le site ; V2 : adresse de la campagne ;
    // V3 : rendu de la dépense légitime.
    const VAULT = `vault:${AS.name}`
    const vault = () => w.addr('btc', { kind: 'p2wsh', multisig: { m: 2, n: 3 }, entity: assoE, wallet: VAULT })
    const V = vault()
    const V2 = vault()
    const V3 = vault()
    const buyT = T - r.int(220, 330) * DAY
    const legitT = T - r.int(25, 55) * DAY
    const buyTx = cv.withdraw(V, roundCoin(w, 0.25, 0.7, 0.01), buyT)
    const donate = (to: string, t: number) => w.fund(to, roundCoin(w, 0.0008, 0.03, 0.0001), t, { senders: 1 })
    const donsV: Tx[] = []
    for (let i = 0, n = r.int(6, 9); i < n; i++) donsV.push(donate(V, buyT + r.int(5, 180) * DAY))
    // Campagne en cours au moment des faits : les dons affluent sur l'adresse dédiée
    const donsV2: Tx[] = []
    for (let i = 0, n = r.int(9, 12); i < n; i++) donsV2.push(donate(V2, T - Math.round(r.float(0.3, 16) * DAY)))

    // ── Dépense légitime (clés du président et du trésorier) ─────────────────
    const supplier = w.addr('btc', { entity: supplierE, kind: 'p2wpkh' })
    const legitPay = roundCoin(w, 0.04, 0.12, 0.001)
    const legit = w.utxoTx({ time: legitT, from: [V], to: [{ address: supplier, value: legitPay }], change: V3, fee: sat(r.int(12, 30) * (11 + 105 + 43 * 2)), autoFund: false })
    signAll(legit, L)
    legit.fp = { version: 2, locktime: legit.block - 1, rbf: true }
    // Quelques dons arrivent encore avant les faits
    for (let i = 0, n = r.int(1, 3); i < n; i++) donsV.push(donate(V, legitT + r.int(3, 20) * DAY))
    for (let i = 0, n = r.int(2, 3); i < n; i++) donsV.push(donate(V, T - Math.round(r.float(0.2, 1.8) * DAY)))

    // ── Dépense frauduleuse : tout le coffre vers une adresse Taproot ────────
    const THIEF = 'wallet:thief'
    const tp = () => w.addr('btc', { kind: 'p2tr', entity: thiefE, wallet: THIEF })
    const scriptFp = (): TxFingerprint => ({ version: 1, locktime: 0, rbf: false })
    const T1 = tp()
    const spendSet = [V3, V2, V]
    const nIn = spendSet.reduce((s, a) => s + w.utxosOf(a, T).length, 0)
    const stolen = r8(spendSet.reduce((s, a) => s + w.unspentValue(a, T), 0))
    const fraudFee = sat(r.int(9, 28) * (11 + 105 * nIn + 43))
    const fraud = w.rawUtxoTx({ time: T, spend: spendSet.map((address) => ({ address })), outputs: [{ address: T1, value: r8(stolen - fraudFee) }], keepOrder: true })
    signAll(fraud, F)
    fraud.fp = scriptFp()
    const got1 = fraud.outputs[0].value
    // Le trésorier découvre le coffre vide en ouvrant Sparrow ; la plainte suit
    const tDisc = Math.max(T + 2 * HOUR, atHour(T + Math.round(r.float(8, 20) * HOUR), 8, 22))
    const tPlainte = atHour(tDisc + r.int(1, 3) * DAY, 9, 18)
    const tAudition = atHour(tPlainte + r.int(2, 6) * DAY, 9, 18)
    // Les donateurs continuent d'envoyer sur l'adresse publiée, vidée (après la découverte :
    // le solde était bien à zéro ce jour-là ; au moins un don arrive avant la plainte)
    const lateDons: Tx[] = [donate(V, Math.round(r.float(tDisc + HOUR, tPlainte - HOUR)))]
    for (let i = 0, n = r.int(2, 4); i < n; i++) lateDons.push(donate(V, Math.max(tDisc + HOUR, T + Math.round(r.float(0.4, 9) * DAY))))
    for (let i = 0, n = r.int(3, 5); i < n; i++) lateDons.push(donate(V2, Math.max(tDisc + HOUR, T + Math.round(r.float(0.4, 12) * DAY))))

    // ── Fractionnement sur trois adresses Taproot ────────────────────────────
    const [T2, T3, T4] = [tp(), tp(), tp()]
    const splitFee = sat(r.int(6, 22) * (11 + 58 + 43 * 3))
    const splitT = T + Math.round(r.float(2, 10) * HOUR)
    const weights = [r.float(0.28, 0.36), r.float(0.3, 0.38)]
    const v2 = r8((got1 - splitFee) * weights[0])
    const v3 = r8((got1 - splitFee) * weights[1])
    const v4 = r8(got1 - splitFee - v2 - v3)
    const split = w.rawUtxoTx({ time: splitT, spend: [{ address: T1 }], outputs: [{ address: T2, value: v2 }, { address: T3, value: v3 }, { address: T4, value: v4 }] })
    split.fp = scriptFp()

    // ── Paiement chez un marchand de cartes cadeaux, rendu Taproot ───────────
    const chDep = shopAddr()
    const cardPay = Math.min(roundCoin(w, 0.012, 0.045, 0.0005), r8(Math.floor(v3 * 0.4 * 2000) / 2000))
    const T5 = tp()
    const payT = splitT + Math.round(r.float(1, 3) * DAY)
    const payTx = w.utxoTx({ time: payT, from: [T3], to: [{ address: chDep, value: cardPay }], change: T5, fee: sat(r.int(6, 20) * (11 + 58 + 43 * 2)) })
    payTx.fp = scriptFp()
    const chSweep = shopSweep([chDep], payT + Math.round(r.float(2, 12) * HOUR))
    const change5 = payTx.outputs.find((o) => o.address === T5)!.value

    // ── Consolidation : dépôt sur la plateforme et trois « pièces » égales ───
    const consT = payT + Math.round(r.float(2, 6) * DAY)
    const exDep = w.addr('btc', { entity: ex.entity, label: `${ex.entity.name} — Adresse de dépôt`, tags: ['deposit'], kind: 'p2wpkh' })
    const consIn = r8(w.unspentValue(T2, consT) + w.unspentValue(T4, consT) + w.unspentValue(T5, consT))
    const consFee = sat(r.int(5, 24) * (11 + 58 * 3 + 43 * 4))
    const deposit = r8(Math.floor((consIn - consFee) * r.float(0.24, 0.34) * 100) / 100)
    const [U1, U2, U3] = [tp(), tp(), tp()]
    const Y = Math.floor(((consIn - consFee - deposit) / 3) * 1e4) / 1e4
    const y3 = r8(consIn - consFee - deposit - 2 * Y)
    const cons = w.rawUtxoTx({ time: consT, spend: [{ address: T2 }, { address: T4 }, { address: T5 }], outputs: [{ address: exDep, value: deposit }, { address: U1, value: Y }, { address: U2, value: Y }, { address: U3, value: y3 }] })
    cons.fp = scriptFp()
    const exSweep = ex.sweep([exDep], consT + Math.round(r.float(1, 8) * HOUR))[0]

    // ── Trois transferts jumeaux le même soir ────────────────────────────────
    // En soirée (19 h–22 h, heure de Paris) : les trois partent en moins d'une heure
    const tV = atHour(consT + Math.round(r.float(1, 3) * DAY), 19, 22)
    const offs = r.shuffle([0, Math.round(r.float(9, 22) * 60), Math.round(r.float(28, 50) * 60)])
    // (1) Le coffre 2-sur-2 des auteurs (P2WSH) : la vraie destination
    const W = w.addr('btc', { kind: 'p2wsh', multisig: { m: 2, n: 2 }, entity: thiefE, wallet: 'vault:auteurs' })
    const feeOne = () => sat(r.int(6, 20) * (11 + 58 + 43))
    const toW = w.rawUtxoTx({ time: tV + offs[0], spend: [{ address: U1 }], outputs: [{ address: W, value: r8(Y - feeOne()) }] })
    toW.fp = scriptFp()
    // (2) Ouverture d'un canal Lightning avec un LSP (P2WSH 2-sur-2 lui aussi)
    // Marge de 5 000 sats : les frais estimés par la brique sont prélevés dessus (pas de rendu)
    const capLn = r8(Y - 0.00005)
    const chan = openChannel(w, { from: U2, peer: 'lumen_lsp', capacity: capLn, time: tV + offs[1], change: null })
    chan.tx.fp = scriptFp()
    // (3) Une adresse Taproot du même portefeuille, qui joue ensuite au casino
    const T8 = tp()
    const toT8 = w.rawUtxoTx({ time: tV + offs[2], spend: [{ address: U3 }], outputs: [{ address: T8, value: r8(y3 - feeOne()) }] })
    toT8.fp = scriptFp()
    const twins = [toW, chan.tx, toT8].sort((a, b) => a.time - b.time)

    // ── Test du coffre : petit envoi, rendu sur la même adresse ──────────────
    const tTest = toW.time + Math.round(r.float(3, 20) * HOUR)
    const testOut = tp()
    const testValue = roundCoin(w, 0.0004, 0.0012, 0.0001)
    const test = w.utxoTx({ time: tTest, from: [W], to: [{ address: testOut, value: testValue }], change: W, fee: sat(r.int(5, 16) * (11 + 105 + 43 * 2)), autoFund: false })
    test.multisigSigners = { 0: [1, 2] }
    test.fp = scriptFp()
    const held = r8(w.unspentValue(W))

    // ── Suites des leurres ───────────────────────────────────────────────────
    // Le canal sert à payer hors chaîne ; fermé coopérativement, il laisse
    // l'essentiel au LSP et un petit solde à l'auteur.
    const lnLocal = r8(Math.floor(capLn * r.float(0.04, 0.12) * 1e4) / 1e4)
    const close = chan.cooperativeClose({ time: tV + Math.round(r.float(9, 24) * DAY), toLocal: lnLocal })
    // L'adresse Taproot joue au casino, mise après mise
    const bets: Tx[] = []
    let tb = toT8.time + Math.round(r.float(4, 30) * HOUR)
    for (let i = 0, n = r.int(4, 6); i < n; i++) {
      const v = r8(Math.floor(w.unspentValue(T8, tb) * r.float(0.15, 0.35) * 1e4) / 1e4)
      if (v < 0.0005) break
      const dep = w.addr('btc', { entity: casinoE, label: `${casinoE.name} — Adresse de dépôt`, tags: ['deposit'] })
      const bt = w.utxoTx({ time: tb, from: [T8], to: [{ address: dep, value: v }], change: T8, autoFund: false })
      bt.fp = scriptFp()
      bets.push(bt)
      tb += Math.round(r.float(0.5, 3) * DAY)
    }
    const betTotal = r8(bets.reduce((s, b) => s + b.outputs.filter((o) => o.address !== T8).reduce((a, o) => a + o.value, 0), 0))

    // ── Le fournisseur : un portefeuille d'entreprise ordinaire ──────────────
    priorHistory(w, supplier, { start: legitT - r.int(90, 160) * DAY, end: legitT + r.int(30, 70) * DAY, nIn: r.int(7, 9), nOut: r.int(3, 5), maxUsd: 3500 })
    // Autour du règlement de l'association : d'autres clients paient, le fournisseur règle le sien
    for (let i = 0, k = r.int(1, 2); i < k; i++) w.fund(supplier, roundCoin(w, 0.01, 0.08, 0.001), legitT + Math.round(r.float(-40, 40) * HOUR), { senders: 1 })
    const supT = legitT + Math.round(r.float(8, 40) * HOUR)
    w.utxoTx({ time: supT, from: [supplier], to: [{ address: w.addr('btc'), value: r8(Math.min(w.unspentValue(supplier, supT) * 0.6, legitPay * r.float(0.5, 0.9))) }], change: supplier, autoFund: false })

    const fraudSize = txSize(w, fraud)!
    const consSize = txSize(w, cons)!
    const legitSize = txSize(w, legit)!

    // ── Bruit de fond ────────────────────────────────────────────────────────
    ex.noise(14, T - 3 * DAY, consT + 6 * DAY)
    cv.noise(8, buyT - 5 * DAY, T + 5 * DAY)
    // Autres commandes chez le revendeur de cartes cadeaux, balayées elles aussi
    for (let i = 0, n = r.int(2, 3); i < n; i++) {
      const t = Math.round(r.float(T - 2 * DAY, consT + 4 * DAY))
      const d = shopAddr()
      w.fund(d, roundCoin(w, 0.0005, 0.03, 0.0001), t, { senders: 1 })
      shopSweep([d], t + Math.round(r.float(2, 12) * HOUR))
    }

    // ── Textes ───────────────────────────────────────────────────────────────
    const keysLabel = (k: number[]) => `les clés n° ${k[0]} et n° ${k[1]}`
    const roleOrder = order.map((role, i) => `• Clé n° ${i + 1} : ${holder[role].name}, ${roleLabel[role]}${role === 'sec' ? ' — phrase de récupération sur papier, sous enveloppe scellée' : ' — portefeuille matériel conservé à son domicile'}`).join('\n')
    const pairs: [Role, Role][] = [['pres', 'tres'], ['pres', 'sec'], ['tres', 'sec']]
    const pairLabel = ([a, b]: [Role, Role]) => `${holder[a].name} et ${holder[b].name}`
    const correctPair = pairs.find(([a, b]) => (a === accomplice || b === accomplice) && (a === 'sec' || b === 'sec'))!
    const accRole = accomplice === 'pres' ? pres.g('du président', 'de la présidente') : tres.g('du trésorier', 'de la trésorière')
    const nameB = ex.entity.name
    const inKinds = fraud.inputs.length
    const lateTotal = r8(w.unspentValue(V) + w.unspentValue(V2))
    const hm = (ts: number) => new Date(ts * 1000).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })
    const nLateBefore = lateDons.filter((d) => d.time < tPlainte && d.outputs.some((o) => o.address === V)).length
    const twinLine = twins.map((x) => `${hm(x.time)} : ${btc(x.outputs[0].value)} vers ${A(w, x.outputs[0].address).slice(0, 16)}…`).join(' ; ')

    return {
      world: w,
      title: `Le coffre de l'association « ${AS.name} »`,
      briefing:
        `L'association « ${AS.name} », ${AS.what} installée à ${city}, détenait une réserve en bitcoins constituée par ${AS.why}. Pour la protéger, le bureau avait mis en place un coffre multisignature « 2-sur-3 » : trois clés, dont deux suffisent pour dépenser. Le ${fmtDate(T)}, la totalité du coffre (${btc(stolen)}) est partie vers une adresse inconnue. ${pres.name}, ${roleLabel.pres}, a déposé plainte pour abus de confiance et accès frauduleux.\n\n` +
        `Une adresse multisignature P2WSH ne montre rien de ses clés tant qu'elle n'a pas été dépensée. Mais chaque dépense publie dans son témoin (witness) les clés publiques et les signatures : en vérifiant chaque signature contre chaque clé, on sait quelles clés ont signé. Comparée à la liste des détenteurs, cette lecture désigne des personnes… ou du moins des clés.\n\n` +
        `Votre mission : identifier la dépense frauduleuse et les clés qui l'ont signée, la comparer à la dernière dépense légitime, suivre les fonds dans le portefeuille Taproot qui les reçoit (empreinte, taille et poids, rendu, consolidation, plateforme de dépôt), puis retrouver où dort le reste du butin. Le magistrat veut savoir ce qui est encore saisissable, et à quelles conditions.`,
      evidence: [
        {
          id: 'plainte', type: 'plainte', title: 'Procès-verbal de plainte (extrait)', date: tPlainte, author: `${pres.name}, ${roleLabel.pres}`,
          body:
            `« Notre association reçoit des dons en bitcoins sur l'adresse publiée sur notre site : ${A(w, V)}. Pour ${AS.campaign}, nous avons aussi publié une adresse dédiée : ${A(w, V2)}. Les deux font partie d'un coffre multisignature 2-sur-3 que nous gérons avec le logiciel Sparrow : il faut deux des trois clés pour dépenser.\n\n` +
            `Depuis la mise en place du coffre, notre seule dépense a réglé la facture de notre fournisseur (${AS.supplier}) le ${fmtDate(legitT, false)} (transaction ${legit.hash}), signée par ${tres.g('notre trésorier', 'notre trésorière')}, ${tres.name}, et par moi-même.\n\n` +
            `Le ${fmtDate(tDisc, false)}, en ouvrant Sparrow, ${tres.name} a constaté que le solde était à zéro. Personne au bureau ne reconnaît cette opération. Depuis, ${nLateBefore > 1 ? `${nLateBefore} dons sont encore arrivés` : 'un don est encore arrivé'} sur l'adresse du site ; nous l'avons retirée en urgence. »`,
        },
        {
          id: 'pv-garde', type: 'pv', title: 'Procès-verbal du conseil d\'administration — garde des clés du coffre', date: buyT - r.int(5, 30) * DAY, author: `Bureau de l'association « ${AS.name} »`,
          body:
            `Le conseil adopte la politique de garde suivante pour la réserve en bitcoins (coffre multisignature 2-sur-3, descripteur « wsh(multi(2, clé 1, clé 2, clé 3)) », ordre des clés fixe) :\n\n` +
            `${roleOrder}\n\n` +
            `Toute dépense est décidée en bureau et signée par ${pres.g('le président', 'la présidente')} et ${tres.g('le trésorier', 'la trésorière')}. La clé de secours ne sert qu'en cas de perte d'un portefeuille matériel ; l'enveloppe est conservée par ${anc.name}, qui a configuré le coffre.`,
        },
        {
          id: 'audition', type: 'pv', title: `Audition ${de(anc.name)} (extrait)`, date: tAudition, author: `Brigade de recherches ${de(city)}`,
          body:
            `${anc.name}, ${roleLabel.sec}, ${anc.g('entendu', 'entendue')} en audition libre :\n` +
            `« L'enveloppe est dans mon coffre-fort, je ne l'ai jamais ouverte. Je ne vois pas comment ma clé aurait pu servir. D'ailleurs, il faut deux clés : regardez plutôt du côté de ceux qui signent d'habitude. J'ai rendu les portefeuilles matériels au bureau quand j'ai quitté la trésorerie, sans garder de copie. Les bitcoins, je n'y connais plus grand-chose, à part Lightning pour payer de petites choses. »`,
        },
        {
          id: 'note', type: 'note', title: 'Note du chef de groupe — lire une transaction moderne', date: tAudition + r.int(0, 2) * DAY, author: 'Chef de groupe — Section de recherches',
          body:
            `• Le panneau « Scripts et témoins » d'une transaction détaille chaque entrée : type de dépense, éléments du témoin et, pour un multisig, les clés publiques avec le rang des clés qui ont signé.\n` +
            `• Le panneau « Taille et poids » donne la taille (octets), le poids (WU) et la taille virtuelle (vB) : les frais se comptent en sat/vB.\n` +
            `• Comparez l'empreinte (version, nLockTime, RBF) de la dépense contestée avec celle d'une dépense légitime : un changement de logiciel est un indice ; une même empreinte sur toute une série de transactions désigne souvent le même outil.\n` +
            `• Les adresses Taproot (bc1p…) dépensées par la clé ne montrent qu'une signature Schnorr : tout le reste est caché.\n` +
            `• Une sortie P2WSH (bc1q… longue) ne dit rien de son script tant qu'elle n'est pas dépensée : coffre multisignature, canal Lightning ou autre. Sa première dépense le révèle.\n\n` +
            `Rappel : une signature établit l'usage d'une clé, pas l'identité de la main qui l'a utilisée.`,
        },
      ],
      seeds: [V],
      objectives: [
        {
          id: 'o1', type: 'tx', points: 8,
          prompt: 'Quelle transaction a vidé le coffre de l\'association ?',
          answer: [fraud.id],
          hint: 'Ouvrez l\'adresse des dons publiée sur le site : parmi ses nombreuses entrées (dons), une seule dépense part vers une adresse bc1p…, avec d\'autres adresses du coffre en entrée.',
          explanation: `${fraud.hash.slice(0, 16)}… dépense ensemble ${inKinds} UTXO du coffre (l'adresse du site ${A(w, V).slice(0, 14)}…, celle de la campagne ${A(w, V2).slice(0, 14)}… et ${A(w, V3).slice(0, 14)}…, qui avait reçu le rendu de la dépense légitime) vers une seule adresse Taproot. Les trois adresses P2WSH ont un script 2-sur-3 : on les reconnaît comme membres d'un même coffre parce qu'elles sont dépensées ensemble, et parce que le rendu de la dépense légitime était revenu vers l'une d'elles. Les dons reçus ensuite sur l'adresse du site ne sont pas des dépenses : ils s'accumulent après les faits.`,
        },
        {
          id: 'o2', type: 'number', points: 10, tolerance: 0, unit: 'rang',
          prompt: 'Une clé a signé la dépense frauduleuse mais pas la dépense légitime citée dans la plainte. Quel est son rang dans le coffre (1, 2 ou 3) ?',
          answer: keyOf('sec'),
          hint: 'Ouvrez les deux transactions, panneau « Scripts et témoins », puis « Afficher » : chaque entrée multisig indique les clés qui ont signé.',
          explanation: `La dépense frauduleuse est signée par ${keysLabel(F)}, sur toutes ses entrées ; la dépense légitime ${legit.hash.slice(0, 12)}… par ${keysLabel(L)}. La clé n° ${keyOf('sec')} n'apparaît que dans la première. Chaque témoin contient un élément vide (exigé par OP_CHECKMULTISIG), deux signatures ECDSA et le script « OP_2 <clé 1> <clé 2> <clé 3> OP_3 OP_CHECKMULTISIG ». Deux signatures suffisent : celle de la troisième clé n'apparaît jamais dans une dépense 2-sur-3, même si sa clé publique figure dans le script.`,
        },
        {
          id: 'o3', type: 'choice', points: 12,
          prompt: 'D\'après la politique de garde adoptée par le conseil, à quels détenteurs appartiennent les clés qui ont signé la dépense frauduleuse ?',
          ...choice(r, pairLabel(correctPair), pairs.filter((p) => p !== correctPair).map(pairLabel).concat(['Impossible à dire : les clés publiques d\'un multisig sont anonymes'])),
          hint: 'Le procès-verbal du conseil donne le rang de chaque clé dans le descripteur, et l\'ordre est fixe (multi, pas sortedmulti).',
          explanation: `Clés n° ${F[0]} et n° ${F[1]} : ${holder[order[F[0] - 1]].name} et ${holder[order[F[1] - 1]].name}. La clé de secours ${de(anc.name)}, censée dormir sous enveloppe scellée, a donc signé — contrairement à ses déclarations —, avec celle ${accRole}. Elle n'apparaît pas dans la dépense légitime (${keysLabel(L)}), conformément à la politique du bureau. Prudence : la signature prouve l'usage de la clé, pas l'identité de la personne. Une copie de la phrase de récupération (réalisée lors de la configuration) et la compromission ou la complicité d'un second détenteur sont les deux hypothèses à instruire.`,
        },
        {
          id: 'o4', type: 'choice', points: 8,
          prompt: 'Comparez l\'empreinte de la dépense frauduleuse avec celle de la dépense légitime. Que peut-on en dire ?',
          ...choice(r,
            'Elles diffèrent (version 1, nLockTime à 0, pas de RBF contre version 2, anti-fee-sniping et RBF) : la dépense frauduleuse n\'a vraisemblablement pas été construite avec le Sparrow de l\'association',
            [
              'Elles sont identiques : la dépense frauduleuse a été construite par le même logiciel, donc sur l\'ordinateur de l\'association',
              'L\'empreinte d\'une transaction multisig est toujours la même : la comparaison n\'apporte rien',
              'Elles diffèrent seulement par les frais, ce qui ne permet aucune conclusion',
            ]),
          hint: 'Panneau « Empreinte du portefeuille » de chacune des deux transactions : version, nLockTime, RBF.',
          explanation: `La dépense légitime porte la signature d'un portefeuille de bureau moderne comme Sparrow : version 2, nLockTime à la hauteur du bloc précédent (protection anti-fee-sniping), RBF signalé. La dépense frauduleuse est en version 1, nLockTime à 0, sans RBF : un autre outil (script, ancien logiciel) l'a construite, avec deux clés importées. Toutes les transactions suivantes du portefeuille Taproot, jusqu'au test du second coffre, ont exactement la même empreinte : même opérateur, même outil.`,
        },
        {
          id: 'o5', type: 'amount', points: 6, unit: 'BTC', tolerance: 0.002,
          prompt: 'Quel montant (en BTC) a été prélevé sur le coffre, frais compris ?',
          answer: stolen,
          hint: 'Additionnez les entrées de la transaction frauduleuse.',
          explanation: `Les entrées totalisent ${btc(stolen)} ; la sortie unique vers l'adresse Taproot en reçoit ${btc(got1)}, le reste (${btc(fraudFee)}) payant les frais de réseau. C'est tout le solde du coffre à cet instant : aucun rendu ne revient vers une adresse P2WSH. Les ${lateDons.length} dons arrivés depuis sur les adresses du site et de la campagne (${btc(lateTotal)}) ne font pas partie du préjudice et y restent. Ils sont pourtant exposés : deux des trois clés ont servi à la fraude, et les auteurs présumés peuvent recommencer. À signaler sans délai au magistrat, avec une surveillance des deux adresses ; l'association doit cesser de les publier.`,
        },
        {
          id: 'o6', type: 'number', points: 8, tolerance: 2, unit: 'vB',
          prompt: 'Quelle est la taille virtuelle (en vB) de la transaction frauduleuse ?',
          answer: fraudSize.vsize,
          hint: 'Panneau « Taille et poids » : la taille virtuelle est le poids divisé par 4.',
          explanation: `${fraudSize.size} octets sérialisés pour un poids de ${fraudSize.weight} WU, soit ${fraudSize.vsize} vB (taux de ${fraudSize.feeRate.toLocaleString('fr-FR')} sat/vB). Le témoin pèse ${fraudSize.witnessBytes} octets : chacune des ${inKinds} entrées P2WSH 2-sur-3 y publie deux signatures et un script de 105 octets contenant les trois clés. Les nombreux petits dons expliquent ce grand nombre d'entrées. Grâce à la remise SegWit (témoin compté au quart), la transaction est facturée ${fraudSize.vsize} vB au lieu de ${fraudSize.vsizeWithoutDiscount}. À titre de comparaison, la dépense légitime fait ${legitSize.vsize} vB.`,
        },
        {
          id: 'o7', type: 'address', points: 6,
          prompt: 'Quelle adresse Taproot reçoit le contenu du coffre ?',
          answer: [T1],
          hint: 'C\'est la seule sortie de la transaction frauduleuse (bc1p…).',
          explanation: `${A(w, T1)} : une adresse P2TR (Taproot, SegWit v1), reconnaissable à son préfixe bc1p. Elle est vidée quelques heures plus tard vers trois autres adresses Taproot.`,
        },
        {
          id: 'o8', type: 'choice', points: 8,
          prompt: 'Que révèle le témoin quand cette adresse Taproot est dépensée ?',
          ...choice(r,
            'Une seule signature Schnorr de 64 octets (dépense par la clé) : impossible de savoir si un script alternatif ou un multisig existait',
            [
              'Les clés publiques de tous les cosignataires, comme pour le coffre P2WSH',
              'Une signature ECDSA et la clé publique, comme pour une adresse SegWit v0',
              'Le script complet de l\'adresse, toujours publié à la dépense en Taproot',
            ]),
          hint: 'Ouvrez la transaction de fractionnement qui dépense l\'adresse bc1p…, panneau « Scripts et témoins ».',
          explanation: `Dépense Taproot « par la clé » : un unique élément de témoin de 64 octets. Un éventuel arbre de scripts (multisig, délai) reste caché tant qu'il ne sert pas, et même une clé agrégée de plusieurs personnes (MuSig) ressemblerait à une clé unique. Pour l'enquêteur, Taproot efface la distinction entre portefeuille simple et coffre partagé ; il reste le comportement (montants, chronologie, empreinte) pour rattacher ces adresses entre elles. À l'inverse, les auteurs choisiront plus tard un coffre P2WSH classique, qui se trahit à sa première dépense.`,
        },
        {
          id: 'o9', type: 'address', points: 8,
          prompt: `Une des adresses Taproot paie un marchand de cartes cadeaux (${shopE.name}). Quelle est l'adresse de rendu de ce paiement ?`,
          answer: [T5],
          hint: 'Deux sorties : un montant rond vers une adresse bc1q… étiquetée, et un montant non rond vers une adresse du même type que l\'entrée.',
          explanation: `${btc(cardPay)} (montant rond) partent vers une adresse P2WPKH de ${shopE.name} ; ${btc(change5)} reviennent vers ${A(w, T5)}, adresse neuve, non ronde et du même type (P2TR) que l'entrée : c'est le rendu. Ce rendu sera regroupé avec les autres adresses Taproot dans la consolidation.`,
        },
        {
          id: 'o10', type: 'number', points: 8, tolerance: 0.6, unit: 'sat/vB',
          prompt: 'La consolidation regroupe trois adresses Taproot avant le dépôt. Quel est son taux de frais (en sat/vB) ?',
          answer: consSize.feeRate,
          hint: 'Trouvez la transaction qui dépense ensemble le rendu du paiement et d\'autres adresses issues du fractionnement, puis lisez « Taille et poids ».',
          explanation: `La consolidation ${cons.hash.slice(0, 12)}… dépense trois entrées P2TR (${A(w, T2).slice(0, 10)}…, ${A(w, T4).slice(0, 10)}…, ${A(w, T5).slice(0, 10)}…) : ${consSize.vsize} vB pour ${btc(consFee)} de frais, soit ${consSize.feeRate.toLocaleString('fr-FR')} sat/vB. Une entrée Taproot dépensée par la clé ne pèse qu'environ 57,5 vB, contre plus de 100 vB pour une entrée multisig P2WSH : c'est l'intérêt économique de Taproot. Les trois entrées étant dépensées ensemble, l'heuristique des entrées communes les rattache au même portefeuille.`,
        },
        {
          id: 'o11', type: 'entity', points: 8,
          prompt: 'Sur quelle plateforme une partie des fonds est-elle déposée ?',
          answer: [exKey],
          hint: 'Une sortie de la consolidation est étiquetée « Adresse de dépôt ».',
          explanation: `${btc(deposit)} (montant rond) partent vers une adresse de dépôt ${nameB}, balayée ensuite vers son hot wallet. ${procedureFor(ex.entity)} La réquisition vise l'identité du titulaire du compte, ses adresses IP et ses moyens de retrait, ainsi que le gel du solde. Les trois autres sorties de la consolidation, de montants presque égaux (${btc(Y)}), restent dans des adresses Taproot de l'auteur : elles préparent la suite.`,
        },
        {
          id: 'o14', type: 'tx', points: 12,
          prompt: `Les trois sorties presque égales de la consolidation partent le même soir, en moins d'une heure, vers trois adresses différentes. Laquelle de ces trois transactions alimente le coffre multisignature où les auteurs gardent le reste du butin ?`,
          answer: [toW.id],
          hint: 'Deux destinations sont des P2WSH (bc1q… longues) : leur script n\'apparaît qu\'à leur première dépense. Ouvrez la transaction qui dépense chacune d\'elles, panneau « Scripts et témoins ». La troisième est une adresse Taproot : que devient-elle ?',
          explanation:
            `Trois transferts jumeaux : ${twinLine}. Montant et horaire ne départagent rien ; ce sont les dépenses ultérieures qui tranchent. ` +
            `${A(w, W).slice(0, 16)}… est dépensée ${Math.round((tTest - toW.time) / HOUR)} h plus tard par un petit envoi de test (${btc(testValue)}), avec rendu sur elle-même : son témoin révèle un multisig 2-sur-2 (deux clés, deux signatures n° 1 et n° 2) et l'empreinte habituelle de l'auteur. C'est le coffre commun, qui détient encore les fonds. ` +
            `${A(w, chan.funding).slice(0, 16)}… est aussi un P2WSH 2-sur-2, mais sa dépense est la fermeture d'un canal Lightning ouvert avec ${chan.peer.name} : l'essentiel revient au nœud du LSP (dépensé hors chaîne), un petit solde à l'auteur. Impasse on-chain, que seule une réquisition au LSP (identifiant de nœud, IP) éclairerait. ` +
            `${A(w, T8).slice(0, 16)}… est une adresse Taproot ordinaire qui mise ${btc(betTotal)} en ${bets.length} fois sur ${casinoE.name}, casino sans KYC : une autre impasse.`,
        },
        {
          id: 'o13', type: 'amount', points: 10, unit: 'BTC', tolerance: 0.001,
          prompt: 'Quel montant (en BTC) ce coffre 2-sur-2 détient-il encore ?',
          answer: held,
          hint: 'Lisez le solde de l\'adresse P2WSH qui a servi au petit envoi de test : son rendu est revenu sur elle-même.',
          explanation: `${A(w, W)} a reçu ${btc(toW.outputs[0].value)}, puis envoyé ${btc(testValue)} en test (et ${btc(test.fee)} de frais) : il reste ${btc(held)}. Ces fonds ne sont gelables par personne : il faut les deux clés du coffre. Le témoin du test montre deux clés publiques : deux détenteurs, ce qui concorde avec les deux signataires de la fraude, sans le prouver. Les perquisitions viseront les supports de ces clés (portefeuilles matériels, phrases, fichiers de configuration du coffre, appelés descripteurs), chez ${anc.name} et chez ${holder[accomplice].name} ; la saisie, sur instruction du magistrat, suppose de réunir les deux signatures. En attendant, l'adresse est placée sous surveillance.`,
        },
      ],
      truth: {
        path: [legit.id, fraud.id, split.id, payTx.id, chSweep.id, cons.id, exSweep.id, toW.id, test.id],
        addresses: [T1, T2, T3, T4, T5, U1, W, exDep, V, V2, V3],
        debrief:
          `1. Le coffre 2-sur-3 de l'association (adresses P2WSH du site, de la campagne et de rendu) avait servi une seule fois légitimement, le ${fmtDate(legitT, false)} : ${keysLabel(L)} (${holder[order[L[0] - 1]].name} et ${holder[order[L[1] - 1]].name}), empreinte d'un portefeuille de bureau (version 2, anti-fee-sniping, RBF).\n` +
          `2. Le ${fmtDate(T)}, ${fraud.hash.slice(0, 14)}… vide le coffre (${btc(stolen)}, ${inKinds} entrées) vers ${A(w, T1)}. Le témoin désigne ${keysLabel(F)} : la clé de secours ${de(anc.name)} et celle ${accRole} (${holder[accomplice].name}). Empreinte différente : version 1, nLockTime 0, pas de RBF. Taille : ${fraudSize.vsize} vB. Les dons continuent ensuite d'arriver sur l'adresse du site.\n` +
          `3. L'adresse Taproot est fractionnée sur trois adresses bc1p… ; l'une paie ${btc(cardPay)} à ${shopE.name} avec un rendu Taproot (${A(w, T5).slice(0, 14)}…).\n` +
          `4. La consolidation (${consSize.feeRate.toLocaleString('fr-FR')} sat/vB, trois entrées P2TR) dépose ${btc(deposit)} chez ${nameB} et prépare trois sorties presque égales de ${btc(Y)}.\n` +
          `5. Le même soir, trois transferts jumeaux : l'un alimente un coffre P2WSH 2-sur-2 (${A(w, W).slice(0, 16)}…), testé quelques heures plus tard puis laissé en l'état avec ${btc(held)} ; un autre ouvre un canal Lightning avec ${chan.peer.name}, refermé une fois dépensé hors chaîne ; le dernier part miser sur ${casinoE.name}.\n\n` +
          `À retenir : un multisig P2WSH ne se lit qu'à la dépense, mais il se lit bien — clés publiques, signatures et rang des signataires sont dans le témoin. Croisé avec la politique de garde, il oriente l'enquête vers des détenteurs précis, sans dispenser d'établir qui a réellement manié les clés. Taproot, lui, masque la nature du portefeuille : on s'appuie alors sur l'empreinte logicielle, les heuristiques de rendu et les entrées communes. Face à des transferts jumeaux, ce sont les dépenses suivantes qui tranchent : un coffre 2-sur-2 et un canal Lightning se ressemblent jusqu'à leur première dépense. Le butin encore détenu dans un coffre auto-hébergé ne se gèle pas : il se saisit, en réunissant les clés.`,
      },
      hints: [
        'Partez de l\'adresse des dons : la dépense qui la vide a deux types d\'adresse bien distincts, P2WSH en entrée et P2TR en sortie.',
        'Dans « Scripts et témoins », cliquez sur « Afficher » : le rang des clés qui ont signé apparaît en clair pour chaque entrée multisig.',
        'Le procès-verbal du conseil fait le lien entre rang de clé et détenteur ; la dépense légitime citée dans la plainte sert de point de comparaison.',
        'Après le fractionnement, cherchez la transaction qui dépense ensemble trois adresses Taproot : elle mène à la plateforme et à trois sorties presque égales.',
        'Pour les trois transferts jumeaux, ouvrez la première dépense de chaque destination : un test de coffre, une fermeture de canal Lightning et des mises au casino ne se ressemblent pas.',
      ],
    }
  },
}
