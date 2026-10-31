import { World } from '../engine/world'
import { dex, exchange, DAY, HOUR } from '../engine/patterns'
import { lending, weth } from '../engine/defi'
import { fmtUsd, fromUsd, roundAsset, usd } from '../engine/chains'
import { traceFunds } from '../engine/tracing'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, fakeCity, fakeHandle, fakePerson, fmtDate, procedureFor } from './util'

export const defiLendingGarantie: ScenarioTemplate = {
  id: 'lending-garantie',
  title: 'La garantie et l\'emprunt',
  tagline: 'De l\'ETH volé déposé en garantie sur Aave, des USDC « neufs » empruntés et envoyés sur un exchange : un lien indirect à chiffrer.',
  description:
    'Le hot wallet d\'un prestataire de paiement en cryptoactifs a été vidé. Le pirate ne vend pas l\'ETH volé : il le dépose en garantie sur Aave, à côté d\'une garantie plus ancienne, et emprunte des USDC qu\'il envoie sur un exchange. Plus tard, il rembourse grâce à du WETH et retire sa garantie vers une adresse neuve. Lisez les appels Aave, mesurez avec l\'outil de traçage la part de l\'emprunt rattachable au vol, qualifiez ce lien et ciblez ce qui peut encore être gelé.',
  difficulty: 4,
  chains: ['eth'],
  skills: ['evm', 'defi', 'tokens', 'exchange_id', 'requisition', 'gel'],
  estMinutes: 55,
  lessons: ['pret-garantie', 'jetons-enveloppes', 'tracage-outille'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const cto = fakePerson(r)
    const city = fakeCity(r)
    const company = r.pick(['Paylium', 'Monetis Pay', 'Kryptal Services', 'Numa Paiements', 'Orbel Pay'])

    // ── Acteurs ──────────────────────────────────────────────────────────────
    const aave = lending(w, 'aave', 'eth')
    const wk = weth(w, 'eth')
    const uni = dex(w, 'uniswap', 'eth')
    const exAKey = r.pick(['kraken', 'coinbase', 'bitstamp'] as const)
    const exA = exchange(w, exAKey, 'eth')
    const exBKey = r.pick(['binance', 'okx', 'huobex'] as const)
    const exB = exchange(w, exBKey, 'eth')

    const victimE = w.customEntity({ name: `${company} (victime)`, category: 'victim' })
    const H = w.addr('eth', { entity: victimE, label: `${company} — Hot wallet` })
    const hackE = w.customEntity({ name: `Pirate du hot wallet ${company} (inconnu)`, category: 'hack' })
    const X = w.addr('eth', { entity: hackE })
    const X2 = w.addr('eth', { entity: hackE })
    const N = w.addr('eth', { entity: hackE })

    // ── Activité normale du hot wallet ───────────────────────────────────────
    const S = roundAsset('ETH', r.float(120, 380))
    w.fundAccount(H, roundAsset('ETH', S + r.float(60, 200)), 'ETH', w.at(-r.float(20, 30) * 24))
    for (let i = 0; i < r.int(12, 18); i++) {
      const t = w.at(-r.float(0.5, 18) * 24)
      w.transfer({ time: t, from: H, to: w.addr('eth'), value: roundAsset('ETH', r.float(0.05, 22)), asset: 'ETH', method: 'transfer' })
    }

    // ── Position Aave antérieure, financée proprement ────────────────────────
    const E0 = roundAsset('ETH', S * r.float(0.12, 0.3))
    const wA = exA.withdraw(X2, roundAsset('ETH', E0 + r.float(0.15, 0.4)), w.at(-r.float(25, 40) * 24))
    const supply0 = aave.supply({ from: X2, value: E0, time: w.at(-r.float(18, 24) * 24) })

    // ── Le piratage ──────────────────────────────────────────────────────────
    const hack = w.transfer({ time: w.at(0), from: H, to: X, value: S, asset: 'ETH' })
    const T = roundAsset('ETH', S * r.float(0.5, 0.62))
    const hop = w.transfer({ time: w.at(r.float(0.3, 1.2)), from: X, to: X2, value: T, asset: 'ETH' })
    const Ts = roundAsset('ETH', T * r.float(0.6, 0.72))
    const supply1 = aave.supply({ from: X2, value: Ts, time: w.at(r.float(1.6, 3)) })
    const collTotal = roundAsset('ETH', E0 + Ts)
    const B = Math.round((usd('ETH', collTotal) * r.float(0.32, 0.45)) / 1000) * 1000
    const borrow = aave.borrow({ from: X2, value: B, asset: 'USDC', time: w.at(r.float(3.2, 5)) })
    const dep = exB.receive(X2, B, w.at(r.float(5.5, 9)), { asset: 'USDC' })

    // ── Remboursement : WETH, swap, déroulage du reste, repay ────────────────
    const tR = w.at(r.float(4, 8) * 24)
    const repayAmt = roundAsset('USDC', B * (1 + r.float(0.002, 0.006)))
    const wSwap = roundAsset('WETH', fromUsd('WETH', repayAmt / 0.985))
    const wrapAmt = roundAsset('ETH', wSwap * r.float(1.12, 1.3))
    const balX2 = w.balanceOf(X2, 'ETH')
    const top = roundAsset('ETH', Math.max(0.5, wrapAmt - balX2 + r.float(0.3, 1.5)))
    const topUp = w.transfer({ time: tR - r.float(2, 10) * HOUR, from: X, to: X2, value: top, asset: 'ETH' })
    const wrapTx = wk.wrap(X2, wrapAmt, tR)
    const sell = uni.swap({ trader: X2, assetIn: 'WETH', amountIn: wSwap, assetOut: 'USDC', time: tR + r.float(0.2, 1) * HOUR })
    const unwrapAmt = roundAsset('WETH', wrapAmt - wSwap)
    const unwrapTx = wk.unwrap(X2, unwrapAmt, tR + r.float(1.2, 2) * HOUR)
    const repay = aave.repay({ from: X2, value: repayAmt, asset: 'USDC', time: tR + r.float(2.2, 3.5) * HOUR })
    const withdraw = aave.withdraw({ from: X2, value: collTotal, to: N, time: tR + r.float(4, 8) * HOUR })
    const xLeft = roundAsset('ETH', w.balanceOf(X, 'ETH'))

    // ── Bruit de fond ────────────────────────────────────────────────────────
    aave.noise(26, w.at(-25 * 24), w.at(10 * 24))
    uni.noise(30, w.at(-3 * 24), w.at(10 * 24), [['ETH', 'USDC'], ['WETH', 'USDC'], ['ETH', 'USDT']])
    for (let i = 0; i < 10; i++) {
      const u = w.addr('eth')
      const v = roundAsset('ETH', r.float(0.5, 30))
      const t = w.at(r.float(-3 * 24, 10 * 24))
      w.fundAccount(u, roundAsset('ETH', v * 1.02), 'ETH', t - r.int(1, 8) * DAY)
      wk.wrap(u, v, t)
    }
    exA.noise(14, w.at(-40 * 24), w.at(2 * 24), 'ETH')
    exB.noise(18, w.at(-2 * 24), w.at(10 * 24), 'USDC')

    // ── Part de l'emprunt rattachable au vol, telle que la calcule l'outil ───
    const tr = traceFunds(w, { txId: hack.id, address: X }, { method: 'haircut' })
    const exEnd = tr.endpoints.find((e) => e.entity.id === exBKey)
    const attribUsd = Math.round(exEnd?.usd ?? 0)
    const attribPct = Math.round((attribUsd / B) * 100)

    const handle = fakeHandle(r)
    const d = (ts: number) => fmtDate(ts)

    return {
      world: w,
      title: `Piratage du hot wallet ${company}`,
      briefing:
        `${company}, prestataire de paiement en cryptoactifs établi à ${city}, a constaté le ${fmtDate(hack.time, false)} la sortie de ${amt(S, 'ETH')} de son portefeuille chaud. La clé privée avait été extraite d'un serveur compromis. ${cto.name}, ${cto.g('directeur technique', 'directrice technique')}, a déposé plainte ; l'enquête vous est confiée.\n\n` +
        `Le pirate n'a pas vendu l'ETH : il en a déposé une partie en garantie sur Aave, protocole de prêt décentralisé, et a emprunté des stablecoins contre cette garantie. Les fonds empruntés sortent de la réserve du protocole : ce ne sont pas les ETH volés, mais ils n'existeraient pas sans eux. Le traceur rattache un emprunt à une garantie marquée, au prorata de la part marquée : c'est un lien économique, indirect, qu'il faut présenter comme tel.\n\n` +
        `Objectifs : suivre l'ETH volé jusqu'à la position Aave, lire la garantie et l'emprunt, mesurer avec l'outil de traçage la part de l'emprunt rattachable au vol, suivre les USDC jusqu'à l'exchange, retrouver le retrait de la garantie, puis déterminer ce qui peut encore être gelé.`,
      evidence: [
        {
          id: 'plainte', type: 'plainte', title: 'Plainte de la société (extrait)', date: w.at(1 * 24), author: `${cto.name} — ${company}`,
          body:
            `« Notre hot wallet ${A(w, H)} sert aux retraits de nos clients. Le ${d(hack.time)}, une transaction que nous n'avons pas initiée en a fait sortir ${amt(S, 'ETH')} :\n${hack.hash}\n\n` +
            `L'analyse préliminaire montre que la clé privée a été copiée depuis un serveur de signature exposé. Nous avons migré les fonds restants vers un nouveau portefeuille. »`,
        },
        {
          id: 'retraits', type: 'email', title: 'Précision du responsable conformité', date: w.at(2 * 24), author: `Conformité — ${company}`,
          body:
            `Pour faciliter vos recherches : les retraits clients légitimes du hot wallet sont plafonnés à 25 ETH par opération et passent tous par notre outil de paiement. Toute sortie supérieure est anormale. Nous tenons la liste des retraits légitimes à votre disposition.`,
        },
        {
          id: 'forum', type: 'forum', title: 'Fil d\'un analyste on-chain', date: w.at(10 * 24), author: handle,
          body:
            `Le pirate de ${company} n'a pas tout bougé d'un coup. Une partie est partie vers une autre adresse qui avait DÉJÀ une position sur Aave, ouverte des semaines avant le hack 👀 Dépôt d'ETH en garantie, emprunt d'USDC, puis remboursement quelques jours plus tard. Classique pour obtenir des stablecoins sans vendre l'ETH volé.`,
        },
        {
          id: 'note', type: 'note', title: 'Note de la cellule d\'appui : prêts DeFi et traçage', date: w.at(10 * 24), author: 'Cellule d\'appui',
          body:
            `• supply / depositETH : l'actif entre dans le pool Aave, des aTokens (aWETH) sont créés au profit du déposant ; withdraw : les aTokens sont détruits et l'actif sort vers l'adresse « to », qui peut être une adresse neuve.\n` +
            `• borrow : l'actif emprunté sort de la réserve du pool. Il n'est pas « les fonds déposés » : la garantie reste dans le pool.\n` +
            `• Outil Traçage : lancé depuis la réception des fonds volés, il rattache un emprunt à la part marquée de la garantie de l'emprunteur. Utilisez la méthode « Prorata (haircut) » et les réglages par défaut ; le rapport doit préciser que ce rattachement est indirect.\n` +
            `• Aave est un protocole sans opérateur capable de bloquer une position.`,
        },
        {
          id: 'pv', type: 'pv', title: 'PV de renseignement : premières diligences', date: w.at(11 * 24), author: 'Enquêteur en charge',
          body:
            `Demande de préservation adressée aux exchanges susceptibles d'être concernés, en attente des adresses de dépôt exactes.\n` +
            `Les émetteurs de stablecoins (Circle pour l'USDC, Tether pour l'USDT) peuvent bloquer une adresse sur réquisition motivée, à condition que les jetons s'y trouvent encore.`,
        },
      ],
      seeds: [],
      objectives: [
        {
          id: 'o1', type: 'address', points: 7,
          prompt: 'Quelle adresse reçoit les ETH détournés du hot wallet ?',
          answer: [X],
          hint: 'Ouvrez la transaction citée dans la plainte.',
          explanation: `La transaction ${hack.hash.slice(0, 18)}…, signée avec la clé volée du hot wallet, envoie ${amt(S, 'ETH')} à ${A(w, X)}, adresse neuve. Le pirate y laisse finalement ${amt(xLeft, 'ETH')}, dormants : à signaler et à surveiller.`,
        },
        {
          id: 'o2', type: 'address', points: 9,
          prompt: 'Quelle adresse reçoit les USDC empruntés sur Aave ?',
          answer: [X2],
          hint: 'Suivez les ETH sortant de la première adresse du pirate, puis cherchez un appel borrow(...) sur le pool Aave : les USDC sortent du pool vers le signataire.',
          explanation: `${A(w, X2)} reçoit ${amt(T, 'ETH')} de la première adresse, les dépose en partie sur Aave puis appelle borrow ; le pool lui verse ${amt(B, 'USDC')}. Ce compte n'est pas neuf : il détenait déjà une position Aave, ouverte bien avant le piratage.`,
        },
        {
          id: 'o3', type: 'amount', points: 9, unit: 'ETH', tolerance: 0.01,
          prompt: 'Combien d\'ETH cette adresse dépose-t-elle en garantie sur Aave après le piratage ?',
          answer: Ts,
          hint: 'Cherchez l\'appel depositETH postérieur au piratage : l\'ETH part vers le pool, des aWETH sont créés au profit du déposant.',
          explanation: `Le ${d(supply1.time)}, depositETH dépose ${amt(Ts, 'ETH')} ; autant d'aWETH sont créés (événement Supply). S'y ajoutent ${amt(E0, 'ETH')} déposés le ${d(supply0.time)}, avant les faits : la garantie totale atteint ${amt(collTotal, 'ETH')}, dont ${Math.round((Ts / collTotal) * 100)} % provient du vol.`,
        },
        {
          id: 'o4', type: 'amount', points: 9, unit: 'USDC', tolerance: 0.01,
          prompt: 'Quel montant d\'USDC est emprunté contre cette garantie ?',
          answer: B,
          hint: 'Lisez l\'argument « amount » de l\'appel borrow(address,uint256,uint256,uint16,address), ou le transfert sortant du pool.',
          explanation: `borrow(USDC, ${amt(B, 'USDC')}, taux variable, 0, emprunteur) : ${amt(B, 'USDC')}, soit environ ${Math.round((B / usd('ETH', collTotal)) * 100)} % de la valeur de la garantie. Ces USDC sortent de la réserve du pool, alimentée par d'autres déposants : ce ne sont pas des ETH volés « convertis ».`,
        },
        {
          id: 'o5', type: 'choice', points: 9,
          prompt: 'Comment qualifier le lien entre les USDC empruntés et le vol ?',
          hint: 'D\'où viennent matériellement les USDC ? Qu\'est-ce qui a permis de les obtenir ? Et quelle part de la garantie provient du vol ?',
          ...choice(r,
            'Un lien indirect : les USDC sortent de la réserve d\'Aave mais ont été obtenus grâce à la garantie volée ; produit indirect, rattachable au prorata de la part volée de la garantie',
            [
              'Un lien direct : Aave a converti les ETH volés en USDC, comme le ferait un swap',
              'Aucun lien : un emprunt est un contrat licite qui rompt définitivement la traçabilité',
              'Un lien direct pour la totalité : toute la garantie est réputée volée, y compris les ETH déposés avant les faits',
            ]),
          explanation: `Les USDC n'ont jamais appartenu à ${company} : ils sortent d'une réserve commune. Mais le pirate ne les a obtenus qu'en immobilisant des ETH volés : c'est un produit indirect de l'infraction (le blanchiment, art. 324-1 du Code pénal, et la confiscation, art. 131-21, visent le produit « direct ou indirect »). La garantie comprend aussi ${amt(E0, 'ETH')} d'origine distincte : le rattachement doit se faire au prorata, et le rapport doit exposer ce raisonnement plutôt que présenter l'emprunt comme un flux.`,
        },
        {
          id: 'o6', type: 'entity', points: 8,
          prompt: 'Sur quel exchange les USDC empruntés sont-ils envoyés ?',
          answer: [exBKey],
          hint: 'Suivez la sortie d\'USDC de l\'emprunteur, quelques heures après l\'emprunt.',
          explanation: `Les ${amt(B, 'USDC')} partent vers une adresse de dépôt de ${exB.entity.name}, balayée vers son hot wallet. ${procedureFor(exB.entity)}`,
        },
        {
          id: 'o7', type: 'address', points: 8,
          prompt: 'Quelle adresse de dépôt citer dans la réquisition adressée à cet exchange ?',
          answer: [dep.deposit],
          hint: 'C\'est l\'adresse qui reçoit les USDC de l\'emprunteur, pas le hot wallet.',
          explanation: `${A(w, dep.deposit)} reçoit ${amt(B, 'USDC')} le ${d(dep.tx.time)} (transaction ${dep.tx.hash.slice(0, 14)}…). Elle désigne le compte client à identifier et, si le solde le permet, à geler.`,
        },
        {
          id: 'o8', type: 'entity', points: 8,
          prompt: 'De quelle plateforme proviennent les ETH de la garantie déposée avant le piratage ?',
          answer: [exAKey],
          hint: 'Remontez le premier financement de l\'adresse emprunteuse, des semaines avant les faits.',
          explanation: `${exA.entity.name} a versé ${amt(wA.transfers[0].value, 'ETH')} à ${A(w, X2).slice(0, 12)}… le ${d(wA.time)}. Ce retrait est rattaché à un compte client : piste d'identification de premier ordre, et explication de la part « propre » de la garantie. ${procedureFor(exA.entity)}`,
        },
        {
          id: 'o9', type: 'amount', points: 12, unit: 'USD', tolerance: 0.02,
          prompt: 'Avec l\'outil Traçage (méthode prorata, réglages par défaut), lancé depuis la réception des ETH volés, quelle valeur (USD) est rattachée au vol chez cet exchange ?',
          answer: attribUsd,
          hint: 'Clic droit sur la première adresse du pirate ▸ Tracer les fonds reçus (la réception du piratage), méthode « Prorata (haircut) ». Lisez la ligne de l\'exchange dans le tableau des destinations.',
          explanation: `L'outil attribue ${fmtUsd(attribUsd)} à ${exB.entity.name}, soit environ ${attribPct} % des ${amt(B, 'USDC')} empruntés : la garantie de l'emprunteur n'est marquée qu'à hauteur de la part issue du vol (${amt(Ts, 'ETH')} sur ${amt(collTotal, 'ETH')}). Le traceur signale ce rattachement comme un lien de garantie : un lien économique, indirect, qui doit figurer comme tel dans le rapport, avec la méthode employée.`,
        },
        {
          id: 'o10', type: 'tx', points: 9,
          prompt: 'Quelle transaction retire la garantie d\'Aave ?',
          answer: [withdraw.id],
          hint: 'Après le remboursement (repay), cherchez l\'appel withdraw(address,uint256,address) sur le pool : des aWETH sont détruits.',
          explanation: `Le ${d(withdraw.time)}, ${withdraw.hash.slice(0, 18)}… détruit ${amt(collTotal, 'aWETH')} et fait sortir ${amt(collTotal, 'ETH')} du pool. Elle n'est possible qu'après le remboursement : ${amt(repayAmt, 'USDC')} (capital et intérêts), obtenus en enveloppant ${amt(wrapAmt, 'ETH')} en WETH, en vendant ${amt(wSwap, 'WETH')} contre ${amt(sell.amountOut, 'USDC')} sur Uniswap et en redéroulant ${amt(unwrapAmt, 'WETH')} en ETH.`,
        },
        {
          id: 'o11', type: 'address', points: 9,
          prompt: 'Vers quelle adresse la garantie est-elle retirée ?',
          answer: [N],
          hint: 'Lisez l\'argument « to » de l\'appel withdraw, ou l\'événement Withdraw émis par le pool.',
          explanation: `L'argument to = ${A(w, N)} : une adresse neuve, sans historique, qui reçoit ${amt(collTotal, 'ETH')} directement du pool Aave. Sans lecture de l'appel, on pourrait croire que ces ETH viennent d'un tiers : la transaction est signée par l'emprunteur, et l'ETH sort du pool vers une autre adresse que la sienne.`,
        },
        {
          id: 'o12', type: 'choice', points: 9,
          prompt: 'À ce stade, que peut-on utilement faire geler ?',
          hint: 'Où se trouvent aujourd\'hui les USDC empruntés ? La position Aave existe-t-elle encore ? Un émetteur peut-il bloquer de l\'ETH ?',
          ...choice(r,
            'Le compte client crédité des USDC chez l\'exchange (réquisition, gel du solde) ; l\'ETH de l\'adresse de retrait ne peut être bloqué par aucun émetteur : surveillance et saisie si l\'on accède aux clés',
            [
              'La position de garantie sur Aave, en requérant le protocole',
              'Les USDC sur l\'adresse emprunteuse, en requérant Circle',
              'L\'ETH de l\'adresse de retrait, en requérant la fondation Ethereum',
            ]),
          explanation: `La position Aave est soldée (remboursée, garantie retirée) et aucun opérateur ne pourrait la bloquer. Les USDC empruntés ne sont plus sur l'adresse emprunteuse : ils ont été déposés chez ${exB.entity.name}, qui peut geler le compte client. L'ETH retiré vers ${A(w, N).slice(0, 12)}… est un actif natif sans émetteur : il faut surveiller l'adresse et agir dès qu'il rejoint un service, ou le saisir si l'enquête donne accès aux clés (perquisition, matériel du suspect).`,
        },
      ],
      truth: {
        path: [wA.id, supply0.id, hack.id, hop.id, supply1.id, borrow.id, dep.tx.id, ...(dep.sweep ? [dep.sweep.id] : []), topUp.id, wrapTx.id, sell.tx.id, unwrapTx.id, repay.id, withdraw.id],
        addresses: [X, X2, N, dep.deposit],
        debrief:
          `1. Avant les faits, ${A(w, X2)} reçoit ${amt(wA.transfers[0].value, 'ETH')} de ${exA.entity.name} et en dépose ${amt(E0, 'ETH')} en garantie sur Aave.\n` +
          `2. Le pirate vide le hot wallet de ${company} (${amt(S, 'ETH')}) vers ${A(w, X)}, puis transfère ${amt(T, 'ETH')} à ${A(w, X2).slice(0, 12)}….\n` +
          `3. ${A(w, X2).slice(0, 12)}… dépose ${amt(Ts, 'ETH')} volés en garantie (total ${amt(collTotal, 'ETH')}) et emprunte ${amt(B, 'USDC')}, aussitôt déposés sur ${exB.entity.name} (${A(w, dep.deposit)}).\n` +
          `4. Quelques jours plus tard, il reçoit ${amt(top, 'ETH')} de la première adresse, enveloppe ${amt(wrapAmt, 'ETH')} en WETH, en vend ${amt(wSwap, 'WETH')} contre des USDC, redéroule le reste, rembourse ${amt(repayAmt, 'USDC')} et retire toute sa garantie vers ${A(w, N)}.\n` +
          `5. L'outil de traçage (prorata) rattache ${fmtUsd(attribUsd)} des USDC déposés chez ${exB.entity.name} au vol, par le lien de garantie.\n\n` +
          `À retenir : un prêt DeFi crée une rupture apparente. Les fonds empruntés sortent de la réserve du protocole, pas des dépôts de l'emprunteur ; ils restent un produit indirect du vol, rattachable au prorata de la garantie marquée, ce que le rapport doit exposer comme un lien économique et non comme un flux. Le retrait de garantie peut viser une adresse neuve : lire l'argument « to ». Côté gel, seuls les acteurs centralisés (exchange, émetteur de stablecoin tant que les jetons sont sur l'adresse) peuvent agir.`,
      },
      hints: [
        'Partez de la transaction de la plainte, puis suivez les ETH du pirate : une partie part vers une adresse qui connaît déjà Aave.',
        'Sur Aave, lisez les appels : depositETH (garantie), borrow (emprunt), repay (remboursement), withdraw (retrait, argument « to »).',
        'La garantie de l\'emprunteur mélange des ETH volés et des ETH plus anciens : remontez l\'origine de ces derniers.',
        'Lancez l\'outil Traçage depuis la réception du piratage par la première adresse du pirate, méthode prorata : regardez les destinations.',
        'Pour rembourser, le pirate passe par le WETH : deposit(), swap sur Uniswap, withdraw() du reste.',
        'Le gel suppose un acteur capable d\'agir : qui détient aujourd\'hui les USDC empruntés ?',
      ],
    }
  },
}
