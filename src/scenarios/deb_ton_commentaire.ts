import { World, type Tx } from '../engine/world'
import { exchange, tonTransfer, HOUR, DAY } from '../engine/patterns'
import { roundAsset } from '../engine/chains'
import { dusting } from '../engine/realism'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, de, fakeCity, fakeHandle, fakePerson, fmtDate, procedureFor } from './util'

// Arnaque aux « tâches rémunérées » sur Telegram, payée en USDT sur TON.
// L'adresse de la « recruteuse » encaisse les « missions premium » de
// plusieurs recrues et renvoie à chacune une petite « commission » pour la
// ferrer : entrées et sorties se mélangent, il faut trier. L'escroc ne passe
// pas par un exchange : il vide la collecte vers TonPocket, portefeuille
// custodial intégré à Telegram, dont l'adresse est PARTAGÉE par tous les
// utilisateurs. Seul le commentaire désigne son compte. Fin d'affaire : service
// de portefeuille. Habillage : recrues avant et après les faits, une recrue qui
// paie en TON, fonds de roulement gardé pour les commissions, poussière sosie.

const COMPANIES = ['MediaBoost Agency', 'StarRank Digital', 'ClickWave Partners', 'Optima Reviews', 'TrendLab Marketing'] as const
const usdt = (v: number) => roundAsset('USDT', v)
const ton = (v: number) => roundAsset('TON', v)
/** Même jour UTC que `ts`, à l'heure UTC `h`. */
const dayAt = (ts: number, h: number) => Math.floor(ts / DAY) * DAY + h * HOUR
/** Repousse au matin (6 h–8 h UTC) un horodatage tombé en soirée tardive ou la nuit (21 h–6 h UTC). */
function awake(ts: number, jitterMin: number): number {
  const h = Math.floor(ts / HOUR) % 24
  if (h >= 6 && h < 21) return ts
  return dayAt(h >= 21 ? ts + DAY : ts, 6) + jitterMin * 60
}

export const debTonCommentaire: ScenarioTemplate = {
  id: 'deb-ton-commentaire',
  title: 'TON : le commentaire qui désigne le compte',
  tagline: 'Une fausse offre d\'emploi sur Telegram, des « commissions » pour ferrer les recrues, et un portefeuille custodial à adresse partagée.',
  description:
    'Recrutée sur Telegram pour des « tâches rémunérées », une victime a prépayé des « missions premium » en USDT sur la blockchain TON. L\'adresse de la recruteuse encaisse les paiements de plusieurs recrues et leur renvoie de petites « commissions » : triez entrées et sorties pour recenser les victimes et chiffrer le préjudice net. Les fonds finissent sur TonPocket, un portefeuille intégré à Telegram dont l\'adresse est commune à tous ses utilisateurs : relevez le commentaire qui désigne le compte de l\'escroc, et ce qui reste gelable.',
  difficulty: 1,
  chains: ['ton'],
  skills: ['lecture_tx', 'tokens', 'memo', 'typologies', 'requisition'],
  estMinutes: 35,
  lessons: ['ton-telegram', 'xrp-memos', 'requisitions', 'typologies'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const victimP = fakePerson(r)
    const victimName = victimP.name
    const g = victimP.g
    const city = fakeCity(r)
    const company = r.pick(COMPANIES)
    const recruiter = fakeHandle(r)
    const alias = r.pick(['Laura', 'Emma', 'Chloé', 'Sarah', 'Julie'])

    const fundKey = r.pick(['binance', 'okx', 'kraken'] as const)
    const fund = exchange(w, fundKey, 'ton')
    const tp = exchange(w, 'tonpocket', 'ton')
    w.setEntity(tp.hot, tp.entity, 'TonPocket — Adresse de dépôt partagée')

    const scamE = w.customEntity({ name: `Fausse recruteuse « ${company} » (inconnu)`, category: 'scam', description: 'Arnaque aux tâches rémunérées : petites commissions, puis « missions premium » à prépayer.' })
    const victimE = w.customEntity({ name: victimName, category: 'victim' })
    const victim = w.addr('ton', { entity: victimE })
    const S = w.addr('ton', { entity: scamE })
    const path: Tx[] = []
    const T0 = w.at(0)

    /** Nouvelle recrue (portefeuille approvisionné juste avant). */
    const recruit = (usdtNeed: number, t: number, asset: 'USDT' | 'TON' = 'USDT') => {
      const a = w.addr('ton')
      w.fundAccount(a, ton(r.float(2, 6)), 'TON', t - Math.round(r.float(30, 200) * HOUR))
      if (asset === 'USDT') w.fundAccount(a, usdt(usdtNeed + r.int(1, 6) * 10), 'USDT', t - Math.round(r.float(2, 30) * HOUR))
      else w.fundAccount(a, ton(usdtNeed + r.float(2, 10)), 'TON', t - Math.round(r.float(2, 30) * HOUR))
      return a
    }
    const payouts: Tx[] = []
    const payout = (to: string, small: number, t: number) => {
      const tx = tonTransfer(w, { from: S, to, value: usdt(Math.round(small * r.float(1.25, 1.4))), asset: 'USDT', comment: `${company} – commission`, time: t })
      payouts.push(tx)
      return tx
    }

    // ── Avant les faits : une première recrue (signalée ailleurs) ───────────
    const earlyV = usdt(r.int(40, 120) * 10)
    const earlyT = T0 - Math.round(r.float(16, 24) * DAY)
    const early = recruit(earlyV, earlyT)
    const earlyTx = tonTransfer(w, { from: early, to: S, value: earlyV, asset: 'USDT', comment: 'Mission VIP', time: earlyT })

    // ── Une recrue « ferrée » : petite mission, commission, grosse mission ──
    const aSmall = usdt(r.int(3, 8) * 10)
    const aBig = usdt(r.int(30, 120) * 10)
    const aT = T0 - Math.round(r.float(6, 9) * DAY)
    const recA = recruit(aSmall + aBig, aT)
    tonTransfer(w, { from: recA, to: S, value: aSmall, asset: 'USDT', comment: 'Mission premium 1', time: aT })
    payout(recA, aSmall, aT + Math.round(r.float(1, 4) * HOUR))
    tonTransfer(w, { from: recA, to: S, value: aBig, asset: 'USDT', comment: 'Mission premium 2', time: aT + Math.round(r.float(20, 40) * HOUR) })

    // ── Une recrue qui paie en TON ───────────────────────────────────────────
    const tonV = ton(Math.round(r.float(120, 500)))
    const tonT = T0 - Math.round(r.float(30, 80) * HOUR)
    const recC = recruit(tonV, tonT, 'TON')
    tonTransfer(w, { from: recC, to: S, value: tonV, asset: 'TON', comment: 'Mission premium', time: tonT })

    // ── La victime ────────────────────────────────────────────────────────────
    const p1 = usdt(r.int(5, 12) * 10)
    const p2 = usdt(r.int(30, 90) * 10)
    const p3 = usdt(r.int(80, 220) * 10)
    fund.withdraw(victim, ton(r.float(3, 8)), T0 - Math.round(r.float(20, 40) * HOUR), 'TON')
    fund.withdraw(victim, usdt(p1 + p2 + r.int(0, 3) * 10), T0 - Math.round(r.float(2, 12) * HOUR), 'USDT')
    const pay1 = tonTransfer(w, { from: victim, to: S, value: p1, asset: 'USDT', comment: 'Mission premium 1', time: T0 })
    const vPayout = payout(victim, p1, T0 + Math.round(r.float(1, 4) * HOUR))
    const payoutV = vPayout.transfers[0].value
    // Paiements de la victime en journée (pas de virement à 3 h du matin)
    const pay2 = tonTransfer(w, { from: victim, to: S, value: p2, asset: 'USDT', comment: 'Mission premium 2', time: awake(vPayout.time + Math.round(r.float(2, 8) * HOUR), r.int(0, 120)) })
    const p3T = awake(pay2.time + Math.round(r.float(20, 40) * HOUR), r.int(30, 150))
    fund.withdraw(victim, usdt(p3 + r.int(0, 3) * 10), p3T - Math.round(r.float(2, 8) * HOUR), 'USDT')
    const pay3 = tonTransfer(w, { from: victim, to: S, value: p3, asset: 'USDT', comment: 'Mission premium 3', time: p3T })

    // ── Une recrue ferrée pendant ce temps (petite mission + commission) ────
    const bSmall = usdt(r.int(3, 8) * 10)
    const bT = pay2.time + Math.round(r.float(3, 15) * HOUR)
    const recB = recruit(bSmall, bT)
    tonTransfer(w, { from: recB, to: S, value: bSmall, asset: 'USDT', comment: 'Mission premium 1', time: bT })
    payout(recB, bSmall, bT + Math.round(r.float(1, 3) * HOUR))

    // ── Vidage vers TonPocket : test, USDT puis TON, même commentaire ───────
    tp.noise(18, T0 - 3 * DAY, T0 + 8 * DAY, 'USDT')
    tp.noise(12, T0 - 3 * DAY, T0 + 8 * DAY, 'TON')
    fund.noise(8, T0 - 3 * DAY, T0 + 6 * DAY, 'TON')
    const used = new Set([...w.txs.values()].map((t) => t.memo).filter((m): m is string => !!m))
    const fresh = () => {
      let m = tp.newMemo()
      while (used.has(m)) m = tp.newMemo()
      used.add(m)
      return m
    }
    const memo = fresh()
    const depT = p3T + Math.round(r.float(5, 18) * HOUR)
    const testTon = ton(r.pick([1, 1.5, 2, 3]))
    const depTest = tonTransfer(w, { from: S, to: tp.hot, value: testTon, asset: 'TON', comment: memo, time: depT - r.int(20, 70) * 60 })
    const usdtBal = w.balanceOf(S, 'USDT')
    const depUsdt = usdt(Math.floor((usdtBal * r.float(0.84, 0.92)) / 10) * 10)
    const depU = tonTransfer(w, { from: S, to: tp.hot, value: depUsdt, asset: 'USDT', comment: memo, time: depT })
    const depTon = ton(Math.floor(w.balanceOf(S, 'TON') - r.float(2, 5)))
    const depN = tonTransfer(w, { from: S, to: tp.hot, value: depTon, asset: 'TON', comment: memo, time: depT + r.int(6, 35) * 60 })
    path.push(earlyTx, pay1, vPayout, pay2, pay3, depTest, depU, depN)

    // Autres utilisateurs de TonPocket déposant au même moment, montants voisins
    for (let i = 0; i < r.int(5, 7); i++) {
      const a = w.addr('ton')
      const v = usdt(Math.round(depUsdt * r.float(0.6, 1.4)))
      const td = depT + r.int(-5 * 3600, 5 * 3600)
      w.fundAccount(a, usdt(v + r.int(2, 30)), 'USDT', td - Math.round(r.float(2, 48) * HOUR))
      tonTransfer(w, { from: a, to: tp.hot, value: v, asset: 'USDT', comment: fresh(), time: td })
    }

    // ── Après les faits : le fonds de roulement paie la recrue suivante ─────
    // Le fonds de roulement doit couvrir la commission (petite mission + ~40 %) sans financement extérieur
    const dSmall = usdt(Math.max(10, Math.min(r.int(3, 8) * 10, Math.floor((w.balanceOf(S, 'USDT') - 1) / 1.5 / 10) * 10)))
    const dT = depT + Math.round(r.float(30, 60) * HOUR)
    const recD = recruit(dSmall, dT)
    tonTransfer(w, { from: recD, to: S, value: dSmall, asset: 'USDT', comment: 'Mission premium 1', time: dT })
    payout(recD, dSmall, dT + Math.round(r.float(1, 3) * HOUR))

    // ── Poussière sosie (address poisoning) ─────────────────────────────────
    const poison = dusting(w, S, { time: depT + 20 * HOUR, n: 2, spreadH: 30 })

    // ── Réponses (monde final) ───────────────────────────────────────────────
    const ins = w.txsOf(S).flatMap((t) => t.transfers).filter((x) => x.to === S && x.value >= 1)
    const payers = new Set(ins.map((x) => x.from))
    const nPayers = payers.size
    const outs = w.txsOf(S).flatMap((t) => t.transfers).filter((x) => x.from === S && payers.has(x.to))
    const nPayouts = outs.length
    const payoutsTotal = usdt(outs.reduce((s, x) => s + x.value, 0))
    const paid = usdt(p1 + p2 + p3)
    const net = usdt(paid - payoutV)
    const tonDeposited = ton(testTon + depTon)
    const leftUsdt = usdt(w.balanceOf(S, 'USDT'))
    const earlyP = fakePerson(r)
    const earlyCity = fakeCity(r)
    const nPoison = poison.txs.length
    const plainteT = dayAt(depT + 2 * DAY, 8) + r.int(0, 8 * 60) * 60
    const signalT = dayAt(depT + 3 * DAY, 7) + r.int(0, 9 * 60) * 60
    const commissariat = `commissariat ${de(earlyCity)}`

    return {
      world: w,
      title: `Fausse offre d'emploi « ${company} » — ${city}`,
      briefing:
        `${victimName}, demeurant à ${city}, dépose plainte pour escroquerie. ${g('Il', 'Elle')} a été ${g('contacté', 'contactée')} sur Telegram par « ${alias} », recruteuse de la société ${company} : quelques euros par vidéo « likée », depuis son téléphone. Après une première « mission premium » vraiment rémunérée, on lui en a proposé d'autres, plus chères, remboursées avec 30 % de commission… qui ne sont jamais arrivées.\n\n` +
        `Les paiements ont été faits en USDT sur la blockchain TON, où chaque transfert peut porter un commentaire public. Certains services, comme le portefeuille TonPocket intégré à Telegram, reçoivent les fonds de tous leurs utilisateurs sur une seule adresse. Un autre service vous a par ailleurs transmis un signalement visant la même « société ».\n\n` +
        `Votre mission : retrouver l'adresse de l'escroc, chiffrer le préjudice net de la victime, trier les entrées et sorties de cette adresse pour recenser les recrues, suivre les fonds jusqu'à leur point de sortie et relever ce qui permettra d'identifier le compte crédité.`,
      evidence: [
        {
          id: 'plainte', type: 'plainte', title: 'Procès-verbal de plainte (extrait)', date: plainteT, author: victimName,
          body:
            `« ${alias} m'envoyait l'adresse à chaque mission, puis elle a supprimé toute la conversation "pour tout le monde". Il me reste deux captures d'écran que j'avais faites et mon historique de portefeuille.\n\n` +
            `J'ai payé ${amt(p1, 'USDT')}, puis ${amt(p2, 'USDT')}, puis ${amt(p3, 'USDT')}. Après la première mission, j'ai bien reçu une commission, c'est pour ça que j'ai continué.\n\n` +
            `Mon adresse TON : ${A(w, victim)}\n` +
            `Transaction de la troisième mission (${fmtDate(pay3.time)}) : ${pay3.hash} »`,
        },
        {
          id: 'telegram', type: 'telegram', title: 'Capture du premier message reçu', author: `@${recruiter}`, date: T0 - 3 * DAY,
          body:
            `Bonjour 😊 je suis ${alias}, chargée de recrutement chez ${company}.\n` +
            `Nous cherchons des personnes pour aimer des vidéos et améliorer le classement de nos clients.\n` +
            `50 à 300 € par jour, depuis votre téléphone, 30 min par jour 💼\n` +
            `Paiement en USDT, simple et rapide. Intéressé${g('', 'e')} ?`,
        },
        {
          id: 'telegram2', type: 'telegram', title: 'Capture — consigne de la « mission premium 3 »', author: `@${recruiter}`, date: p3T - 45 * 60,
          body:
            `Mission premium 3 débloquée 🎉 Gain prévu : ${amt(usdt(p3 * 1.3), 'USDT')}\n` +
            `Envoyez ${amt(p3, 'USDT')} (réseau TON) à l'adresse de la mission habituelle, avec le commentaire « Mission premium 3 ».\n` +
            `⚠️ Le remboursement et la commission sont versés après validation de toutes les tâches du lot.`,
        },
        {
          id: 'signalement', type: 'pv', title: `Signalement transmis par le ${commissariat}`, date: signalT, author: `Commissariat ${de(earlyCity)}`,
          body:
            `Main courante ${de(earlyP.name)}, recruté${earlyP.g('', 'e')} sur Telegram par « ${company} » pour des « tâches rémunérées ».\n\n` +
            `${earlyP.g('Il', 'Elle')} déclare avoir payé une « Mission VIP » de ${amt(earlyV, 'USDT')} (réseau TON) le ${fmtDate(earlyTx.time, false)}, sans jamais être remboursé${earlyP.g('', 'e')}. Hash et adresse non conservés : ${earlyP.g('il', 'elle')} a désinstallé son application de portefeuille.\n\n` +
            `Transmis pour rapprochement éventuel.`,
        },
      ],
      seeds: [victim],
      objectives: [
        {
          id: 'o1', type: 'address', points: 9,
          prompt: 'À quelle adresse TON la victime a-t-elle payé ses « missions » ?',
          answer: [S],
          hint: 'Ouvrez la transaction citée dans la plainte, ou dépliez les sorties du portefeuille de la victime.',
          explanation: `Les trois paiements (${amt(paid, 'USDT')} au total) vont vers ${A(w, S)}. Le transfert en sens inverse (« commission ») part de la même adresse : l'escroc rend une petite somme pour gagner la confiance de sa victime.`,
        },
        {
          id: 'o6', type: 'amount', points: 8, unit: 'USDT', tolerance: 0.01,
          prompt: 'Quel montant la « commission » renvoyée par l\'escroc à la victime représentait-elle ?',
          answer: payoutV,
          hint: 'Dans les transactions du portefeuille de la victime, cherchez le seul transfert entrant d\'USDT venant de l\'adresse de l\'escroc (son commentaire évoque une commission).',
          explanation: `${amt(payoutV, 'USDT')}, versés le ${fmtDate(vPayout.time)}, quelques heures après la première mission (${amt(p1, 'USDT')}) : un « gain » d'environ ${Math.round((payoutV / p1 - 1) * 100)} %. C'est le ressort de l'arnaque aux tâches : un premier retour réel, financé par l'argent des autres recrues, pour convaincre de payer davantage ensuite. Ce transfert entrant doit figurer au dossier : il réduit le préjudice et prouve le contact avec l'escroc.`,
        },
        {
          id: 'o7', type: 'amount', points: 9, unit: 'USDT', tolerance: 0.01,
          prompt: 'Quel est le préjudice net de la victime en USDT (paiements envoyés moins commission reçue) ?',
          answer: net,
          hint: 'Additionnez les trois paiements cités dans la plainte, puis retranchez le transfert reçu de l\'escroc.',
          explanation: `${amt(paid, 'USDT')} envoyés − ${amt(payoutV, 'USDT')} reçus = ${amt(net, 'USDT')}. Le préjudice se chiffre net des sommes rendues par l'escroc : présenter le montant brut exposerait la procédure à une contestation facile. Les frais de réseau (en TON) sont accessoires et se mentionnent à part.`,
        },
        {
          id: 'o9', type: 'number', points: 9, tolerance: 0, unit: 'portefeuilles',
          prompt: 'Combien de portefeuilles distincts (celui de la victime compris) ont payé l\'adresse de l\'escroc ?',
          answer: nPayers,
          hint: 'Listez les transferts entrants de l\'adresse de l\'escroc, en USDT comme en TON, et comptez les adresses émettrices différentes. Écartez les montants de quelques centimes venus d\'adresses ressemblantes.',
          explanation: `${nPayers} portefeuilles : ${victimName} (trois paiements), la recrue signalée par le ${commissariat}, une recrue qui paie en TON, et ${nPayers - 3} autres recrues aux libellés « Mission premium ». On n'oublie pas l'actif natif : une victime qui paie en TON reste une victime. Les ${nPoison} micro-transferts venus d'adresses qui imitent celle de l'escroc sont de l'empoisonnement d'adresse, pas des paiements.`,
        },
        {
          id: 'o13', type: 'number', points: 9, tolerance: 0, unit: 'commissions',
          prompt: 'Combien de « commissions » l\'adresse de l\'escroc a-t-elle versées à des recrues (celle de la victime comprise) ?',
          answer: nPayouts,
          hint: 'Parmi les sorties de l\'adresse de l\'escroc, ne retenez que les transferts vers des portefeuilles qui l\'ont eux-mêmes payée : les gros envois vers l\'adresse étiquetée sont autre chose.',
          explanation: `${nPayouts} commissions, pour ${amt(payoutsTotal, 'USDT')} au total : chacune suit de quelques heures une petite « mission premium 1 », et vaut 25 à 40 % de plus. Il suffit que quelques recrues paient ensuite des missions plus chères, comme la victime, pour que l'appât soit largement rentabilisé. Les autres sorties partent vers l'adresse partagée de TonPocket : c'est l'encaissement, pas un remboursement.`,
        },
        {
          id: 'o8', type: 'tx', points: 8,
          prompt: 'Quelle transaction correspond au paiement de la recrue signalée par l\'autre service ?',
          answer: [earlyTx.id],
          hint: 'Le signalement donne une date et un montant : cherchez parmi les transferts entrants de l\'adresse de l\'escroc celui qui correspond aux deux.',
          explanation: `Le ${fmtDate(earlyTx.time)}, ${amt(earlyV, 'USDT')} arrivent sur ${A(w, S)} avec le commentaire « Mission VIP » (${earlyTx.hash.slice(0, 12)}…) : montant et date concordent. C'est aussi le plus ancien paiement reçu par cette adresse : l'escroquerie a commencé bien avant les faits dénoncés. Rattacher le signalement à une transaction permet de joindre les procédures et de retrouver l'adresse de la recrue, qu'elle avait perdue.`,
        },
        {
          id: 'o2', type: 'entity', points: 9,
          prompt: 'Vers quel service l\'escroc a-t-il fait sortir les fonds ?',
          answer: ['tonpocket'],
          hint: 'Hors commissions, les sorties de l\'adresse de l\'escroc vont vers une adresse étiquetée qui reçoit énormément de dépôts de tiers.',
          explanation: `Les USDT et les TON partent vers ${A(w, tp.hot)}, l'adresse partagée de TonPocket : un portefeuille custodial (fictif) intégré à Telegram, où chacun détient un solde sur un compte rattaché à son identifiant Telegram. Ce n'est pas un exchange : les transferts entre utilisateurs restent internes, invisibles on-chain. ${procedureFor(tp.entity)}`,
        },
        {
          id: 'o3', type: 'number', points: 10, tolerance: 0, unit: 'commentaire',
          prompt: 'Quel commentaire accompagne les dépôts de l\'escroc sur TonPocket ?',
          answer: Number(memo),
          hint: 'Sélectionnez une transaction de l\'escroc vers l\'adresse partagée : le champ « Commentaire (memo) » s\'affiche dans le panneau de droite. Les libellés « Mission premium » ne servent à rien ici.',
          explanation: `Les trois dépôts (un test en TON, puis les USDT, puis les TON) portent le commentaire ${memo}. Les dépôts d'autres utilisateurs arrivés au même moment portent d'autres commentaires : d'autres comptes. Les textes « Mission premium… » ou « commission » ne sont que des libellés saisis par les recrues ou l'escroc, sans valeur pour désigner un compte.`,
        },
        {
          id: 'o4', type: 'amount', points: 8, unit: 'USDT', tolerance: 0.01,
          prompt: 'Combien d\'USDT l\'escroc a-t-il déposés sur TonPocket ?',
          answer: depUsdt,
          hint: 'Ne comptez que le transfert d\'USDT parti de l\'adresse de l\'escroc avec son commentaire, pas les dépôts voisins d\'autres utilisateurs.',
          explanation: `${amt(depUsdt, 'USDT')} le ${fmtDate(depU.time)}. ${depUsdt > paid ? `Le montant dépasse les paiements de la victime (${amt(paid, 'USDT')}) : d'autres recrues ont payé la même adresse.` : `Les fonds de la victime (${amt(paid, 'USDT')}) s'y mêlent à ceux d'autres recrues : sur un modèle à comptes, on ne sait pas quels USDT précis partent.`} L'escroc ne vide pas tout : il garde des USDT pour payer les commissions des recrues suivantes.`,
        },
        {
          id: 'o10', type: 'amount', points: 8, unit: 'TON', tolerance: 0.01,
          prompt: 'Combien de TON au total l\'escroc a-t-il déposés sur TonPocket sous ce commentaire (test compris) ?',
          answer: tonDeposited,
          hint: 'Deux transferts de TON portent le commentaire : un petit, juste avant le dépôt d\'USDT, et un plus gros juste après. Additionnez-les.',
          explanation: `${amt(testTon, 'TON')} de test + ${amt(depTon, 'TON')} = ${amt(tonDeposited, 'TON')}. Le petit envoi préalable vérifie que le commentaire est bien reconnu par le service avant d'envoyer le gros des fonds : c'est un réflexe d'utilisateur averti. Ces TON viennent pour l'essentiel de la recrue qui a payé en TON. La réquisition cite les trois dépôts (trois hash, deux actifs, un commentaire).`,
        },
        {
          id: 'o12', type: 'amount', points: 8, unit: 'USDT', tolerance: 0.02,
          prompt: 'Combien d\'USDT restent sur l\'adresse de l\'escroc à la fin de l\'analyse ?',
          answer: leftUsdt,
          hint: 'Lisez le solde USDT de l\'adresse de l\'escroc dans son résumé.',
          explanation: `${amt(leftUsdt, 'USDT')} : le fonds de roulement que l'escroc garde pour verser les commissions des prochaines recrues (il en paie d'ailleurs une après le vidage). Sur TON aussi, l'USDT est émis par Tether : ce solde peut faire l'objet d'une demande de gel à l'émetteur, ce qui coupe l'appât des commissions.`,
        },
        {
          id: 'o5', type: 'choice', points: 8,
          prompt: 'Pourquoi la réquisition à TonPocket doit-elle mentionner ce commentaire ?',
          ...choice(r,
            'L\'adresse est commune à tous les utilisateurs : seul le commentaire, avec les hash, désigne le compte crédité',
            [
              'Le commentaire contient la clé privée de l\'escroc : le service pourra vider son portefeuille',
              'Sans commentaire, une transaction TON n\'est pas confirmée et le dépôt pourrait être annulé',
              'Le commentaire est le numéro de téléphone de l\'utilisateur, ce qui dispense de toute réquisition',
            ]),
          hint: 'Regardez combien de dépôts différents arrivent sur la même adresse de TonPocket.',
          explanation: `TonPocket reçoit sur ${A(w, tp.hot)} les dépôts de tous ses utilisateurs : sans le commentaire ${memo}, impossible de savoir quel compte a été crédité. La réquisition cite l'adresse, le commentaire, les hash, dates et montants des trois dépôts.`,
        },
        {
          id: 'o11', type: 'choice', points: 8,
          prompt: 'Que demander à TonPocket, et qu\'en attendre ?',
          ...choice(r,
            'Le gel du compte désigné par le commentaire, l\'identifiant Telegram et le numéro de téléphone associés, l\'historique interne',
            [
              'Rien : un portefeuille intégré à une messagerie ne conserve aucune donnée sur ses utilisateurs',
              'Le gel de l\'adresse partagée tout entière, qui contient les fonds de l\'escroc',
              'L\'annulation des trois dépôts, que le service peut renvoyer vers les recrues',
            ]),
          hint: 'Le service tient-il des comptes ? À quoi sont-ils rattachés ?',
          explanation: `TonPocket tient un compte par utilisateur, rattaché à un compte Telegram : identifiant, pseudonyme, numéro de téléphone, historique des dépôts, retraits et transferts internes. Il peut bloquer ce compte (gel conservatoire). Ses données peuvent aussi relier le compte à @${recruiter}, la recruteuse : ce serait un lien décisif. Le KYC est faible sous un plafond : le numéro de téléphone sera peut-être la meilleure piste. Geler l'adresse partagée bloquerait tous les utilisateurs, et une transaction confirmée ne s'annule pas.`,
        },
      ],
      truth: {
        path: path.map((t) => t.id),
        addresses: [S, tp.hot],
        debrief:
          `1. Avant les faits, une première recrue (signalée par le ${commissariat}) paie ${amt(earlyV, 'USDT')} à ${A(w, S)} (« Mission VIP »). D'autres suivent, dont une en TON.\n` +
          `2. ${victimName} paie ${amt(p1, 'USDT')}, ${amt(p2, 'USDT')} puis ${amt(p3, 'USDT')} à la même adresse. Entre les deux premiers paiements, l'escroc lui renvoie ${amt(payoutV, 'USDT')} de « commission » : préjudice net ${amt(net, 'USDT')}.\n` +
          `3. L'adresse de l'escroc mêle ${nPayers} portefeuilles payeurs et ${nPayouts} commissions de mise en confiance (${amt(payoutsTotal, 'USDT')}), plus ${nPoison} micro-transferts sosies sans rapport.\n` +
          `4. Le ${fmtDate(depT)}, l'escroc vide l'essentiel vers l'adresse partagée de TonPocket, toujours avec le commentaire ${memo} : ${amt(testTon, 'TON')} de test, ${amt(depUsdt, 'USDT')}, puis ${amt(depTon, 'TON')}.\n` +
          `5. Il garde ${amt(leftUsdt, 'USDT')} pour les commissions suivantes : une nouvelle recrue est ferrée après le vidage.\n\n` +
          `À retenir : sur TON (comme sur XRP avec le destination tag), un service peut recevoir tous ses utilisateurs sur une seule adresse ; le commentaire est alors l'identifiant du compte. Une adresse d'escroc qui renvoie de petites sommes à ses victimes n'est pas « honnête » : c'est l'appât. Le préjudice se calcule net de ces sommes.\n\n` +
          `Réflexes de l'enquêteur : réquisition à TonPocket citant le commentaire, les hash, dates et montants, avec demande de gel du compte ; demande de gel à Tether sur le reliquat d'USDT ; signalement du compte @${recruiter} à Telegram ; information du ${commissariat} ; identification des autres recrues à partir de leurs adresses.`,
      },
      hints: [
        'Partez du portefeuille de la victime : ses paiements partent tous vers la même adresse, et un transfert en revient.',
        'Sur l\'adresse de l\'escroc, les entrées sont des recrues (en USDT comme en TON), les petites sorties vers ces mêmes recrues sont des commissions.',
        'Les grosses sorties vont vers une adresse qui reçoit énormément de dépôts de tiers : une adresse partagée de service.',
        'Dans le détail d\'une transaction TON, le commentaire apparaît dans un encadré « Commentaire (memo) ».',
      ],
    }
  },
}
