import { World } from '../engine/world'
import { dex, exchange } from '../engine/patterns'
import { roundAsset } from '../engine/chains'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, fakeCity, fakeHandle, fakeName, fakePerson, fmtDate, procedureFor } from './util'

export const accDexSwap: ScenarioTemplate = {
  id: 'dex-swap',
  title: 'Drainer et swaps sur DEX',
  tagline: 'Des ETH volés par un drainer, convertis en stablecoins sur Uniswap : suivez les jambes du swap.',
  description:
    'Un collectionneur de NFT a signé une transaction « Claim » sur un faux site d\'airdrop. Ses ETH ont été aspirés par un contrat drainer, puis convertis en stablecoins sur un DEX avant d\'être envoyés sur un exchange. Apprenez à lire un swap (routeur, pool, jetons reçus), mesurez l\'activité de l\'affilié et du fournisseur du kit, et suivez chaque jeton jusqu\'à sa destination.',
  difficulty: 2,
  chains: ['eth'],
  skills: ['evm', 'tokens', 'dex', 'defi', 'exchange_id'],
  estMinutes: 40,
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
    const otherVictims: { addr: string; value: number; tx: string; time: number }[] = []
    const v2Name = fakeName(r)
    for (let i = 0; i < r.int(1, 3); i++) {
      const v = w.addr('eth', { entity: w.customEntity({ name: i === 0 ? v2Name : 'Victime non identifiée', category: 'victim' }) })
      const val = roundAsset('ETH', r.float(0.4, 3))
      w.fundAccount(v, roundAsset('ETH', val + r.float(0.01, 0.1)), 'ETH', w.at(-r.int(10, 60) * 24))
      const t = drainTx(v, val, w.at(r.float(-30, 20)))
      others.push(t.id)
      otherVictims.push({ addr: v, value: val, tx: t.hash, time: t.time })
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
    const kitCut = roundAsset('ETH', stolen - roundAsset('ETH', stolen * share))
    const nAffVictims = others.length + 1
    const daiOut = daiTx.transfers[0].value
    const v2 = otherVictims[0]
    const city2 = fakeCity(r)

    return {
      world: w,
      title: `Drainer « Claim » — ${city}`,
      briefing:
        `${victimName} (${city}), ${g('collectionneur', 'collectionneuse')} de NFT, a cliqué sur un lien annonçant un « airdrop » réservé aux détenteurs d'une collection. Le site lui a demandé de connecter son portefeuille puis de signer une transaction « Claim ». Quelques secondes plus tard, son solde d'ETH était vide.\n\n` +
        `Les drainers sont des kits vendus « clé en main » : un contrat malveillant aspire les fonds et les répartit entre l'affilié qui a mené la campagne et le fournisseur du kit. Les fonds volés passent souvent par un DEX pour être convertis en stablecoins.\n\n` +
        `Objectifs : identifier l'adresse de l'affilié et celle du fournisseur du kit, mesurer l'ampleur de la campagne de l'affilié, reconstituer ses swaps (actifs et montants obtenus), puis suivre chaque jeton jusqu'à sa destination.`,
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
        {
          id: 'rapprochement', type: 'email', title: 'Message d\'un commissariat (plainte similaire)', date: w.at(3 * 24), author: `Commissariat de ${city2}`,
          body:
            `Bonjour,\n` +
            `Nous avons reçu la plainte de ${v2Name}, victime d'un faux airdrop après avoir signé une transaction « Claim ». Son adresse ${A(w, v2.addr)} a perdu ${amt(v2.value, 'ETH')} le ${fmtDate(v2.time, false)} (transaction ${v2.tx}).\n` +
            `Le mode opératoire semble identique au vôtre. Pouvez-vous nous dire si les fonds aboutissent au même endroit ?\n` +
            `Cordialement`,
        },
        {
          id: 'note', type: 'note', title: 'Note de l\'analyste : stablecoins et gel', date: w.at(3 * 24), author: 'Cellule d\'appui',
          body:
            `• USDC et USDT sont émis par des sociétés qui peuvent bloquer une adresse sur demande motivée des autorités.\n` +
            `• Le DAI est un stablecoin décentralisé, adossé à des garanties déposées dans des contrats : aucun émetteur ne peut geler une adresse.\n` +
            `• Une fois des jetons déposés sur un exchange, c'est la plateforme qu'on requiert (identité, gel du compte), sur l'adresse de dépôt.`,
        },
      ],
      seeds: [],
      objectives: [
        {
          id: 'o1', type: 'address', points: 10,
          prompt: 'Quelle adresse (EOA) de l\'affilié a reçu la part principale de l\'ETH volé ?',
          answer: [operator],
          hint: 'Ouvrez la transaction « Claim » : elle contient plusieurs transferts internes (jambes). Le contrat redistribue l\'ETH reçu.',
          explanation: `La transaction signée par la victime envoie ${amt(stolen, 'ETH')} au contrat, qui reverse ${Math.round(share * 100)} % à ${A(w, operator)} (l'affilié) et le reste à ${A(w, kitFee)} (commission du fournisseur du kit).`,
        },
        {
          id: 'o5', type: 'choice', points: 8,
          prompt: 'Que représente la seconde sortie du contrat drainer (la plus petite) ?',
          hint: 'Regardez qui d\'autre envoie des fonds à cette adresse : reçoit-elle une part d\'autres transactions « Claim » ?',
          ...choice(r,
            'La commission du fournisseur du kit (drainer-as-a-service)',
            [
              'Les frais de gas remboursés à la victime par le contrat',
              'Un remboursement automatique prévu par le smart contract',
              'Le dépôt de garantie exigé par Uniswap avant un swap',
            ]),
          explanation: `L'adresse ${A(w, kitFee)} reçoit une commission de chaque vol, y compris d'autres affiliés : c'est une cible prioritaire, car elle relie toutes les campagnes du même kit.`,
        },
        {
          id: 'o6', type: 'address', points: 9,
          prompt: 'Quelle adresse encaisse la commission du fournisseur du kit de drainage ?',
          answer: [kitFee],
          hint: 'Dans la transaction « Claim » du plaignant, le contrat drainer reverse l\'ETH à deux adresses : prenez celle qui reçoit la plus petite part.',
          explanation: `${A(w, kitFee)} reçoit ${Math.round((1 - share) * 100)} % de chaque vol passé par le contrat, y compris ceux d'autres affiliés (on la retrouve dans d'autres transactions « Claim » dont l'affilié n'est pas bénéficiaire). C'est le portefeuille du fournisseur du drainer-as-a-service : il relie toutes les campagnes du kit et peut être signalé aux plateformes pour bloquer ses dépôts futurs.`,
        },
        {
          id: 'o7', type: 'amount', points: 9, unit: 'ETH', tolerance: 0.01,
          prompt: 'Combien d\'ETH le fournisseur du kit a-t-il prélevés sur le vol subi par le plaignant ?',
          answer: kitCut,
          hint: 'C\'est la plus petite des deux jambes sortantes du contrat, dans la transaction signée par le plaignant (pas dans celles des autres victimes).',
          explanation: `Sur ${amt(stolen, 'ETH')} volés, le contrat reverse ${amt(roundAsset('ETH', stolen * share), 'ETH')} à l'affilié et ${amt(kitCut, 'ETH')} au fournisseur. Les deux bénéficiaires sont coauteurs du vol : le préjudice du plaignant se répartit entre eux, ce qu'il faut documenter pour chaque victime.`,
        },
        {
          id: 'o8', type: 'number', points: 9, unit: 'victimes',
          prompt: 'Combien de victimes au total (plaignant compris) ont été drainées au profit de cette même adresse d\'affilié ?',
          answer: nAffVictims,
          hint: 'Comptez les transactions « Claim » dans lesquelles l\'adresse de l\'affilié reçoit une part du contrat drainer. Les autres « Claim » du contrat profitent à d\'autres affiliés.',
          explanation: `L'adresse ${A(w, operator)} reçoit sa part de ${nAffVictims} transactions « Claim », donc de ${nAffVictims} victimes, dont ${v2Name} (plainte à ${city2}). Le contrat drainer, lui, sert aussi à d'autres affiliés, qui touchent leur part sur d'autres adresses : seules les victimes dont la part aboutit chez l'affilié relèvent de cette procédure, les autres justifient un signalement.`,
        },
        {
          id: 'o2', type: 'choice', points: 8,
          prompt: 'En quels actifs l\'affilié a-t-il converti une partie de ses ETH sur Uniswap ?',
          hint: 'Dépliez les flux entrants de l\'affilié : quels jetons lui renvoient les pools Uniswap ?',
          ...choice(r, 'USDC et DAI', ['USDC uniquement', 'USDC et USDT', 'USDC et WBTC']),
          explanation: 'Trois swaps : deux ETH → USDC et un ETH → DAI. Dans chaque swap, l\'ETH part vers le routeur, qui le transmet au pool ; le pool renvoie le jeton à l\'affilié.',
        },
        {
          id: 'o3', type: 'amount', points: 10, unit: 'USDC', tolerance: 0.01,
          prompt: 'Quel montant total d\'USDC l\'affilié a-t-il obtenu par ses swaps ?',
          answer: usdcTotal,
          hint: 'Il y a deux swaps vers l\'USDC : additionnez les jetons renvoyés par le pool ETH/USDC.',
          explanation: `${amt(sw1.amountOut, 'USDC')} + ${amt(sw3.amountOut, 'USDC')} = ${amt(usdcTotal, 'USDC')}.`,
        },
        {
          id: 'o4', type: 'entity', points: 9,
          prompt: 'Sur quelle plateforme les USDC ont-ils été envoyés ?',
          hint: 'Suivez les sorties d\'USDC de l\'affilié : l\'adresse destinataire est ensuite balayée vers un hot wallet étiqueté.',
          answer: [destKey],
          explanation: `Les ${amt(usdcTotal, 'USDC')} sont déposés sur une adresse de dépôt ${dest.entity.name} puis balayés vers son hot wallet. Les DAI partent vers un autre portefeuille de l'affilié, et ${amt(ethKept, 'ETH')} restent sur son adresse. ${procedureFor(dest.entity)}`,
        },
        {
          id: 'o9', type: 'address', points: 9,
          prompt: 'Quelle adresse de dépôt faut-il citer dans la réquisition adressée à cette plateforme ?',
          answer: [dep.deposit],
          hint: 'Ce n\'est pas le hot wallet : c\'est l\'adresse qui reçoit les USDC de l\'affilié, avant d\'être balayée.',
          explanation: `L'affilié envoie ${amt(usdcTotal, 'USDC')} sur ${A(w, dep.deposit)} le ${fmtDate(dep.tx.time)}, adresse de dépôt propre à un client de ${dest.entity.name}, balayée ensuite vers le hot wallet. C'est elle qui désigne le titulaire du compte.`,
        },
        {
          id: 'o10', type: 'address', points: 10,
          prompt: 'Vers quelle adresse l\'affilié a-t-il envoyé les jetons obtenus par son swap qui n\'est pas parti vers l\'exchange ?',
          answer: [cold],
          hint: 'Suivez séparément chaque jeton reçu des pools : l\'un d\'eux ne va pas vers une adresse de dépôt, mais vers une adresse sans étiquette.',
          explanation: `Les ${amt(daiOut, 'DAI')} obtenus par le swap ETH → DAI partent vers ${A(w, cold)}, adresse sans étiquette qui ne fait rien d'autre : un portefeuille de stockage de l'affilié. Il faut la placer sous surveillance : si ces DAI rejoignent une plateforme, une réquisition rapide devient possible.`,
        },
        {
          id: 'o11', type: 'choice', points: 9,
          prompt: 'Peut-on demander le gel des stablecoins conservés par l\'affilié hors de l\'exchange ?',
          hint: 'Quel est le stablecoin conservé, et existe-t-il une société émettrice capable de bloquer une adresse ?',
          ...choice(r,
            'Non : ce stablecoin est décentralisé, sans émetteur capable de geler ; il faut surveiller l\'adresse et agir si les fonds rejoignent une plateforme',
            [
              'Oui : tout stablecoin adossé au dollar peut être gelé par son émetteur sur demande motivée',
              'Oui : Uniswap peut bloquer les jetons issus de ses pools, puisqu\'il a réalisé le swap',
              'Non : des jetons ERC-20 ne peuvent jamais être bloqués, quel que soit l\'émetteur',
            ]),
          explanation: `Les jetons conservés hors de l'exchange sont des DAI : aucun émetteur centralisé ne peut les bloquer, contrairement à l'USDC ou à l'USDT dont les contrats prévoient une liste noire. Uniswap est un protocole sans opérateur qui puisse intervenir. La parade est la surveillance de ${A(w, cold).slice(0, 12)}… et la réquisition de la plateforme où les fonds aboutiront. Le choix du DAI pour la part « stockée » n'est sans doute pas un hasard.`,
        },
      ],
      truth: {
        path: [tDrain.id, ...others, sw1.tx.id, sw2.tx.id, sw3.tx.id, dep.tx.id, ...(dep.sweep ? [dep.sweep.id] : []), daiTx.id],
        addresses: [drainer, operator, kitFee, cold, dep.deposit],
        debrief:
          `1. La victime signe « Claim » : ${amt(stolen, 'ETH')} partent vers le contrat drainer ${A(w, drainer)}, qui reverse dans la même transaction ${Math.round(share * 100)} % à l'affilié ${A(w, operator)} et le reste au fournisseur du kit.\n` +
          `2. L'affilié, qui a aussi drainé ${others.length} autre(s) victime(s) (dont ${v2Name}), effectue trois swaps sur Uniswap : ETH → ${amt(sw1.amountOut, 'USDC')}, ETH → ${amt(sw2.amountOut, 'DAI')}, ETH → ${amt(sw3.amountOut, 'USDC')}.\n` +
          `3. Il dépose ${amt(usdcTotal, 'USDC')} sur l'adresse de dépôt ${A(w, dep.deposit)} (${dest.entity.name}), envoie les ${amt(daiOut, 'DAI')} vers ${A(w, cold)} et garde ${amt(ethKept, 'ETH')}.\n` +
          `4. Le fournisseur du kit encaisse ${amt(kitCut, 'ETH')} sur le vol du plaignant, et des commissions sur les vols d'autres affiliés, sur ${A(w, kitFee)}.\n\n` +
          `À retenir : un swap DEX n'est pas une rupture de traçage. Le routeur et le pool sont des contrats publics ; la transaction montre l'actif entrant et l'actif sortant, au profit du même trader. Les stablecoins obtenus (USDC, DAI) se suivent comme n'importe quel jeton, et l'USDC est gelable par son émetteur.`,
      },
      hints: [
        'Commencez par la transaction signée par la victime (dans la plainte) et ouvrez son détail : plusieurs transferts y figurent.',
        'Un swap ETH → jeton se lit en trois jambes : trader → routeur (ETH), routeur → pool (ETH), pool → trader (jeton).',
        'Dépliez les flux entrants de l\'affilié pour voir les jetons renvoyés par les pools Uniswap.',
        'Les jetons obtenus ne prennent pas tous le même chemin : suivez chaque jeton séparément.',
        'Pour mesurer l\'activité de l\'affilié, comptez les « Claim » dont il est bénéficiaire, pas toutes les transactions du contrat.',
      ],
    }
  },
}
