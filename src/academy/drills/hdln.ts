// Exercices Bitcoin avancés : portefeuilles HD (xpub / ypub / zpub, chemins de
// dérivation, gap limit) et reconnaissance des transactions Lightning on-chain.
// Les transactions Lightning sont construites avec le moteur (openChannel,
// cooperativeClose, forceClose) et la réponse est celle de detectLightning.
import { World, type Tx } from '../../engine/world'
import { createHdWallet, HD_SCHEMES, type HdAddrKind } from '../../engine/hd'
import { openChannel } from '../../engine/patterns'
import { detectLightning, type LightningKind } from '../../engine/analysis'
import type { AddrKind } from '../../engine/addressgen'
import type { DrillDef, DrillItem } from '../model'
import { dayTime, frList, frMax, mkChoice, rngFor } from './util'

// ── Portefeuilles HD ─────────────────────────────────────────────────────────

const COIN_NAME: Record<'btc' | 'ltc', string> = { btc: 'Bitcoin', ltc: 'Litecoin' }
const COIN_TYPE: Record<'btc' | 'ltc', number> = { btc: 0, ltc: 2 }
const KIND_SHORT: Record<HdAddrKind, string> = { p2wpkh: 'SegWit natif', p2sh: 'SegWit encapsulé', p2pkh: 'Legacy', p2tr: 'Taproot' }

/** Libellé d'un type d'adresse HD : « SegWit natif (P2WPKH) — adresses bc1q…, BIP 84 ». */
function hdKindLabel(kind: HdAddrKind, chain: 'btc' | 'ltc'): string {
  const s = HD_SCHEMES[kind]
  return `${s.label} — adresses ${s.addrHint[chain]}, ${s.bip}`
}

const kindsFor = (chain: 'btc' | 'ltc'): HdAddrKind[] => (chain === 'btc' ? ['p2wpkh', 'p2sh', 'p2pkh', 'p2tr'] : ['p2wpkh', 'p2sh', 'p2pkh'])

const PREFIX_RULE = 'Rappel : zpub → BIP 84 (SegWit natif, m/84\'/…) ; ypub → BIP 49 (SegWit encapsulé, m/49\'/…) ; xpub → BIP 44 (Legacy, m/44\'/…) mais aussi BIP 86 (Taproot, m/86\'/…), car les portefeuilles Taproot exportent une xpub accompagnée d\'un « descripteur » tr(…).'

/** Nombre d'adresses utilisées qu'un balayage avec ce gap limit retrouvera. */
export function gapFound(used: number[], gap: number): number {
  let prev = -1
  let found = 0
  for (const u of [...used].sort((a, b) => a - b)) {
    if (u - prev - 1 >= gap) break
    found++
    prev = u
  }
  return found
}

export const hdPath: DrillDef = {
  id: 'hd-path',
  title: 'xpub et chemins de dérivation',
  description: 'Lire une clé publique étendue (xpub, ypub, zpub) et un chemin de dérivation : type d\'adresses, branche de rendu, compte, gap limit et portée réelle d\'une xpub saisie.',
  level: 2,
  track: 'bitcoin',
  icon: 'KeyRound',
  generate(seed) {
    const rng = rngFor(seed, 'hd-path')
    const variant = rng.weighted([['prefix', 3], ['path', 3], ['format', 2], ['power', 2], ['gap', 2]] as const)
    const chain: 'btc' | 'ltc' = rng.chance(0.75) ? 'btc' : 'ltc'
    const w = new World(rng.int(1, 0x7ffffffe))

    if (variant === 'prefix') {
      // BTC : une fois sur quatre, une xpub, dont le préfixe seul ne tranche pas entre BIP 44 et BIP 86.
      const ambiguous = chain === 'btc' && rng.chance(0.25)
      const kind: HdAddrKind = ambiguous ? rng.pick(['p2pkh', 'p2tr'] as const) : rng.pick(['p2wpkh', 'p2sh'] as const)
      const hd = createHdWallet(w, { chain, kind })
      const AMBIG = 'Le préfixe ne suffit pas : une xpub sert au BIP 44 (Legacy, 1…) comme au BIP 86 (Taproot, bc1p…) ; il faut le chemin ou le descripteur'
      const correct = ambiguous ? AMBIG : hdKindLabel(kind, chain)
      const others = kindsFor(chain).filter((k) => ambiguous || k !== kind).map((k) => hdKindLabel(k, chain))
      const { options, answer } = mkChoice(rng, correct, rng.shuffle(others), 4)
      const prefix = HD_SCHEMES[kind].prefix
      return {
        prompt: 'Cette clé publique étendue a été relevée dans l\'application de portefeuille d\'un suspect. Quel type d\'adresses permet-elle de dériver ?',
        context: `Portefeuille ${COIN_NAME[chain]}. Observez les quatre premiers caractères.`,
        visual: { type: 'address', value: hd.xpub },
        kind: 'choice',
        options,
        answer,
        explain: ambiguous
          ? `Le préfixe « xpub » est le format historique (BIP 32/44) : par convention il désigne un compte Legacy (chemin m/44'/0'/0', adresses 1…). Mais les portefeuilles Taproot (BIP 86, m/86'/0'/0', adresses bc1p…) exportent eux aussi une « xpub », accompagnée d'un descripteur tr(…) : aucun préfixe propre n'a été créé pour Taproot. Avec le seul préfixe, on ne peut donc pas trancher.\n\nEn pratique : rechercher le descripteur ou le chemin (exports du logiciel, sauvegarde, captures), ou dériver les deux familles d'adresses et garder celle qui a un historique sur la blockchain.\n\n${PREFIX_RULE}`
          : `Le préfixe « ${prefix} » a été défini (norme SLIP-132) pour signaler le type de script : ${prefix === 'zpub' ? 'zpub = BIP 84, SegWit natif P2WPKH (chemin m/84\'/…), adresses ' + HD_SCHEMES.p2wpkh.addrHint[chain] : 'ypub = BIP 49, SegWit encapsulé dans du P2SH (chemin m/49\'/…), adresses ' + HD_SCHEMES.p2sh.addrHint[chain]}. Les quatre premiers caractères suffisent donc à savoir quelles adresses rechercher sur l'explorateur.\n\n${PREFIX_RULE} Dériver le mauvais type d'adresses avec la bonne clé donnerait des adresses valides mais vides : c'est l'erreur classique qui fait conclure à tort qu'un portefeuille « n'a jamais servi ».`,
      }
    }

    if (variant === 'path' || variant === 'format') {
      const kind: HdAddrKind = rng.pick(kindsFor(chain))
      const purpose = HD_SCHEMES[kind].purpose
      const coinType = COIN_TYPE[chain]
      const account = rng.weighted([[0, 5], [1, 2], [2, 1], [3, 1]] as const)
      const branch = rng.chance(0.5) ? 1 : 0
      const index = rng.int(0, 40)
      const path = `m/${purpose}'/${coinType}'/${account}'/${branch}/${index}`

      if (variant === 'format') {
        const fmt = (k: HdAddrKind, c: 'btc' | 'ltc') => `${HD_SCHEMES[k].addrHint[c]} — ${HD_SCHEMES[k].label}, ${COIN_NAME[c]}`
        const correct = fmt(kind, chain)
        const other: 'btc' | 'ltc' = chain === 'btc' ? 'ltc' : 'btc'
        const d = [
          ...kindsFor(chain).filter((k) => k !== kind).map((k) => fmt(k, chain)),
          ...(kind !== 'p2tr' ? [fmt(kind, other)] : []),
        ]
        const { options, answer } = mkChoice(rng, correct, rng.shuffle(d), 4)
        return {
          prompt: `Quel format d'adresse produit le chemin de dérivation ${path} ?`,
          context: 'Le chemin figure dans l\'export d\'un logiciel de portefeuille saisi en perquisition.',
          visual: { type: 'address', value: path },
          kind: 'choice',
          options,
          answer,
          explain: `Un chemin BIP 32 se lit m / objectif' / type de coin' / compte' / branche / index. Ici l'objectif ${purpose}' désigne ${HD_SCHEMES[kind].bip}, soit ${HD_SCHEMES[kind].label} ; le type de coin ${coinType}' désigne ${COIN_NAME[chain]} (norme SLIP-44 : 0 = Bitcoin, 2 = Litecoin, 60 = Ethereum). Le format attendu est donc ${HD_SCHEMES[kind].addrHint[chain]}.\n\nObjectifs à connaître : 44' = Legacy (1… / L…), 49' = SegWit encapsulé (3… / M…), 84' = SegWit natif (bc1q… / ltc1q…), 86' = Taproot (bc1p…). Se tromper de type de coin fait chercher sur la mauvaise blockchain ; se tromper d'objectif fait dériver des adresses valides mais jamais utilisées.`,
        }
      }

      const role = (b: number) => (b === 1 ? 'Adresse de rendu (branche interne 1)' : 'Adresse de réception (branche externe 0)')
      const desc = (b: number, i: number, acc: number, c: 'btc' | 'ltc', k: HdAddrKind) => `${role(b)}, index ${i} du compte ${acc} — ${COIN_NAME[c]}, ${KIND_SHORT[k]}`
      const correct = desc(branch, index, account, chain, kind)
      const otherKinds = rng.shuffle(kindsFor(chain).filter((k) => k !== kind))
      // La confusion réception / rendu est toujours proposée ; les autres pièges sont tirés au sort.
      const d = rng.shuffle([
        ...(account !== index ? [desc(branch, account, index, chain, kind)] : []),
        ...(kind !== 'p2tr' ? [desc(branch, index, account, chain === 'btc' ? 'ltc' : 'btc', kind)] : []),
        desc(branch, index, account, chain, otherKinds[0]),
        desc(branch, index, account, chain, otherKinds[1]),
      ])
      const { options, answer } = mkChoice(rng, correct, [desc(1 - branch, index, account, chain, kind), ...d], 4)
      return {
        prompt: `Que désigne le chemin de dérivation ${path} ?`,
        context: 'Chemin affiché par l\'outil « Dérivation HD » pour une adresse du dossier.',
        visual: { type: 'address', value: path },
        kind: 'choice',
        options,
        answer,
        explain: `Lecture, élément par élément : m (clé maîtresse) / ${purpose}' = ${HD_SCHEMES[kind].bip}, ${HD_SCHEMES[kind].label} / ${coinType}' = ${COIN_NAME[chain]} / ${account}' = compte n° ${account} (le premier compte porte le numéro 0) / ${branch} = ${branch === 1 ? 'branche interne, réservée aux adresses de rendu' : 'branche externe, celle des adresses de réception communiquées aux payeurs'} / ${index} = index de l'adresse dans la branche (${index === 0 ? 'la toute première' : `la ${index + 1}ᵉ, la numérotation commençant à 0`}). L'apostrophe signale une dérivation « durcie » (hardened).\n\nPour l'enquête, la branche compte : une adresse en …/1/i est un rendu, donc des fonds restés au propriétaire, pas un paiement à un tiers. Pièges : confondre compte et index (le compte est au 3ᵉ niveau, l'index au dernier), ou le type de coin (0 = Bitcoin, 2 = Litecoin).`,
      }
    }

    if (variant === 'power') {
      const kind: HdAddrKind = rng.pick(chain === 'btc' ? (['p2wpkh', 'p2wpkh', 'p2sh', 'p2pkh'] as const) : (['p2wpkh', 'p2sh'] as const))
      const hd = createHdWallet(w, { chain, kind })
      const prefix = HD_SCHEMES[kind].prefix
      const purpose = HD_SCHEMES[kind].purpose
      const correct = 'Recalculer toutes les adresses de ce compte, en réception comme en rendu, et suivre leurs transactions — sans pouvoir dépenser'
      const d = [
        'Dépenser les fonds : une clé étendue équivaut à la clé privée du portefeuille',
        'Retrouver la phrase de récupération (seed) du portefeuille',
        `Voir les adresses de tous les comptes du portefeuille (m/${purpose}'/${COIN_TYPE[chain]}'/0', 1', 2'…)`,
        'Voir uniquement l\'adresse de réception actuellement affichée par l\'application',
      ]
      const { options, answer } = mkChoice(rng, correct, rng.shuffle(d), rng.pick([4, 5]))
      return {
        prompt: `Que permet, à elle seule, la ${prefix} saisie ci-dessous ?`,
        context: `${prefix} du compte ${hd.pathTemplate.replace('/{0|1}/i', '')}, exportée depuis le logiciel de portefeuille du suspect (${COIN_NAME[chain]}).`,
        visual: { type: 'address', value: hd.xpub },
        kind: 'choice',
        options,
        answer,
        explain: `Une clé publique étendue (xpub, ypub, zpub) est la clé publique d'un compte et son « code de chaîne » : elle permet de dériver toutes les clés publiques, donc toutes les adresses, des branches de réception (…/0/i) et de rendu (…/1/i) de ce compte. On reconstitue ainsi tout l'historique et le solde, rendu compris — ce que le clustering seul ne garantit jamais.\n\nElle ne contient aucune clé privée : impossible de dépenser ou de transférer les fonds (pour une saisie, il faut la seed ou les clés privées). Elle ne permet pas non plus de remonter à la phrase de récupération. Enfin, elle ne couvre qu'un compte : les comptes 1', 2'… du même portefeuille ont chacun leur propre clé étendue. À l'inverse, elle va bien au-delà de la seule adresse affichée.`,
      }
    }

    // gap limit
    const kind: HdAddrKind = rng.pick(kindsFor(chain))
    const hd = createHdWallet(w, { chain, kind })
    const gap = 20
    const used: number[] = []
    let i = 0
    const nFirst = rng.int(2, 5)
    for (let k = 0; k < nFirst; k++) {
      i += k === 0 ? rng.int(0, 1) : rng.int(1, 6)
      used.push(i)
    }
    const hasHole = rng.chance(0.7)
    // Un trou de 20 adresses inutilisées ou plus (si hasHole), sinon des écarts inférieurs.
    i += hasHole ? gap + 1 + rng.int(0, 15) : rng.int(8, gap)
    used.push(i)
    const nAfter = rng.int(0, 2)
    for (let k = 0; k < nAfter; k++) {
      i += rng.int(1, 9)
      used.push(i)
    }
    const found = gapFound(used, gap)
    const missed = used.slice(found)
    return {
      prompt: `Le logiciel d'analyse balaie la branche de réception dans l'ordre (index 0, 1, 2…) et s'arrête après ${gap} adresses inutilisées consécutives (gap limit). Combien des adresses utilisées ci-dessous retrouvera-t-il ?`,
      context: `${HD_SCHEMES[kind].prefix} saisie (${COIN_NAME[chain]}, ${HD_SCHEMES[kind].bip}). Les autres index de la branche n'ont jamais reçu de fonds.`,
      visual: { type: 'list', title: `Index utilisés sur la branche de réception (${hd.pathTemplate.replace('{0|1}', '0')})`, items: used.map((u) => `${hd.path(0, u)} — adresse avec historique`) },
      kind: 'number',
      answer: found,
      tolerance: 0,
      unit: 'adresses',
      explain: `Le balayage compte les adresses vides consécutives depuis la dernière adresse utilisée et s'arrête à ${gap}. ${missed.length
        ? `Entre l'index ${used[found - 1]} et l'index ${missed[0]}, il y a ${missed[0] - used[found - 1] - 1} adresses inutilisées : le seuil de ${gap} est atteint avant l'index ${missed[0]}, qui n'est jamais examiné. Le logiciel trouve ${found} adresse(s) (index ${frList(used.slice(0, found).map(String))}) et manque ${frList(missed.map(String))}.`
        : `Aucun écart entre deux adresses utilisées n'atteint ${gap} adresses vides : toutes les adresses sont trouvées (${found}).`}\n\nC'est un piège réel : un suspect (ou son logiciel) peut utiliser une adresse lointaine, volontairement ou non. Si l'historique semble incomplet — fonds reçus qui « disparaissent », rendu introuvable — relevez le gap limit dans l'outil (100, 500…) et relancez la dérivation, sans oublier la branche de rendu (…/1/i).`,
    }
  },
}

// ── Lightning ────────────────────────────────────────────────────────────────

type LnCase = 'open' | 'coop' | 'force' | 'payment' | 'consolidation' | 'coinjoin' | 'batch'
const CASE_KIND: Record<LnCase, LightningKind> = { open: 'open', coop: 'coop-close', force: 'force-close', payment: 'none', consolidation: 'none', coinjoin: 'none', batch: 'none' }

const KIND_OPTION: Record<Exclude<LightningKind, 'sweep'>, string> = {
  open: 'Ouverture d\'un canal Lightning (financement d\'une sortie 2-de-2)',
  'coop-close': 'Fermeture coopérative d\'un canal Lightning',
  'force-close': 'Fermeture forcée (unilatérale) d\'un canal Lightning',
  none: 'Transaction on-chain ordinaire, sans structure Lightning',
}

const r8 = (v: number) => Math.round(v * 1e8) / 1e8

/** Construit dans un monde jetable la transaction de l'exercice. */
function buildLnTx(w: World, rng: ReturnType<typeof rngFor>, c: LnCase, chain: 'btc' | 'ltc', t: number): { tx: Tx; detail: string } {
  const DAY = 86400
  const unit = chain === 'btc' ? 1 : 40
  const ordinaryKind = (): AddrKind => (chain === 'btc' ? rng.pick(['p2wpkh', 'p2wpkh', 'p2tr', 'p2pkh', 'p2sh'] as const) : rng.pick(['p2wpkh', 'p2wpkh', 'p2sh'] as const))
  if (c === 'open' || c === 'coop' || c === 'force') {
    const user = w.addr(chain, { kind: 'p2wpkh' })
    const capacity = r8(rng.pick([0.005, 0.01, 0.02, 0.025, 0.05, 0.1, 0.2, 0.25]) * unit)
    const tOpen = c === 'open' ? t : t - rng.int(15, 200) * DAY
    w.fund(user, r8(capacity * rng.float(1.1, 1.8)), tOpen - rng.int(2, 60) * DAY)
    const ch = openChannel(w, { from: user, peer: 'lumen_lsp', capacity, time: tOpen })
    if (c === 'open') return { tx: ch.tx, detail: `capacité ${frMax(capacity)} ${chain.toUpperCase()}` }
    const toLocal = r8(capacity * rng.float(0.12, 0.85))
    if (c === 'coop') return { tx: ch.cooperativeClose({ time: t, toLocal }), detail: '' }
    return { tx: ch.forceClose({ time: t, toLocal, by: rng.chance(0.6) ? 'local' : 'remote' }).commitTx, detail: '' }
  }
  if (c === 'payment') {
    const kind = ordinaryKind()
    const from = w.addr(chain, { kind })
    const value = rng.chance(0.5) ? r8(rng.pick([0.005, 0.01, 0.02, 0.05, 0.1, 0.25]) * unit) : r8(rng.float(0.003, 0.4) * unit)
    w.fund(from, r8(value * rng.float(1.2, 2.5)), t - rng.int(2, 60) * DAY)
    const to = w.addr(chain, { kind: ordinaryKind() })
    return { tx: w.utxoTx({ time: t, from: [from], to: [{ address: to, value }] }), detail: '' }
  }
  if (c === 'consolidation') {
    const kind: AddrKind = chain === 'btc' ? rng.pick(['p2wpkh', 'p2tr', 'p2sh'] as const) : 'p2wpkh'
    const n = rng.int(3, 7)
    const addrs = w.addrs(chain, n, { kind })
    let total = 0
    for (const a of addrs) {
      const v = r8(rng.float(0.001, 0.08) * unit)
      total += v
      w.fund(a, v, t - rng.int(3, 90) * DAY)
    }
    const fee = r8((11 + n * 68 + 31) * rng.int(3, 20) * 1e-8)
    const to = w.addr(chain, { kind })
    return { tx: w.utxoTx({ time: t, from: addrs, to: [{ address: to, value: r8(total - fee) }], fee, change: null, spendAll: true }), detail: '' }
  }
  if (c === 'coinjoin') {
    const n = 5
    const denom = rng.pick([0.001, 0.01, 0.05]) * unit
    const spend = Array.from({ length: n }, () => {
      const a = w.addr(chain, { kind: 'p2wpkh' })
      const v = r8(denom * rng.float(1.001, 1.01))
      w.fund(a, v, t - rng.int(1, 30) * DAY)
      return { address: a }
    })
    const outputs = Array.from({ length: n }, () => ({ address: w.addr(chain, { kind: 'p2wpkh' }), value: r8(denom) }))
    return { tx: w.rawUtxoTx({ time: t, spend, outputs, tags: ['coinjoin'] }), detail: '' }
  }
  // Retrait groupé d'un service : une entrée, plusieurs sorties.
  const hot = w.addr(chain, { kind: 'p2wpkh' })
  const nOut = rng.int(3, 6)
  const to = Array.from({ length: nOut }, () => ({ address: w.addr(chain, { kind: ordinaryKind() }), value: r8(rng.float(0.002, 0.15) * unit) }))
  const sum = to.reduce((s, x) => s + x.value, 0)
  w.fund(hot, r8(sum * rng.float(1.5, 3)), t - rng.int(1, 5) * DAY)
  return { tx: w.utxoTx({ time: t, from: [hot], to }), detail: '' }
}

function lnSetup(seed: number) {
  const rng = rngFor(seed, 'ln-channel')
  const c = rng.weighted([['open', 2.2], ['coop', 2], ['force', 2], ['payment', 0.9], ['consolidation', 0.7], ['coinjoin', 0.6], ['batch', 0.6]] as const) as LnCase
  const chain: 'btc' | 'ltc' = rng.chance(0.8) ? 'btc' : 'ltc'
  const w = new World(rng.int(1, 0x7ffffffe))
  const t = dayTime(rng)
  const { tx } = buildLnTx(w, rng, c, chain, t)
  return { rng, c, chain, w, tx }
}

/** Vérité de l'exercice : la transaction, son monde et le cas construit (pour les vérifications automatiques). */
export function lnDrillCase(seed: number): { w: World; tx: Tx; intended: LightningKind } {
  const { w, tx, c } = lnSetup(seed)
  return { w, tx, intended: CASE_KIND[c] }
}

export const lnChannel: DrillDef = {
  id: 'ln-channel',
  title: 'Lightning on-chain',
  description: 'Reconnaître sur la blockchain une ouverture de canal Lightning, une fermeture coopérative ou forcée — et ce qu\'elles révèlent (ou non) des paiements.',
  level: 4,
  track: 'bitcoin',
  icon: 'Zap',
  generate(seed) {
    const { rng, c, chain, w, tx } = lnSetup(seed)
    const verdict = detectLightning(w, tx)
    const kind = (verdict.kind === 'sweep' ? 'none' : verdict.kind) as Exclude<LightningKind, 'sweep'>
    const asset = chain.toUpperCase()
    const isWsh = (id: string) => w.get(id).kind === 'p2wsh'
    const visual: DrillItem['visual'] = {
      type: 'tx',
      chain,
      asset,
      hash: tx.hash,
      time: tx.time,
      inputs: tx.inputs.map((i) => ({ address: w.get(i.address).addr, value: r8(i.value) })),
      outputs: tx.outputs.map((o) => ({ address: w.get(o.address).addr, value: r8(o.value) })),
      fee: r8(tx.fee),
    }
    const lt = tx.fp?.locktime ?? 0
    const ltTxt = lt >= 0x20000000 ? `0x${lt.toString(16)}` : String(lt)
    const wshLen = chain === 'btc' ? 62 : 63
    const context = `Version ${tx.fp?.version ?? 2} · nLockTime ${ltTxt}. Rappel : une adresse ${chain === 'btc' ? 'bc1q' : 'ltc1q'}… de ${wshLen} caractères est un script SegWit (P2WSH) ; de ${wshLen - 20} caractères, une simple clé (P2WPKH).`
    const wshOut = tx.outputs.filter((o) => isWsh(o.address))
    const anchors = wshOut.filter((o) => o.value <= 0.0000033 + 1e-12).length

    const why: Record<typeof kind, string> = {
      open: `Une seule sortie P2WSH (${frMax(r8(wshOut[0]?.value ?? 0))} ${asset}, montant rond) et, à côté, une sortie ordinaire qui est le rendu du financeur : c'est la forme du financement d'un canal, une sortie verrouillée par un script multisignature 2-de-2 partagé avec le pair. La capacité du canal est le montant de cette sortie.\n\nRéserve d'analyste : un coffre multisignature (2-de-3, séquestre) a exactement la même apparence. Seules l'annonce publique du canal dans le graphe Lightning, ou la façon dont la sortie est dépensée plus tard (fermeture), permettent de confirmer.`,
      'coop-close': `L'unique entrée dépense une sortie P2WSH (le script 2-de-2 du canal) et les ${tx.outputs.length} sorties sont des adresses ordinaires, sans délai ni ancre, avec nLockTime 0 : les deux pairs ont signé ensemble la répartition finale. C'est une fermeture coopérative ; chaque sortie est le solde final d'une partie.`,
      'force-close': `L'unique entrée dépense le script 2-de-2 du canal, mais on trouve ${anchors ? `${anchors} « ancres » de 330 sats (P2WSH) servant à relever les frais par CPFP` : 'des sorties P2WSH'}${wshOut.length - anchors > 0 ? ' et une sortie P2WSH de montant significatif : le solde de celui qui a diffusé la transaction, bloqué par un délai (CSV, souvent 144 blocs) avant de pouvoir être récupéré' : ''}. Le nLockTime commençant par 0x20 encode un numéro d'engagement masqué (BOLT 3). C'est la transaction d'engagement diffusée unilatéralement : une fermeture forcée (pair injoignable, litige ou tentative de fraude).`,
      none: c === 'coinjoin'
        ? `${tx.inputs.length} entrées distinctes et ${tx.outputs.length} sorties de montant identique : c'est un CoinJoin, pas une opération Lightning. Aucune adresse P2WSH n'intervient.`
        : `Aucune adresse P2WSH en entrée, et pas de sortie P2WSH unique en sortie : ${c === 'consolidation' ? 'plusieurs entrées regroupées vers une seule sortie, c\'est une consolidation' : c === 'batch' ? 'une entrée qui paie plusieurs destinataires, c\'est un retrait groupé (batch) de service' : 'c\'est un paiement ordinaire avec rendu'}.${[...tx.inputs, ...tx.outputs].some((o) => w.get(o.address).kind === 'p2tr') ? ' Attention : les adresses bc1p… de 62 caractères sont des Taproot (P2TR), pas des P2WSH (bc1q…).' : ''}`,
    }
    const distractorNote: Record<typeof kind, string> = {
      open: 'Ce n\'est pas une fermeture : l\'entrée n\'est pas une sortie P2WSH, c\'est l\'inverse — la transaction crée la sortie du canal.',
      'coop-close': 'Pas de fermeture forcée : ni sortie retardée P2WSH, ni ancres de 330 sats, ni nLockTime commençant par 0x20. Pas une ouverture : le P2WSH est en entrée, pas en sortie.',
      'force-close': 'Une fermeture coopérative n\'aurait que des sorties ordinaires et un nLockTime nul ; une ouverture créerait une sortie P2WSH au lieu d\'en dépenser une.',
      none: 'Une ouverture créerait une sortie P2WSH unique ; une fermeture dépenserait une entrée P2WSH unique. Rien de tel ici.',
    }

    const askVisible = kind !== 'none' && rng.chance(0.3)
    if (askVisible) {
      const VIS: Record<'open' | 'coop-close' | 'force-close', string> = {
        open: 'La capacité du canal et le portefeuille on-chain qui l\'a financé (entrées et rendu)',
        'coop-close': 'Le solde final de chaque partie et les adresses où chacune récupère ses fonds',
        'force-close': 'Le solde final de chaque partie, celui du diffuseur restant bloqué par un délai avant récupération',
      }
      const correct = VIS[kind as 'open']
      const d = rng.shuffle([
        'La liste des paiements effectués dans le canal, avec leurs montants',
        'Le destinataire final des paiements routés par ce canal',
        'L\'identité du pair, inscrite dans la transaction',
        ...(kind === 'open' ? [VIS['coop-close']] : []),
      ])
      const { options, answer } = mkChoice(rng, correct, d, 4)
      return {
        prompt: `Cette transaction est une ${kind === 'open' ? 'ouverture' : kind === 'coop-close' ? 'fermeture coopérative' : 'fermeture forcée'} de canal Lightning. Que permet-elle d'établir ?`,
        context,
        visual,
        kind: 'choice',
        options,
        answer,
        explain: `${why[kind]}\n\nLa blockchain ne voit que l'ouverture et la fermeture. Les paiements faits dans le canal entre les deux restent hors chaîne : ni leurs montants, ni leurs dates, ni leurs destinataires n'apparaissent, d'autant que le routage en oignon masque l'origine et la destination finales. Le pair n'est pas écrit dans la transaction : on ne le connaît que si le canal est annoncé publiquement (explorateurs Lightning) ou par réquisition d'un service custodial ou d'un LSP.`,
      }
    }

    const order: (typeof kind)[] = ['open', 'coop-close', 'force-close', 'none']
    const correct = KIND_OPTION[kind]
    const { options, answer } = mkChoice(rng, correct, rng.shuffle(order.filter((k) => k !== kind).map((k) => KIND_OPTION[k])), 4)
    return {
      prompt: 'Que représente cette transaction ?',
      context,
      visual,
      kind: 'choice',
      options,
      answer,
      explain: `${why[kind]}\n\n${distractorNote[kind]}`,
    }
  },
}
