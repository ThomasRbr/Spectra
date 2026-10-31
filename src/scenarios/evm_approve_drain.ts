import { World } from '../engine/world'
import { dex, exchange, DAY, HOUR } from '../engine/patterns'
import { aggregator, approve, failedTx, forwarderExchange, permit, transferFrom } from '../engine/defi'
import { tokenContract } from '../engine/evm'
import { fromUsd, roundAsset, type AssetId } from '../engine/chains'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, fakeCity, fakeHandle, fakePerson, fmtDate, procedureFor } from './util'

const MIN = 60

export const evmApproveDrain: ScenarioTemplate = {
  id: 'approve-drain',
  title: 'L\'autorisation piégée',
  tagline: 'Une « vérification de portefeuille », un approve illimité, une signature permit… et un transferFrom signé par l\'attaquant.',
  description:
    'Un faux site de « vérification de portefeuille » fait signer des autorisations de dépense. Une victime accorde un approve illimité, une autre ne signe qu\'un message permit que l\'attaquant publie lui-même. Des heures plus tard, l\'attaquant vide les comptes par transferFrom, convertit le butin via 1inch à travers plusieurs pools et dépose le reste sur un exchange dont les adresses de dépôt sont des contrats. Lisez les appels décodés : spender, signataire, owner, pools, statut d\'échec.',
  difficulty: 3,
  chains: ['eth'],
  skills: ['evm', 'tokens', 'defi', 'dex', 'typologies', 'exchange_id', 'gel'],
  estMinutes: 45,
  lessons: ['calldata-selecteurs', 'drainers-approvals', 'agregateurs-routeurs', 'contrats-depot-create2'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const v1P = fakePerson(r)
    const v2P = fakePerson(r)
    const city = fakeCity(r)
    const city2 = fakeCity(r)
    const domain = r.pick(['veriflow-wallet.app', 'walletguard-check.io', 'secure-dappsync.net', 'chainvalid-portal.com'])

    // ── Acteurs ──────────────────────────────────────────────────────────────
    const uni = dex(w, 'uniswap', 'eth')
    const agg = aggregator(w, 'oneinch', 'eth', uni)
    const exKey = r.pick(['coinbase', 'kraken', 'okx', 'bitstamp'] as const)
    const fx = forwarderExchange(w, exKey, 'eth')
    const ch = exchange(w, 'coinhouse', 'eth')
    const bn = exchange(w, exKey === 'okx' ? 'binance' : 'okx', 'eth')

    const atkE = w.customEntity({ name: `Opérateur du faux site ${domain} (inconnu)`, category: 'scam' })
    const S = w.addr('eth', { entity: atkE }) // spender des autorisations
    const G = w.addr('eth', { entity: atkE }) // publie les permits, paie le gas
    const R = w.addr('eth', { entity: atkE }) // reçoit les jetons volés

    const v1E = w.customEntity({ name: v1P.name, category: 'victim' })
    const v2E = w.customEntity({ name: v2P.name, category: 'victim' })
    const v3E = w.customEntity({ name: 'Victime évitée (signalement)', category: 'individual' })
    const V1 = w.addr('eth', { entity: v1E })
    const V2 = w.addr('eth', { entity: v2E })
    const V3 = w.addr('eth', { entity: v3E })

    // ── Préparation de l'attaquant ───────────────────────────────────────────
    w.fundAccount(G, roundAsset('ETH', r.float(0.4, 1.1)), 'ETH', w.at(-r.float(8, 15) * 24))
    const gasS = w.transfer({ time: w.at(-r.float(3, 6) * 24), from: G, to: S, value: roundAsset('ETH', r.float(0.08, 0.2)), asset: 'ETH' })
    const gasR = w.transfer({ time: w.at(-r.float(1, 2.5) * 24), from: G, to: R, value: roundAsset('ETH', r.float(0.05, 0.12)), asset: 'ETH' })

    // ── Historique des victimes ──────────────────────────────────────────────
    const u1 = roundAsset('USDT', r.float(9000, 48000))
    ch.withdraw(V1, roundAsset('ETH', r.float(0.05, 0.3)), w.at(-r.int(60, 200) * 24))
    ch.withdraw(V1, u1, w.at(-r.int(10, 50) * 24), 'USDT')
    const c2 = roundAsset('USDC', r.float(6000, 30000))
    bn.withdraw(V2, roundAsset('ETH', r.float(0.03, 0.2)), w.at(-r.int(40, 160) * 24))
    bn.withdraw(V2, c2, w.at(-r.int(8, 40) * 24), 'USDC')
    const c3 = roundAsset('USDC', r.float(2000, 9000))
    bn.withdraw(V3, roundAsset('ETH', r.float(0.03, 0.1)), w.at(-r.int(30, 90) * 24))
    bn.withdraw(V3, c3, w.at(-r.int(5, 30) * 24), 'USDC')
    // Autorisations légitimes antérieures (routeurs connus)
    approve(w, { owner: V1, spender: uni.router, asset: 'USDT', value: roundAsset('USDT', r.float(100, 900)), time: w.at(-r.int(5, 9) * 24) })

    // ── Victime 1 : approve illimité, puis transferFrom ─────────────────────
    const ap1 = approve(w, { owner: V1, spender: S, asset: 'USDT', time: w.at(0) })
    const tf1 = transferFrom(w, { spender: S, owner: V1, to: R, value: u1, asset: 'USDT', time: w.at(r.float(5, 20)) })

    // ── Victime 2 : signature permit hors chaîne, publiée par G ──────────────
    const tSig = w.at(r.float(26, 40))
    const pm2 = permit(w, { owner: V2, spender: S, asset: 'USDC', submitter: G, time: tSig + r.int(4, 25) * MIN })
    const tf2 = transferFrom(w, { spender: S, owner: V2, to: R, value: c2, asset: 'USDC', time: pm2.time + r.int(1, 6) * MIN })

    // ── Victime 3 : approve, révocation à temps, transferFrom échoué ─────────
    const ap3 = approve(w, { owner: V3, spender: S, asset: 'USDC', time: w.at(r.float(44, 50)) })
    const revoke3 = approve(w, { owner: V3, spender: S, asset: 'USDC', value: 0, time: ap3.time + r.int(40, 180) * MIN })
    const usdcToken = tokenContract(w, 'eth', 'USDC')
    const fail3 = failedTx(w, {
      signer: S, to: usdcToken, time: revoke3.time + r.int(20, 120) * MIN, method: 'transferFrom', reason: 'ERC20: transfer amount exceeds allowance',
      call: { to: usdcToken, sig: 'transferFrom(address,address,uint256)', args: [{ addr: V3 }, { addr: R }, { amt: c3, asset: 'USDC' }] },
    })

    // ── Blanchiment : 1inch puis exchange à contrats de dépôt ────────────────
    const sw1 = agg.swap({ trader: R, route: ['USDT', 'USDC'], amountIn: u1, time: w.at(r.float(56, 62)) })
    const usdcAll = roundAsset('USDC', w.balanceOf(R, 'USDC'))
    const daiIn = roundAsset('USDC', usdcAll * r.float(0.3, 0.45))
    const sw2 = agg.swap({ trader: R, route: ['USDC', 'ETH', 'DAI'], amountIn: daiIn, time: w.at(r.float(63, 68)) })
    const daiOut = sw2.amountOut
    const toEx = roundAsset('USDC', w.balanceOf(R, 'USDC'))
    const dep = fx.receive(R, toEx, w.at(r.float(70, 80)), { asset: 'USDC', flushDelayH: r.float(1, 6) })

    // ── Bruit de fond ────────────────────────────────────────────────────────
    uni.noise(30, w.at(-3 * 24), w.at(6 * 24), [['ETH', 'USDC'], ['ETH', 'DAI'], ['ETH', 'USDT'], ['USDC', 'USDT']])
    const routes: AssetId[][] = [['USDC', 'ETH', 'DAI'], ['USDT', 'USDC'], ['ETH', 'USDC'], ['USDC', 'ETH'], ['DAI', 'ETH', 'USDT']]
    for (let i = 0; i < 18; i++) {
      const route = r.pick(routes)
      const a0 = route[0]
      const amountIn = roundAsset(a0, fromUsd(a0, r.float(300, 40000)))
      agg.swap({ trader: w.addr('eth'), route, amountIn, time: w.at(r.float(-3 * 24, 6 * 24)) })
    }
    for (let i = 0; i < 12; i++) {
      const u = w.addr('eth')
      approve(w, { owner: u, spender: r.pick([uni.router, agg.router]), asset: r.pick(['USDC', 'USDT', 'DAI'] as const), time: w.at(r.float(-4 * 24, 6 * 24)) })
    }
    fx.noise(22, w.at(-3 * 24), w.at(7 * 24), 'USDC')
    fx.noise(12, w.at(-3 * 24), w.at(7 * 24), 'ETH')
    ch.noise(8, w.at(-3 * 24), w.at(5 * 24), 'USDT')
    bn.noise(10, w.at(-3 * 24), w.at(5 * 24), 'USDC')

    const handle = fakeHandle(r)
    const exName = fx.entity.name
    const d = (ts: number) => fmtDate(ts)

    return {
      world: w,
      title: `Faux site de vérification « ${domain} »`,
      briefing:
        `${v1P.name} (${city}) a reçu un courriel l'avertissant que son portefeuille devait être « vérifié » pour rester actif. Sur le site ${domain}, ${v1P.g('il', 'elle')} a connecté son portefeuille et confirmé une transaction présentée comme une simple vérification. Ses USDT ont disparu le jour même. ${v2P.name} (${city2}) décrit le même site, mais affirme n'avoir signé aucune transaction.\n\n` +
        `Ces sites ne volent pas les fonds directement : ils font signer une autorisation de dépense (approve) ou une signature hors chaîne (permit). L'attaquant, devenu « spender », déplace ensuite les jetons quand il le veut par transferFrom, une transaction qu'il signe lui-même. L'inspecteur décode chaque appel : fonction, arguments, signataire, journaux d'événements, statut.\n\n` +
        `Objectifs : identifier le spender et les comptes de l'attaquant, retrouver la transaction qui a réellement vidé chaque victime, comprendre la signature permit, lire l'échec d'une tentative, puis suivre le butin à travers l'agrégateur 1inch jusqu'au contrat de dépôt de l'exchange.`,
      evidence: [
        {
          id: 'plainte', type: 'plainte', title: 'Procès-verbal de plainte (extrait)', date: w.at(4 * 24), author: v1P.name,
          body:
            `« Le site m'a demandé de cliquer sur "Vérifier mon portefeuille". Mon portefeuille m'a montré une demande que j'ai acceptée, il était écrit quelque chose comme "Autoriser l'accès à vos USDT". Le site a affiché "Portefeuille vérifié ✅". Le soir même, mon solde d'USDT était à zéro, alors que je n'ai rien envoyé.\n\n` +
            `Mon adresse : ${A(w, V1)}\n` +
            `La transaction que j'ai signée : ${ap1.hash} »`,
        },
        {
          id: 'courriel', type: 'email', title: 'Courriel d\'hameçonnage reçu par la victime', date: w.at(-6), author: `Support <no-reply@${domain}>`,
          body:
            `Objet : Action requise — vérification de votre portefeuille\n\n` +
            `Suite à la nouvelle réglementation européenne, tous les portefeuilles doivent être vérifiés avant le ${fmtDate(w.at(3 * 24), false)}.\n` +
            `Sans vérification, vos actifs pourraient être temporairement inaccessibles.\n\n` +
            `[ Vérifier mon portefeuille ] → https://${domain}/verify\n\n` +
            `Cette opération est gratuite et ne prend qu'une minute.`,
        },
        {
          id: 'rapprochement', type: 'email', title: 'Message d\'une brigade (plainte similaire)', date: w.at(6 * 24), author: `Brigade de gendarmerie de ${city2}`,
          body:
            `Bonjour,\n\n${v2P.name}, adresse ${A(w, V2)}, a perdu ${amt(c2, 'USDC')} le ${fmtDate(tf2.time, false)} après être ${v2P.g('passé', 'passée')} sur ${domain}. ${v2P.g('Il', 'Elle')} est formel${v2P.g('', 'le')} : ${v2P.g('il', 'elle')} n'a validé qu'une « signature de connexion », sans frais de gas, et son adresse n'a jamais signé la moindre transaction.\n\n` +
            `Un outil de contrôle des autorisations lui indique une autorisation illimitée sur ses USDC, créée par la transaction ${pm2.hash}.\n\nPouvez-vous nous éclairer ?\nCordialement`,
        },
        {
          id: 'forum', type: 'forum', title: 'Publication sur un forum de sécurité Web3', date: w.at(5 * 24), author: handle,
          body:
            `PSA : ${domain} est un drainer. J'ai signé leur "vérification" puis j'ai vu passer une alerte sur ce site deux heures après. J'ai révoqué l'autorisation tout de suite (approve à 0). Je crois que j'ai eu de la chance, mes USDC sont toujours là.\n` +
            `Mon adresse : ${A(w, V3)}`,
        },
        {
          id: 'note', type: 'note', title: 'Note de la cellule d\'appui : stablecoins et gel', date: w.at(6 * 24), author: 'Cellule d\'appui',
          body:
            `• USDT (Tether) et USDC (Circle) : l'émetteur peut placer une adresse sur liste noire à la demande motivée des autorités.\n` +
            `• DAI : stablecoin décentralisé, sans émetteur capable de geler une adresse.\n` +
            `• Fonds déposés sur un exchange : requérir la plateforme sur l'adresse de dépôt et les hash des dépôts.`,
        },
      ],
      seeds: [],
      objectives: [
        {
          id: 'o1', type: 'address', points: 9,
          prompt: 'Quelle adresse figure comme « spender » dans l\'autorisation signée par la plaignante ?',
          answer: [S],
          hint: 'Ouvrez la transaction citée dans la plainte : la rubrique « Appel de contrat » décode approve(address,uint256) et son premier argument.',
          explanation: `La plaignante appelle approve(address,uint256) sur le contrat USDT. Le premier argument, spender, est ${A(w, S)} : ce compte peut désormais déplacer ses USDT sans nouvelle signature de sa part. L'événement Approval émis par le contrat USDT reprend owner, spender et montant.`,
        },
        {
          id: 'o2', type: 'choice', points: 7,
          prompt: 'Le second argument de cet approve vaut 2²⁵⁶−1. Que signifie cette valeur ?',
          hint: 'Lisez l\'aide affichée sous la fonction décodée et la valeur de l\'argument « value ».',
          ...choice(r,
            'Une autorisation illimitée : le spender peut prélever tous les USDT présents et futurs de l\'adresse, sans limite de montant ni de durée',
            [
              'Un montant symbolique qui ne permet de prélever que les frais de vérification',
              'Une autorisation valable une seule fois, qui expire après le premier prélèvement',
              'Un code d\'erreur : l\'autorisation n\'a pas été enregistrée par le contrat',
            ]),
          explanation: `2²⁵⁶−1 est la plus grande valeur d'un uint256 : les portefeuilles et les dApps l'utilisent pour une autorisation « illimitée ». Elle reste active jusqu'à sa révocation (approve à 0), y compris pour des jetons reçus plus tard. C'est pourquoi un drainer peut attendre avant de frapper.`,
        },
        {
          id: 'o3', type: 'tx', points: 10,
          prompt: 'Quelle transaction a réellement fait sortir les USDT de la plaignante ?',
          answer: [tf1.id],
          hint: 'Ce n\'est pas la transaction signée par la victime. Cherchez, dans la liste des transactions de son adresse, la sortie d\'USDT.',
          explanation: `La transaction ${tf1.hash.slice(0, 18)}… (${d(tf1.time)}) appelle transferFrom(address,address,uint256) sur le contrat USDT : from = la plaignante, to = ${A(w, R).slice(0, 12)}…, value = ${amt(u1, 'USDT')}. L'approve n'a déplacé aucun fonds : il a seulement ouvert le droit de le faire.`,
        },
        {
          id: 'o4', type: 'choice', points: 8,
          prompt: 'Qui a signé cette transaction transferFrom ?',
          hint: 'Comparez le signataire (« De ») de la transaction avec les arguments from et to de l\'appel.',
          ...choice(r,
            'Le spender de l\'autorisation : la victime n\'a rien signé pour ce prélèvement',
            [
              'La victime, à son insu, au moment où elle a validé la « vérification »',
              'Le contrat USDT lui-même, qui exécute automatiquement les autorisations',
              'L\'adresse qui reçoit les jetons, seule habilitée à les réclamer',
            ]),
          explanation: `transferFrom est signé par ${A(w, S).slice(0, 12)}…, le spender, qui paie le gas. Le contrat USDT vérifie l'autorisation puis débite la victime. Juridiquement, c'est l'acte de soustraction : il est signé par la clé de l'attaquant, des heures après la « vérification », ce qui le distingue d'une remise volontaire.`,
        },
        {
          id: 'o5', type: 'address', points: 8,
          prompt: 'Vers quelle adresse les jetons prélevés sont-ils envoyés ?',
          answer: [R],
          hint: 'Lisez l\'argument « to » de l\'appel transferFrom, ou l\'événement Transfer.',
          explanation: `Les deux prélèvements (USDT de la plaignante, USDC de ${v2P.name}) aboutissent sur ${A(w, R)}. L'attaquant sépare les rôles : un compte pour les autorisations, un pour recevoir, un pour payer le gas. Les trois ont été approvisionnés en ETH par la même adresse ${A(w, G).slice(0, 12)}…, ce qui les rattache au même opérateur.`,
        },
        {
          id: 'o6', type: 'address', points: 9,
          prompt: 'Quel compte a publié sur la chaîne l\'autorisation de la seconde victime ?',
          answer: [G],
          hint: 'Ouvrez la transaction citée par la brigade : qui la signe ? Comparez avec les arguments owner et spender de l\'appel.',
          explanation: `La transaction ${pm2.hash.slice(0, 18)}… appelle permit(owner, spender, value, deadline, v, r, s) sur le contrat USDC. Elle est signée par ${A(w, G)}, qui en paie le gas ; owner = ${v2P.name}, spender = ${A(w, S).slice(0, 12)}…. Les arguments v, r, s portent la signature de la victime, obtenue hors chaîne. ${A(w, G).slice(0, 12)}… a aussi financé en gas le spender et le receveur.`,
        },
        {
          id: 'o7', type: 'choice', points: 8,
          prompt: `Pourquoi ${v2P.name} affirme-t-${v2P.g('il', 'elle')} de bonne foi n'avoir signé aucune transaction ?`,
          hint: 'Regardez quelles transactions apparaissent dans la liste de son adresse, puis relisez l\'aide de la fonction permit.',
          ...choice(r,
            'Une signature permit (EIP-2612) se fait hors chaîne, sans gas : c\'est l\'attaquant qui la publie, la victime n\'apparaît que comme argument « owner »',
            [
              'Sa clé privée a été volée : l\'attaquant a signé l\'autorisation à sa place',
              'L\'autorisation a été signée depuis un autre portefeuille de la victime',
              'L\'USDC ne nécessite aucune autorisation : n\'importe qui peut transférer les jetons d\'autrui',
            ]),
          explanation: `Avec permit, le titulaire signe un message structuré (pas une transaction) que son portefeuille présente parfois comme une simple connexion. N'importe qui peut ensuite le publier : ici ${A(w, G).slice(0, 12)}…. L'autorisation ne figure pas dans la liste des transactions de la victime, seulement le prélèvement de ${amt(c2, 'USDC')} par transferFrom. Seule la lecture des arguments du permit établit le lien.`,
        },
        {
          id: 'o8', type: 'amount', points: 10, unit: 'DAI', tolerance: 0.01,
          prompt: 'Combien de DAI l\'attaquant obtient-il par son swap multi-pools sur 1inch ?',
          answer: daiOut,
          hint: 'Parmi les transactions de l\'adresse receveuse, cherchez l\'appel unoswap dont la liste « pools » compte deux pools. Le DAI revient au signataire en fin de route.',
          explanation: `La transaction ${sw2.tx.hash.slice(0, 18)}… appelle unoswap sur le routeur 1inch avec ${amt(daiIn, 'USDC')} et une liste de deux pools : USDC → ETH (pool ETH/USDC), puis ETH → DAI (pool DAI/ETH). Le routeur détient l'actif intermédiaire entre les deux étapes ; le receveur obtient ${amt(daiOut, 'DAI')}. Auparavant, un premier unoswap à un seul pool a converti les ${amt(u1, 'USDT')} volés en ${amt(sw1.amountOut, 'USDC')}. Ces DAI restent sur ${A(w, R).slice(0, 12)}… : aucun émetteur ne peut les geler, il faut surveiller l'adresse.`,
        },
        {
          id: 'o9', type: 'address', points: 9,
          prompt: 'Sur quelle adresse de dépôt l\'attaquant envoie-t-il les USDC restants ?',
          answer: [dep.deposit],
          hint: 'Suivez la dernière sortie d\'USDC du receveur : la destination est un contrat propre à un client, pas le hot wallet.',
          explanation: `Le ${d(dep.tx.time)}, ${amt(toEx, 'USDC')} partent vers ${A(w, dep.deposit)}, contrat de dépôt (forwarder) de ${exName}. Les USDC y restent jusqu'au reversement (createForwarder, signé par le portefeuille opérationnel de la plateforme, le ${d(dep.flush!.time)}). C'est cette adresse, avec le hash du dépôt, qu'il faut citer dans la réquisition.`,
        },
        {
          id: 'o10', type: 'entity', points: 8,
          prompt: 'À quel exchange appartient cette adresse de dépôt ?',
          answer: [exKey],
          hint: 'Regardez l\'étiquette du contrat de dépôt, ou celle du hot wallet qui reçoit le reversement.',
          explanation: `Le contrat de dépôt est attribué à ${exName}. ${procedureFor(fx.entity)} Les USDC sont désormais dans la trésorerie de la plateforme : c'est le compte client qu'il faut faire geler, et non l'adresse auprès de Circle.`,
        },
        {
          id: 'o11', type: 'tx', points: 10,
          prompt: 'Une tentative de prélèvement de l\'attaquant a échoué. Quelle est cette transaction ?',
          answer: [fail3.id],
          hint: 'Parcourez les transactions signées par le spender : l\'une porte le statut « Échec (reverted) ». La victime visée n\'apparaît que dans les arguments.',
          explanation: `La transaction ${fail3.hash.slice(0, 18)}… (${d(fail3.time)}), signée par le spender, appelle transferFrom sur le contrat USDC avec from = ${A(w, V3).slice(0, 12)}… (l'auteur du signalement sur le forum) et value = ${amt(c3, 'USDC')}. Elle a échoué : aucun transfert, aucun événement, mais des frais payés.`,
        },
        {
          id: 'o12', type: 'choice', points: 8,
          prompt: 'Pourquoi cette tentative a-t-elle échoué, et qu\'en tirer ?',
          hint: 'Lisez le motif d\'échec, puis la liste des transactions de l\'adresse visée.',
          ...choice(r,
            'L\'autorisation avait été révoquée (approve à 0) : « transfer amount exceeds allowance ». La tentative prouve l\'intention de l\'attaquant mais aucun préjudice',
            [
              'Le solde de la victime était insuffisant : elle avait déjà été vidée par une autre transaction',
              'Circle avait gelé l\'adresse du spender, qui ne pouvait plus recevoir d\'USDC',
              'Le gas fourni était insuffisant : l\'attaquant a réussi au second essai',
            ]),
          explanation: `${A(w, V3).slice(0, 12)}… a signé l'approve le ${d(ap3.time)} puis l'a révoqué le ${d(revoke3.time)} (approve(spender, 0)). Le contrat USDC refuse donc le transferFrom : « ERC20: transfer amount exceeds allowance ». Pénalement, c'est une tentative (art. 121-5 du Code pénal), qui documente le mode opératoire et la persistance de l'attaquant ; la personne visée n'a subi aucune perte.`,
        },
      ],
      truth: {
        path: [gasS.id, gasR.id, ap1.id, tf1.id, pm2.id, tf2.id, ap3.id, revoke3.id, fail3.id, sw1.tx.id, sw2.tx.id, dep.tx.id, dep.flush!.id],
        addresses: [S, R, G, dep.deposit],
        debrief:
          `1. Préparation : ${A(w, G)} approvisionne en gas le spender ${A(w, S)} et le receveur ${A(w, R)}.\n` +
          `2. La plaignante signe approve(spender = ${A(w, S).slice(0, 12)}…, 2²⁵⁶−1) sur l'USDT. Le spender signe ensuite transferFrom et prélève ${amt(u1, 'USDT')} vers le receveur.\n` +
          `3. ${v2P.name} ne signe qu'un message permit, publié par ${A(w, G).slice(0, 12)}… ; le spender prélève ${amt(c2, 'USDC')} par transferFrom quelques minutes plus tard.\n` +
          `4. L'auteur du signalement sur le forum révoque son autorisation à temps : le transferFrom de l'attaquant échoue (« transfer amount exceeds allowance »).\n` +
          `5. Le receveur convertit les USDT en USDC (unoswap, un pool), puis ${amt(daiIn, 'USDC')} en ${amt(daiOut, 'DAI')} (unoswap, deux pools : USDC → ETH → DAI), et dépose ${amt(toEx, 'USDC')} sur le contrat de dépôt ${A(w, dep.deposit)} (${exName}).\n\n` +
          `À retenir : dans un drainer à autorisation, la victime signe l'autorisation (approve, ou permit hors chaîne), jamais le prélèvement. Le transferFrom est signé par le spender : c'est lui qu'il faut lire, ainsi que les arguments décodés (owner, spender, from, to). Les DAI sont hors de portée d'un gel ; les USDC déposés sur l'exchange se gèlent sur le compte client.`,
      },
      hints: [
        'Ouvrez la transaction de la plainte et lisez la rubrique « Appel de contrat » : fonction, spender, montant.',
        'La sortie des USDT de la victime figure dans sa liste de transactions, mais elle n\'est pas signée par elle.',
        'Pour la seconde victime, la transaction citée par la brigade n\'est pas signée par la victime : lisez signataire et arguments.',
        'Les transactions signées par le spender comprennent les prélèvements… et une tentative échouée.',
        'Un appel unoswap liste les pools traversés : comptez-les et suivez l\'actif reçu en fin de route.',
        'L\'adresse de dépôt de l\'exchange est un contrat : le reversement vers le hot wallet est signé par la plateforme.',
      ],
    }
  },
}
