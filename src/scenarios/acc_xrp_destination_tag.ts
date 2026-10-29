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
    'Une victime a placé ses XRP dans un faux programme de « staking garanti ». Les fonds finissent sur l\'adresse d\'un exchange… partagée par tous ses clients. Retrouvez le destination tag qui permettra d\'identifier le compte crédité.',
  difficulty: 1,
  chains: ['xrp'],
  skills: ['lecture_tx', 'memo', 'exchange_id', 'requisition'],
  estMinutes: 10,
  lessons: ['comptes-evm', 'xrp-memos', 'exchanges', 'requisitions'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const victimP = fakePerson(r)
    const victimName = victimP.name
    const g = victimP.g
    const city = fakeCity(r)

    const cv = exchange(w, 'coinvault', 'xrp')
    const destKey = r.pick(['binova', 'kaizen', 'nordex'] as const)
    const dest = exchange(w, destKey, 'xrp')

    const victimE = w.customEntity({ name: victimName, category: 'victim' })
    const victim = w.addr('xrp', { entity: victimE })
    const suspect = w.customEntity({ name: '« XRP Yield Club » (inconnu)', category: 'suspect' })

    // La victime achète ses XRP sur Coinvault
    const pay1 = Math.round(r.float(6000, 20000) / 100) * 100
    const pay2 = Math.round(r.float(4000, 15000) / 100) * 100
    cv.withdraw(victim, pay1 + r.int(30, 200), w.at(-r.float(20, 40)), 'XRP')
    cv.withdraw(victim, pay2 + r.int(10, 80), w.at(r.float(30, 44)), 'XRP')

    // Paiements vers l'adresse du « club »
    const s1 = w.addr('xrp', { entity: suspect })
    const t1 = w.transfer({ time: w.at(0), from: victim, to: s1, value: pay1, asset: 'XRP' })
    const t2 = w.transfer({ time: w.at(r.float(48, 60)), from: victim, to: s1, value: pay2, asset: 'XRP' })

    // Transit par une seconde adresse (en laissant la réserve du compte)
    const reserve1 = r.int(2, 12)
    const s2 = w.addr('xrp', { entity: suspect })
    const t3 = w.transfer({ time: w.at(r.float(62, 70)), from: s1, to: s2, value: roundAsset('XRP', w.balanceOf(s1, 'XRP') - reserve1), asset: 'XRP' })

    // Dépôt sur l'exchange : adresse partagée + destination tag
    const tag = r.int(1000000, 499999999)
    const reserve2 = r.int(2, 12)
    const depTotal = roundAsset('XRP', w.balanceOf(s2, 'XRP') - reserve2)
    const part1 = roundAsset('XRP', Math.round((depTotal * r.float(0.55, 0.7)) / 100) * 100)
    const part2 = roundAsset('XRP', depTotal - part1)
    const depT = w.at(r.float(72, 84))
    const d1 = dest.receive(s2, part1, depT, { asset: 'XRP', memo: String(tag) })
    const d2 = dest.receive(s2, part2, depT + r.int(20, 90) * 60, { asset: 'XRP', memo: String(tag) })

    // Leurres : d'autres clients déposent au même moment, montants comparables, autres tags
    for (let i = 0; i < r.int(6, 9); i++) {
      const a = w.addr('xrp')
      const v = roundAsset('XRP', part1 * r.float(0.6, 1.4))
      const td = depT + r.int(-6 * 3600, 6 * 3600)
      w.fundAccount(a, roundAsset('XRP', v + r.int(15, 100)), 'XRP', td - r.int(2, 72) * HOUR)
      let otherTag = r.int(1000000, 499999999)
      if (otherTag === tag) otherTag += 7
      w.transfer({ time: td, from: a, to: dest.hot, value: v, asset: 'XRP', memo: String(otherTag) })
    }

    // Bruit de fond
    dest.noise(22, w.at(-3 * 24), w.at(6 * 24), 'XRP')
    cv.noise(10, w.at(-3 * 24), w.at(5 * 24), 'XRP')

    const handle = fakeHandle(r)

    return {
      world: w,
      title: `XRP Yield Club — ${city}`,
      briefing:
        `${victimName} (${city}) a rejoint sur Telegram le « XRP Yield Club », qui promettait 4 % de rendement hebdomadaire sur des XRP « stakés ». ${g('Il', 'Elle')} a envoyé deux virements en XRP depuis son portefeuille personnel, alimenté par Coinvault.\n\n` +
        `Le groupe a disparu. Sur le XRP Ledger, les exchanges utilisent souvent une seule adresse pour tous leurs clients : le compte crédité est désigné par un numéro joint au paiement, le destination tag.\n\n` +
        `Votre mission : identifier l'exchange où les fonds ont été déposés et le destination tag du compte bénéficiaire.`,
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
      ],
      seeds: [victim],
      objectives: [
        {
          id: 'o1', type: 'entity', points: 30,
          prompt: 'Sur quel exchange les XRP ont-ils été déposés ?',
          answer: [destKey],
          hint: 'Suivez les XRP de l\'adresse du « pool » : après un saut intermédiaire, ils arrivent sur une adresse étiquetée.',
          explanation: `Les XRP transitent par ${A(w, s2)} puis sont envoyés en deux fois sur le hot wallet de ${dest.entity.name}.`,
        },
        {
          id: 'o2', type: 'number', points: 40, tolerance: 0, unit: 'tag',
          prompt: 'Quel destination tag accompagne les dépôts de l\'escroc ?',
          answer: tag,
          hint: 'Ouvrez le détail des transactions vers le hot wallet : le champ memo / destination tag y figure. Attention aux autres dépôts du même jour.',
          explanation: `Les deux dépôts (${amt(part1, 'XRP')} et ${amt(part2, 'XRP')}) portent le tag ${tag}. Les autres dépôts reçus par le hot wallet au même moment portent d'autres tags : ce sont d'autres clients.`,
        },
        {
          id: 'o3', type: 'choice', points: 30,
          prompt: 'Pourquoi une réquisition mentionnant seulement l\'adresse de l\'exchange serait-elle inexploitable ?',
          ...choice(r,
            'L\'adresse est commune à tous les clients : seul le tag (avec hash et date) désigne le compte',
            [
              'Les adresses XRP changent à chaque transaction, l\'adresse citée n\'existe déjà plus',
              'L\'exchange ne conserve pas l\'historique des dépôts reçus sur ses propres adresses',
              'Le destination tag est un mot de passe : sans lui, l\'exchange ne peut rien consulter',
            ]),
          explanation: `L'adresse ${A(w, dest.hot)} reçoit les dépôts de milliers de clients. La réquisition doit viser le tag ${tag} et citer les hash des dépôts ${d1.tx.hash.slice(0, 12)}… et ${d2.tx.hash.slice(0, 12)}…, leurs dates et montants. Sans tag, l'exchange ne peut pas savoir quel compte a été crédité. ${procedureFor(dest.entity)}`,
        },
      ],
      truth: {
        path: [t1.id, t2.id, t3.id, d1.tx.id, d2.tx.id],
        addresses: [s1, s2, dest.hot],
        debrief:
          `1. La victime envoie ${amt(pay1, 'XRP')} puis ${amt(pay2, 'XRP')} à l'adresse du « pool » ${A(w, s1)}.\n` +
          `2. L'escroc transfère le solde vers ${A(w, s2)} en laissant quelques XRP : sur le XRP Ledger, un compte doit conserver une petite réserve minimale (quelques XRP) qu'il ne peut pas envoyer.\n` +
          `3. Il dépose ${amt(part1, 'XRP')} puis ${amt(part2, 'XRP')} sur l'adresse partagée de ${dest.entity.name}, avec le destination tag ${tag}.\n\n` +
          `À retenir : sur XRP (comme pour les memos Stellar, EOS, Cosmos ou certains dépôts BNB), l'adresse d'un exchange est souvent commune à tous ses clients. Le couple adresse + destination tag, appuyé du hash de transaction, est indispensable à la réquisition. À l'inverse, l'annonce « pas besoin de tag » du faux pool trahit une adresse personnelle, contrôlée par l'escroc.`,
      },
      hints: [
        'Dépliez les flux sortants de la victime puis ceux de l\'adresse du « pool ».',
        'L\'adresse finale est étiquetée « Hot Wallet » : elle reçoit énormément de dépôts de tiers.',
        'Dans le détail d\'une transaction XRP, le destination tag apparaît dans le champ memo.',
      ],
    }
  },
}
