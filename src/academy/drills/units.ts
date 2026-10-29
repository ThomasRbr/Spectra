// Exercices numériques : conversions d'unités et calcul des frais d'une
// transaction UTXO.
import { Rng } from '../../engine/rng'
import { genAddress, genTxHash, type AddrKind } from '../../engine/addressgen'
import type { DrillDef, DrillItem } from '../model'
import { coin, dayTime, fr, frMax, rngFor } from './util'

/** Entier log-uniforme dans [min, max]. */
function logInt(rng: Rng, min: number, max: number): number {
  return Math.round(Math.exp(rng.float(Math.log(min), Math.log(max))))
}

// ── Conversions d'unités ────────────────────────────────────────────────────

const TOL = 1e-6

function satsToCoin(rng: Rng): DrillItem {
  const ltc = rng.chance(0.2)
  const sub = ltc ? 'litoshis' : 'sats'
  const unit = ltc ? 'LTC' : 'BTC'
  const sats = logInt(rng, 800, 4_000_000_000)
  const ctx = ltc
    ? 'Le relevé brut d\'un nœud Litecoin exprime les montants en litoshis (1 LTC = 100 000 000 litoshis).'
    : rng.pick([
        'Un explorateur affiche les montants en satoshis (sats).',
        'La demande de rançon est exprimée en sats sur la note laissée par les attaquants.',
        'Le portefeuille Lightning saisi affiche le solde en sats.',
      ])
  return {
    prompt: `Convertissez ${fr(sats)} ${sub} en ${unit}.`,
    context: ctx,
    kind: 'number',
    answer: sats / 1e8,
    tolerance: TOL,
    unit,
    explain:
      `1 ${unit} = 100 000 000 ${sub} (10⁸). Il faut donc diviser par 100 000 000, c'est-à-dire décaler la virgule de 8 rangs vers la gauche : ${fr(sats)} ${sub} = ${coin(sats, unit)}.\n\n` +
      `Erreur fréquente : se tromper d'un rang (×10 ou ÷10). Pour vérifier, retenez que 1 million de ${sub} = 0,01 ${unit}. Une erreur d'un facteur 10 fausse le préjudice et les montants d'une réquisition.`,
  }
}

function coinToSats(rng: Rng): DrillItem {
  const ltc = rng.chance(0.2)
  const sub = ltc ? 'litoshis' : 'sats'
  const unit = ltc ? 'LTC' : 'BTC'
  const sats = logInt(rng, 5_000, 900_000_000)
  return {
    prompt: `Combien de ${sub} représentent ${coin(sats, unit)} ?`,
    context: rng.pick([
      'Pour comparer précisément deux montants, on les exprime dans l\'unité de base entière.',
      'Un outil d\'analyse demande le montant en unité de base pour une recherche par valeur exacte.',
      'Le montant reçu par l\'adresse suspecte doit être reporté en unité de base dans votre procès-verbal.',
    ]),
    kind: 'number',
    answer: sats,
    tolerance: TOL,
    unit: sub,
    explain:
      `1 ${unit} = 100 000 000 ${sub}. On multiplie par 10⁸ (virgule décalée de 8 rangs vers la droite) : ${coin(sats, unit)} = ${fr(sats)} ${sub}.\n\n` +
      `Les ${sub} sont toujours un nombre entier : s'il reste une virgule après conversion, c'est qu'un rang a été oublié.`,
  }
}

function gasFee(rng: Rng): DrillItem {
  const bsc = rng.chance(0.25)
  const native = bsc ? 'BNB' : 'ETH'
  const op = rng.pick([
    { gas: 21000, what: 'un simple transfert de ' + native },
    { gas: rng.pick([46109, 51384, 63209, 65000]), what: 'un transfert de jeton (USDT)' },
    { gas: rng.int(120000, 210000), what: 'un swap sur un DEX' },
    { gas: rng.int(45000, 48000), what: 'une approbation (approve) de jeton' },
  ])
  const price = bsc ? rng.pick([1, 3, 5]) : Math.round(rng.float(2, 60) * 10) / 10
  const fee = (op.gas * price) / 1e9
  return {
    prompt: `Une transaction a consommé ${fr(op.gas)} unités de gas à ${frMax(price, 1)} gwei par unité. Quels sont les frais, en ${native} ?`,
    context: `Il s'agit de ${op.what} sur ${bsc ? 'BNB Smart Chain' : 'Ethereum'}. Rappel : 1 gwei = 10⁻⁹ ${native} (un milliardième).`,
    kind: 'number',
    answer: fee,
    tolerance: TOL,
    unit: native,
    explain:
      `Frais = gas consommé × prix du gas = ${fr(op.gas)} × ${frMax(price, 1)} gwei = ${frMax(op.gas * price, 1)} gwei. ` +
      `Comme 1 gwei = 0,000000001 ${native}, on divise par 10⁹ : ${frMax(fee, 10)} ${native}.\n\n` +
      `Le gas se paie toujours dans l'actif natif de la chaîne (${native}), même quand on transfère un jeton comme l'USDT : un portefeuille sans ${native} ne peut pas déplacer ses jetons.`,
  }
}

function weiToNative(rng: Rng): DrillItem {
  const bsc = rng.chance(0.25)
  const native = bsc ? 'BNB' : 'ETH'
  const micro = logInt(rng, 1_000, 80_000_000) // millionièmes
  const wei = String(micro) + '000000000000'
  return {
    prompt: `Le champ « value » brut d'une transaction indique ${wei} wei. Quel montant en ${native} ?`,
    context: `Données brutes extraites d'un nœud ${bsc ? 'BNB Smart Chain' : 'Ethereum'} (JSON-RPC). Rappel : 1 ${native} = 10¹⁸ wei.`,
    kind: 'number',
    answer: micro / 1e6,
    tolerance: TOL,
    unit: native,
    explain:
      `1 ${native} = 1 000 000 000 000 000 000 wei (10¹⁸). On décale la virgule de 18 rangs vers la gauche : ${wei} wei = ${frMax(micro / 1e6, 6)} ${native}.\n\n` +
      `Astuce : comptez les chiffres. Le nombre en a ${wei.length} ; ${wei.length > 18 ? `les ${wei.length - 18} premiers forment la partie entière` : 'moins de 19 chiffres signifie un montant inférieur à 1'}. Les explorateurs font la conversion pour vous, mais les exports bruts et les réponses de certains prestataires ne la font pas.`,
  }
}

const TOKENS = [
  { sym: 'USDT', chainName: 'Ethereum (ERC-20)', dec: 6 },
  { sym: 'USDT', chainName: 'Tron (TRC-20)', dec: 6 },
  { sym: 'USDC', chainName: 'Ethereum (ERC-20)', dec: 6 },
  { sym: 'USDC', chainName: 'Solana (SPL)', dec: 6 },
  { sym: 'DAI', chainName: 'Ethereum (ERC-20)', dec: 18 },
  { sym: 'USDT', chainName: 'BNB Smart Chain (BEP-20)', dec: 18 },
] as const

function tokenRawToHuman(rng: Rng): DrillItem {
  const t = rng.pick(TOKENS)
  const cents = logInt(rng, 1_000, 90_000_000)
  const raw = String(cents) + '0'.repeat(t.dec - 2)
  const human = cents / 100
  return {
    prompt: `L'événement Transfer du contrat ${t.sym} indique value = ${raw}. Quel montant en ${t.sym} ?`,
    context: `Jeton ${t.sym} sur ${t.chainName}. La fonction decimals() du contrat renvoie ${t.dec}.`,
    kind: 'number',
    answer: human,
    tolerance: TOL,
    unit: t.sym,
    explain:
      `Les jetons n'ont pas de virgule on-chain : le contrat stocke un entier et déclare ses décimales. Avec decimals = ${t.dec}, on divise par 10^${t.dec} : ${raw} → ${frMax(human, 2)} ${t.sym}.\n\n` +
      `Attention : les décimales dépendent du contrat, pas de l'actif « en général ». L'USDT a 6 décimales sur Ethereum et Tron mais 18 sur BNB Smart Chain ; le DAI en a 18. Appliquer les mauvaises décimales donne une erreur d'un facteur 10¹² !`,
  }
}

function tokenHumanToRaw(rng: Rng): DrillItem {
  const t = rng.pick(TOKENS.filter((x) => x.dec === 6))
  const cents = logInt(rng, 1_000, 50_000_000)
  const human = cents / 100
  return {
    prompt: `Vous recherchez dans les logs un transfert de ${frMax(human, 2)} ${t.sym}. Quelle valeur brute (unités de base) chercher ?`,
    context: `Jeton ${t.sym} sur ${t.chainName}, decimals = ${t.dec}.`,
    kind: 'number',
    answer: cents * 10_000,
    tolerance: TOL,
    unit: 'unités de base',
    explain:
      `On multiplie par 10^${t.dec} = 1 000 000 : ${frMax(human, 2)} × 1 000 000 = ${fr(cents * 10_000)} unités de base.\n\n` +
      `C'est la valeur qui apparaît dans le champ « value » de l'événement Transfer et dans les données brutes : chercher « ${frMax(human, 2)} » dans des logs bruts ne donnerait rien.`,
  }
}

export const unitConvert: DrillDef = {
  id: 'unit-convert',
  title: 'Conversions d\'unités',
  description: 'Passer des sats aux BTC, des wei et gwei aux ETH, et appliquer les décimales d\'un jeton.',
  level: 0,
  track: 'bases',
  icon: 'Calculator',
  generate(seed) {
    const rng = rngFor(seed, 'unit-convert')
    const gen = rng.weighted([
      [satsToCoin, 2],
      [coinToSats, 1.5],
      [gasFee, 1.3],
      [weiToNative, 1],
      [tokenRawToHuman, 1.5],
      [tokenHumanToRaw, 0.8],
    ] as const)
    return gen(rng)
  },
}

// ── Frais d'une transaction UTXO ───────────────────────────────────────────

export const utxoFee: DrillDef = {
  id: 'utxo-fee',
  title: 'Frais d\'une transaction UTXO',
  description: 'Calculer les frais implicites d\'une transaction : somme des entrées moins somme des sorties.',
  level: 1,
  track: 'bitcoin',
  icon: 'Calculator',
  generate(seed) {
    const rng = rngFor(seed, 'utxo-fee')
    const chain = rng.chance(0.8) ? 'btc' : 'ltc'
    const unit = chain === 'btc' ? 'BTC' : 'LTC'
    const sub = chain === 'btc' ? 'sats' : 'litoshis'
    const kind: AddrKind = rng.pick(chain === 'btc' ? (['p2wpkh', 'p2wpkh', 'p2pkh', 'p2sh', 'p2tr'] as const) : (['p2wpkh', 'p2pkh', 'p2sh'] as const))
    const nIn = rng.weighted([[1, 3], [2, 3], [3, 2], [4, 1]] as const)
    const nOut = rng.weighted([[1, 1], [2, 4], [3, 2]] as const)
    const inputs = Array.from({ length: nIn }, () => logInt(rng, 60_000, 250_000_000))
    const total = inputs.reduce((a, b) => a + b, 0)
    const vbytes = 11 + nIn * (kind === 'p2pkh' ? 148 : kind === 'p2sh' ? 91 : kind === 'p2tr' ? 58 : 68) + nOut * 31
    const rate = chain === 'btc' ? rng.int(3, 60) : rng.int(10, 40)
    const fee = vbytes * rate
    const avail = total - fee
    const outs: number[] = []
    if (nOut === 1) outs.push(avail)
    else {
      const parts = rng.split(avail, nOut, 1)
      let acc = 0
      for (let i = 0; i < nOut - 1; i++) {
        let v = Math.floor(parts[i])
        const step = v > 10_000_000 ? 1_000_000 : v > 1_000_000 ? 100_000 : 10_000
        if (v >= step && rng.chance(0.6)) v = Math.floor(v / step) * step
        outs.push(v)
        acc += v
      }
      outs.push(avail - acc)
    }
    const inAddr = Array.from({ length: nIn }, () => genAddress(rng, chain, kind))
    const outAddr = outs.map(() => genAddress(rng, chain, rng.chance(0.6) ? kind : rng.pick(['p2wpkh', 'p2sh', 'p2pkh'] as const)))
    const inSat = rng.chance(0.5)
    const answer = inSat ? fee : fee / 1e8
    const situation = nOut === 1 ? 'Transaction sans rendu (balayage ou envoi de la totalité).' : rng.pick(['Paiement avec rendu.', 'Transaction relevée sur le chemin des fonds de la victime.', 'Transaction émise par l\'adresse suspecte.'])
    return {
      prompt: `Quels frais cette transaction a-t-elle payés au mineur ? Répondez en ${inSat ? sub : unit}.`,
      context: `${situation} Les frais n'apparaissent pas comme une sortie : à vous de les calculer.`,
      visual: {
        type: 'tx',
        chain,
        asset: unit,
        hash: genTxHash(rng, chain),
        time: dayTime(rng),
        inputs: inputs.map((v, i) => ({ address: inAddr[i], value: v / 1e8 })),
        outputs: outs.map((v, i) => ({ address: outAddr[i], value: v / 1e8 })),
      },
      kind: 'number',
      answer,
      tolerance: TOL,
      unit: inSat ? sub : unit,
      explain:
        `Dans le modèle UTXO, frais = Σ entrées − Σ sorties.\n\n` +
        `- Σ entrées = ${inputs.map((v) => fr(v / 1e8, 8)).join(' + ')} = ${coin(total, unit)}\n` +
        `- Σ sorties = ${outs.map((v) => fr(v / 1e8, 8)).join(' + ')} = ${coin(avail, unit)}\n` +
        `- Frais = ${coin(fee, unit)}, soit ${fr(fee)} ${sub}.\n\n` +
        `Pour une taille d'environ ${fr(vbytes)} vB, cela correspond à ~${rate} ${sub}/vB. ` +
        `Piège : la plus petite sortie n'est pas « les frais » — elle peut être un rendu ou un paiement. Les frais sont la différence, jamais une ligne du tableau.`,
    }
  },
}
