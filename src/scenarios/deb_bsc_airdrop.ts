import { World, type Tx } from '../engine/world'
import { exchange, HOUR, DAY } from '../engine/patterns'
import { roundAsset } from '../engine/chains'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, fakeCity, fakePerson, fmtDate, procedureFor } from './util'

// Faux airdrop sur BNB Smart Chain : la victime paie des « frais » en BNB
// (natif) et en USDT (BEP-20). L'adresse 0x de l'escroc existe aussi sur
// Ethereum (même clé), presque vide : le piège est de chercher sur la mauvaise
// chaîne.

const TOKENS = ['MOONX', 'BNBAI', 'PEPEGOLD', 'SAFEDOGE', 'METAPAW', 'QUANTA'] as const

const bnb = (v: number) => roundAsset('BNB', v)
const usdt = (v: number) => roundAsset('USDT', v)

export const debBscAirdrop: ScenarioTemplate = {
  id: 'deb-bsc-airdrop',
  title: 'BNB Chain : le faux airdrop',
  tagline: 'Même format d\'adresse qu\'Ethereum, mais une autre blockchain.',
  description:
    'Pour « débloquer » un airdrop imaginaire, une victime a payé des frais en BNB puis en USDT sur BNB Smart Chain. Suivez les deux actifs jusqu\'à l\'exchange, apprenez à distinguer la monnaie native d\'un jeton BEP-20, et évitez le piège classique des adresses 0x présentes sur plusieurs chaînes.',
  difficulty: 1,
  chains: ['bsc'],
  skills: ['lecture_tx', 'evm', 'tokens', 'exchange_id', 'typologies'],
  estMinutes: 15,
  lessons: ['comptes-evm', 'tokens-erc20', 'stablecoins', 'exchanges', 'typologies'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const victimP = fakePerson(r)
    const victimName = victimP.name
    const g = victimP.g
    const city = fakeCity(r)
    const token = r.pick(TOKENS)
    const promised = r.pick([1500, 2500, 3000, 4200, 5000])

    const destKey = r.pick(['binance', 'okx'] as const)
    const fundKey = destKey === 'binance' ? 'okx' : 'binance'
    const dest = exchange(w, destKey, 'bsc')
    const fund = exchange(w, fundKey, 'bsc')

    const scamE = w.customEntity({ name: `Faux airdrop ${token} (inconnu)`, category: 'scam', description: 'Faux site de distribution gratuite de jetons réclamant des « frais de déblocage ».' })
    const victimE = w.customEntity({ name: victimName, category: 'victim' })
    const victim = w.addr('bsc', { entity: victimE })
    // Même compte sur Ethereum (même clé privée) : créé d'abord, la forme BSC ensuite
    const s1eth = w.addr('eth', { entity: scamE })
    const s1 = w.addrSameEoa(s1eth, 'bsc')
    const path: Tx[] = []

    // Activité ancienne et minime du même compte sur Ethereum
    const ethOld = w.fundAccount(s1eth, roundAsset('ETH', r.float(0.004, 0.02)), 'ETH', w.at(-r.int(90, 400) * 24))

    // ── La victime ────────────────────────────────────────────────────────────
    const b1 = bnb(r.pick([0.03, 0.05, 0.08, 0.1, 0.12]))
    const u1 = usdt(r.int(15, 50) * 10)
    const u2 = usdt(r.int(30, 120) * 10)
    const T0 = w.at(0)
    fund.withdraw(victim, bnb(b1 + r.float(0.02, 0.1)), T0 - Math.round(r.float(5, 30) * HOUR), 'BNB')
    fund.withdraw(victim, usdt(u1 + r.int(0, 3) * 10), T0 - Math.round(r.float(1, 4) * HOUR), 'USDT')
    const pay1 = w.transfer({ time: T0, from: victim, to: s1, value: b1, asset: 'BNB' })
    const pay2 = w.transfer({ time: T0 + r.int(10, 50) * 60, from: victim, to: s1, value: u1, asset: 'USDT' })
    const u2T = pay2.time + Math.round(r.float(18, 40) * HOUR)
    fund.withdraw(victim, usdt(u2 + r.int(0, 3) * 10), u2T - Math.round(r.float(1, 6) * HOUR), 'USDT')
    const pay3 = w.transfer({ time: u2T, from: victim, to: s1, value: u2, asset: 'USDT' })
    path.push(pay1, pay2, pay3)

    // ── Autres victimes ──────────────────────────────────────────────────────
    const nOthers = r.int(2, 3)
    for (let i = 0; i < nOthers; i++) {
      const a = w.addr('bsc')
      const t = w.at(r.float(-30, 15))
      const bv = bnb(r.pick([0.03, 0.05, 0.08, 0.1]))
      const uv = usdt(r.int(10, 80) * 10)
      w.fundAccount(a, bnb(bv + r.float(0.01, 0.05)), 'BNB', t - Math.round(r.float(2, 48) * HOUR))
      w.fundAccount(a, usdt(uv + r.int(0, 5) * 10), 'USDT', t - Math.round(r.float(1, 24) * HOUR))
      w.transfer({ time: t, from: a, to: s1, value: bv, asset: 'BNB' })
      w.transfer({ time: t + r.int(5, 60) * 60, from: a, to: s1, value: uv, asset: 'USDT' })
    }

    // ── Dépôt sur l'exchange ─────────────────────────────────────────────────
    const depT = u2T + Math.round(r.float(3, 16) * HOUR)
    const usdtDep = usdt(Math.floor((w.balanceOf(s1, 'USDT') * r.float(0.9, 1)) / 10) * 10)
    const d1 = dest.receive(s1, usdtDep, depT, { asset: 'USDT' })
    const deposit = d1.deposit
    const bnbDep = bnb(w.balanceOf(s1, 'BNB') * r.float(0.7, 0.9))
    const d2 = dest.receive(s1, bnbDep, depT + r.int(5, 40) * 60, { asset: 'BNB', depositAddr: deposit })
    path.push(d1.tx, ...(d1.sweep ? [d1.sweep] : []), d2.tx, ...(d2.sweep ? [d2.sweep] : []))

    // ── Bruit de fond ────────────────────────────────────────────────────────
    dest.noise(14, w.at(-3 * 24), w.at(6 * 24), 'USDT')
    dest.noise(8, w.at(-3 * 24), w.at(6 * 24), 'BNB')
    fund.noise(8, w.at(-4 * 24), w.at(4 * 24), 'BNB')

    const destName = dest.entity.name
    const paidUsdt = usdt(u1 + u2)

    return {
      world: w,
      title: `Faux airdrop ${token} — ${city}`,
      briefing:
        `${victimName}, demeurant à ${city}, dépose plainte pour escroquerie. Sur un réseau social, une publicité annonçait un « airdrop » du jeton ${token} : ${promised.toLocaleString('fr-FR')} $ offerts aux premiers inscrits. Pour « réclamer » ses jetons, ${g('il', 'elle')} a dû payer des frais de gas en BNB, puis des « frais de déblocage » en USDT. Les jetons ne sont jamais arrivés.\n\n` +
        `Les paiements ont été faits sur BNB Smart Chain (BSC), une blockchain compatible avec Ethereum (EVM) : mêmes adresses en 0x…, même fonctionnement par comptes, mais un registre distinct, avec sa propre monnaie native (le BNB) et ses jetons au standard BEP-20.\n\n` +
        `Votre mission : identifier le compte de l'escroc sur la bonne chaîne et suivre les fonds jusqu'à l'exchange.`,
      evidence: [
        {
          id: 'plainte', type: 'plainte', title: 'Procès-verbal de plainte (extrait)', date: depT + DAY, author: victimName,
          body:
            `« J'ai payé ${amt(b1, 'BNB')} de frais de gas le ${fmtDate(pay1.time)}, puis ${amt(u1, 'USDT')} et ${amt(u2, 'USDT')} de frais de déblocage. Mon portefeuille était réglé sur "BNB Smart Chain".\n\n` +
            `Mon adresse : ${A(w, victim)}\n` +
            `Transaction des ${amt(u2, 'USDT')} : ${pay3.hash} »`,
        },
        {
          id: 'capture', type: 'capture', title: `Capture du site « ${token} Airdrop »`, date: T0 - 2 * HOUR,
          body:
            `🎁 ${token} AIRDROP — PHASE FINALE 🎁\n` +
            `Votre allocation : ${promised.toLocaleString('fr-FR')} $ en ${token}\n` +
            `Pour réclamer : réglez les frais de réseau sur l'adresse officielle du contrat de distribution :\n${A(w, s1)}\n` +
            `Réseau : BNB Smart Chain (BEP-20) uniquement.\n` +
            `⏳ Offre valable 24 h.`,
        },
        {
          id: 'note', type: 'note', title: 'Message d\'un collègue', date: depT + DAY, author: 'Collègue de la brigade',
          body: `J'ai collé l'adresse du site dans Etherscan : quasiment rien dessus, à peine quelques centimes d'ETH reçus il y a longtemps. Fausse piste ? Je te laisse vérifier.`,
        },
      ],
      seeds: [victim],
      objectives: [
        {
          id: 'o1', type: 'address', points: 20,
          prompt: 'Quel compte de l\'escroc, sur BNB Smart Chain, a reçu les paiements de la victime ?',
          answer: [s1],
          hint: 'Dépliez les sorties du portefeuille de la victime (qui est sur BSC). La recherche (Ctrl K) peut proposer la même adresse sur deux chaînes : vérifiez l\'étiquette de chaîne.',
          explanation: `${A(w, s1)} sur BNB Smart Chain. Le site présente une adresse de « contrat de distribution », mais c'est un simple compte externe (EOA) contrôlé par l'escroc. La même adresse existe sur Ethereum, avec une activité ancienne et minime : ce n'est pas là que les fonds ont circulé.`,
        },
        {
          id: 'o2', type: 'entity', points: 20,
          prompt: 'Sur quelle plateforme l\'escroc a-t-il déposé les fonds ?',
          answer: [destKey],
          hint: 'Suivez les sorties du compte de l\'escroc sur BSC : l\'USDT et le BNB partent vers la même adresse, qui reverse tout à un hot wallet étiqueté.',
          explanation: `L'USDT puis le BNB arrivent sur l'adresse de dépôt ${A(w, deposit)}, aussitôt balayée vers le hot wallet de ${destName}. ${procedureFor(dest.entity)}`,
        },
        {
          id: 'o3', type: 'amount', points: 20, unit: 'USDT', tolerance: 0.01,
          prompt: 'Combien d\'USDT (BEP-20) l\'escroc a-t-il déposés sur cette plateforme ?',
          answer: usdtDep,
          hint: 'Ouvrez le transfert d\'USDT vers l\'adresse de dépôt. Ne confondez pas avec le transfert de BNB, qui suit de peu.',
          explanation: `${amt(usdtDep, 'USDT')} : plus que les ${amt(paidUsdt, 'USDT')} versés par ${victimName}, car ${nOthers} autres victimes ont payé le même compte. Le BNB (${amt(bnbDep, 'BNB')}) fait l'objet d'un transfert séparé vers la même adresse de dépôt.`,
        },
        {
          id: 'o4', type: 'choice', points: 20,
          prompt: 'Que répondre au collègue qui ne trouve presque rien sur Etherscan ?',
          ...choice(r,
            'La même adresse 0x existe sur plusieurs chaînes EVM : il faut l\'examiner sur BSC',
            [
              'L\'adresse est fausse : une adresse en 0x ne peut exister que sur le réseau Ethereum',
              'Les fonds ont été effacés de la blockchain après le dépôt de la plainte',
              'L\'escroc est passé par un mixeur, qui masque l\'adresse sur Etherscan',
            ]),
          explanation: 'Ethereum, BNB Smart Chain, Arbitrum, Base… partagent le même format d\'adresse : une même clé privée contrôle la même adresse 0x sur chacune, mais chaque chaîne a son propre registre et ses propres soldes. Etherscan ne montre qu\'Ethereum ; pour BSC, il faut un explorateur de BSC (ou un outil multi-chaînes). Avant de conclure qu\'une adresse est vide, vérifiez toujours la chaîne indiquée par la victime, son portefeuille ou la capture (« BEP-20 »).',
        },
        {
          id: 'o5', type: 'choice', points: 20,
          prompt: 'La victime a payé en BNB puis en USDT. Quelle est la différence entre les deux ?',
          ...choice(r,
            'Le BNB est la monnaie native qui paie le gas ; l\'USDT est un jeton BEP-20',
            [
              'Le BNB est un jeton BEP-20 émis par Tether ; l\'USDT est la monnaie native',
              'Aucune : sur BNB Smart Chain, tous les actifs sont des monnaies natives',
              'L\'USDT BEP-20 devient de l\'USDT Ethereum dès qu\'il arrive chez l\'escroc',
            ]),
          explanation: 'Comme l\'ETH sur Ethereum, le BNB est l\'actif natif de BSC : il paie les frais (gas) de toutes les transactions, y compris les transferts de jetons. L\'USDT BEP-20 est un jeton géré par un smart contract (équivalent de l\'ERC-20). Les deux se suivent séparément ; l\'USDT a un émetteur (Tether) capable de geler des jetons encore présents sur une adresse.',
        },
      ],
      truth: {
        path: path.map((t) => t.id),
        addresses: [s1, deposit, s1eth],
        debrief:
          `1. ${victimName} paie ${amt(b1, 'BNB')} (monnaie native, « frais de gas ») puis ${amt(u1, 'USDT')} et ${amt(u2, 'USDT')} (jeton BEP-20) au compte ${A(w, s1)} sur BNB Smart Chain.\n` +
          `2. ${nOthers} autres victimes paient le même compte.\n` +
          `3. L'escroc dépose ${amt(usdtDep, 'USDT')} puis ${amt(bnbDep, 'BNB')} sur l'adresse de dépôt ${destName} ${A(w, deposit)}, aussitôt balayée.\n` +
          `4. Sur Ethereum, la même adresse n'a reçu qu'un petit montant d'ETH il y a longtemps (${ethOld.hash.slice(0, 10)}…) : même clé, autre registre.\n\n` +
          `À retenir : une adresse 0x ne dit pas sur quelle chaîne se trouvent les fonds. Identifiez toujours la chaîne (portefeuille de la victime, mention BEP-20/ERC-20, explorateur) avant de tracer.\n\n` +
          `Réflexes de l'enquêteur : requérir ${destName} sur l'adresse de dépôt avec demande de gel ; noter que le même compte existe sur Ethereum (piste complémentaire) ; signaler le faux site et la publicité à la plateforme qui l'a diffusée.`,
      },
      hints: [
        'Partez du portefeuille de la victime, déjà sur BNB Smart Chain : dépliez ses sorties.',
        'Le même texte d\'adresse peut correspondre à deux nœuds (Ethereum et BSC) : regardez la chaîne affichée dans le panneau de droite.',
        'Suivez séparément le BNB et l\'USDT : ils finissent sur la même adresse de dépôt.',
      ],
    }
  },
}
