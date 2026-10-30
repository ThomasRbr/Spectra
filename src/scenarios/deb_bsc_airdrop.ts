import { World, type Tx } from '../engine/world'
import { exchange, HOUR, DAY } from '../engine/patterns'
import { roundAsset } from '../engine/chains'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, fakeCity, fakePerson, fmtDate, procedureFor } from './util'

// Faux airdrop sur BNB Smart Chain : la victime paie des « frais » en BNB
// (natif) et en USDT (BEP-20). L'adresse 0x de l'escroc existe aussi sur
// Ethereum (même clé), presque vide : le piège est de chercher sur la mauvaise
// chaîne. Avant de déposer sur un exchange, l'escroc met une partie des USDT
// de côté sur un compte de réserve, où ils dorment encore (gelables).

const TOKENS = ['MOONX', 'BNBAI', 'PEPEGOLD', 'SAFEDOGE', 'METAPAW', 'QUANTA'] as const

const bnb = (v: number) => roundAsset('BNB', v)
const usdt = (v: number) => roundAsset('USDT', v)

export const debBscAirdrop: ScenarioTemplate = {
  id: 'deb-bsc-airdrop',
  title: 'BNB Chain : le faux airdrop',
  tagline: 'Même format d\'adresse qu\'Ethereum, mais une autre blockchain.',
  description:
    'Pour « débloquer » un airdrop imaginaire, une victime a payé des frais en BNB puis en USDT sur BNB Smart Chain. Mesurez le nombre de victimes et les sommes collectées, suivez les deux actifs jusqu\'à l\'exchange, repérez les USDT mis de côté par l\'escroc, apprenez à distinguer la monnaie native d\'un jeton BEP-20, et évitez le piège classique des adresses 0x présentes sur plusieurs chaînes.',
  difficulty: 1,
  chains: ['bsc'],
  skills: ['lecture_tx', 'evm', 'tokens', 'exchange_id', 'typologies'],
  estMinutes: 30,
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
    const reserve = w.addr('bsc', { entity: scamE })
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
    const nVictims = nOthers + 1
    const totalUsdt = usdt(w.balanceOf(s1, 'USDT'))

    // ── Mise de côté sur un compte de réserve ───────────────────────────────
    const reserveV = usdt(Math.round((totalUsdt * r.float(0.15, 0.25)) / 10) * 10)
    const reserveTx = w.transfer({ time: u2T + Math.round(r.float(0.5, 2.5) * HOUR), from: s1, to: reserve, value: reserveV, asset: 'USDT' })
    path.push(reserveTx)

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
    const views = r.int(18, 60) * 1000
    const domainDays = r.int(2, 6)

    return {
      world: w,
      title: `Faux airdrop ${token} — ${city}`,
      briefing:
        `${victimName}, demeurant à ${city}, dépose plainte pour escroquerie. Sur un réseau social, une publicité annonçait un « airdrop » du jeton ${token} : ${promised.toLocaleString('fr-FR')} $ offerts aux premiers inscrits. Pour « réclamer » ses jetons, ${g('il', 'elle')} a dû payer des frais de gas en BNB, puis des « frais de déblocage » en USDT. Les jetons ne sont jamais arrivés.\n\n` +
        `Les paiements ont été faits sur BNB Smart Chain (BSC), une blockchain compatible avec Ethereum (EVM) : mêmes adresses en 0x…, même fonctionnement par comptes, mais un registre distinct, avec sa propre monnaie native (le BNB) et ses jetons au standard BEP-20.\n\n` +
        `Votre mission : identifier le compte de l'escroc sur la bonne chaîne, mesurer le nombre de victimes et les sommes collectées, puis suivre toutes les sorties : l'exchange, mais aussi ce qui pourrait encore être gelé.`,
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
        {
          id: 'osint', type: 'osint', title: 'Recherche en sources ouvertes — site et publicité', date: depT + 2 * DAY, author: 'Cellule d\'appui',
          body:
            `Nom de domaine du faux site enregistré ${domainDays} jours avant les faits, via un bureau d'enregistrement étranger, coordonnées du titulaire masquées.\n` +
            `La publicité a été diffusée environ ${views.toLocaleString('fr-FR')} fois avant son retrait par le réseau social.\n` +
            `Plusieurs commentaires sous la publicité signalent une arnaque après paiement des « frais ».\n\n` +
            `Rappel : sur ce type d'arnaque, l'escroc ne dépose pas toujours tout sur un exchange. Vérifier toutes les sorties du compte.`,
        },
      ],
      seeds: [victim],
      objectives: [
        {
          id: 'o1', type: 'address', points: 10,
          prompt: 'Quel compte de l\'escroc, sur BNB Smart Chain, a reçu les paiements de la victime ?',
          answer: [s1],
          hint: 'Dépliez les sorties du portefeuille de la victime (qui est sur BSC). La recherche (Ctrl K) peut proposer la même adresse sur deux chaînes : vérifiez l\'étiquette de chaîne.',
          explanation: `${A(w, s1)} sur BNB Smart Chain. Le site présente une adresse de « contrat de distribution », mais c'est un simple compte externe (EOA) contrôlé par l'escroc. La même adresse existe sur Ethereum, avec une activité ancienne et minime : ce n'est pas là que les fonds ont circulé.`,
        },
        {
          id: 'o6', type: 'number', points: 9, tolerance: 0, unit: 'victimes',
          prompt: 'Combien de portefeuilles distincts (celui de la victime compris) ont payé le compte de l\'escroc sur BSC ?',
          answer: nVictims,
          hint: 'Listez les transferts entrants du compte de l\'escroc sur BSC et comptez les adresses émettrices différentes. Chaque victime paie en BNB puis en USDT : ne comptez pas deux fois la même.',
          explanation: `${nVictims} portefeuilles : ${victimName} et ${nOthers} autres, qui suivent tous le même schéma (un petit montant de BNB « pour le gas », puis des USDT « de déblocage »). Ce schéma répété est la signature de l'arnaque et une estimation minimale du nombre de victimes, à transmettre au parquet. On compte des portefeuilles, pas des transactions.`,
        },
        {
          id: 'o7', type: 'amount', points: 9, unit: 'USDT', tolerance: 0.01,
          prompt: 'Quel montant total d\'USDT le compte de l\'escroc a-t-il reçu des victimes ?',
          answer: totalUsdt,
          hint: 'Additionnez les transferts entrants d\'USDT (pas de BNB), ou lisez le total reçu en USDT dans le résumé du compte.',
          explanation: `${amt(totalUsdt, 'USDT')}, dont ${amt(paidUsdt, 'USDT')} versés par ${victimName}. C'est le préjudice global apparent en USDT ; les petits montants de BNB s'y ajoutent, mais se suivent et se chiffrent séparément (autre actif).`,
        },
        {
          id: 'o5', type: 'choice', points: 8,
          prompt: 'La victime a payé en BNB puis en USDT. Quelle est la différence entre les deux ?',
          hint: 'Ouvrez une transaction d\'USDT : dans quelle monnaie les frais (gas) sont-ils payés ?',
          ...choice(r,
            'Le BNB est la monnaie native qui paie le gas ; l\'USDT est un jeton BEP-20',
            [
              'Le BNB est un jeton BEP-20 émis par Tether ; l\'USDT est la monnaie native',
              'Aucune : sur BNB Smart Chain, tous les actifs sont des monnaies natives',
              'L\'USDT BEP-20 devient de l\'USDT Ethereum dès qu\'il arrive chez l\'escroc',
            ]),
          explanation: 'Comme l\'ETH sur Ethereum, le BNB est l\'actif natif de BSC : il paie les frais (gas) de toutes les transactions, y compris les transferts de jetons. L\'USDT BEP-20 est un jeton géré par un smart contract (équivalent de l\'ERC-20). Les deux se suivent séparément ; l\'USDT a un émetteur (Tether) capable de geler des jetons encore présents sur une adresse.',
        },
        {
          id: 'o4', type: 'choice', points: 8,
          prompt: 'Que répondre au collègue qui ne trouve presque rien sur Etherscan ?',
          hint: 'Sur quelle chaîne le portefeuille de la victime et la capture du site sont-ils réglés ?',
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
          id: 'o10', type: 'address', points: 10,
          prompt: 'Avant de déposer sur un exchange, l\'escroc met des USDT de côté sur un autre compte non étiqueté. Lequel ?',
          answer: [reserve],
          hint: 'Classez les sorties d\'USDT du compte de l\'escroc par date : la première ne va pas vers une adresse qui reverse tout à un hot wallet.',
          explanation: `Le ${fmtDate(reserveTx.time)}, ${amt(reserveV, 'USDT')} partent vers ${A(w, reserve)}, qui ne les déplace plus : ce n'est pas une adresse de dépôt d'exchange (elle ne reverse rien à un hot wallet), mais un compte de réserve contrôlé par l'escroc. C'est une cible prioritaire : les USDT y sont encore, donc gelables.`,
        },
        {
          id: 'o11', type: 'amount', points: 9, unit: 'USDT', tolerance: 0.01,
          prompt: 'Combien d\'USDT dorment sur ce compte de réserve ?',
          answer: reserveV,
          hint: 'Lisez le solde USDT du compte de réserve dans son résumé, ou le montant du transfert qui l\'a alimenté.',
          explanation: `${amt(reserveV, 'USDT')}, soit environ ${Math.round((reserveV / totalUsdt) * 100)} % des USDT collectés. C'est le montant à citer dans la demande de gel adressée à l'émetteur, avec l'adresse et le hash du transfert.`,
        },
        {
          id: 'o2', type: 'entity', points: 9,
          prompt: 'Sur quelle plateforme l\'escroc a-t-il déposé le reste des fonds ?',
          answer: [destKey],
          hint: 'Suivez les sorties du compte de l\'escroc sur BSC : l\'USDT et le BNB partent vers la même adresse, qui reverse tout à un hot wallet étiqueté.',
          explanation: `L'USDT puis le BNB arrivent sur l'adresse de dépôt ${A(w, deposit)}, aussitôt balayée vers le hot wallet de ${destName}. ${procedureFor(dest.entity)}`,
        },
        {
          id: 'o9', type: 'address', points: 9,
          prompt: 'Quelle adresse de dépôt de cette plateforme faut-il citer dans la réquisition ?',
          answer: [deposit],
          hint: 'C\'est l\'adresse qui reçoit les fonds du compte de l\'escroc, pas le hot wallet vers lequel elle les reverse.',
          explanation: `${A(w, deposit)} : sur les chaînes à comptes, chaque client d'un exchange reçoit sa propre adresse de dépôt, que la plateforme rattache à son compte. Citer le hot wallet ne servirait à rien : il regroupe les fonds de tous les clients. La réquisition mentionne l'adresse de dépôt, les hash des deux transferts (USDT et BNB), leurs dates et montants.`,
        },
        {
          id: 'o3', type: 'amount', points: 9, unit: 'USDT', tolerance: 0.01,
          prompt: 'Combien d\'USDT (BEP-20) l\'escroc a-t-il déposés sur cette plateforme ?',
          answer: usdtDep,
          hint: 'Ouvrez le transfert d\'USDT vers l\'adresse de dépôt. Ne confondez pas avec le transfert de BNB, qui suit de peu.',
          explanation: `${amt(usdtDep, 'USDT')} : plus que les ${amt(paidUsdt, 'USDT')} versés par ${victimName}, car ${nOthers} autres victimes ont payé le même compte. Le BNB fait l'objet d'un transfert séparé vers la même adresse de dépôt.`,
        },
        {
          id: 'o8', type: 'amount', points: 8, unit: 'BNB', tolerance: 0.01,
          prompt: 'Et combien de BNB l\'escroc a-t-il déposés sur la même adresse de dépôt ?',
          answer: bnbDep,
          hint: 'Le second transfert vers l\'adresse de dépôt porte sur l\'actif natif : lisez sa valeur en BNB.',
          explanation: `${amt(bnbDep, 'BNB')}, issus des « frais de gas » payés par les victimes. L'escroc garde un peu de BNB sur son compte : sans BNB, il ne pourrait plus payer le gas de ses transferts d'USDT. Petit montant, mais à citer : il complète le préjudice et confirme que les deux actifs vont au même compte client.`,
        },
        {
          id: 'o12', type: 'choice', points: 8,
          prompt: 'Quel est le bon réflexe pour les USDT encore présents sur le compte de réserve ?',
          hint: 'Ce compte n\'appartient à aucune plateforme : qui a la main sur le jeton lui-même ?',
          ...choice(r,
            'Demander sans attendre à Tether, l\'émetteur de l\'USDT, le gel des jetons présents sur ce compte',
            [
              `Demander à ${destName} de geler le compte de réserve, puisque l'escroc y a aussi un compte client`,
              'Demander aux validateurs de BNB Smart Chain d\'annuler le transfert vers le compte de réserve',
              'Attendre la réponse de l\'exchange : le gel n\'est possible qu\'une fois l\'auteur identifié',
            ]),
          explanation: `Le compte de réserve ${A(w, reserve)} est un portefeuille contrôlé par l'escroc, pas un compte d'exchange : ${destName} n'a aucune prise dessus. L'émetteur de l'USDT peut en revanche bloquer les jetons présents sur une adresse, sur demande motivée via son portail dédié aux forces de l'ordre (adresse, solde, hash, contexte). C'est une mesure conservatoire volontaire de l'émetteur, qui n'attend pas l'identification ; la saisie suit ensuite les règles applicables. Une transaction confirmée ne s'annule pas.`,
        },
      ],
      truth: {
        path: path.map((t) => t.id),
        addresses: [s1, deposit, reserve, s1eth],
        debrief:
          `1. ${victimName} paie ${amt(b1, 'BNB')} (monnaie native, « frais de gas ») puis ${amt(u1, 'USDT')} et ${amt(u2, 'USDT')} (jeton BEP-20) au compte ${A(w, s1)} sur BNB Smart Chain.\n` +
          `2. ${nOthers} autres victimes paient le même compte, selon le même schéma : ${nVictims} portefeuilles, ${amt(totalUsdt, 'USDT')} collectés.\n` +
          `3. Peu après le dernier paiement de la victime, l'escroc met ${amt(reserveV, 'USDT')} de côté sur un compte de réserve ${A(w, reserve)}, où ils sont toujours.\n` +
          `4. Il dépose ensuite ${amt(usdtDep, 'USDT')} puis ${amt(bnbDep, 'BNB')} sur l'adresse de dépôt ${destName} ${A(w, deposit)}, aussitôt balayée.\n` +
          `5. Sur Ethereum, la même adresse n'a reçu qu'un petit montant d'ETH il y a longtemps (${ethOld.hash.slice(0, 10)}…) : même clé, autre registre.\n\n` +
          `À retenir : une adresse 0x ne dit pas sur quelle chaîne se trouvent les fonds. Identifiez toujours la chaîne (portefeuille de la victime, mention BEP-20/ERC-20, explorateur) avant de tracer. Et examinez toutes les sorties : ce qui n'est pas parti vers un exchange peut encore être gelé.\n\n` +
          `Réflexes de l'enquêteur : demander à Tether le gel des USDT du compte de réserve ; requérir ${destName} sur l'adresse de dépôt avec demande de gel ; noter que le même compte existe sur Ethereum (piste complémentaire) ; signaler le faux site et la publicité à la plateforme qui l'a diffusée.`,
      },
      hints: [
        'Partez du portefeuille de la victime, déjà sur BNB Smart Chain : dépliez ses sorties.',
        'Le même texte d\'adresse peut correspondre à deux nœuds (Ethereum et BSC) : regardez la chaîne affichée dans le panneau de droite.',
        'Les entrées du compte de l\'escroc racontent combien de victimes il a faites ; ses sorties, où vont les fonds.',
        'Suivez séparément le BNB et l\'USDT : une partie des USDT ne va pas vers l\'exchange.',
      ],
    }
  },
}
