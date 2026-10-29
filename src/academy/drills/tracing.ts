// Exercices de traçage outillé : méthodes d'attribution (FIFO, LIFO, prorata,
// poison), adresses de dépôt sur le modèle à comptes, rapprochement d'un
// échangeur instantané, lecture d'une peel chain, démixage d'un pool et
// empreinte de portefeuille. Chaque réponse est calculée par le générateur.
import { genAddress, shortAddr } from '../../engine/addressgen'
import type { DrillDef, DrillItem } from '../model'
import { LETTERS, dayTime, de, fr, frMax, mkChoice, rngFor } from './util'

const EXCHANGES = ['Binance', 'OKX', 'Bitstamp', 'Coinhouse', 'Kraken', 'Coinbase']
const hm = (t: number) => {
  const d = new Date(t * 1000)
  return `${String(d.getUTCHours()).padStart(2, '0')} h ${String(d.getUTCMinutes()).padStart(2, '0')}`
}

// ── Méthodes d'attribution ───────────────────────────────────────────────

type Method = 'fifo' | 'lifo' | 'haircut'
const METHOD_LABEL: Record<Method, string> = { fifo: 'FIFO (premier entré, premier sorti)', lifo: 'LIFO (dernier entré, premier sorti)', haircut: 'prorata (haircut)' }

export const taintMethod: DrillDef = {
  id: 'taint-method',
  title: 'Quelle part est marquée ?',
  description: 'Appliquer FIFO, LIFO, prorata ou poison au solde d\'une adresse qui mélange les fonds d\'une victime et d\'autres fonds.',
  level: 2,
  track: 'methodo',
  icon: 'Scale',
  generate(seed) {
    const rng = rngFor(seed, 'taint-method')
    const step = 50
    const c1 = Math.round(rng.float(2000, 12000) / step) * step
    const v = Math.round(rng.float(8000, 40000) / step) * step
    const c2 = Math.round(rng.float(2000, 12000) / step) * step
    // Paiement supérieur à chaque apport propre : chaque méthode attribue une part non nulle
    const P = Math.round(rng.float(Math.max(c1, c2) + 500, c1 + v + c2 - 500) / step) * step
    const total = c1 + v + c2
    const fifo = Math.min(v, Math.max(0, P - c1))
    const lifo = Math.min(v, Math.max(0, P - c2))
    const haircut = Math.round(((P * v) / total) * 100) / 100
    const t0 = dayTime(rng)
    const items = [
      `${hm(t0)} — reçoit ${fr(c1)} USDT d'un compte personnel (fonds propres)`,
      `${hm(t0 + 3 * 3600)} — reçoit ${fr(v)} USDT de la victime`,
      `${hm(t0 + 5 * 3600)} — reçoit ${fr(c2)} USDT d'un autre contact (fonds sans lien)`,
      `${hm(t0 + 7 * 3600)} — envoie ${fr(P)} USDT vers une adresse de dépôt ${rng.pick(EXCHANGES)}`,
    ]
    const visual = { type: 'list' as const, title: 'Historique de l\'adresse intermédiaire (Tron, USDT)', items }
    const recap = `Rappel : FIFO = ${fr(fifo)} USDT, LIFO = ${fr(lifo)} USDT, prorata = ${frMax(haircut, 2)} USDT, poison = ${fr(P)} USDT (tout le paiement).`

    if (rng.chance(0.25)) {
      const correct = 'Poison : la totalité du paiement est considérée comme marquée'
      const { options, answer } = mkChoice(rng, correct, rng.shuffle([
        'Prorata : il ne garde que la part de la victime dans le solde',
        'FIFO : les fonds de la victime sont entrés avant le paiement',
        'LIFO : les derniers fonds entrés partent en premier',
      ]), 4)
      return {
        prompt: 'Le paiement vers l\'exchange doit être signalé au titre d\'un gel conservatoire, en couvrant le périmètre le plus large. Quelle méthode le délimite ?',
        visual,
        kind: 'choice',
        options,
        answer,
        explain: `La méthode « poison » (contamination totale) considère comme marqué tout montant qui sort après l'entrée de fonds illicites : ici les ${fr(P)} USDT entiers. Elle délimite un périmètre maximal (signalement, gel conservatoire), jamais un préjudice : elle compte aussi les ${fr(c1 + c2)} USDT sans lien.\n\n${recap}`,
      }
    }

    const m = rng.pick(['fifo', 'lifo', 'haircut'] as Method[])
    const answer = m === 'fifo' ? fifo : m === 'lifo' ? lifo : haircut
    const how: Record<Method, string> = {
      fifo: `En FIFO, le paiement consomme les fonds dans leur ordre d'arrivée : d'abord les ${fr(c1)} USDT propres, puis ${fr(fifo)} USDT de la victime (${fr(P)} − ${fr(c1)}${fifo === v ? `, plafonné aux ${fr(v)} reçus` : ''}).`,
      lifo: `En LIFO, le paiement consomme d'abord les fonds arrivés en dernier : les ${fr(c2)} USDT sans lien, puis ${fr(lifo)} USDT de la victime (${fr(P)} − ${fr(c2)}${lifo === v ? `, plafonné aux ${fr(v)} reçus` : ''}).`,
      haircut: `Au prorata, chaque unité sortie emporte la proportion de fonds de la victime dans le solde au moment du paiement : ${fr(v)} / ${fr(total)} = ${frMax((v / total) * 100, 1)} %, soit ${fr(P)} × ${frMax(v / total, 4)} = ${frMax(haircut, 2)} USDT.`,
    }
    return {
      prompt: `Selon la méthode ${METHOD_LABEL[m]}, combien d'USDT de la victime partent dans le paiement vers l'exchange ?`,
      context: 'L\'adresse ne détenait rien avant ces opérations. Arrondissez à l\'unité (au centime pour le prorata).',
      visual,
      kind: 'number',
      answer,
      tolerance: m === 'haircut' ? 0.01 : 0.001,
      unit: 'USDT',
      explain: `${how[m]}\n\n${recap} Le résultat dépend de la méthode : le rapport doit annoncer celle qui est retenue et, si la conclusion change d'une méthode à l'autre, le dire.`,
    }
  },
}

// ── Adresse de dépôt sur le modèle à comptes ─────────────────────────────

export const depositPattern: DrillDef = {
  id: 'deposit-pattern',
  title: 'Repérer une adresse de dépôt',
  description: 'Sur Ethereum ou Tron, reconnaître au comportement l\'adresse de dépôt client d\'un exchange, même quand l\'outil ne l\'a pas étiquetée.',
  level: 2,
  track: 'comptes',
  icon: 'Inbox',
  generate(seed) {
    const rng = rngFor(seed, 'deposit-pattern')
    const chain = rng.pick(['eth', 'tron'] as const)
    const asset = 'USDT'
    const ex = rng.pick(EXCHANGES)
    const short = (a: string) => shortAddr(a, 5)
    const hot = genAddress(rng, chain, 'eoa')
    const addrs = Array.from({ length: 4 }, () => genAddress(rng, chain, 'eoa'))
    const t0 = dayTime(rng)
    const rows: Extract<DrillItem['visual'], { type: 'transfers' }>['rows'] = []
    const amt = () => Math.round(rng.float(800, 30000))
    // 0 : vraie adresse de dépôt (reçoit puis reverse tout au hot wallet, comme ses voisines)
    // 1 : reverse au hot wallet mais garde la moitié (paiement partiel d'un particulier)
    // 2 : vide son solde mais vers deux destinations différentes
    // 3 : reverse tout vers une adresse qui ne reçoit que d'elle (simple relais)
    const relay = genAddress(rng, chain, 'eoa')
    const other = genAddress(rng, chain, 'eoa')
    const a0 = amt()
    const a1 = amt()
    const a2 = amt()
    const a3 = amt()
    rows.push({ from: genAddress(rng, chain, 'eoa'), to: addrs[0], value: a0, asset, time: t0 })
    rows.push({ from: addrs[0], to: hot, value: a0, asset, time: t0 + rng.int(20, 300) * 60, toLabel: `${ex} — Hot wallet` })
    rows.push({ from: genAddress(rng, chain, 'eoa'), to: addrs[1], value: a1, asset, time: t0 + 600 })
    rows.push({ from: addrs[1], to: hot, value: Math.round(a1 / 2), asset, time: t0 + 9 * 3600, toLabel: `${ex} — Hot wallet` })
    rows.push({ from: genAddress(rng, chain, 'eoa'), to: addrs[2], value: a2, asset, time: t0 + 1200 })
    rows.push({ from: addrs[2], to: hot, value: Math.round(a2 * 0.4), asset, time: t0 + 2 * 3600, toLabel: `${ex} — Hot wallet` })
    rows.push({ from: addrs[2], to: other, value: a2 - Math.round(a2 * 0.4), asset, time: t0 + 2 * 3600 + 300 })
    rows.push({ from: genAddress(rng, chain, 'eoa'), to: addrs[3], value: a3, asset, time: t0 + 1800 })
    rows.push({ from: addrs[3], to: relay, value: a3, asset, time: t0 + 3600 })
    // Voisines : d'autres adresses qui reversent tout au même hot wallet
    for (let i = 0; i < 3; i++) {
      const s = genAddress(rng, chain, 'eoa')
      const v = amt()
      rows.push({ from: s, to: hot, value: v, asset, time: t0 + rng.int(1, 20) * 1800, fromLabel: 'Autre adresse (solde vidé)', toLabel: `${ex} — Hot wallet` })
    }
    rng.shuffle(rows)
    rows.sort((x, y) => (x.time ?? 0) - (y.time ?? 0))
    const labels = addrs.map(short)
    const { options, answer } = mkChoice(rng, labels[0], rng.shuffle(labels.slice(1)), 4)
    return {
      prompt: `Laquelle de ces adresses non étiquetées est vraisemblablement une adresse de dépôt client de ${ex} ?`,
      context: `Transferts USDT relevés sur ${chain === 'eth' ? 'Ethereum' : 'Tron'}. Seul le hot wallet de ${ex} est étiqueté par l'outil.`,
      visual: { type: 'transfers', chain, rows },
      kind: 'choice',
      options,
      answer,
      explain: `${labels[0]} reçoit ${fr(a0)} USDT puis reverse exactement tout vers le hot wallet de ${ex}, peu après, comme d'autres adresses qui vident leur solde vers ce même collecteur : c'est le schéma d'une adresse de dépôt (une par client, balayée régulièrement). C'est elle qu'il faut citer dans la réquisition, avec le hash du dépôt : elle désigne le compte client.\n\nLes autres : ${labels[1]} ne reverse que la moitié de ce qu'elle a reçu (particulier qui paie) ; ${labels[2]} répartit ses fonds entre deux destinations (pas un balayage) ; ${labels[3]} vide tout, mais vers une adresse qui ne reçoit que d'elle (simple relais, sans collecteur partagé).`,
    }
  },
}

// ── Échangeur instantané : quel paiement correspond au dépôt ? ───────────

export const swapMatch: DrillDef = {
  id: 'swap-match',
  title: 'Sortie d\'un échangeur instantané',
  description: 'Retrouver, par le montant et le délai, le paiement d\'un échangeur instantané qui correspond à un dépôt, quand aucun lien on-chain n\'existe.',
  level: 3,
  track: 'interchaines',
  icon: 'Repeat',
  generate(seed) {
    const rng = rngFor(seed, 'swap-match')
    const svc = rng.pick(['ChangeNOW', 'eXch'])
    const depUsd = Math.round(rng.float(3000, 90000))
    const btcPrice = 64000
    const depBtc = Math.round((depUsd / btcPrice) * 1e6) / 1e6
    const ethPrice = 3185
    const t0 = dayTime(rng)
    const fee = rng.float(0.008, 0.02)
    const goodUsd = depUsd * (1 - fee)
    const mk = (usdv: number, dtMin: number) => ({ usd: usdv, eth: Math.round((usdv / ethPrice) * 1e4) / 1e4, dt: dtMin })
    const good = mk(goodUsd, rng.int(8, 40))
    const cands = [
      { key: 'good', ...good },
      { key: 'over', ...mk(depUsd * rng.float(1.02, 1.06), rng.int(5, 40)) },
      { key: 'early', ...mk(depUsd * rng.float(0.975, 0.995), -rng.int(15, 90)) },
      { key: 'late', ...mk(depUsd * rng.float(0.975, 0.995), rng.int(300, 600)) },
      { key: 'low', ...mk(depUsd * rng.float(0.8, 0.88), rng.int(5, 40)) },
    ]
    const shown = [cands[0], ...rng.shuffle(cands.slice(1)).slice(0, 3)]
    const order = rng.shuffle(shown.map((_, i) => i))
    const lines = order.map((i, k) => {
      const c = shown[i]
      const when = c.dt >= 0 ? `${c.dt} min après le dépôt` : `${-c.dt} min avant le dépôt`
      return { k, c, text: `Paiement ${LETTERS[k]} : ${frMax(c.eth, 4)} ETH (≈ ${fr(Math.round(c.usd))} $), ${when}` }
    })
    const correctLine = lines.find((l) => l.c.key === 'good')!
    const why: Record<string, string> = {
      over: 'plus que la valeur déposée : un service ne paie pas plus qu\'il ne reçoit',
      early: 'antérieur au dépôt : impossible',
      late: 'montant plausible, mais plusieurs heures après : hors de la fenêtre habituelle (quelques minutes à une heure)',
      low: 'trop bas : plus de 12 % d\'écart, bien au-delà des frais habituels (0,5 à 3 %)',
    }
    const { options, answer } = mkChoice(rng, `Paiement ${LETTERS[correctLine.k]}`, lines.filter((l) => l !== correctLine).map((l) => `Paiement ${LETTERS[l.k]}`), 4)
    return {
      prompt: `Quel paiement ${de(svc)} correspond le plus probablement au dépôt du suspect ?`,
      context: `Le suspect a déposé ${frMax(depBtc, 6)} BTC (≈ ${fr(depUsd)} $) sur une adresse de dépôt ${svc}. Paiements sortants du hot wallet ETH ${de(svc)} autour de ce moment (cours retenus : 1 BTC = ${fr(btcPrice)} $, 1 ETH = ${fr(ethPrice)} $).`,
      visual: { type: 'list', title: `Sorties du hot wallet ETH ${de(svc)}`, items: lines.map((l) => l.text) },
      kind: 'choice',
      options,
      answer,
      explain: `Le paiement ${LETTERS[correctLine.k]} représente ${frMax((good.usd / depUsd) * 100, 1)} % de la valeur déposée, ${good.dt} minutes après : la commission et l'écart de cours de l'échangeur (0,5 à 3 %) et son délai habituel concordent.\n\nÉcartés : ${lines.filter((l) => l !== correctLine).map((l) => `${LETTERS[l.k]}, ${why[l.c.key]}`).join(' ; ')}.\n\nLe rapprochement reste une hypothèse : il se confirme par réquisition à ${svc} avec le hash du dépôt, qui permet au service de retrouver la commande et son adresse de paiement.`,
    }
  },
}

// ── Lecture d'une peel chain ─────────────────────────────────────────────

export const peelRead: DrillDef = {
  id: 'peel-read',
  title: 'Lire une peel chain',
  description: 'Suivre une peel chain saut par saut et totaliser les pelures arrivées chez un même service.',
  level: 2,
  track: 'bitcoin',
  icon: 'ListTree',
  generate(seed) {
    const rng = rngFor(seed, 'peel-read')
    const n = rng.int(5, 8)
    const targets = rng.shuffle([...EXCHANGES]).slice(0, 3)
    const focus = targets[0]
    let bal = Math.round(rng.float(2, 9) * 1e4) / 1e4
    const start = bal
    const items: string[] = []
    let sum = 0
    let count = 0
    const forced = rng.int(0, n - 1)
    for (let i = 0; i < n; i++) {
      const peel = Math.round(bal * rng.float(0.04, 0.12) * 1e4) / 1e4
      const fee = 0.0001
      const dest = i === forced ? focus : rng.pick([...targets, 'adresse non attribuée'])
      bal = Math.round((bal - peel - fee) * 1e4) / 1e4
      if (dest === focus) {
        sum += peel
        count++
      }
      items.push(`Saut ${i + 1} : ${frMax(peel, 4)} BTC → ${dest === 'adresse non attribuée' ? dest : `adresse de dépôt ${dest}`} · reste ${frMax(bal, 4)} BTC vers une adresse neuve`)
    }
    sum = Math.round(sum * 1e4) / 1e4
    if (rng.chance(0.35)) {
      return {
        prompt: 'Combien de bitcoins restent sur la dernière adresse de la chaîne ?',
        context: `Peel chain partie d'une adresse qui détenait ${frMax(start, 4)} BTC. Chaque saut paie 0,0001 BTC de frais.`,
        visual: { type: 'list', title: 'Tableau des pelures', items },
        kind: 'number',
        answer: bal,
        tolerance: 0.002,
        unit: 'BTC',
        explain: `C'est le « reste » du dernier saut : ${frMax(bal, 4)} BTC. Il n'a pas encore été dépensé : c'est une piste de gel ou de saisie si l'adresse est rattachée au suspect, et une adresse à surveiller.\n\nVérification : ${frMax(start, 4)} BTC − pelures − ${n} × 0,0001 BTC de frais.`,
      }
    }
    return {
      prompt: `Quel montant total la chaîne a-t-elle déposé chez ${focus} ?`,
      context: `Peel chain partie d'une adresse qui détenait ${frMax(start, 4)} BTC.`,
      visual: { type: 'list', title: 'Tableau des pelures', items },
      kind: 'number',
      answer: sum,
      tolerance: 0.002,
      unit: 'BTC',
      explain: `On additionne les pelures dont la destination est une adresse de dépôt ${focus} : ${count} pelure(s), soit ${frMax(sum, 4)} BTC.\n\nC'est ce regroupement par service qui oriente les réquisitions : une seule demande à ${focus}, listant toutes les adresses de dépôt et tous les txid concernés.`,
    }
  },
}

// ── Démixage d'un pool de confidentialité ────────────────────────────────

export const poolDemix: DrillDef = {
  id: 'pool-demix',
  title: 'Retraits d\'un pool : lesquels rattacher ?',
  description: 'Exploiter les erreurs d\'hygiène autour d\'un pool à dénominations fixes (type Tornado) et écarter les rattachements impossibles.',
  level: 4,
  track: 'confidentialite',
  icon: 'ScanSearch',
  generate(seed) {
    const rng = rngFor(seed, 'pool-demix')
    const n10 = rng.int(3, 6)
    const n100 = rng.int(1, 3)
    const [lA, lB, lC, lD] = rng.shuffle(LETTERS.slice(0, 4))
    const groups = [
      { key: 'good', text: `Le collecteur ${lA} reçoit ${Math.min(n10, 3)} retraits de 10 ETH et ${n100} de 100 ETH, tous 3 à 15 jours après les dépôts, ainsi que le reliquat non mixé (0,6 ETH) envoyé par le suspect via une adresse intermédiaire.` },
      { key: 'early', text: `Le collecteur ${lB} reçoit 4 retraits de 10 ETH, dont l'un deux jours avant le premier dépôt du suspect.` },
      { key: 'count', text: `Le collecteur ${lC} reçoit ${n10 + 2} retraits de 10 ETH, tous postérieurs aux dépôts.` },
      { key: 'relayer', text: `Les retraits vers ${lD} passent par le même relayer que plusieurs retraits du suspect.` },
    ]
    const shown = rng.shuffle([...groups])
    const correct = `Le collecteur ${lA}`
    const { options, answer } = mkChoice(rng, correct, [`Le collecteur ${lB}`, `Le collecteur ${lC}`, `Les retraits vers ${lD}`], 4)
    return {
      prompt: 'Quel groupe de retraits peut être rattaché au suspect, à titre de présomption ?',
      context: `Le suspect a déposé ${n10} × 10 ETH et ${n100} × 100 ETH dans le pool en une soirée. Sur la même période, des dizaines de tiers déposent et retirent les mêmes dénominations.`,
      visual: { type: 'list', title: 'Groupes de retraits observés', items: shown.map((g) => g.text) },
      kind: 'choice',
      options,
      answer,
      explain: `${lA} cumule deux erreurs d'hygiène : des retraits regroupés sur une même adresse, tous postérieurs aux dépôts et compatibles en nombre, et la réception du reliquat qui n'est jamais passé par le pool. Ce lien non mixé rattache le collecteur au déposant.\n\nÉcartés : ${lB} reçoit un retrait antérieur au premier dépôt, ce qui ne peut pas être les fonds du suspect ; ${lC} compte ${n10 + 2} retraits de 10 ETH pour seulement ${n10} dépôts du suspect à cette dénomination ; un relayer est partagé par de nombreux utilisateurs et ne désigne personne.\n\nC'est une présomption : à corroborer par la suite du flux (dépôt du collecteur chez un service, réquisition).`,
    }
  },
}

// ── Empreinte de portefeuille ────────────────────────────────────────────

interface Fp {
  version: number
  locktime: 'hauteur' | '0'
  rbf: boolean
}
const fpText = (f: Fp) => `version ${f.version} · nLockTime ${f.locktime === 'hauteur' ? '= hauteur du bloc' : '= 0'} · RBF ${f.rbf ? 'signalé' : 'non signalé'}`
const FPS: Fp[] = [
  { version: 2, locktime: 'hauteur', rbf: true },
  { version: 2, locktime: '0', rbf: true },
  { version: 1, locktime: '0', rbf: false },
  { version: 2, locktime: '0', rbf: false },
]

export const walletFingerprint: DrillDef = {
  id: 'wallet-fingerprint',
  title: 'Empreinte de portefeuille',
  description: 'Départager le rendu et le paiement d\'une transaction Bitcoin grâce aux champs techniques des transactions qui dépensent ensuite chaque sortie.',
  level: 5,
  track: 'methodo',
  icon: 'Fingerprint',
  generate(seed) {
    const rng = rngFor(seed, 'wallet-fingerprint')
    const [mine, other] = rng.shuffle([...FPS]).slice(0, 2)
    const a = (Math.round(rng.float(0.05, 0.6) * 1e4) / 1e4)
    const b = (Math.round(rng.float(0.05, 0.6) * 1e4) / 1e4)
    const undecidable = rng.chance(0.2)
    const changeIsX = rng.chance(0.5)
    const fx = undecidable ? mine : changeIsX ? mine : other
    const fy = undecidable ? mine : changeIsX ? other : mine
    const items = [
      `Transaction étudiée : ${fpText(mine)} · 1 entrée P2WPKH → sortie X (${frMax(a, 4)} BTC, P2WPKH, adresse neuve) et sortie Y (${frMax(b, 4)} BTC, P2WPKH, adresse neuve)`,
      `Dépense ultérieure de X : ${fpText(fx)}`,
      `Dépense ultérieure de Y : ${fpText(fy)}`,
    ]
    const UND = 'Indécidable : les deux sorties sont redépensées avec la même empreinte'
    const correct = undecidable ? UND : changeIsX ? 'La sortie X' : 'La sortie Y'
    const { options, answer } = mkChoice(rng, correct, [changeIsX || undecidable ? 'La sortie Y' : 'La sortie X', undecidable ? 'La sortie X' : UND, 'La plus grosse des deux sorties, toujours'], 4)
    const diff = (f: Fp, g: Fp) => [f.version !== g.version && 'la version', f.locktime !== g.locktime && 'le nLockTime', f.rbf !== g.rbf && 'le signalement RBF'].filter(Boolean).join(', ')
    return {
      prompt: 'Quelle sortie est le plus probablement le rendu ?',
      context: 'Les deux sorties sont du même type, vers des adresses neuves, et aucun montant n\'est rond : les heuristiques classiques ne tranchent pas.',
      visual: { type: 'list', title: 'Champs techniques relevés', items },
      kind: 'choice',
      options,
      answer,
      explain: undecidable
        ? `Les deux sorties sont redépensées avec la même empreinte que la transaction étudiée : le critère ne permet pas de trancher (deux utilisateurs du même logiciel, ou le même acteur des deux côtés). Il faut d'autres éléments : dépense commune avec des adresses du cluster, comportement ultérieur, montants en euros.`
        : `Chaque logiciel de portefeuille fixe ces champs de la même manière à chaque transaction. La sortie ${changeIsX ? 'X' : 'Y'} est redépensée avec la même empreinte que la transaction étudiée : même logiciel, donc probablement même acteur, c'est le rendu. L'autre sortie est dépensée par un logiciel différent (${diff(mine, other)}) : c'est le paiement.\n\nCe n'est qu'un indice parmi d'autres : deux personnes peuvent utiliser le même logiciel. La taille de la sortie ne dit rien à elle seule.`,
    }
  },
}
