import { World, type Tx } from '../engine/world'
import { exchange, swapper, HOUR, DAY, type ExchangeKit } from '../engine/patterns'
import { roundAsset } from '../engine/chains'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, fakeCity, fakePerson, fmtDate, procedureFor } from './util'

const COMPANIES = ['Vantelis Électronique', 'Orvane Composants', 'Cortexis Trading', 'Lumerys Distribution', 'Ferval Composants', 'Sydelec Import-Export']

const LEGIT = [
  { name: 'Shenzhen Kaiyuan Components Co., Ltd.', country: 'Chine', object: 'Microcontrôleurs et cartes de développement' },
  { name: 'Hsinchu Lumitek Ltd.', country: 'Taïwan', object: 'Circuits de gestion d\'alimentation' },
  { name: 'Penang Microparts Sdn Bhd', country: 'Malaisie', object: 'Connecteurs et composants passifs' },
]

const SHELLS = [
  { name: 'Kirtech Trading FZE', country: 'Émirats arabes unis' },
  { name: 'Baltron Supply LLC', country: 'Kirghizistan' },
  { name: 'Orvex Components Ltd', country: 'Hong Kong' },
  { name: 'Polaris Bridge Trading LLC', country: 'Arménie' },
]

const DUAL_USE = ['Processeurs de signal numérique (DSP)', 'Modules FPGA', 'Récepteurs GNSS', 'Transistors RF de puissance', 'Mémoires flash durcies', 'Capteurs inertiels MEMS']

type Kind = 'legitE' | 'legitT' | 'legitU' | 'gxDirect' | 'gxHop' | 'gxCn'

interface Invoice {
  kind: Kind
  no: string
  supplier: string
  country: string
  object: string
  amount: number
  payT: number
  payTx?: Tx
  /** Montant effectivement crédité chez Garantex (null si flux légitime). */
  arrival: number | null
  txs: string[]
}

const r2 = (v: number) => Math.round(v * 100) / 100
/** Solde d'un compte à une date donnée (les flux sont générés dans le désordre). */
function balanceAt(w: World, id: string, asset: 'USDT', t: number): number {
  let b = 0
  for (const tx of w.txsOf(id)) {
    if (tx.time > t) continue
    for (const f of tx.transfers) {
      if (f.asset !== asset) continue
      if (f.to === id) b += f.value
      if (f.from === id) b -= f.value
    }
  }
  return r2(b)
}
const initials = (s: string) => s.split(/\s+/).filter((x) => /^[A-Z]/.test(x)).slice(0, 2).map((x) => x[0]).join('')

export const tronSanctionsGarantex: ScenarioTemplate = {
  id: 'tron-sanctions-garantex',
  title: 'Contournement de sanctions : la filière Garantex',
  tagline: 'Des factures, des USDT et un exchange sanctionné : mesurer l\'exposition et séparer le légitime de l\'illicite.',
  description:
    'TRACFIN signale une société française d\'import-export de composants électroniques dont le gérant achète de gros volumes d\'USDT. Une partie paie de vrais fournisseurs, une autre aboutit, directement ou via des intermédiaires et un changement de réseau, chez Garantex, exchange russe sanctionné. Mesurez l\'exposition, identifiez les intermédiaires, calculez le total parvenu à Garantex et choisissez la bonne voie procédurale.',
  difficulty: 3,
  chains: ['tron', 'eth'],
  skills: ['tron', 'tokens', 'typologies', 'exchange_id', 'requisition'],
  estMinutes: 65,
  lessons: ['exposition-risque', 'attribution-sources', 'blanchiment-pro', 'cooperation-internationale', 'tron-usdt'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const city = fakeCity(r)
    const managerP = fakePerson(r)
    const manager = managerP.name
    const g = managerP.g
    const company = r.pick(COMPANIES)
    const siren = `${r.int(800, 989)} ${r.int(100, 999)} ${r.int(100, 999)}`

    // ── Acteurs ──────────────────────────────────────────────────────────────
    const coE = w.customEntity({ name: `${company} SAS`, category: 'suspect', description: `Société d'import-export de composants électroniques (${city}).` })
    const netE = w.customEntity({ name: 'Intermédiaires de la filière (non identifiés)', category: 'suspect' })
    const cvE = exchange(w, 'coinhouse', 'eth')
    const cvT = exchange(w, 'coinhouse', 'tron')
    const bs = exchange(w, 'bitstamp', 'eth')
    const gx = exchange(w, 'garantex', 'tron')
    const cn = swapper(w, 'changenow')
    const keyE = r.pick(['kraken', 'coinbase'] as const)
    const keyU = keyE === 'kraken' ? 'coinbase' : 'kraken'
    const keyT = r.pick(['binance', 'okx'] as const)
    const kitE = exchange(w, keyE, 'eth')
    const kitU = exchange(w, keyU, 'eth')
    const kitT = exchange(w, keyT, 'tron')

    const E0 = w.addr('eth', { entity: coE })
    const T0 = w.addr('tron', { entity: coE })
    const I1 = w.addr('eth', { entity: netE })
    const T1 = w.addr('tron', { entity: netE })
    const T2 = w.addr('tron', { entity: netE })
    const N = w.addr('tron', { entity: netE })
    const supplierUE = w.customEntity({ name: LEGIT[2].name, category: 'individual', description: 'Portefeuille du fournisseur (non attribué dans la base).' })
    const U = w.addr('eth', { entity: supplierUE })
    const G1 = gx.newDeposit()
    const G2 = gx.newDeposit()
    const depU = kitU.newDeposit()

    // ── Factures (ordre chronologique) ───────────────────────────────────────
    const nHop = r.int(1, 2)
    const nCn = r.int(1, 2)
    const kinds: Kind[] = r.shuffle(['legitE', 'legitT', 'legitU', 'gxDirect', ...Array<Kind>(nHop).fill('gxHop'), ...Array<Kind>(nCn).fill('gxCn')])
    const start = w.at(-r.int(150, 180) * 24)
    const end = w.at(-r.int(12, 20) * 24)
    const times = kinds.map(() => Math.round(r.float(start + 10 * DAY, end))).sort((a, b) => a - b)
    for (let i = 1; i < times.length; i++) times[i] = Math.max(times[i], times[i - 1] + Math.round(r.float(4, 9) * DAY))
    const shells = r.pickN(SHELLS, 3)
    const objects = r.pickN(DUAL_USE, kinds.length)
    const usedAmounts = new Set<number>()
    const invoices: Invoice[] = kinds.map((kind, i) => {
      let amount = Math.round(r.float(12000, 85000) / 10) * 10
      while (usedAmounts.has(amount)) amount += 10
      usedAmounts.add(amount)
      const legit = kind === 'legitE' ? LEGIT[0] : kind === 'legitT' ? LEGIT[1] : kind === 'legitU' ? LEGIT[2] : null
      const shell = kind === 'gxDirect' || kind === 'gxHop' ? shells[r.int(0, 1)] : shells[2]
      const supplier = legit?.name ?? shell.name
      return {
        kind, amount, payT: times[i], arrival: null, txs: [],
        supplier, country: legit?.country ?? shell.country, object: legit?.object ?? objects[i % objects.length],
        no: `${initials(supplier)}-${r.int(1000, 9899)}`,
      }
    })

    // ── Gas et historique ────────────────────────────────────────────────────
    bs.withdraw(E0, roundAsset('ETH', r.float(0.3, 0.8)), start - r.int(3, 10) * DAY, 'ETH')
    cvT.withdraw(T0, r.int(6, 15) * 100, start - r.int(3, 10) * DAY, 'TRX')
    w.fundAccount(N, r.int(30, 80) * 100, 'TRX', start - r.int(20, 40) * DAY)
    const gasT1 = w.transfer({ time: start - r.int(5, 15) * DAY, from: N, to: T1, value: r.int(15, 40) * 10, asset: 'TRX' })
    const gasT2 = w.transfer({ time: start - r.int(5, 15) * DAY, from: N, to: T2, value: r.int(15, 40) * 10, asset: 'TRX' })
    w.fundAccount(I1, roundAsset('ETH', r.float(0.05, 0.15)), 'ETH', start - r.int(3, 12) * DAY)
    // Le portefeuille du fournisseur malaisien reçoit aussi d'autres clients
    for (let i = 0; i < r.int(5, 8); i++) w.fundAccount(U, r2(r.float(2000, 40000)), 'USDT', Math.round(r.float(start, end)))

    // ── Achats et paiements ──────────────────────────────────────────────────
    let boughtCoinhouse = 0
    let boughtBitstamp = 0
    const cnPayouts: Tx[] = []
    const cnDeposits: Tx[] = []
    for (const inv of invoices) {
      const onEth = inv.kind === 'legitE' || inv.kind === 'legitU' || inv.kind === 'gxCn'
      const buy = inv.amount + r.int(20, 600)
      const buyT = inv.payT - Math.round(r.float(6, 72) * HOUR)
      if (onEth) {
        const kit: ExchangeKit = r.chance(0.5) ? cvE : bs
        kit.withdraw(E0, buy, buyT, 'USDT')
        if (kit === cvE) boughtCoinhouse += buy
        else boughtBitstamp += buy
      } else {
        cvT.withdraw(T0, buy, buyT, 'USDT')
        boughtCoinhouse += buy
      }
      switch (inv.kind) {
        case 'legitE': {
          const d = kitE.receive(E0, inv.amount, inv.payT, { asset: 'USDT' })
          inv.payTx = d.tx
          inv.txs.push(d.tx.id)
          break
        }
        case 'legitT': {
          const d = kitT.receive(T0, inv.amount, inv.payT, { asset: 'USDT' })
          inv.payTx = d.tx
          inv.txs.push(d.tx.id)
          break
        }
        case 'legitU': {
          inv.payTx = w.transfer({ time: inv.payT, from: E0, to: U, value: inv.amount, asset: 'USDT' })
          const t2 = inv.payT + Math.round(r.float(1, 3) * DAY)
          // Les règlements antérieurs à cette date sont déjà sur le portefeuille
          const d = kitU.receive(U, balanceAt(w, U, 'USDT', t2), t2, { asset: 'USDT', depositAddr: depU })
          inv.txs.push(inv.payTx.id, d.tx.id)
          break
        }
        case 'gxDirect': {
          const d = gx.receive(T0, inv.amount, inv.payT, { asset: 'USDT', depositAddr: G2 })
          inv.payTx = d.tx
          inv.arrival = inv.amount
          inv.txs.push(d.tx.id)
          break
        }
        case 'gxHop': {
          inv.payTx = w.transfer({ time: inv.payT, from: T0, to: T2, value: inv.amount, asset: 'USDT' })
          const d = gx.receive(T2, inv.amount, inv.payT + Math.round(r.float(2, 12) * HOUR), { asset: 'USDT', depositAddr: G2 })
          inv.arrival = inv.amount
          inv.txs.push(inv.payTx.id, d.tx.id)
          break
        }
        case 'gxCn': {
          inv.payTx = w.transfer({ time: inv.payT, from: E0, to: I1, value: inv.amount, asset: 'USDT' })
          const ord = cn.order({
            from: I1, value: inv.amount, asset: 'USDT', time: inv.payT + Math.round(r.float(1, 6) * HOUR),
            toChain: 'tron', toAsset: 'USDT', recipient: T1, feePct: r.float(0.01, 0.02), delayMin: [8, 35], decoys: r.int(4, 7),
          })
          const d = gx.receive(T1, ord.payoutValue, ord.payoutTx.time + Math.round(r.float(1, 5) * HOUR), { asset: 'USDT', depositAddr: G1 })
          inv.arrival = ord.payoutValue
          cnPayouts.push(ord.payoutTx)
          cnDeposits.push(ord.depositTx)
          inv.txs.push(inv.payTx.id, ord.depositTx.id, ord.payoutTx.id, d.tx.id)
          break
        }
      }
    }
    // Un dernier dépôt du fournisseur malaisien, sans lien avec la société
    w.fundAccount(U, r2(r.float(3000, 30000)), 'USDT', end + r.int(1, 4) * DAY)
    kitU.receive(U, r2(w.balanceOf(U, 'USDT')), end + r.int(5, 8) * DAY, { asset: 'USDT', depositAddr: depU })

    // ── Bruit ────────────────────────────────────────────────────────────────
    gx.noise(14, start, w.at(0), 'USDT')
    kitE.noise(10, start, w.at(0), 'USDT')
    kitU.noise(8, start, w.at(0), 'USDT')
    kitT.noise(12, start, w.at(0), 'USDT')
    cvE.noise(8, start, w.at(0), 'USDT')
    cvT.noise(8, start, w.at(0), 'USDT')
    bs.noise(8, start, w.at(0), 'USDT')

    // ── Synthèse ─────────────────────────────────────────────────────────────
    const gxInv = invoices.filter((i) => i.arrival !== null)
    const nGx = gxInv.length
    const totalGx = r2(gxInv.reduce((s, i) => s + (i.arrival ?? 0), 0))
    const invoicedGx = gxInv.reduce((s, i) => s + i.amount, 0)
    const direct = invoices.find((i) => i.kind === 'gxDirect')!
    const hops = invoices.filter((i) => i.kind === 'gxHop')
    const cns = invoices.filter((i) => i.kind === 'gxCn')
    const legitU = invoices.find((i) => i.kind === 'legitU')!
    const hopTotal = hops.reduce((s, i) => s + i.amount, 0)
    const cnTotal = r2(cns.reduce((s, i) => s + (i.arrival ?? 0), 0))
    const totalInvoiced = invoices.reduce((s, i) => s + i.amount, 0)
    const nameE = kitE.entity.name
    const nameU = kitU.entity.name
    const nameT = kitT.entity.name
    const tSignal = w.at(-r.int(3, 8) * 24)
    // USDT restés sur l'adresse Tron de la société (marges d'achat accumulées)
    const t0Left = r2(w.balanceOf(T0, 'USDT'))
    const tether = w.entity('tether')
    const recap = gxInv
      .map((i) => `   • ${i.no} (${i.supplier}) — ${amt(i.amount, 'USDT')} payés, ${amt(i.arrival ?? 0, 'USDT')} crédités chez Garantex (${i.kind === 'gxDirect' ? 'direct' : i.kind === 'gxHop' ? `via ${A(w, T2)}` : `via ${A(w, I1)}, ChangeNOW et ${A(w, T1)}`})`)
      .join('\n')

    return {
      world: w,
      title: `Filière Garantex — ${company}`,
      briefing:
        `TRACFIN transmet au parquet une note concernant ${company} SAS (${city}), société d'import-export de composants électroniques dirigée par ${manager}. Depuis plusieurs mois, ${g('le gérant', 'la gérante')} achète d'importants volumes d'USDT sur Coinhouse et Bitstamp, retirés vers des portefeuilles auto-hébergés au nom de la société, sur Ethereum et sur Tron.\n\n` +
        `${g('Il', 'Elle')} présente ces achats comme le règlement de fournisseurs asiatiques. Les enquêteurs soupçonnent qu'une partie des paiements finance en réalité, par l'intermédiaire de sociétés-écrans, des livraisons de composants à double usage vers la Russie, en contournement des mesures restrictives de l'Union européenne.\n\n` +
        `Garantex, exchange russe, est sanctionné par l'OFAC depuis avril 2022 pour son rôle dans le blanchiment (la chronologie de cette affaire est simulée). Objectifs : mesurer l'exposition directe et indirecte de la société à Garantex, identifier les intermédiaires et leur financement, distinguer les règlements légitimes, calculer le total parvenu à l'entité sanctionnée et préserver ce qui peut encore l'être.`,
      evidence: [
        {
          id: 'tracfin', type: 'note', title: 'Note d\'information TRACFIN (extrait)', date: tSignal, author: 'TRACFIN',
          body:
            `Objet : ${company} SAS — SIREN ${siren} — gérance : ${manager}.\n` +
            `Déclarations de soupçon d'un prestataire de services sur actifs numériques et informations reçues d'une cellule de renseignement financier partenaire :\n` +
            `- achats d'USDT sur Coinhouse : ${amt(boughtCoinhouse, 'USDT')} ;\n` +
            `- achats d'USDT sur Bitstamp : ${amt(boughtBitstamp, 'USDT')} ;\n` +
            `- adresses de retrait déclarées par la société : ${A(w, E0)} (Ethereum) et ${A(w, T0)} (Tron).\n` +
            `Volumes sans rapport avec le chiffre d'affaires déclaré. Selon les outils d'analyse du déclarant, une partie des fonds présente une exposition à une entité sanctionnée.`,
        },
        {
          id: 'factures', type: 'rapport', title: 'Factures fournisseurs réglées en USDT (remises par l\'expert-comptable)', date: tSignal + 2 * DAY, author: 'Expert-comptable de la société',
          body:
            invoices
              .map((i) => `${fmtDate(i.payT - r.int(1, 4) * DAY, false)} — facture ${i.no} — ${i.supplier} (${i.country}) — ${i.object} — ${i.amount.toLocaleString('fr-FR')} $ US — réglée en USDT`)
              .join('\n') +
            `\n\nTotal facturé : ${totalInvoiced.toLocaleString('fr-FR')} $ US. Règlements exécutés par ${g('le gérant', 'la gérante')}, sans contrôle comptable des adresses de destination.`,
        },
        {
          id: 'osint', type: 'osint', title: 'Recherches en sources ouvertes sur les fournisseurs', date: tSignal + 4 * DAY, author: 'Groupe d\'appui crypto-actifs',
          body:
            `- ${LEGIT[0].name}, ${LEGIT[1].name}, ${LEGIT[2].name} : sociétés actives depuis plus de dix ans, catalogues en ligne, distributeurs référencés de grandes marques. Plusieurs clients européens déclarent les régler en USDT.\n` +
            `- ${shells.map((s) => s.name).join(', ')} : sociétés immatriculées depuis moins de deux ans, adresses de domiciliation, aucun site ni catalogue. Même numéro de téléphone russe dans deux registres. L'une d'elles apparaît comme expéditeur dans des données douanières de réexportation vers la Russie.`,
        },
        {
          id: 'fiche', type: 'note', title: 'Fiche entité — Garantex', date: tSignal - 30 * DAY, author: 'Groupe d\'appui crypto-actifs',
          body:
            `Exchange enregistré en Russie, inscrit en avril 2022 sur la liste SDN de l'OFAC (Trésor américain) pour avoir facilité le blanchiment au profit de rançongiciels, de marchés du darknet et de fraudeurs. Domaines saisis en mars 2025 ; activité reprise sous le nom Grinex.\n` +
            `Aucune coopération avec les autorités occidentales. Les adresses de dépôt sont attribuées dans la base de l'outil (catégorie « Entité sanctionnée »).\n` +
            `Rappel : l'exposition calculée automatiquement suit les flux on-chain ; elle s'arrête aux services qui « coupent » la trace, comme les échangeurs instantanés.`,
        },
      ],
      seeds: [E0, T0],
      objectives: [
        {
          id: 'o1', type: 'amount', points: 10, unit: 'USDT', tolerance: 0.01,
          prompt: 'Quelle est l\'exposition DIRECTE (un seul saut) de l\'adresse Tron de la société à Garantex, en USDT ?',
          answer: direct.amount,
          hint: 'Onglet Exposition de l\'adresse Tron de la société, sens sortant : lisez la ligne « Entité sanctionnée » dans la colonne directe.',
          explanation: `${A(w, T0)} envoie ${amt(direct.amount, 'USDT')} directement à l'adresse de dépôt Garantex ${A(w, G2)} (facture ${direct.no}) : c'est l'exposition directe. L'outil affiche en plus ${amt(hopTotal, 'USDT')} d'exposition indirecte, passée par ${A(w, T2)} avant d'atteindre la même adresse de dépôt. Le règlement vers ${nameT} (${amt(invoices.find((i) => i.kind === 'legitT')!.amount, 'USDT')}) apparaît en direct dans la catégorie « Exchange centralisé », sans risque particulier.`,
        },
        {
          id: 'o11', type: 'tx', points: 8,
          prompt: `Quelle transaction ERC-20 de l'adresse Ethereum intermédiaire dépose des USDT chez ChangeNOW${nCn > 1 ? ' (l\'une ou l\'autre)' : ''} ?`,
          answer: cnDeposits.map((t) => t.id),
          hint: 'Depuis l\'adresse Ethereum de la société, suivez les paiements vers une adresse non attribuée, puis la sortie de celle-ci vers une adresse étiquetée « ChangeNOW — Adresse de dépôt ».',
          explanation: `${cns.map((i, k) => `${A(w, I1)} reçoit ${amt(i.amount, 'USDT')} de la société (facture ${i.no}) puis les dépose chez ChangeNOW par la transaction ${cnDeposits[k].hash} (${fmtDate(cnDeposits[k].time)})`).join(' ; ')}. Ce hash est l'identifiant de commande à fournir à ChangeNOW pour obtenir les données de la commande (adresse de paiement, horodatages, IP), et le point de départ de la corrélation vers Tron.`,
        },
        {
          id: 'o2', type: 'tx', points: 10,
          prompt: 'L\'adresse Ethereum intermédiaire envoie ses USDT à ChangeNOW. Identifiez une transaction de paiement ChangeNOW sur Tron qui correspond à l\'un de ces dépôts.',
          answer: cnPayouts.map((t) => t.id),
          hint: `Corrélation : émetteur ChangeNOW, chaîne Tron, à partir de l'heure du dépôt ERC-20, fenêtre d'environ 1 h, tolérance de 2 à 3 %. Le candidat retenu doit ensuite alimenter Garantex.`,
          explanation: `${cns.map((i, k) => `Dépôt de ${amt(i.amount, 'USDT')} (ERC-20) chez ChangeNOW (${cnDeposits[k].hash.slice(0, 14)}…), puis ${Math.round((cnPayouts[k].time - cnDeposits[k].time) / 60)} minutes plus tard paiement de ${amt(i.arrival ?? 0, 'USDT')} (TRC-20) à ${A(w, T1)}`).join(' ; ')}. Seul le montant diminué de la commission (1 à 2 %) et le délai relient les deux transactions ; la suite (dépôt immédiat chez Garantex) confirme l'hypothèse.`,
        },
        {
          id: 'o3', type: 'addresses', points: 10,
          prompt: 'Sélectionnez les adresses intermédiaires contrôlées par la filière entre la société et Garantex (hors adresses de services).',
          answer: [T2, I1, T1],
          hint: 'Trois adresses : une sur Tron entre la société et Garantex, une sur Ethereum avant ChangeNOW, une sur Tron après ChangeNOW. Le portefeuille d\'un fournisseur légitime n\'en fait pas partie.',
          explanation: `${A(w, T2)} (Tron, relais vers Garantex), ${A(w, I1)} (Ethereum, avant ChangeNOW) et ${A(w, T1)} (Tron, après ChangeNOW). ${A(w, T2)} et ${A(w, T1)} reçoivent leurs TRX de frais d'un même portefeuille, ce qui conforte leur rattachement à un même opérateur. Le portefeuille ${A(w, U)} reçoit des règlements de nombreux clients et dépose chez ${nameU} : c'est celui du fournisseur ${LEGIT[2].name}, pas un intermédiaire.`,
        },
        {
          id: 'o8', type: 'address', points: 9,
          prompt: 'Les deux relais Tron de la filière ont reçu leurs TRX de frais (gas) de la même adresse. Laquelle ?',
          answer: [N],
          hint: 'Ouvrez le premier flux entrant (en TRX, avant toute facture) de chacun des deux relais Tron.',
          explanation: `${A(w, N)} envoie ${amt(gasT1.transfers[0].value, 'TRX')} à ${A(w, T1)} et ${amt(gasT2.transfers[0].value, 'TRX')} à ${A(w, T2)}, avant les premiers paiements de la société. Une adresse Tron sans TRX ne peut pas transférer d'USDT : le financeur de gas commun relie les deux relais à un même opérateur, alors qu'ils ne se sont jamais rien envoyé. C'est un argument d'attribution indépendant des montants, et une nouvelle piste (qui a alimenté ce financeur ?).`,
        },
        {
          id: 'o9', type: 'addresses', points: 9,
          prompt: 'Sélectionnez les adresses de dépôt Garantex qui ont reçu des fonds issus de la société.',
          answer: [G1, G2],
          hint: 'Suivez chaque branche (directe, relais Tron, passage par ChangeNOW) jusqu\'à une adresse étiquetée Garantex ; deux branches convergent.',
          explanation: `${A(w, G2)} reçoit le paiement direct et le flux relayé par ${A(w, T2)} ; ${A(w, G1)} reçoit le produit des commandes ChangeNOW via ${A(w, T1)}. Deux adresses de dépôt distinctes signifient probablement deux comptes clients Garantex : la filière cloisonne ses circuits, mais chaque compte est documenté avec ses dates et montants dans le signalement.`,
        },
        {
          id: 'o4', type: 'number', points: 9,
          prompt: 'Combien de factures de l\'extrait comptable ont donné lieu à des paiements qui ont abouti chez Garantex ?',
          answer: nGx,
          hint: 'Rapprochez chaque facture du paiement on-chain de même montant, puis suivez ce paiement jusqu\'au bout.',
          explanation: `${nGx} factures sur ${invoices.length}, toutes émises par des sociétés-écrans :\n${recap}\nLes ${invoices.length - nGx} autres (${LEGIT.map((l) => l.name).join(', ')}) aboutissent chez ${nameE}, ${nameT} et ${nameU}.`,
        },
        {
          id: 'o5', type: 'amount', points: 11, unit: 'USDT', tolerance: 0.005,
          prompt: 'Quel montant total d\'USDT issu de la société a été crédité sur des adresses de dépôt Garantex ?',
          answer: totalGx,
          hint: 'Additionnez ce qui arrive réellement sur les adresses de dépôt Garantex, pas les montants facturés : le passage par ChangeNOW coûte une commission.',
          explanation: `${amt(totalGx, 'USDT')} : ${amt(direct.amount + hopTotal, 'USDT')} sur ${A(w, G2)} (direct et via ${A(w, T2)}) et ${amt(cnTotal, 'USDT')} sur ${A(w, G1)} (via ChangeNOW). Les factures correspondantes totalisent ${amt(invoicedGx, 'USDT')} : l'écart de ${amt(r2(invoicedGx - totalGx), 'USDT')} correspond aux commissions de ChangeNOW. Deux adresses de dépôt distinctes signifient probablement deux comptes Garantex. L'outil d'exposition seul aurait manqué ${amt(cnTotal, 'USDT')}.`,
        },
        {
          id: 'o6', type: 'choice', points: 8,
          prompt: `La facture ${legitU.no} (${LEGIT[2].name}, ${amt(legitU.amount, 'USDT')}) a été payée vers une adresse non attribuée. Que retenir ?`,
          ...choice(r,
            `Adresse d'un fournisseur réel : elle reçoit de nombreux clients et dépose chez ${nameU} ; flux à vérifier mais non exposé à Garantex`,
            [
              'Toute adresse non attribuée entre la société et un exchange doit être comptée comme intermédiaire de la filière',
              'Adresse probablement contrôlée par Garantex : son montant s\'ajoute au total parvenu à l\'entité sanctionnée',
              'Paiement à exclure de l\'analyse : seuls les flux sur Tron sont pertinents en matière de sanctions',
            ]),
          hint: 'Regardez les autres entrées de cette adresse et la destination de ses sorties.',
          explanation: `${A(w, U)} reçoit des USDT de plusieurs expéditeurs sans lien avec la société, puis les dépose régulièrement sur une même adresse ${nameU} ${A(w, depU)}. C'est le profil d'un portefeuille d'encaissement commercial, cohérent avec un fournisseur établi (sources ouvertes). L'attribution ne se présume pas : une adresse inconnue n'est ni suspecte ni innocente par défaut, et une réquisition à ${nameU} permettra de confirmer le titulaire. Gonfler l'exposition avec ce flux affaiblirait la procédure.`,
        },
        {
          id: 'o10', type: 'amount', points: 9, unit: 'USDT', tolerance: 0.01,
          prompt: 'Quel solde d\'USDT reste actuellement sur l\'adresse Tron de la société ?',
          answer: t0Left,
          hint: 'Lisez le solde USDT de l\'adresse Tron déclarée par la société (ou faites le bilan : achats Coinhouse reçus moins paiements émis).',
          explanation: `${A(w, T0)} détient encore ${amt(t0Left, 'USDT')} : à chaque facture, ${g('le gérant', 'la gérante')} a acheté un peu plus que le montant dû et le surplus s'est accumulé. Ces fonds sont sur un portefeuille auto-hébergé : aucune plateforme ne les détient, mais l'émetteur du jeton peut les bloquer.`,
        },
        {
          id: 'o12', type: 'choice', points: 8,
          prompt: 'Comment préserver ce solde d\'USDT avant que la société ne soit alertée ?',
          ...choice(r,
            'Demander à Tether, émetteur de l\'USDT, le gel de l\'adresse Tron de la société, puis la saisie selon le cadre procédural applicable',
            [
              'Demander à Coinhouse de geler ces USDT, puisqu\'ils proviennent de ses retraits',
              'Aucune mesure possible : un portefeuille auto-hébergé échappe à tout gel',
              'Demander à Garantex de restituer les fonds reçus pour compenser le solde',
            ]),
          hint: 'Qui garde la main sur un jeton TRC-20, même dans un portefeuille que personne d\'autre ne contrôle ?',
          explanation: `Une fois retirés, les USDT ne sont plus chez Coinhouse : la plateforme ne peut geler que ce qui reste sur le compte. En revanche, l'émetteur du jeton peut placer l'adresse sur liste noire, ce qui rend les USDT intransférables. ${procedureFor(tether)} Garantex, sanctionné et non coopératif, n'est pas un interlocuteur.`,
        },
        {
          id: 'o7', type: 'choice', points: 9,
          prompt: 'Quelle voie procédurale retenir ?',
          ...choice(r,
            'Documenter l\'exposition pour le parquet et TRACFIN, faire geler les comptes chez Coinhouse et Bitstamp, requérir ChangeNOW ; aucune réquisition à Garantex',
            [
              'Adresser une réquisition à Garantex pour identifier les titulaires des adresses de dépôt',
              'Demander à ChangeNOW de geler les USDT versés sur l\'adresse Tron intermédiaire',
              'Classer : des paiements en USDT entre sociétés privées ne relèvent pas des sanctions',
            ]),
          hint: 'Quels acteurs coopèrent, et lesquels détiennent encore des avoirs de la société ?',
          explanation: `${procedureFor(gx.entity)} En revanche, la société a ses comptes chez des prestataires régulés : ${procedureFor(cvE.entity)} ${procedureFor(bs.entity)} ChangeNOW ne détient plus les fonds une fois le paiement effectué, mais ses données de commande consolident la corrélation. ${procedureFor(cn.entity)} Sur le fond, le contournement de mesures restrictives de l'UE relève notamment du délit douanier (art. 459 du code des douanes) ; le blanchiment peut aussi être retenu.`,
        },
      ],
      truth: {
        path: [...invoices.flatMap((i) => i.txs), gasT1.id, gasT2.id],
        addresses: [E0, T0, I1, T1, T2, N, G1, G2],
        debrief:
          `1. ${company} SAS achète ${amt(boughtCoinhouse, 'USDT')} sur Coinhouse et ${amt(boughtBitstamp, 'USDT')} sur Bitstamp, retirés vers ${A(w, E0)} (Ethereum) et ${A(w, T0)} (Tron).\n` +
          `2. ${invoices.length - nGx} factures de fournisseurs établis sont réglées vers ${nameE}, ${nameT} et le portefeuille commercial de ${LEGIT[2].name} (qui dépose chez ${nameU}) : flux légitimes en apparence.\n` +
          `3. ${nGx} factures de sociétés-écrans aboutissent chez Garantex :\n${recap}\n` +
          `4. Total crédité chez Garantex : ${amt(totalGx, 'USDT')} (${amt(direct.amount, 'USDT')} d'exposition directe, ${amt(hopTotal, 'USDT')} d'exposition indirecte détectée par l'outil, ${amt(cnTotal, 'USDT')} invisibles sans corrélation à cause du passage ERC-20 → TRC-20 par ChangeNOW).\n` +
          `5. Les relais ${A(w, T1)} et ${A(w, T2)} partagent le même financeur de TRX ${A(w, N)}.\n` +
          `6. Il reste ${amt(t0Left, 'USDT')} sur l'adresse Tron de la société, gelables par l'émetteur (Tether).\n\n` +
          `À retenir : l'exposition calculée par un outil n'est qu'un point de départ. Elle mesure bien les flux directs et à quelques sauts, mais s'arrête aux services qui coupent la trace (échangeurs instantanés, changement de réseau). À l'inverse, toute adresse inconnue n'est pas un intermédiaire : le rapprochement avec les factures et le comportement des adresses permettent de séparer les règlements légitimes des flux vers l'entité sanctionnée. Garantex ne répond à aucune réquisition : on documente, on signale et on agit sur les prestataires régulés où la société détient ses comptes.`,
      },
      hints: [
        'Commencez par l\'onglet Exposition de l\'adresse Tron de la société : distinguez les sorties directes vers Garantex de celles qui passent par un intermédiaire.',
        'Rapprochez chaque facture d\'un paiement on-chain de même montant : les fournisseurs établis aboutissent sur des exchanges régulés.',
        'Sur Ethereum, l\'intermédiaire envoie ses USDT à ChangeNOW : corrélez sur Tron (USDT, émetteur ChangeNOW) pour retrouver l\'adresse qui alimente Garantex.',
        'Les relais Tron ont besoin de TRX pour payer leurs frais : leur premier financement révèle un opérateur commun. Pensez aussi au solde restant sur les adresses de la société.',
      ],
    }
  },
}
