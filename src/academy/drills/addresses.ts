// Exercices de reconnaissance de formats : chaîne d'une adresse, type
// d'adresse, hash de transaction ou adresse.
import { Rng } from '../../engine/rng'
import type { ChainId } from '../../engine/chains'
import { genAddress, genTxHash, KIND_LABEL, type AddrKind } from '../../engine/addressgen'
import type { DrillDef } from '../model'
import { mkChoice, mkChoiceRandom, rngFor } from './util'

// ── Quelle blockchain ? ─────────────────────────────────────────────────────

type Family = 'btc' | 'ltc' | 'evm' | 'tron' | 'xrp' | 'sol' | 'xmr'

const FAMILY_LABEL: Record<Family, string> = {
  btc: 'Bitcoin',
  ltc: 'Litecoin',
  evm: 'EVM (Ethereum, BNB Smart Chain…)',
  tron: 'Tron',
  xrp: 'XRP Ledger',
  sol: 'Solana',
  xmr: 'Monero',
}

/** Distracteurs plausibles : les formats que l'on confond le plus souvent. */
const CONFUSIONS: Record<Family, Family[]> = {
  btc: ['ltc', 'sol', 'tron', 'evm'],
  ltc: ['btc', 'tron', 'sol'],
  evm: ['tron', 'sol', 'btc'],
  tron: ['evm', 'btc', 'sol', 'xrp'],
  xrp: ['btc', 'sol', 'tron'],
  sol: ['btc', 'tron', 'xmr', 'xrp'],
  xmr: ['btc', 'sol', 'ltc'],
}

const FAMILY_RULE: Record<Family, string> = {
  btc: 'Bitcoin : « 1… » (Legacy P2PKH, 26–34 caractères Base58), « 3… » (P2SH, 34 caractères) ou « bc1… » (SegWit/Taproot, Bech32).',
  ltc: 'Litecoin : « L… » (Legacy), « M… » (P2SH) ou « ltc1… » (SegWit natif).',
  evm: 'EVM : « 0x » suivi de 40 caractères hexadécimaux. Le même format est utilisé par Ethereum, BNB Smart Chain, Polygon, Arbitrum… : l\'adresse seule ne dit pas sur quelle chaîne EVM regarder, il faut vérifier l\'activité sur chacune.',
  tron: 'Tron : « T » majuscule suivi de 33 caractères Base58 (34 au total).',
  xrp: 'XRP Ledger : « r » minuscule, 25 à 35 caractères dans l\'alphabet propre au XRPL.',
  sol: 'Solana : 32 à 44 caractères Base58, sans préfixe particulier (clé publique encodée directement).',
  xmr: 'Monero : adresse standard très longue (95 caractères) commençant par « 4 » (« 8 » pour une sous-adresse).',
}

function addrFor(rng: Rng, fam: Family): { addr: string; kind: AddrKind } {
  switch (fam) {
    case 'btc': {
      const kind = rng.pick(['p2pkh', 'p2sh', 'p2wpkh', 'p2tr'] as const)
      return { addr: genAddress(rng, 'btc', kind), kind }
    }
    case 'ltc': {
      const kind = rng.pick(['p2pkh', 'p2sh', 'p2wpkh'] as const)
      return { addr: genAddress(rng, 'ltc', kind), kind }
    }
    case 'evm':
      return { addr: genAddress(rng, rng.pick(['eth', 'bsc'] as const), 'eoa'), kind: 'eoa' }
    case 'tron':
      return { addr: genAddress(rng, 'tron', 'eoa'), kind: 'eoa' }
    case 'xrp':
      return { addr: genAddress(rng, 'xrp', 'account'), kind: 'account' }
    case 'sol': {
      // Évite les préfixes qui rappelleraient un autre format (1, 3, L, M, T, r, 4).
      let a = genAddress(rng, 'sol', 'eoa')
      for (let i = 0; i < 20 && /^[13LMTr4]/.test(a); i++) a = genAddress(rng, 'sol', 'eoa')
      if (/^[13LMTr4]/.test(a)) a = 'H' + a.slice(1)
      return { addr: a, kind: 'eoa' }
    }
    case 'xmr':
      return { addr: genAddress(rng, 'xmr', 'stealth'), kind: 'stealth' }
  }
}

const SITUATIONS = [
  'La victime vous transmet l\'adresse vers laquelle elle a envoyé ses fonds.',
  'Cette adresse figure dans une conversation saisie sur le téléphone du suspect.',
  'Un faux site d\'investissement affiche cette adresse de « dépôt ».',
  'La demande de rançon reçue par l\'entreprise contient cette adresse.',
  'Un signalement PHAROS mentionne cette adresse.',
  'Cette adresse apparaît dans un relevé fourni par un exchange.',
]

export const chainFromAddress: DrillDef = {
  id: 'chain-from-address',
  title: 'Quelle blockchain ?',
  description: 'Reconnaître la blockchain d\'une adresse à partir de son préfixe, de sa longueur et de son alphabet.',
  level: 0,
  track: 'bases',
  icon: 'ScanSearch',
  generate(seed) {
    const rng = rngFor(seed, 'chain-from-address')
    const fam = rng.weighted([['btc', 3], ['ltc', 1.2], ['evm', 2], ['tron', 1.6], ['xrp', 1.2], ['sol', 1.2], ['xmr', 1]] as const) as Family
    const { addr, kind } = addrFor(rng, fam)
    const distractors = rng.shuffle([...CONFUSIONS[fam]]).map((f) => FAMILY_LABEL[f])
    const { options, answer } = mkChoice(rng, FAMILY_LABEL[fam], distractors, rng.pick([3, 4, 4, 5]))
    const wrong = options.filter((_, i) => i !== answer)
    const famOf = (label: string) => (Object.keys(FAMILY_LABEL) as Family[]).find((f) => FAMILY_LABEL[f] === label)!
    let explain = `${FAMILY_RULE[fam]}`
    if (fam === 'btc' || fam === 'ltc') explain += ` Ici, il s'agit plus précisément d'une adresse ${KIND_LABEL[kind]}.`
    explain += `\n\nPourquoi pas les autres : ${wrong.map((w) => FAMILY_RULE[famOf(w)]).join(' ')}`
    if (fam === 'sol') explain += '\n\nAstuce : une adresse Base58 de 43–44 caractères sans préfixe reconnaissable est typique de Solana ; une adresse Bitcoin Legacy fait au plus 34 caractères.'
    if (fam === 'tron') explain += '\n\nAstuce : Tron et Ethereum partagent la même cryptographie, mais Tron encode ses adresses en Base58 avec le préfixe « T », alors qu\'Ethereum les écrit en hexadécimal après « 0x ».'
    return {
      prompt: 'Sur quelle blockchain chercher cette adresse ?',
      context: `${rng.pick(SITUATIONS)} Longueur : ${addr.length} caractères.`,
      visual: { type: 'address', value: addr },
      kind: 'choice',
      options,
      answer,
      explain,
    }
  },
}

// ── Type d'adresse ──────────────────────────────────────────────────────────

const UTXO_KIND_RULE: Record<'p2pkh' | 'p2sh' | 'p2wpkh' | 'p2tr', string> = {
  p2pkh: 'Legacy (P2PKH) : préfixe « 1 » sur Bitcoin, « L » sur Litecoin. Format historique, encodé en Base58, frais plus élevés.',
  p2sh: 'Script (P2SH) : préfixe « 3 » sur Bitcoin, « M » sur Litecoin. L\'adresse est l\'empreinte d\'un script : multisignature, SegWit « enveloppé »… souvent utilisé par les exchanges et portefeuilles multisig.',
  p2wpkh: 'SegWit natif (P2WPKH) : préfixe « bc1q » sur Bitcoin, « ltc1q » sur Litecoin, encodage Bech32 (minuscules, 42 caractères pour une clé simple).',
  p2tr: 'Taproot (P2TR) : préfixe « bc1p », encodage Bech32m, 62 caractères. Introduit en 2021.',
}

export const addressType: DrillDef = {
  id: 'address-type',
  title: 'Type d\'adresse',
  description: 'Identifier le type de script (Legacy, P2SH, SegWit, Taproot) ou de compte (EOA, contrat) d\'une adresse.',
  level: 1,
  track: 'bitcoin',
  icon: 'Fingerprint',
  generate(seed) {
    const rng = rngFor(seed, 'address-type')
    if (rng.chance(0.25)) {
      // EVM : le format ne distingue pas un EOA d'un contrat → indice explorateur.
      const chain = rng.pick(['eth', 'bsc'] as const)
      const addr = genAddress(rng, chain, 'eoa')
      const isContract = rng.chance(0.5)
      const explorer = chain === 'eth' ? 'Etherscan' : 'BscScan'
      const clue = isContract
        ? rng.pick([
            `Sur ${explorer}, la page de l'adresse affiche un onglet « Contract » avec du bytecode et des fonctions (« Read / Write Contract »).`,
            `Sur ${explorer}, l'adresse a été créée par une transaction « Contract Creation » et possède du code ; elle n'a jamais signé de transaction.`,
          ])
        : rng.pick([
            `Sur ${explorer}, l'adresse ne contient aucun code ; elle a signé ${rng.int(12, 900)} transactions (nonce ${rng.int(12, 900)}) et paie elle-même ses frais.`,
            `Sur ${explorer}, l'adresse n'a pas de bytecode et apparaît comme « From » de nombreuses transactions qu'elle a signées.`,
          ])
      const correct = isContract ? KIND_LABEL.contract : KIND_LABEL.eoa
      const { options, answer } = mkChoice(rng, correct, [isContract ? KIND_LABEL.eoa : KIND_LABEL.contract, KIND_LABEL.p2sh, KIND_LABEL.p2tr], 4)
      return {
        prompt: 'De quel type de compte s\'agit-il ?',
        context: clue,
        visual: { type: 'address', value: addr },
        kind: 'choice',
        options,
        answer,
        explain:
          `Sur une chaîne EVM, une adresse de compte externe (EOA, contrôlé par une clé privée) et une adresse de smart contract ont exactement le même format « 0x » + 40 caractères hexadécimaux : seul l'explorateur permet de trancher. ` +
          (isContract
            ? 'La présence de bytecode (onglet « Contract ») et l\'absence de transaction signée indiquent un smart contract : il n\'a pas de clé privée et n\'agit que lorsqu\'on l\'appelle.'
            : 'Aucun code et des transactions signées (nonce non nul) : c\'est un compte externe, contrôlé par une clé privée — donc par une personne ou un service.') +
          '\n\nP2SH et Taproot sont des types de scripts Bitcoin : ils n\'existent pas sur Ethereum ou BSC, même si un contrat multisig rappelle l\'usage du P2SH.',
      }
    }
    const chain: ChainId = rng.chance(0.75) ? 'btc' : 'ltc'
    const kinds = chain === 'btc' ? (['p2pkh', 'p2sh', 'p2wpkh', 'p2tr'] as const) : (['p2pkh', 'p2sh', 'p2wpkh'] as const)
    const kind = rng.pick(kinds)
    const addr = genAddress(rng, chain, kind)
    const pool = [KIND_LABEL.p2pkh, KIND_LABEL.p2sh, KIND_LABEL.p2wpkh, KIND_LABEL.p2tr, KIND_LABEL.eoa]
    const { options, answer } = mkChoiceRandom(rng, KIND_LABEL[kind], pool.slice(0, 4).concat(rng.chance(0.3) ? [KIND_LABEL.eoa] : []), 4)
    const others = (['p2pkh', 'p2sh', 'p2wpkh', 'p2tr'] as const).filter((k) => k !== kind && options.includes(KIND_LABEL[k]))
    return {
      prompt: `Quel est le type de cette adresse ${chain === 'btc' ? 'Bitcoin' : 'Litecoin'} ?`,
      context: rng.pick([
        'Le type d\'adresse renseigne sur le portefeuille utilisé et sert d\'indice pour repérer le rendu d\'une transaction.',
        'Adresse relevée dans les sorties d\'une transaction que vous analysez.',
        'Adresse de destination indiquée par la victime.',
      ]),
      visual: { type: 'address', value: addr },
      kind: 'choice',
      options,
      answer,
      explain:
        `${UTXO_KIND_RULE[kind]}\n\nÀ ne pas confondre : ${others.map((k) => UTXO_KIND_RULE[k]).join(' ')}` +
        (options.includes(KIND_LABEL.eoa) ? ' « Compte externe (EOA) » est une notion du modèle à comptes (Ethereum…), pas des chaînes UTXO.' : '') +
        '\n\nEn analyse, le type d\'adresse est précieux : un portefeuille utilise en général un seul type pour ses adresses de rendu.',
    }
  },
}

// ── Hash ou adresse ? ───────────────────────────────────────────────────────

const HASH = 'Hash (identifiant) de transaction'
const ADDR = 'Adresse'
const INVALID = 'Format invalide (ni l\'un ni l\'autre)'

const CHAIN_NAME: Partial<Record<ChainId, string>> = { btc: 'Bitcoin', ltc: 'Litecoin', eth: 'Ethereum', bsc: 'BNB Smart Chain', tron: 'Tron', xrp: 'XRP Ledger', sol: 'Solana' }

function utxoPrefix(chain: ChainId, kind: AddrKind): string {
  const btc = chain === 'btc'
  if (kind === 'p2pkh') return btc ? '1' : 'L'
  if (kind === 'p2sh') return btc ? '3' : 'M'
  if (kind === 'p2tr') return 'bc1p'
  return btc ? 'bc1q' : 'ltc1q'
}

function corrupt(rng: Rng, chain: ChainId): { value: string; why: string } {
  switch (chain) {
    case 'eth':
    case 'bsc': {
      if (rng.chance(0.5)) {
        const n = rng.pick([39, 41, 63, 62])
        const s = genTxHash(rng, chain).slice(2, 2 + n)
        return { value: '0x' + s, why: `après « 0x » on compte ${n} caractères hexadécimaux : ni 40 (adresse), ni 64 (hash de transaction). Il manque ou il y a un caractère en trop — probablement une erreur de copie.` }
      }
      const a = genAddress(rng, chain, 'eoa')
      const pos = rng.int(4, 38)
      const bad = rng.pick(['g', 'k', 'z', 'G', 'x'])
      return { value: a.slice(0, pos) + bad + a.slice(pos + 1), why: `le caractère « ${bad} » n'est pas hexadécimal (0–9, a–f) : une vraie adresse 0x ne peut pas le contenir.` }
    }
    case 'btc': {
      if (rng.chance(0.5)) {
        const a = genAddress(rng, 'btc', 'p2wpkh')
        const pos = rng.int(6, 36)
        const bad = rng.pick(['b', 'i', 'o', '1'])
        return { value: a.slice(0, pos) + bad + a.slice(pos + 1), why: `l'alphabet Bech32 (après « bc1 ») exclut les caractères « 1 », « b », « i » et « o » ; or on y trouve « ${bad} ».` }
      }
      const a = genAddress(rng, 'btc', rng.pick(['p2pkh', 'p2sh'] as const))
      const pos = rng.int(5, 25)
      const bad = rng.pick(['0', 'O', 'I', 'l'])
      return { value: a.slice(0, pos) + bad + a.slice(pos + 1), why: `l'alphabet Base58 exclut « 0 », « O », « I » et « l » (trop faciles à confondre) ; or on y trouve « ${bad} ».` }
    }
    default: {
      const a = genAddress(rng, 'tron', 'eoa')
      const pos = rng.int(5, 25)
      const bad = rng.pick(['0', 'O', 'I', 'l'])
      return { value: a.slice(0, pos) + bad + a.slice(pos + 1), why: `l'alphabet Base58 utilisé par Tron exclut « 0 », « O », « I » et « l » ; or on y trouve « ${bad} ».` }
    }
  }
}

export const hashOrAddress: DrillDef = {
  id: 'hash-or-address',
  title: 'Hash ou adresse ?',
  description: 'Distinguer un identifiant de transaction d\'une adresse (et repérer un format corrompu).',
  level: 0,
  track: 'bases',
  icon: 'Hash',
  generate(seed) {
    const rng = rngFor(seed, 'hash-or-address')
    const what = rng.weighted([['hash', 0.43], ['addr', 0.42], ['invalid', 0.15]] as const)
    let chain: ChainId
    let value: string
    let correct: string
    let explain: string
    if (what === 'invalid') {
      chain = rng.pick(['eth', 'bsc', 'btc', 'tron'] as const)
      const c = corrupt(rng, chain)
      value = c.value
      correct = INVALID
      explain = `Format invalide : ${c.why}\n\nRéflexe : avant toute recherche ou réquisition, vérifiez la longueur et l'alphabet de l'identifiant ; une erreur de recopie peut envoyer l'enquête sur une fausse piste (ou rendre une réquisition inexploitable).`
    } else if (what === 'hash') {
      chain = rng.pick(['btc', 'ltc', 'eth', 'bsc', 'tron', 'xrp', 'sol'] as const)
      value = genTxHash(rng, chain)
      correct = HASH
      const rule =
        chain === 'eth' || chain === 'bsc'
          ? '« 0x » suivi de 64 caractères hexadécimaux (32 octets) : c\'est un hash de transaction. Une adresse EVM, elle, n\'a que 40 caractères après « 0x ».'
          : chain === 'xrp'
            ? '64 caractères hexadécimaux en majuscules : c\'est le format des hash de transaction du XRP Ledger. Une adresse XRPL commence par « r » et utilise un alphabet Base58 spécifique.'
            : chain === 'sol'
              ? '86 à 88 caractères Base58 : sur Solana, l\'identifiant d\'une transaction est sa signature, deux fois plus longue qu\'une adresse (32 à 44 caractères).'
              : '64 caractères hexadécimaux sans préfixe : c\'est un identifiant de transaction (txid). Une adresse Bitcoin/Litecoin commence par un préfixe (1, 3, bc1, L, M, ltc1…) et utilise Base58 ou Bech32.'
      explain = `${rule}\n\nNuance : d'autres objets ont aussi 64 caractères hexadécimaux (hash de bloc, clé privée brute). Le contexte (explorateur, champ « TxID ») permet de lever le doute ; on ne colle jamais une chaîne inconnue sur un site tiers sans réfléchir à l'OPSEC.`
    } else {
      chain = rng.pick(['btc', 'ltc', 'eth', 'bsc', 'tron', 'xrp', 'sol'] as const)
      const kind: AddrKind = chain === 'btc' ? rng.pick(['p2pkh', 'p2sh', 'p2wpkh', 'p2tr'] as const) : chain === 'ltc' ? rng.pick(['p2pkh', 'p2sh', 'p2wpkh'] as const) : chain === 'xrp' ? 'account' : 'eoa'
      value = genAddress(rng, chain, kind)
      correct = ADDR
      const rule =
        chain === 'eth' || chain === 'bsc'
          ? '« 0x » + 40 caractères hexadécimaux (20 octets) : c\'est une adresse EVM. Un hash de transaction en aurait 64.'
          : chain === 'tron'
            ? '« T » + 33 caractères Base58 : adresse Tron. Les hash de transaction Tron sont 64 caractères hexadécimaux.'
            : chain === 'xrp'
              ? 'Commence par « r », alphabet XRPL : c\'est une adresse (compte) XRP Ledger. Les hash de transaction XRPL sont 64 caractères hexadécimaux.'
              : chain === 'sol'
                ? '43–44 caractères Base58 : adresse Solana (clé publique). Une signature de transaction Solana en compte 86 à 88.'
                : `Préfixe « ${utxoPrefix(chain, kind)} » et alphabet ${kind === 'p2wpkh' || kind === 'p2tr' ? 'Bech32' : 'Base58'} : adresse ${chain === 'btc' ? 'Bitcoin' : 'Litecoin'} ${KIND_LABEL[kind]}. Un txid serait 64 caractères hexadécimaux sans préfixe.`
      explain = `${rule}\n\nRéflexe : on recherche une adresse pour voir son historique et son solde ; on recherche un hash pour voir une transaction précise.`
    }
    const { options, answer } = mkChoice(rng, correct, rng.shuffle([HASH, ADDR, INVALID].filter((x) => x !== correct)), 3)
    return {
      prompt: 'Cette chaîne de caractères est…',
      context: `Élément relevé dans une procédure (contexte : ${CHAIN_NAME[chain]}). Longueur : ${value.length} caractères.`,
      visual: { type: 'address', value },
      kind: 'choice',
      options,
      answer,
      explain,
    }
  },
}
