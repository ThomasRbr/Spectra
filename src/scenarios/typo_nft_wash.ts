import { World, type Tx } from '../engine/world'
import { exchange, HOUR, DAY } from '../engine/patterns'
import { roundAsset, usd } from '../engine/chains'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, fakeCity, fakePerson, fmtDate, procedureFor } from './util'

// Blanchiment par wash trading de NFT sur une place de marché (Mosaïque,
// fictive). Une partie du butin d'un piratage DeFi (Lendora, fictif) finance
// des portefeuilles liés qui s'achètent et se revendent les mêmes NFT à des
// prix gonflés : les ventes passent par le contrat de la place de marché, qui
// reverse le prix au vendeur. Les fonds ressortent comme « produits de ventes
// NFT » et finissent sur un exchange. Le NFT n'est pas un actif du moteur :
// chaque vente est une transaction ETH vers le contrat, dont la méthode
// indique le tokenId.

const COLLECTIONS = ['Les Gargouilles', 'Pixels de Montmartre', 'Chimères Club', 'Les Vigies', 'Brume Genesis'] as const
const MP_FEE = 0.025
const ROYALTY = 0.025

const eth = (v: number) => roundAsset('ETH', v)
const pctFr = (f: number) => (f * 100).toLocaleString('fr-FR')
const usd0 = (v: number) => `${Math.round(v).toLocaleString('fr-FR')} $`

export const nftWash: ScenarioTemplate = {
  id: 'nft-wash',
  title: 'Wash trading de NFT : blanchir un piratage',
  tagline: 'Les mêmes NFT achetés et revendus en boucle entre portefeuilles liés, à des prix qui s\'envolent.',
  description:
    'Une partie du butin d\'un piratage DeFi finance une poignée de portefeuilles qui s\'échangent les mêmes NFT sur une place de marché, à des prix sans rapport avec le marché. Identifiez la source commune et les portefeuilles de wash trading, le NFT le plus « lavé », le montant ressorti sur un exchange et les indicateurs qui caractérisent le montage.',
  difficulty: 3,
  chains: ['eth'],
  skills: ['evm', 'defi', 'typologies', 'exchange_id', 'requisition'],
  estMinutes: 35,
  lessons: ['nft-fraudes', 'defi-exploits', 'comptes-evm', 'blanchiment-pro', 'requisitions'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const city = fakeCity(r)
    const collection = r.pick(COLLECTIONS)
    const artist = fakePerson(r)
    const cto = fakePerson(r)

    // ── Acteurs ──────────────────────────────────────────────────────────────
    const destKey = r.pick(['kraken', 'coinbase', 'binance', 'bitstamp', 'okx'] as const)
    const dest = exchange(w, destKey, 'eth')
    const ramps = ['coinbase', 'kraken', 'binance'].filter((k) => k !== destKey).map((k) => exchange(w, k, 'eth'))
    const lendora = w.entity('lendora')
    const mosaique = w.entity('mosaique')
    const lendPool = w.addr('eth', { entity: lendora, label: 'Lendora: Lending Pool', contract: { name: 'Lendora Lending Pool', type: 'lending' } })
    const market = w.addr('eth', { entity: mosaique, label: 'Mosaïque Market : contrat d\'échange', contract: { name: 'Mosaïque Exchange', type: 'router' } })
    const mpFee = w.addr('eth', { entity: mosaique, label: 'Mosaïque Market : commissions', tags: ['liquid'] })
    const artistE = w.customEntity({ name: `${artist.name} (créateur de « ${collection} »)`, category: 'individual' })
    const royalty = w.addr('eth', { entity: artistE })
    const hackE = w.customEntity({ name: 'Pirate de Lendora (inconnu)', category: 'suspect' })
    const hacker = w.addr('eth', { entity: hackE })
    const hacker2 = w.addr('eth', { entity: hackE })

    const t0 = w.at(0)
    const sale = (buyer: string, seller: string, price: number, tokenId: number, time: number): Tx =>
      w.multi({
        time, signer: buyer, method: `matchOrders — transferFrom (tokenId ${tokenId})`, tags: ['nft-sale'],
        legs: [
          { from: buyer, to: market, value: price, asset: 'ETH' },
          { from: market, to: seller, value: eth(price * (1 - MP_FEE - ROYALTY)), asset: 'ETH' },
          { from: market, to: mpFee, value: eth(price * MP_FEE), asset: 'ETH' },
          { from: market, to: royalty, value: eth(price * ROYALTY), asset: 'ETH' },
        ],
      })

    // ── 1. Le piratage ───────────────────────────────────────────────────────
    const stolen = eth(Math.round(r.float(180, 420)))
    const exploit = w.multi({ time: t0, signer: hacker, legs: [{ from: lendPool, to: hacker, value: stolen, asset: 'ETH' }], method: 'flashLoan + liquidate (exploit)', tags: ['exploit'] })
    const parkTx = w.transfer({ time: t0 + Math.round(r.float(1, 4) * HOUR), from: hacker, to: hacker2, value: eth(stolen * r.float(0.45, 0.6)), asset: 'ETH' })

    // ── 2. Source commune et portefeuilles de wash trading ──────────────────
    const source = w.addr('eth', { entity: hackE })
    const srcIn = eth(Math.round(r.float(55, 90)))
    const srcTx = w.transfer({ time: t0 + Math.round(r.float(2, 6) * DAY), from: hacker, to: source, value: srcIn, asset: 'ETH' })
    const K = r.int(4, 5)
    const washers = Array.from({ length: K }, () => w.addr('eth', { entity: hackE }))
    const fundTxs: Tx[] = []
    const tF = srcTx.time + Math.round(r.float(3, 20) * HOUR)
    washers.forEach((a, i) => fundTxs.push(w.transfer({ time: tF + i * Math.round(r.float(0.2, 3) * HOUR), from: source, to: a, value: eth(Math.round(r.float(8, 14) * 10) / 10), asset: 'ETH' })))
    // Un portefeuille de second rang, financé par l'un des premiers
    const late = w.addr('eth', { entity: hackE })
    const lateFund = w.transfer({ time: tF + Math.round(r.float(1, 3) * DAY), from: washers[0], to: late, value: eth(Math.round(r.float(4, 7) * 10) / 10), asset: 'ETH' })
    const allWash = [...washers, late]
    const topUp = (to: string, need: number, time: number) => {
      if (w.balanceOf(source, 'ETH') < need) fundTxs.push(w.transfer({ time: time - 3 * HOUR, from: hacker, to: source, value: eth(need * 2 + 5), asset: 'ETH' }))
      fundTxs.push(w.transfer({ time: time - Math.round(r.float(20, 90) * 60), from: source, to: to, value: eth(need), asset: 'ETH' }))
    }

    // ── 3. Acquisition de trois NFT au prix plancher ───────────────────────
    const ids = new Set<number>()
    while (ids.size < 3) ids.add(r.int(100, 4999))
    const tokens = [...ids]
    const owner = new Map<number, string>()
    const acqTxs: Tx[] = []
    tokens.forEach((id, i) => {
      const holder = w.addr('eth')
      const price = eth(r.float(0.06, 0.18))
      const buyer = allWash[i % K]
      acqTxs.push(sale(buyer, holder, price, id, tF + Math.round((1 + i * r.float(0.2, 0.6)) * DAY)))
      owner.set(id, buyer)
    })

    // ── 4. Ventes croisées à prix gonflés ───────────────────────────────────
    const hot = tokens[0]
    const nTrades = r.int(13, 18)
    const price = new Map<number, number>(tokens.map((id) => [id, r.float(2.5, 5)]))
    const washTxs: Tx[] = []
    const counts = new Map<number, number>(tokens.map((id) => [id, 0]))
    let t = acqTxs[acqTxs.length - 1].time + Math.round(r.float(0.5, 2) * DAY)
    let lateActive = false
    for (let k = 0; k < nTrades; k++) {
      const id = k % 2 === 0 || r.chance(0.3) ? hot : tokens[1 + ((k >> 1) % 2)]
      const seller = owner.get(id)!
      if (t > lateFund.time) lateActive = true
      const pool = (lateActive ? allWash : washers).filter((a) => a !== seller)
      // Aller-retour fréquent : le précédent vendeur rachète
      const prevs = washTxs.filter((x) => x.method?.endsWith(`(tokenId ${id})`))
      const prev = prevs[prevs.length - 1]
      const prevSeller = prev?.transfers[1].to
      const buyer = prevSeller && pool.includes(prevSeller) && r.chance(0.45) ? prevSeller : r.pick(pool)
      const p = eth(Math.round(price.get(id)! * 100) / 100)
      if (w.balanceOf(buyer, 'ETH') < p + 0.05) topUp(buyer, eth(p - w.balanceOf(buyer, 'ETH') + r.float(0.5, 2)), t)
      washTxs.push(sale(buyer, seller, p, id, t))
      owner.set(id, buyer)
      counts.set(id, counts.get(id)! + 1)
      price.set(id, price.get(id)! * r.float(1.08, 1.32))
      t += Math.round(r.float(6, 40) * HOUR)
    }
    // tokenId le plus lavé : unique par construction (au moins la moitié des ventes)
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]
    const washVolume = eth(washTxs.reduce((s, x) => s + x.transfers[0].value, 0))

    // Ventes publiques au prix plancher (autres tokenId de la collection)
    for (let i = 0; i < r.int(14, 20); i++) {
      let id = r.int(1, 5000)
      while (ids.has(id)) id = r.int(1, 5000)
      const b = w.addr('eth')
      const s = w.addr('eth')
      const tt = Math.round(r.float(tF - 4 * DAY, t + 2 * DAY))
      const p = eth(r.float(0.05, 0.25))
      if (r.chance(0.5)) r.pick(ramps).withdraw(b, eth(p + r.float(0.05, 1.5)), tt - Math.round(r.float(2, 60) * HOUR), 'ETH')
      else w.fundAccount(b, eth(p + r.float(0.02, 0.8)), 'ETH', tt - Math.round(r.float(2, 60) * HOUR))
      sale(b, s, p, id, tt)
    }

    // ── 5. Sortie : regroupement puis exchange ──────────────────────────────
    const exit = w.addr('eth', { entity: hackE })
    const tX = t + Math.round(r.float(0.5, 2) * DAY)
    const consol = allWash.map((a, i) => w.transfer({ time: tX + i * Math.round(r.float(0.3, 2) * HOUR), from: a, to: exit, value: eth(w.balanceOf(a, 'ETH')), asset: 'ETH' }))
    const exitIn = eth(w.balanceOf(exit, 'ETH'))
    const dep = dest.newDeposit()
    const p1 = eth(Math.floor(exitIn * r.float(0.45, 0.6) * 100) / 100)
    const p2 = eth(Math.floor((exitIn - p1 - r.float(0.02, 0.1)) * 100) / 100)
    const tD = consol[consol.length - 1].time + Math.round(r.float(3, 20) * HOUR)
    const d1 = dest.receive(exit, p1, tD, { asset: 'ETH', depositAddr: dep, sweepDelayH: r.float(0.3, 2) })
    const d2 = dest.receive(exit, p2, tD + Math.round(r.float(8, 30) * HOUR), { asset: 'ETH', depositAddr: dep, sweepDelayH: r.float(0.3, 2) })
    const laundered = eth(p1 + p2)

    // ── Bruit ────────────────────────────────────────────────────────────────
    dest.noise(18, t0 - 2 * DAY, tD + 4 * DAY, 'ETH')
    for (const k of ramps) k.noise(5, t0 - 2 * DAY, tD + 2 * DAY, 'ETH')

    // ── Synthèse ─────────────────────────────────────────────────────────────
    const destName = dest.entity.name
    const fees = eth(washVolume * (MP_FEE + ROYALTY))
    const funded = eth(fundTxs.filter((x) => x.transfers[0].from === source).reduce((s, x) => s + x.transfers[0].value, 0))
    const hotPrices = washTxs.filter((x) => x.method?.endsWith(`(tokenId ${hot})`)).map((x) => x.transfers[0].value)
    const report = fakePerson(r)

    return {
      world: w,
      title: `Wash trading « ${collection} » — ${city}`,
      briefing:
        `Le protocole de prêt Lendora a été victime d'un piratage : ${amt(stolen, 'ETH')} (≈ ${usd0(usd('ETH', stolen))}) ont été extraits de son contrat. Une partie de l'équipe est basée à ${city} ; le parquet a ouvert une enquête et vous saisit de l'analyse des flux.\n\n` +
        `Quelques jours après le piratage, la collection NFT « ${collection} », vendue sur la place de marché Mosaïque Market, a connu une flambée de volume sans rapport avec son prix plancher. La cellule d'appui soupçonne un montage de wash trading destiné à faire passer une partie du butin pour des produits de ventes de NFT.\n\n` +
        `Le NFT lui-même n'est pas représenté sur le graphe : chaque vente apparaît comme un paiement en ETH vers le contrat de Mosaïque, qui reverse le prix au vendeur, moins la commission de la plateforme et la redevance du créateur. La méthode de la transaction indique le tokenId échangé.`,
      evidence: [
        {
          id: 'rapport', type: 'rapport', title: 'Rapport post-incident de Lendora (extrait)', date: t0 + DAY, author: `${cto.name}, directeur technique de Lendora`,
          body:
            `« Le ${fmtDate(t0)}, un attaquant a combiné un prêt flash et une manipulation de l'oracle de prix pour liquider des positions à son profit. ${amt(stolen, 'ETH')} ont été transférés depuis notre contrat de prêt.\n\n` +
            `Transaction d'exploitation : ${exploit.hash}\n` +
            `Adresse de l'attaquant : ${A(w, hacker)}\n\n` +
            `Nous avons proposé publiquement une prime de 10 % contre la restitution du reste. Aucune réponse à ce jour. »`,
        },
        {
          id: 'capture', type: 'capture', title: `Statistiques de la collection « ${collection} » sur Mosaïque Market`, date: t - DAY,
          body:
            `${collection} — 5 000 éléments\n` +
            `Prix plancher : ${(Math.round(r.float(0.07, 0.12) * 100) / 100).toLocaleString('fr-FR')} ETH\n` +
            `Volume 30 jours : +${r.int(3000, 9000).toLocaleString('fr-FR')} % · Ventes 30 jours : ${washTxs.length + r.int(20, 45)}\n` +
            `Propriétaires uniques : ${r.int(1400, 2100).toLocaleString('fr-FR')}\n` +
            `Redevance créateur : ${pctFr(ROYALTY)} % · Commission plateforme : ${pctFr(MP_FEE)} %`,
        },
        {
          id: 'note', type: 'note', title: 'Note de l\'analyste : repérer le wash trading', date: t, author: 'Cellule d\'appui',
          body:
            `• Wash trading : un même opérateur est à la fois acheteur et vendeur. Il crée un faux volume, fait monter le prix affiché et, en blanchiment, transforme des fonds sales en « produits de ventes ».\n` +
            `• Indicateurs : portefeuilles financés par une même source, peu avant les échanges ; mêmes NFT revendus en boucle (A → B → A) ; prix sans rapport avec le prix plancher ; peu ou pas d'acheteurs extérieurs ; produits regroupés à la sortie.\n` +
            `• Le coût du montage se limite aux commissions et redevances prélevées à chaque vente : c'est le « prix » du blanchiment.\n` +
            `• La place de marché ne détient pas les NFT ni les fonds au-delà de la transaction, mais conserve souvent les données de connexion des portefeuilles.`,
        },
        {
          id: 'pv', type: 'pv', title: 'PV de renseignement', date: tD + 2 * DAY, author: report.name,
          body:
            `Un analyste conformité d'un prestataire européen signale, sous couvert d'anonymat, qu'un client a justifié un dépôt important d'ETH par « la revente d'une œuvre NFT de la collection ${collection} », fournissant une capture de la vente la plus chère (${amt(eth(Math.max(...hotPrices)), 'ETH')}).\n` +
            `Le prestataire n'est pas identifié à ce stade. Pistes : remonter les fonds de l'attaquant de Lendora jusqu'aux ventes de NFT, puis suivre leurs produits.`,
        },
      ],
      seeds: [hacker],
      objectives: [
        {
          id: 'o1', type: 'address', points: 15,
          prompt: 'Quelle adresse a financé les portefeuilles qui ont pratiqué le wash trading ?',
          answer: [source],
          hint: 'Suivez les sorties de l\'adresse de l\'attaquant : l\'une d\'elles redistribue aussitôt les ETH vers plusieurs portefeuilles neufs.',
          explanation: `${A(w, source)} reçoit ${amt(srcIn, 'ETH')} de l'attaquant et finance ${K} portefeuilles neufs en quelques heures, puis les réalimente au besoin (${amt(funded, 'ETH')} au total). C'est la source commune du montage.`,
        },
        {
          id: 'o2', type: 'addresses', points: 20,
          prompt: 'Quels portefeuilles ont participé aux ventes croisées ?',
          answer: allWash,
          hint: 'Les portefeuilles financés par la source s\'achètent et se revendent les mêmes tokenId. Vérifiez si l\'un d\'eux a lui-même financé un portefeuille supplémentaire.',
          explanation: `${K} portefeuilles financés par la source, plus ${A(w, late)}, financé par l'un d'eux (${amt(lateFund.transfers[0].value, 'ETH')}) et entré plus tard dans la boucle. Les vendeurs extérieurs du début (prix plancher) et les acheteurs des ventes publiques n'ont aucun lien de financement.`,
        },
        {
          id: 'o3', type: 'number', points: 10, unit: 'tokenId', tolerance: 0,
          prompt: 'Quel tokenId a été le plus souvent revendu entre ces portefeuilles ?',
          answer: top[0],
          hint: 'La méthode de chaque vente (« matchOrders — transferFrom (tokenId …) ») indique le NFT échangé : comptez les occurrences dans les transactions des portefeuilles liés.',
          explanation: `Le tokenId ${top[0]} change de mains ${top[1]} fois entre portefeuilles liés, son prix passant de ${amt(hotPrices[0], 'ETH')} à ${amt(hotPrices[hotPrices.length - 1], 'ETH')}, alors que le prix plancher de la collection reste sous 0,15 ETH. Les deux autres NFT (${tokens.slice(1).join(' et ')}) servent d'appoint.`,
        },
        {
          id: 'o4', type: 'amount', points: 15, unit: 'ETH', tolerance: 0.01,
          prompt: 'Quel montant d\'ETH, présenté comme des produits de ventes NFT, a été déposé sur l\'exchange de sortie ?',
          answer: laundered,
          hint: 'Les portefeuilles liés regroupent tout leur solde sur une adresse de sortie, qui dépose en deux fois.',
          explanation: `${allWash.length} portefeuilles versent ${amt(exitIn, 'ETH')} à ${A(w, exit)}, qui dépose ${amt(p1, 'ETH')} puis ${amt(p2, 'ETH')} = ${amt(laundered, 'ETH')} (≈ ${usd0(usd('ETH', laundered))}). Le volume des ventes croisées atteint ${amt(washVolume, 'ETH')}, pour un coût de ${amt(fees, 'ETH')} en commissions et redevances : le volume affiché est sans rapport avec les fonds réellement engagés.`,
        },
        {
          id: 'o5', type: 'entity', points: 15,
          prompt: 'Sur quel exchange les fonds sont-ils ressortis ?',
          answer: [destKey],
          hint: 'L\'adresse de sortie dépose sur une adresse rattachée à un exchange, balayée ensuite vers son hot wallet.',
          explanation: `Les deux dépôts arrivent sur ${A(w, dep)}, adresse de dépôt de ${destName}. ${procedureFor(dest.entity)} La justification « vente de NFT » avancée par le client tombe : l'acheteur et le vendeur étaient financés par la même source.`,
        },
        {
          id: 'o6', type: 'amount', points: 10, unit: 'ETH', tolerance: 0.02,
          prompt: 'Quel volume (en ETH) ont totalisé les reventes entre portefeuilles liés ?',
          answer: washVolume,
          hint: 'Additionnez les prix payés au contrat de Mosaïque lors des ventes dont l\'acheteur et le vendeur sont tous deux des portefeuilles liés.',
          explanation: `${washTxs.length} reventes entre portefeuilles liés totalisent ${amt(washVolume, 'ETH')} (≈ ${usd0(usd('ETH', washVolume))}) : c'est le faux volume affiché par la collection. Le contrat d'échange et l'adresse de commissions sont attribués à Mosaïque Market, qui peut être requise pour ses journaux (adresses IP, e-mails facultatifs, signatures des ordres), susceptibles de relier les portefeuilles à un même appareil. ${procedureFor(mosaique)}`,
        },
        {
          id: 'o7', type: 'choice', points: 15,
          prompt: 'Quels indicateurs caractérisent ici le wash trading ?',
          ...choice(r,
            'Financement commun, mêmes tokenId revendus en boucle entre ces portefeuilles, prix détachés du plancher, sortie regroupée',
            [
              'Le prix élevé d\'une seule vente, qui suffit à lui seul à démontrer que l\'acheteur et le vendeur sont une seule et même personne',
              'Le passage par le contrat de la place de marché, qui prouve que la plateforme a organisé les ventes croisées',
              'Le paiement de redevances au créateur, qui fait de celui-ci le bénéficiaire et l\'organisateur probable du montage',
            ]),
          explanation: `C'est la convergence qui compte : même source de financement, rotations du même NFT (A → B → A), prix multipliés sans acheteur extérieur, puis regroupement des produits avant l'exchange. Ni la place de marché ni le créateur (${A(w, royalty).slice(0, 10)}…, qui touche ${pctFr(ROYALTY)} % de chaque vente) ne sont impliqués du seul fait des flux : ils sont des tiers dont les données peuvent être requises. Les faits peuvent relever du blanchiment (art. 324-1 du Code pénal), les ventes fictives servant à donner une justification mensongère à l'origine des fonds.`,
        },
      ],
      truth: {
        path: [exploit.id, srcTx.id, parkTx.id, ...fundTxs.map((x) => x.id), lateFund.id, ...acqTxs.map((x) => x.id), ...washTxs.map((x) => x.id), ...consol.map((x) => x.id), d1.tx.id, ...(d1.sweep ? [d1.sweep.id] : []), d2.tx.id, ...(d2.sweep ? [d2.sweep.id] : [])],
        addresses: [hacker, source, ...allWash, market, exit, dep],
        debrief:
          `1. Le ${fmtDate(t0, false)}, l'attaquant extrait ${amt(stolen, 'ETH')} du contrat de Lendora vers ${A(w, hacker)} et met une partie de côté sur ${A(w, hacker2)}.\n` +
          `2. ${amt(srcIn, 'ETH')} passent sur ${A(w, source)}, qui finance ${K} portefeuilles neufs ; l'un d'eux finance à son tour un portefeuille supplémentaire, entré plus tard dans la boucle.\n` +
          `3. Les portefeuilles achètent trois NFT de « ${collection} » au prix plancher, puis se les revendent ${washTxs.length} fois via le contrat de Mosaïque Market, pour ${amt(washVolume, 'ETH')} de volume. Le tokenId ${top[0]} change de mains ${top[1]} fois, jusqu'à ${amt(eth(Math.max(...hotPrices)), 'ETH')}.\n` +
          `4. Les soldes sont regroupés sur ${A(w, exit)} puis déposés sur ${destName} : ${amt(laundered, 'ETH')}, justifiés auprès de la plateforme comme le produit d'une vente de NFT.\n\n` +
          `À retenir : une vente de NFT ne prouve pas l'existence d'un acheteur indépendant. Le financement des deux parties, la rotation des mêmes tokenId et la déconnexion des prix avec le marché démontrent le caractère fictif des ventes. Le coût du montage (${amt(fees, 'ETH')} de commissions et redevances) est faible au regard des fonds « justifiés ». Réquisitions : ${destName} (titulaire du compte, pièces justificatives fournies), Mosaïque Market (données de connexion), et suivi des fonds restés sur ${A(w, hacker2).slice(0, 10)}…`,
      },
      hints: [
        'Partez de l\'adresse de l\'attaquant citée par Lendora et repérez, parmi ses sorties, l\'adresse qui redistribue vers plusieurs portefeuilles neufs.',
        'Les ventes de NFT sont des transactions vers le contrat de Mosaïque : lisez la méthode pour connaître le tokenId et repérez qui paie et qui encaisse.',
        'Comptez les ventes par tokenId entre les portefeuilles liés ; écartez les achats initiaux au prix plancher auprès de détenteurs extérieurs.',
        'En fin de boucle, tous les portefeuilles liés se vident vers une même adresse : suivez-la jusqu\'à l\'exchange.',
      ],
    }
  },
}
