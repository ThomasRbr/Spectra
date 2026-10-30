import { World } from '../engine/world'
import { exchange, HOUR } from '../engine/patterns'
import { roundAsset } from '../engine/chains'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, fakeCity, fakeHandle, fakePerson, fmtDate, procedureFor } from './util'

export const accXrpDestinationTag: ScenarioTemplate = {
  id: 'xrp-destination-tag',
  title: 'Le destination tag XRP',
  tagline: 'Une adresse partagée par des milliers de clients : seul le tag désigne le titulaire.',
  description:
    'Une victime a placé ses XRP dans un faux programme de « staking garanti ». Les fonds finissent sur les adresses de deux exchanges… partagées par tous leurs clients. Retrouvez les destination tags qui permettront d\'identifier les comptes crédités, chiffrez ce qu\'a reçu le faux pool et préparez des réquisitions exploitables.',
  difficulty: 1,
  chains: ['xrp'],
  skills: ['lecture_tx', 'memo', 'exchange_id', 'requisition'],
  estMinutes: 30,
  lessons: ['comptes-evm', 'xrp-memos', 'exchanges', 'requisitions'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const victimP = fakePerson(r)
    const victimName = victimP.name
    const g = victimP.g
    const city = fakeCity(r)

    const cv = exchange(w, 'coinhouse', 'xrp')
    const destKey = r.pick(['binance', 'okx', 'bitstamp'] as const)
    const dest = exchange(w, destKey, 'xrp')
    // Seconde plateforme, où l'escroc encaisse une plus petite part sous un autre tag
    const ex2Key = r.pick((['kraken', 'bitstamp', 'binance', 'okx'] as const).filter((k) => k !== destKey))
    const ex2 = exchange(w, ex2Key, 'xrp')

    const victimE = w.customEntity({ name: victimName, category: 'victim' })
    const victim = w.addr('xrp', { entity: victimE })
    const suspect = w.customEntity({ name: '« XRP Yield Club » (inconnu)', category: 'suspect' })

    // La victime achète ses XRP sur Coinhouse
    const pay1 = Math.round(r.float(6000, 20000) / 100) * 100
    const pay2 = Math.round(r.float(4000, 15000) / 100) * 100
    cv.withdraw(victim, pay1 + r.int(30, 200), w.at(-r.float(20, 40)), 'XRP')
    cv.withdraw(victim, pay2 + r.int(10, 80), w.at(r.float(30, 44)), 'XRP')

    // Paiements vers l'adresse du « club »
    const s1 = w.addr('xrp', { entity: suspect })
    const t1 = w.transfer({ time: w.at(0), from: victim, to: s1, value: pay1, asset: 'XRP' })
    const t2 = w.transfer({ time: w.at(r.float(48, 60)), from: victim, to: s1, value: pay2, asset: 'XRP' })

    // Un autre membre du canal paie le même « pool » entre les deux versements
    const other = w.addr('xrp', { entity: w.customEntity({ name: 'Victime non identifiée', category: 'victim' }) })
    const payO = Math.round(r.float(3000, 12000) / 100) * 100
    w.fundAccount(other, payO + r.int(20, 150), 'XRP', w.at(r.float(-30, 8)))
    const tOther = w.transfer({ time: w.at(r.float(12, 40)), from: other, to: s1, value: payO, asset: 'XRP' })
    const poolTotal = pay1 + pay2 + payO

    // Transit par une seconde adresse (en laissant la réserve du compte)
    const reserve1 = r.int(2, 12)
    const s2 = w.addr('xrp', { entity: suspect })
    const t3 = w.transfer({ time: w.at(r.float(62, 70)), from: s1, to: s2, value: roundAsset('XRP', w.balanceOf(s1, 'XRP') - reserve1), asset: 'XRP' })

    // Première sortie, plus petite, vers la seconde plateforme (adresse partagée + son propre tag)
    const tag = r.int(1000000, 499999999)
    let tag2 = r.int(1000000, 499999999)
    if (tag2 === tag) tag2 += 11
    const side = roundAsset('XRP', Math.round((w.balanceOf(s2, 'XRP') * r.float(0.18, 0.28)) / 10) * 10)
    const sideT = w.at(r.float(71, 75))
    const dSide = w.transfer({ time: sideT, from: s2, to: ex2.hot, value: side, asset: 'XRP', memo: String(tag2) })

    // Dépôt principal sur l'exchange : adresse partagée + destination tag
    const reserve2 = r.int(2, 12)
    const depTotal = roundAsset('XRP', w.balanceOf(s2, 'XRP') - reserve2)
    const part1 = roundAsset('XRP', Math.round((depTotal * r.float(0.55, 0.7)) / 100) * 100)
    const part2 = roundAsset('XRP', depTotal - part1)
    const depT = w.at(r.float(77, 88))
    const d1 = dest.receive(s2, part1, depT, { asset: 'XRP', memo: String(tag) })
    const d2 = dest.receive(s2, part2, depT + r.int(20, 90) * 60, { asset: 'XRP', memo: String(tag) })

    // Leurres : d'autres clients déposent au même moment, montants comparables, autres tags
    const decoys = (hot: string, ref: number, t: number, n: number) => {
      for (let i = 0; i < n; i++) {
        const a = w.addr('xrp')
        const v = roundAsset('XRP', ref * r.float(0.6, 1.4))
        const td = t + r.int(-6 * 3600, 6 * 3600)
        w.fundAccount(a, roundAsset('XRP', v + r.int(15, 100)), 'XRP', td - r.int(2, 72) * HOUR)
        let otherTag = r.int(1000000, 499999999)
        if (otherTag === tag || otherTag === tag2) otherTag += 7
        w.transfer({ time: td, from: a, to: hot, value: v, asset: 'XRP', memo: String(otherTag) })
      }
    }
    decoys(dest.hot, part1, depT, r.int(6, 9))
    decoys(ex2.hot, side, sideT, r.int(4, 6))

    // Bruit de fond
    dest.noise(22, w.at(-3 * 24), w.at(6 * 24), 'XRP')
    ex2.noise(14, w.at(-3 * 24), w.at(6 * 24), 'XRP')
    cv.noise(10, w.at(-3 * 24), w.at(5 * 24), 'XRP')

    const handle = fakeHandle(r)
    const memberHandle = fakeHandle(r)
    const destName = dest.entity.name
    const ex2Name = ex2.entity.name

    return {
      world: w,
      title: `XRP Yield Club — ${city}`,
      briefing:
        `${victimName} (${city}) a rejoint sur Telegram le « XRP Yield Club », qui promettait 4 % de rendement hebdomadaire sur des XRP « stakés ». ${g('Il', 'Elle')} a envoyé deux virements en XRP depuis son portefeuille personnel, alimenté par Coinhouse.\n\n` +
        `Le groupe a disparu. Sur le XRP Ledger, les exchanges utilisent souvent une seule adresse pour tous leurs clients : le compte crédité est désigné par un numéro joint au paiement, le destination tag.\n\n` +
        `Votre mission : suivre les XRP du « pool », mesurer ce qu'il a collecté, identifier les exchanges où les fonds ont été déposés et les destination tags des comptes bénéficiaires, puis préparer des réquisitions exploitables.`,
      evidence: [
        {
          id: 'plainte', type: 'plainte', title: 'Procès-verbal de plainte (extrait)', date: w.at(7 * 24), author: victimName,
          body:
            `« J'ai fait deux envois : ${amt(pay1, 'XRP')} le ${fmtDate(t1.time)} et ${amt(pay2, 'XRP')} le ${fmtDate(t2.time)}.\n\n` +
            `Mon adresse XRP : ${A(w, victim)}\n` +
            `Référence du premier envoi : ${t1.hash} »`,
        },
        {
          id: 'telegram', type: 'telegram', title: 'Canal Telegram « XRP Yield Club »', author: `@${handle}`, date: w.at(-3 * 24),
          body:
            `📢 Nouveau pool de staking ouvert ! 4 %/semaine garantis 🔒\n` +
            `Adresse officielle du pool : ${A(w, s1)}\n` +
            `⚠️ Pas besoin de destination tag pour notre pool, envoyez directement.`,
        },
        {
          id: 'telegram2', type: 'telegram', title: 'Canal Telegram « XRP Yield Club » — derniers messages', author: `@${memberHandle}`, date: w.at(6 * 24),
          body:
            `@${memberHandle} : J'ai envoyé mes XRP au pool il y a plusieurs jours, toujours aucun rendement crédité 😡\n` +
            `@${memberHandle} : Les admins ne répondent plus, quelqu'un a des nouvelles ?\n` +
            `[Le canal a été supprimé par son administrateur]`,
        },
      ],
      seeds: [victim],
      objectives: [
        {
          id: 'o5', type: 'address', points: 8,
          prompt: 'Un autre membre du club a lui aussi payé le « pool ». Quelle est son adresse ?',
          answer: [other],
          hint: 'Dépliez les flux entrants de l\'adresse du pool : un expéditeur non attribué, autre que la victime, lui envoie des XRP.',
          explanation: `${A(w, other)} envoie ${amt(payO, 'XRP')} au pool le ${fmtDate(tOther.time)}, entre les deux versements de ${victimName}. Le message de détresse publié sur le canal le laissait deviner : c'est une seconde victime, à identifier (son propre historique, alimenté depuis une plateforme, permettra de remonter jusqu'à elle).`,
        },
        {
          id: 'o6', type: 'amount', points: 8, unit: 'XRP', tolerance: 0.005,
          prompt: 'Combien d\'XRP l\'adresse du « pool » a-t-elle reçus au total ?',
          answer: poolTotal,
          hint: 'Sélectionnez l\'adresse du pool et lisez son « Total reçu ».',
          explanation: `${amt(poolTotal, 'XRP')} : ${amt(pay1, 'XRP')} + ${amt(pay2, 'XRP')} de ${victimName} et ${amt(payO, 'XRP')} de l'autre membre. C'est le préjudice minimal visible on-chain, toutes victimes confondues.`,
        },
        {
          id: 'o4', type: 'address', points: 8,
          prompt: 'Vers quelle adresse de transit l\'escroc vide-t-il l\'adresse du pool ?',
          answer: [s2],
          hint: 'Dépliez les flux sortants de l\'adresse du pool : un seul transfert, presque tout le solde.',
          explanation: `${A(w, s2)} reçoit tout le solde du pool, à l'exception de ${amt(reserve1, 'XRP')} : sur le XRP Ledger, un compte doit conserver une réserve minimale qu'il ne peut pas envoyer. Cette adresse, non attribuée, est un relais de l'escroc d'où partent les dépôts vers les plateformes.`,
        },
        {
          id: 'o1', type: 'entity', points: 10,
          prompt: 'Sur quel exchange la majeure partie des XRP a-t-elle été déposée ?',
          answer: [destKey],
          hint: 'Suivez les XRP de l\'adresse du « pool » : après un saut intermédiaire, ils arrivent sur des adresses étiquetées. Comparez les montants.',
          explanation: `Les XRP transitent par ${A(w, s2)} puis sont envoyés en deux fois sur le hot wallet de ${destName} (${amt(depTotal, 'XRP')}), une plus petite part partant vers ${ex2Name}.`,
        },
        {
          id: 'o2', type: 'number', points: 12, tolerance: 0, unit: 'tag',
          prompt: 'Quel destination tag accompagne les dépôts de l\'escroc sur cet exchange ?',
          answer: tag,
          hint: 'Ouvrez le détail des transactions vers le hot wallet : le champ memo / destination tag y figure. Attention aux autres dépôts du même jour.',
          explanation: `Les deux dépôts (${amt(part1, 'XRP')} et ${amt(part2, 'XRP')}) portent le tag ${tag}. Les autres dépôts reçus par le hot wallet au même moment portent d'autres tags : ce sont d'autres clients.`,
        },
        {
          id: 'o7', type: 'tx', points: 8,
          prompt: 'Citez une transaction de dépôt portant ce tag (à mentionner dans la réquisition).',
          answer: [d1.tx.id, d2.tx.id],
          hint: 'Ce sont les transferts de l\'adresse de transit vers le hot wallet de la plateforme principale ; vérifiez le tag dans leur détail.',
          explanation: `Deux transactions conviennent : ${d1.tx.hash.slice(0, 12)}… (${amt(part1, 'XRP')}, ${fmtDate(d1.tx.time)}) et ${d2.tx.hash.slice(0, 12)}… (${amt(part2, 'XRP')}, ${fmtDate(d2.tx.time)}). La réquisition cite les deux, avec le tag ${tag} : hash, date et montant permettent à ${destName} de retrouver chaque crédit sans ambiguïté, même si un client a mal saisi son tag.`,
        },
        {
          id: 'o8', type: 'amount', points: 8, unit: 'XRP', tolerance: 0.005,
          prompt: 'Quel montant total d\'XRP a été crédité sous ce tag ?',
          answer: depTotal,
          hint: 'Additionnez les deux dépôts de l\'adresse de transit qui portent ce tag.',
          explanation: `${amt(part1, 'XRP')} + ${amt(part2, 'XRP')} = ${amt(depTotal, 'XRP')}. C'est le montant à rechercher sur le compte client de ${destName}, et à bloquer s'il n'a pas déjà été retiré.`,
        },
        {
          id: 'o9', type: 'entity', points: 8,
          prompt: 'Vers quelle autre plateforme une plus petite part des XRP a-t-elle été envoyée ?',
          answer: [ex2Key],
          hint: 'L\'adresse de transit a envoyé des XRP vers deux hot wallets étiquetés.',
          explanation: `Le ${fmtDate(dSide.time)}, avant le dépôt principal, l'adresse de transit envoie ${amt(side, 'XRP')} sur l'adresse partagée de ${ex2Name}. L'escroc dispose donc d'un second compte, sur une autre plateforme : ${procedureFor(ex2.entity)}`,
        },
        {
          id: 'o10', type: 'number', points: 10, tolerance: 0, unit: 'tag',
          prompt: 'Quel destination tag accompagne ce dépôt sur la seconde plateforme ?',
          answer: tag2,
          hint: 'Ouvrez le transfert de l\'adresse de transit vers le hot wallet de la seconde plateforme et lisez le champ « Destination tag ».',
          explanation: `Le dépôt de ${amt(side, 'XRP')} vers ${ex2Name} porte le tag ${tag2}, différent de celui utilisé chez ${destName} : chaque plateforme attribue ses propres numéros, un tag n'a de sens qu'avec l'adresse à laquelle il est associé. La réquisition à ${ex2Name} cite ce tag, le hash ${dSide.hash.slice(0, 12)}…, la date et le montant.`,
        },
        {
          id: 'o11', type: 'choice', points: 8,
          prompt: 'Que révèle l\'annonce du canal « pas besoin de destination tag pour notre pool » ?',
          ...choice(r,
            'Que l\'adresse du pool est un compte personnel contrôlé par l\'escroc, et non l\'adresse partagée d\'une plateforme',
            [
              'Que le pool utilise un mécanisme de staking qui identifie automatiquement chaque déposant',
              'Que les fonds partent directement sur un smart contract de staking du XRP Ledger',
              'Que l\'adresse appartient à un exchange qui a désactivé les tags pour ce client',
            ]),
          hint: 'Dans quel cas un destinataire XRP a-t-il besoin d\'un tag ?',
          explanation: `Un tag n'est nécessaire que si l'adresse de destination est partagée entre plusieurs clients (exchange, service de paiement). Une adresse qui n'en demande pas appartient à une seule personne : ici, l'escroc. Il n'existe pas de « staking » natif rémunéré sur le XRP Ledger : la promesse elle-même signait l'escroquerie. Les fonds n'ont d'ailleurs fait que transiter par ${A(w, s2).slice(0, 10)}… avant d'être déposés sur des exchanges.`,
        },
        {
          id: 'o3', type: 'choice', points: 12,
          prompt: 'Pourquoi une réquisition mentionnant seulement l\'adresse de l\'exchange serait-elle inexploitable ?',
          ...choice(r,
            'L\'adresse est commune à tous les clients : seul le tag (avec hash et date) désigne le compte',
            [
              'Les adresses XRP changent à chaque transaction, l\'adresse citée n\'existe déjà plus',
              'L\'exchange ne conserve pas l\'historique des dépôts reçus sur ses propres adresses',
              'Le destination tag est un mot de passe : sans lui, l\'exchange ne peut rien consulter',
            ]),
          hint: 'Combien de clients déposent sur cette adresse, et comment l\'exchange les distingue-t-il ?',
          explanation: `L'adresse ${A(w, dest.hot)} reçoit les dépôts de milliers de clients. La réquisition doit viser le tag ${tag} et citer les hash des dépôts ${d1.tx.hash.slice(0, 12)}… et ${d2.tx.hash.slice(0, 12)}…, leurs dates et montants. Sans tag, l'exchange ne peut pas savoir quel compte a été crédité. ${procedureFor(dest.entity)}`,
        },
      ],
      truth: {
        path: [t1.id, t2.id, tOther.id, t3.id, dSide.id, d1.tx.id, d2.tx.id],
        addresses: [s1, s2, dest.hot, ex2.hot, other],
        debrief:
          `1. La victime envoie ${amt(pay1, 'XRP')} puis ${amt(pay2, 'XRP')} à l'adresse du « pool » ${A(w, s1)}. Un autre membre du club (${A(w, other)}) y verse ${amt(payO, 'XRP')} : ${amt(poolTotal, 'XRP')} au total.\n` +
          `2. L'escroc transfère le solde vers ${A(w, s2)} en laissant ${amt(reserve1, 'XRP')} : sur le XRP Ledger, un compte doit conserver une petite réserve minimale (quelques XRP) qu'il ne peut pas envoyer.\n` +
          `3. Il envoie d'abord ${amt(side, 'XRP')} sur l'adresse partagée de ${ex2Name}, avec le destination tag ${tag2}.\n` +
          `4. Il dépose ensuite ${amt(part1, 'XRP')} puis ${amt(part2, 'XRP')} (${amt(depTotal, 'XRP')} au total) sur l'adresse partagée de ${destName}, avec le destination tag ${tag}.\n\n` +
          `À retenir : sur XRP (comme pour les memos Stellar, EOS, Cosmos ou certains dépôts BNB), l'adresse d'un exchange est souvent commune à tous ses clients. Le couple adresse + destination tag, appuyé du hash de transaction, est indispensable à la réquisition ; un tag n'a de sens que pour la plateforme qui l'a attribué. À l'inverse, l'annonce « pas besoin de tag » du faux pool trahit une adresse personnelle, contrôlée par l'escroc. Deux réquisitions sont à prévoir (${destName}, ${ex2Name}), et la seconde victime est à identifier.`,
      },
      hints: [
        'Dépliez les flux sortants de la victime puis ceux de l\'adresse du « pool ».',
        'L\'adresse finale est étiquetée « Hot Wallet » : elle reçoit énormément de dépôts de tiers.',
        'Dans le détail d\'une transaction XRP, le destination tag apparaît dans le champ memo.',
        'L\'adresse de transit n\'a pas tout envoyé au même endroit : vérifiez chacun de ses transferts sortants.',
      ],
    }
  },
}
