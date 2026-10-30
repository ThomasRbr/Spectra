import { World, type Tx } from '../engine/world'
import { exchange, tonTransfer, HOUR, DAY } from '../engine/patterns'
import { roundAsset } from '../engine/chains'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, fakeCity, fakeHandle, fakePerson, fmtDate, procedureFor } from './util'

// Arnaque à l'emploi sur Telegram (« tâches rémunérées ») payée en USDT sur
// TON. L'escroc dépose ensuite sur l'adresse PARTAGÉE d'un exchange : le compte
// crédité n'est désigné que par le commentaire de la transaction.

const COMPANIES = ['MediaBoost Agency', 'StarRank Digital', 'ClickWave Partners', 'Optima Reviews', 'TrendLab Marketing'] as const

const usdt = (v: number) => roundAsset('USDT', v)
const ton = (v: number) => roundAsset('TON', v)

export const debTonCommentaire: ScenarioTemplate = {
  id: 'deb-ton-commentaire',
  title: 'TON : le commentaire qui désigne le compte',
  tagline: 'Une fausse offre d\'emploi, des USDT sur TON et une adresse d\'exchange partagée.',
  description:
    'Recrutée sur Telegram pour des « tâches rémunérées », une victime a fini par prépayer des « missions premium » en USDT sur la blockchain TON. Retrouvez l\'adresse de l\'escroc, suivez les fonds jusqu\'à l\'exchange et relevez l\'information indispensable à la réquisition quand l\'adresse de dépôt est commune à tous les clients.',
  difficulty: 1,
  chains: ['ton'],
  skills: ['lecture_tx', 'tokens', 'memo', 'exchange_id', 'requisition'],
  estMinutes: 15,
  lessons: ['ton-telegram', 'xrp-memos', 'exchanges', 'requisitions', 'typologies'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const victimP = fakePerson(r)
    const victimName = victimP.name
    const g = victimP.g
    const city = fakeCity(r)
    const company = r.pick(COMPANIES)
    const recruiter = fakeHandle(r)

    const destKey = r.pick(['binance', 'okx', 'kraken'] as const)
    const fundKey = r.pick((['binance', 'okx', 'kraken'] as const).filter((k) => k !== destKey))
    const dest = exchange(w, destKey, 'ton')
    const fund = exchange(w, fundKey, 'ton')

    const scamE = w.customEntity({ name: `Faux recruteur « ${company} » (inconnu)`, category: 'scam', description: 'Arnaque à l\'emploi : tâches rémunérées puis « missions premium » à prépayer.' })
    const victimE = w.customEntity({ name: victimName, category: 'victim' })
    const victim = w.addr('ton', { entity: victimE })
    const s1 = w.addr('ton', { entity: scamE })
    const path: Tx[] = []

    // ── Une première victime alimente l'adresse (avant les faits) ───────────
    const early = w.addr('ton')
    const earlyV = usdt(r.int(40, 120) * 10)
    const earlyT = w.at(-r.float(20, 60))
    w.fundAccount(early, usdt(earlyV + r.int(1, 6) * 10), 'USDT', earlyT - Math.round(r.float(3, 40) * HOUR))
    const earlyTx = tonTransfer(w, { from: early, to: s1, value: earlyV, asset: 'USDT', comment: 'Mission VIP', time: earlyT })

    // ── La victime ────────────────────────────────────────────────────────────
    const p1 = usdt(r.int(5, 12) * 10)
    const p2 = usdt(r.int(30, 90) * 10)
    const p3 = usdt(r.int(80, 220) * 10)
    const T0 = w.at(0)
    fund.withdraw(victim, ton(r.float(3, 8)), T0 - Math.round(r.float(20, 40) * HOUR), 'TON')
    fund.withdraw(victim, usdt(p1 + p2 + r.int(0, 3) * 10), T0 - Math.round(r.float(2, 12) * HOUR), 'USDT')
    const pay1 = tonTransfer(w, { from: victim, to: s1, value: p1, asset: 'USDT', comment: 'Mission premium 1', time: T0 })
    const payout = tonTransfer(w, { from: s1, to: victim, value: usdt(Math.round(p1 * r.float(1.25, 1.4))), asset: 'USDT', comment: `${company} – commission`, time: T0 + Math.round(r.float(1, 4) * HOUR) })
    const pay2 = tonTransfer(w, { from: victim, to: s1, value: p2, asset: 'USDT', comment: 'Mission premium 2', time: payout.time + Math.round(r.float(2, 8) * HOUR) })
    const p3T = pay2.time + Math.round(r.float(20, 40) * HOUR)
    fund.withdraw(victim, usdt(p3 + r.int(0, 3) * 10), p3T - Math.round(r.float(2, 8) * HOUR), 'USDT')
    const pay3 = tonTransfer(w, { from: victim, to: s1, value: p3, asset: 'USDT', comment: 'Mission premium 3', time: p3T })
    path.push(pay1, pay2, pay3)

    // ── Autres recrues (une paie en TON) ─────────────────────────────────────
    const nOthers = r.int(1, 2)
    for (let i = 0; i < nOthers; i++) {
      const a = w.addr('ton')
      const v = usdt(r.int(20, 150) * 10)
      const t = w.at(r.float(-10, 20))
      w.fundAccount(a, usdt(v + r.int(1, 5) * 10), 'USDT', t - Math.round(r.float(2, 30) * HOUR))
      tonTransfer(w, { from: a, to: s1, value: v, asset: 'USDT', comment: 'Mission premium', time: t })
    }
    const tonPayer = w.addr('ton')
    const tonV = ton(Math.round(r.float(120, 600)))
    const tonT = w.at(r.float(-10, 20))
    w.fundAccount(tonPayer, ton(tonV + r.float(2, 10)), 'TON', tonT - Math.round(r.float(2, 30) * HOUR))
    tonTransfer(w, { from: tonPayer, to: s1, value: tonV, asset: 'TON', comment: 'Mission premium', time: tonT })

    // ── Bruit de l'exchange (avant de fixer le commentaire de l'escroc) ──────
    dest.noise(16, w.at(-3 * 24), w.at(8 * 24), 'USDT')
    dest.noise(10, w.at(-3 * 24), w.at(8 * 24), 'TON')
    fund.noise(6, w.at(-3 * 24), w.at(6 * 24), 'TON')
    const used = new Set([...w.txs.values()].map((t) => t.memo).filter((m): m is string => !!m))
    const fresh = () => {
      let m = dest.newMemo()
      while (used.has(m)) m = dest.newMemo()
      used.add(m)
      return m
    }
    const memo = fresh()

    // ── Dépôts sur l'adresse partagée de l'exchange ─────────────────────────
    const depT = p3T + Math.round(r.float(4, 18) * HOUR)
    const usdtBal = w.balanceOf(s1, 'USDT')
    const depUsdt = usdt(Math.floor((usdtBal * r.float(0.9, 0.97)) / 10) * 10)
    const dep1 = tonTransfer(w, { from: s1, to: dest.hot, value: depUsdt, asset: 'USDT', comment: memo, time: depT })
    const depTon = ton(Math.floor(w.balanceOf(s1, 'TON') - r.float(1, 3)))
    const dep2 = tonTransfer(w, { from: s1, to: dest.hot, value: depTon, asset: 'TON', comment: memo, time: depT + r.int(8, 40) * 60 })
    path.push(dep1, dep2)

    // Leurres : autres clients déposant au même moment, montants voisins
    for (let i = 0; i < r.int(5, 7); i++) {
      const a = w.addr('ton')
      const v = usdt(Math.round(depUsdt * r.float(0.6, 1.4)))
      const td = depT + r.int(-5 * 3600, 5 * 3600)
      w.fundAccount(a, usdt(v + r.int(2, 30)), 'USDT', td - Math.round(r.float(2, 48) * HOUR))
      tonTransfer(w, { from: a, to: dest.hot, value: v, asset: 'USDT', comment: fresh(), time: td })
    }

    const destName = dest.entity.name
    const paid = usdt(p1 + p2 + p3)

    return {
      world: w,
      title: `Fausse offre d'emploi « ${company} » — ${city}`,
      briefing:
        `${victimName}, demeurant à ${city}, dépose plainte pour escroquerie. ${g('Il', 'Elle')} a été ${g('contacté', 'contactée')} sur Telegram par une « recruteuse » de la société ${company} : quelques euros par vidéo « likée », depuis son téléphone. Après de petits gains réels, on lui a proposé des « missions premium » à prépayer en USDT, remboursées avec 30 % de commission… qui ne sont jamais arrivées.\n\n` +
        `Les paiements ont été faits sur la blockchain TON, depuis son portefeuille. Sur TON, chaque transfert peut porter un commentaire public. Certains exchanges y reçoivent tous les dépôts de leurs clients sur une seule adresse.\n\n` +
        `Votre mission : retrouver l'adresse de l'escroc, suivre les fonds jusqu'à l'exchange et relever ce qui permettra d'identifier le compte crédité.`,
      evidence: [
        {
          id: 'plainte', type: 'plainte', title: 'Procès-verbal de plainte (extrait)', date: depT + 2 * DAY, author: victimName,
          body:
            `« La recruteuse m'envoyait l'adresse à chaque mission, puis elle a supprimé toute la conversation "pour tout le monde". Il me reste mon historique de portefeuille.\n\n` +
            `J'ai payé ${amt(p1, 'USDT')}, puis ${amt(p2, 'USDT')}, puis ${amt(p3, 'USDT')}. Après la première mission, j'ai bien reçu une commission, c'est pour ça que j'ai continué.\n\n` +
            `Mon adresse TON : ${A(w, victim)}\n` +
            `Transaction de la troisième mission (${fmtDate(pay3.time)}) : ${pay3.hash} »`,
        },
        {
          id: 'telegram', type: 'telegram', title: 'Capture du premier message reçu', author: `@${recruiter}`, date: T0 - 3 * DAY,
          body:
            `Bonjour 😊 je suis Laura, chargée de recrutement chez ${company}.\n` +
            `Nous cherchons des personnes pour aimer des vidéos et améliorer le classement de nos clients.\n` +
            `50 à 300 € par jour, depuis votre téléphone, 30 min par jour 💼\n` +
            `Paiement en USDT, simple et rapide. Intéressé${g('', 'e')} ?`,
        },
      ],
      seeds: [victim],
      objectives: [
        {
          id: 'o1', type: 'address', points: 20,
          prompt: 'À quelle adresse TON la victime a-t-elle payé ses « missions » ?',
          answer: [s1],
          hint: 'Ouvrez la transaction citée dans la plainte, ou dépliez les sorties du portefeuille de la victime.',
          explanation: `Les trois paiements (${amt(paid, 'USDT')} au total) vont vers ${A(w, s1)}. Le transfert en sens inverse (« commission ») part de la même adresse : l'escroc rend une petite somme pour gagner la confiance de sa victime.`,
        },
        {
          id: 'o2', type: 'entity', points: 15,
          prompt: 'Sur quel exchange l\'escroc a-t-il déposé les fonds ?',
          answer: [destKey],
          hint: 'Dépliez les sorties de l\'adresse de l\'escroc : hors la petite « commission », les fonds partent vers une adresse étiquetée « Hot Wallet ».',
          explanation: `Les USDT et les TON partent vers ${A(w, dest.hot)}, l'adresse de ${destName} qui reçoit les dépôts de tous ses clients sur TON.`,
        },
        {
          id: 'o3', type: 'number', points: 25, tolerance: 0, unit: 'commentaire',
          prompt: 'Quel commentaire accompagne les dépôts de l\'escroc sur l\'exchange ?',
          answer: Number(memo),
          hint: 'Sélectionnez une transaction de l\'escroc vers le hot wallet : le champ « Commentaire (memo) » s\'affiche dans le panneau de droite. Les commentaires des paiements de la victime ne servent à rien ici.',
          explanation: `Les deux dépôts portent le commentaire ${memo}. Les autres dépôts reçus au même moment par ${destName} portent d'autres commentaires : ce sont d'autres clients. Les textes « Mission premium… » n'étaient que des libellés saisis par la victime, sans valeur pour la réquisition.`,
        },
        {
          id: 'o4', type: 'amount', points: 20, unit: 'USDT', tolerance: 0.01,
          prompt: 'Combien d\'USDT l\'escroc a-t-il déposés sur l\'exchange ?',
          answer: depUsdt,
          hint: 'Ne comptez que le dépôt en USDT parti de l\'adresse de l\'escroc, pas les dépôts voisins d\'autres clients.',
          explanation: `${amt(depUsdt, 'USDT')}, plus ${amt(depTon, 'TON')} dans un second dépôt. Le montant dépasse les paiements de ${victimName} (${amt(paid, 'USDT')}) : d'autres recrues ont payé la même adresse.`,
        },
        {
          id: 'o5', type: 'choice', points: 20,
          prompt: 'Pourquoi la réquisition à l\'exchange doit-elle mentionner ce commentaire ?',
          ...choice(r,
            'L\'adresse est commune à tous les clients : seul le commentaire, avec le hash, désigne le compte',
            [
              'Le commentaire contient la clé privée de l\'escroc : l\'exchange pourra alors bloquer ses fonds sans délai',
              'Sans commentaire, une transaction TON n\'est pas confirmée et le dépôt pourrait être annulé',
              'Le commentaire est le numéro de téléphone du client, ce qui dispense de demander son identité',
            ]),
          explanation: `${destName} reçoit sur ${A(w, dest.hot)} les dépôts de milliers de clients : sans le commentaire ${memo}, impossible de savoir quel compte a été crédité. La réquisition cite l'adresse, le commentaire, les hash (${dep1.hash.slice(0, 12)}… et ${dep2.hash.slice(0, 12)}…), dates et montants, et demande identité, IP, historique et gel du compte. ${procedureFor(dest.entity)}`,
        },
      ],
      truth: {
        path: [earlyTx.id, ...path.map((t) => t.id)],
        addresses: [s1],
        debrief:
          `1. ${victimName} paie ${amt(p1, 'USDT')}, ${amt(p2, 'USDT')} puis ${amt(p3, 'USDT')} (jetons USDT sur TON) à ${A(w, s1)}. Entre les deux premiers paiements, l'escroc lui renvoie une « commission » : technique classique de mise en confiance.\n` +
          `2. D'autres recrues paient la même adresse, en USDT et en TON.\n` +
          `3. L'escroc dépose ${amt(depUsdt, 'USDT')} puis ${amt(depTon, 'TON')} sur l'adresse partagée de ${destName}, avec le commentaire ${memo}.\n\n` +
          `À retenir : sur TON (comme sur XRP avec le destination tag), un exchange peut utiliser une seule adresse pour tous ses clients. Le commentaire est alors l'identifiant du compte. Plusieurs commentaires circulent dans un dossier : seul celui des dépôts vers l'exchange désigne le compte de l'escroc.\n\n` +
          `Réflexes de l'enquêteur : réquisition à ${destName} citant le commentaire, les hash, dates et montants, avec demande de gel ; signalement du compte Telegram de la « recruteuse » ; recherche d'autres plaintes visant la même adresse.`,
      },
      hints: [
        'Partez du portefeuille de la victime : ses paiements partent tous vers la même adresse.',
        'Dépliez les sorties de cette adresse. L\'adresse finale reçoit énormément de dépôts de tiers : c\'est une adresse partagée d\'exchange.',
        'Dans le détail d\'une transaction TON, le commentaire apparaît dans un encadré « Commentaire (memo) ».',
      ],
    }
  },
}
