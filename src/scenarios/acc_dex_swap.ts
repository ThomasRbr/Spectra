import { World } from '../engine/world'
import { dex, exchange } from '../engine/patterns'
import { roundAsset } from '../engine/chains'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, fakeCity, fakeHandle, fakePerson, procedureFor } from './util'

export const accDexSwap: ScenarioTemplate = {
  id: 'dex-swap',
  title: 'Drainer et swaps sur DEX',
  tagline: 'Des ETH volés par un drainer, convertis en stablecoins sur Uniswap : suivez les jambes du swap.',
  description:
    'Un collectionneur de NFT a signé une transaction « Claim » sur un faux site d\'airdrop. Ses ETH ont été aspirés par un contrat drainer, puis convertis en stablecoins sur un DEX avant d\'être envoyés sur un exchange. Apprenez à lire un swap (routeur, pool, jetons reçus).',
  difficulty: 2,
  chains: ['eth'],
  skills: ['evm', 'tokens', 'dex', 'defi', 'exchange_id'],
  estMinutes: 20,
  lessons: ['comptes-evm', 'tokens-erc20', 'dex-defi', 'typologies', 'exchanges'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const victimP = fakePerson(r)
    const victimName = victimP.name
    const g = victimP.g
    const city = fakeCity(r)

    const omni = dex(w, 'uniswap', 'eth')
    const cv = exchange(w, 'coinhouse', 'eth')
    const destKey = r.pick(['binance', 'okx', 'huobex', 'bitstamp'] as const)
    const dest = exchange(w, destKey, 'eth')

    const kitE = w.customEntity({ name: 'Kit de drainage « PhantomClaim »', category: 'scam', description: 'Drainer-as-a-service : le fournisseur prélève une commission sur chaque vol.' })
    const operatorE = w.customEntity({ name: 'Affilié du drainer (inconnu)', category: 'suspect' })
    const drainer = w.addr('eth', { entity: kitE, contract: { name: 'Contrat non vérifié', type: 'exploit' } })
    const kitFee = w.addr('eth', { entity: kitE })
    const operator = w.addr('eth', { entity: operatorE })
    const cold = w.addr('eth', { entity: operatorE })

    // Victime : portefeuille actif depuis longtemps
    const victimE = w.customEntity({ name: victimName, category: 'victim' })
    const victim = w.addr('eth', { entity: victimE })
    const stolen = roundAsset('ETH', r.float(4, 16))
    cv.withdraw(victim, roundAsset('ETH', stolen * r.float(0.6, 0.7)), w.at(-r.int(120, 300) * 24))
    cv.withdraw(victim, roundAsset('ETH', stolen * r.float(0.45, 0.6)), w.at(-r.int(20, 90) * 24))
    omni.swap({ trader: victim, assetIn: 'ETH', amountIn: roundAsset('ETH', r.float(0.05, 0.2)), assetOut: 'USDC', time: w.at(-r.int(5, 15) * 24) })

    // Le drain : la victime signe « Claim » ; le contrat répartit 80 % / 20 %
    const share = r.pick([0.8, 0.8, 0.75, 0.85])
    const drainTx = (from: string, value: number, time: number) => {
      const op = roundAsset('ETH', value * share)
      return w.multi({
        time, signer: from, method: 'Claim',
        legs: [
          { from, to: drainer, value, asset: 'ETH' },
          { from: drainer, to: operator, value: op, asset: 'ETH' },
          { from: drainer, to: kitFee, value: roundAsset('ETH', value - op), asset: 'ETH' },
        ],
      })
    }
    const tDrain = drainTx(victim, stolen, w.at(0))

    // Autres victimes du même affilié
    const others: string[] = []
    for (let i = 0; i < r.int(1, 3); i++) {
      const v = w.addr('eth', { entity: w.customEntity({ name: 'Victime non identifiée', category: 'victim' }) })
      const val = roundAsset('ETH', r.float(0.4, 3))
      w.fundAccount(v, roundAsset('ETH', val + r.float(0.01, 0.1)), 'ETH', w.at(-r.int(10, 60) * 24))
      others.push(drainTx(v, val, w.at(r.float(-30, 20))).id)
    }
    // Le fournisseur du kit encaisse aussi des commissions d'autres affiliés
    for (let i = 0; i < r.int(3, 6); i++) {
      const v = w.addr('eth')
      const val = roundAsset('ETH', r.float(0.2, 5))
      w.fundAccount(v, roundAsset('ETH', val * 1.02), 'ETH', w.at(-r.int(5, 40) * 24))
      w.multi({
        time: w.at(r.float(-72, 72)), signer: v, method: 'Claim',
        legs: [
          { from: v, to: drainer, value: val, asset: 'ETH' },
          { from: drainer, to: w.addr('eth'), value: roundAsset('ETH', val * share), asset: 'ETH' },
          { from: drainer, to: kitFee, value: roundAsset('ETH', val * (1 - share)), asset: 'ETH' },
        ],
      })
    }

    // Swaps de l'affilié : ETH → USDC (deux fois) et ETH → DAI
    const opEth = w.balanceOf(operator, 'ETH')
    const sw1 = omni.swap({ trader: operator, assetIn: 'ETH', amountIn: roundAsset('ETH', opEth * r.float(0.35, 0.45)), assetOut: 'USDC', time: w.at(r.float(22, 26)) })
    const sw2 = omni.swap({ trader: operator, assetIn: 'ETH', amountIn: roundAsset('ETH', opEth * r.float(0.15, 0.25)), assetOut: 'DAI', time: w.at(r.float(27, 30)) })
    const sw3 = omni.swap({ trader: operator, assetIn: 'ETH', amountIn: roundAsset('ETH', opEth * r.float(0.12, 0.2)), assetOut: 'USDC', time: w.at(r.float(31, 34)) })
    const usdcTotal = roundAsset('USDC', sw1.amountOut + sw3.amountOut)

    // USDC → exchange ; DAI → portefeuille froid ; reste d'ETH conservé
    const dep = dest.receive(operator, w.balanceOf(operator, 'USDC'), w.at(r.float(36, 48)), { asset: 'USDC' })
    const daiTx = w.transfer({ time: w.at(r.float(38, 60)), from: operator, to: cold, value: w.balanceOf(operator, 'DAI'), asset: 'DAI' })
    const ethKept = roundAsset('ETH', w.balanceOf(operator, 'ETH'))

    // Bruit de fond
    omni.noise(40, w.at(-2 * 24), w.at(4 * 24), [['ETH', 'USDC'], ['ETH', 'DAI'], ['ETH', 'USDT']])
    dest.noise(14, w.at(-2 * 24), w.at(5 * 24), 'USDC')
    dest.noise(8, w.at(-2 * 24), w.at(5 * 24), 'ETH')
    cv.noise(6, w.at(-3 * 24), w.at(3 * 24), 'ETH')

    const handle = fakeHandle(r)

    return {
      world: w,
      title: `Drainer « Claim » — ${city}`,
      briefing:
        `${victimName} (${city}), ${g('collectionneur', 'collectionneuse')} de NFT, a cliqué sur un lien annonçant un « airdrop » réservé aux détenteurs d'une collection. Le site lui a demandé de connecter son portefeuille puis de signer une transaction « Claim ». Quelques secondes plus tard, son solde d'ETH était vide.\n\n` +
        `Les drainers sont des kits vendus « clé en main » : un contrat malveillant aspire les fonds et les répartit entre l'affilié qui a mené la campagne et le fournisseur du kit. Les fonds volés passent souvent par un DEX pour être convertis en stablecoins.\n\n` +
        `Objectifs : identifier l'adresse de l'affilié, reconstituer ses swaps (actifs et montants obtenus) et la plateforme de sortie.`,
      evidence: [
        {
          id: 'plainte', type: 'plainte', title: 'Procès-verbal de plainte (extrait)', date: w.at(2 * 24), author: victimName,
          body:
            `« J'ai signé une seule transaction, qui s'appelait "Claim". Mon portefeuille affichait "+ 1 200 jetons", je n'ai pas fait attention au montant d'ETH.\n\n` +
            `Mon adresse : ${A(w, victim)}\n` +
            `Transaction signée : ${tDrain.hash} »`,
        },
        {
          id: 'capture', type: 'capture', title: 'Capture du faux site d\'airdrop', date: w.at(-0.1),
          body: `🎁 Holders Airdrop — Season 2\nVotre portefeuille est éligible !\n[ Connect Wallet ]  →  [ Claim ]\nRéseau : Ethereum · Frais estimés : 0,002 ETH`,
        },
        {
          id: 'forum', type: 'forum', title: 'Signalement communautaire (forum sécurité Web3)', author: handle, date: w.at(30),
          body:
            `Alerte : drainer actif derrière les faux sites « Holders Airdrop ». Le contrat ${A(w, drainer)} reçoit l'ETH des victimes et le redistribue immédiatement, environ ${Math.round(share * 100)} % / ${Math.round((1 - share) * 100)} %. Ne signez rien.`,
        },
      ],
      seeds: [],
      objectives: [
        {
          id: 'o1', type: 'address', points: 25,
          prompt: 'Quelle adresse (EOA) de l\'affilié a reçu la part principale de l\'ETH volé ?',
          answer: [operator],
          hint: 'Ouvrez la transaction « Claim » : elle contient plusieurs transferts internes (jambes). Le contrat redistribue l\'ETH reçu.',
          explanation: `La transaction signée par la victime envoie ${amt(stolen, 'ETH')} au contrat, qui reverse ${Math.round(share * 100)} % à ${A(w, operator)} (l'affilié) et le reste à ${A(w, kitFee)} (commission du fournisseur du kit).`,
        },
        {
          id: 'o2', type: 'choice', points: 15,
          prompt: 'En quels actifs l\'affilié a-t-il converti une partie de ses ETH sur Uniswap ?',
          ...choice(r, 'USDC et DAI', ['USDC uniquement', 'USDC et USDT', 'USDC et WBTC']),
          explanation: 'Trois swaps : deux ETH → USDC et un ETH → DAI. Dans chaque swap, l\'ETH part vers le routeur, qui le transmet au pool ; le pool renvoie le jeton à l\'affilié.',
        },
        {
          id: 'o3', type: 'amount', points: 25, unit: 'USDC', tolerance: 0.01,
          prompt: 'Quel montant total d\'USDC l\'affilié a-t-il obtenu par ses swaps ?',
          answer: usdcTotal,
          hint: 'Il y a deux swaps vers l\'USDC : additionnez les jetons renvoyés par le pool ETH/USDC.',
          explanation: `${amt(sw1.amountOut, 'USDC')} + ${amt(sw3.amountOut, 'USDC')} = ${amt(usdcTotal, 'USDC')}.`,
        },
        {
          id: 'o4', type: 'entity', points: 25,
          prompt: 'Sur quelle plateforme les USDC ont-ils été envoyés ?',
          answer: [destKey],
          explanation: `Les ${amt(usdcTotal, 'USDC')} sont déposés sur une adresse de dépôt ${dest.entity.name} puis balayés vers son hot wallet. Les DAI partent vers un autre portefeuille de l'affilié, et ${amt(ethKept, 'ETH')} restent sur son adresse. ${procedureFor(dest.entity)}`,
        },
        {
          id: 'o5', type: 'choice', points: 10,
          prompt: 'Que représente la seconde sortie du contrat drainer (la plus petite) ?',
          ...choice(r,
            'La commission du fournisseur du kit (drainer-as-a-service)',
            [
              'Les frais de gas remboursés à la victime par le contrat',
              'Un remboursement automatique prévu par le smart contract',
              'Le dépôt de garantie exigé par Uniswap avant un swap',
            ]),
          explanation: `L'adresse ${A(w, kitFee)} reçoit une commission de chaque vol, y compris d'autres affiliés : c'est une cible prioritaire, car elle relie toutes les campagnes du même kit.`,
        },
      ],
      truth: {
        path: [tDrain.id, ...others, sw1.tx.id, sw2.tx.id, sw3.tx.id, dep.tx.id, ...(dep.sweep ? [dep.sweep.id] : []), daiTx.id],
        addresses: [drainer, operator, kitFee, cold, dep.deposit],
        debrief:
          `1. La victime signe « Claim » : ${amt(stolen, 'ETH')} partent vers le contrat drainer ${A(w, drainer)}, qui reverse dans la même transaction ${Math.round(share * 100)} % à l'affilié ${A(w, operator)} et le reste au fournisseur du kit.\n` +
          `2. L'affilié, qui a aussi drainé ${others.length} autre(s) victime(s), effectue trois swaps sur Uniswap : ETH → ${amt(sw1.amountOut, 'USDC')}, ETH → ${amt(sw2.amountOut, 'DAI')}, ETH → ${amt(sw3.amountOut, 'USDC')}.\n` +
          `3. Il dépose ${amt(usdcTotal, 'USDC')} sur ${dest.entity.name}, envoie les DAI vers ${A(w, cold)} et garde ${amt(ethKept, 'ETH')}.\n\n` +
          `À retenir : un swap DEX n'est pas une rupture de traçage. Le routeur et le pool sont des contrats publics ; la transaction montre l'actif entrant et l'actif sortant, au profit du même trader. Les stablecoins obtenus (USDC, DAI) se suivent comme n'importe quel jeton, et l'USDC est gelable par son émetteur.`,
      },
      hints: [
        'Commencez par la transaction signée par la victime (dans la plainte) et ouvrez son détail : plusieurs transferts y figurent.',
        'Un swap ETH → jeton se lit en trois jambes : trader → routeur (ETH), routeur → pool (ETH), pool → trader (jeton).',
        'Dépliez les flux entrants de l\'affilié pour voir les jetons renvoyés par les pools Uniswap.',
        'Les jetons obtenus ne prennent pas tous le même chemin : suivez chaque jeton séparément.',
      ],
    }
  },
}
