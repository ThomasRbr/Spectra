import { World, type Tx } from '../engine/world'
import { exchange, HOUR, DAY } from '../engine/patterns'
import { roundAsset } from '../engine/chains'
import { lookalike } from '../engine/addressgen'
import { decoyBranches, dusting, type Branch } from '../engine/realism'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, de, fakeCity, fakePerson, fmtDate, procedureFor } from './util'

/** Affichage tronqué tel qu'il apparaît dans une application portefeuille. */
function trunc(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-5)}`
}

/** Heure de Paris (0–23) d'un horodatage. */
const parisHour = (ts: number) => Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone: 'Europe/Paris' }).format(new Date(ts * 1000)))
/** Même jour que `ts`, à `h` heures pile (heure de Paris). */
const atHour = (ts: number, h: number) => ts - (ts % HOUR) + (h - parisHour(ts)) * HOUR

const FATE: Record<Branch['fate'], string> = {
  dort: 'n\'a plus bougé',
  'dépensée': 'a servi à de petits paiements',
  retour: 'a été renvoyée vers le hub',
  'éclatée': 'a été ré-éclatée en petites sommes',
}

export const accAddressPoisoning: ScenarioTemplate = {
  id: 'address-poisoning',
  title: 'Address poisoning sur Tron',
  tagline: 'Trois sosies dans l\'historique, un copier-coller de trop : retrouver la vraie adresse, la fausse, et les USDT encore gelables.',
  description:
    'Une indépendante transfère chaque mois ses USDT vers son compte Coinhouse. Cette fois, son test puis son virement sont partis vers une adresse qui ressemble trait pour trait à la bonne. Son historique contient plusieurs sosies : distinguez l\'adresse légitime de celles des empoisonneurs, isolez la transaction d\'empoisonnement, remontez le hub qui finance les sosies et le collecteur qui regroupe d\'autres victimes, puis localisez les USDT encore gelables par l\'émetteur.',
  difficulty: 2,
  chains: ['tron'],
  skills: ['tron', 'tokens', 'poisoning', 'typologies', 'exchange_id', 'gel'],
  estMinutes: 50,
  lessons: ['tron-usdt', 'address-poisoning', 'typologies', 'exchanges', 'gel-saisie'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const victimName = fakePerson(r, 'f').name
    const city = fakeCity(r)
    const city2 = r.pick(['Lyon', 'Nantes', 'Lille', 'Toulouse', 'Bordeaux', 'Marseille', 'Nice', 'Rouen'].filter((c) => c !== city))

    const own = exchange(w, 'coinhouse', 'tron')
    const destKey = r.pick(['huobex', 'okx', 'binance'] as const)
    const dest = exchange(w, destKey, 'tron')
    // Plateforme d'où proviennent les TRX du hub (pivot d'identification du réseau)
    const hubSrcKey = r.pick((['binance', 'okx', 'huobex', 'kraken'] as const).filter((k) => k !== destKey))
    const hubSrc = exchange(w, hubSrcKey, 'tron')
    const tether = w.entity('tether')

    const victimE = w.customEntity({ name: victimName, category: 'victim' })
    const victim = w.addr('tron', { entity: victimE })
    const clientE = w.customEntity({ name: 'Client de la victime (société étrangère)', category: 'individual' })
    const client = w.addr('tron', { entity: clientE })
    const attackerE = w.customEntity({ name: 'Réseau d\'address poisoning (inconnu)', category: 'suspect' })

    // ── Vie normale de la victime ────────────────────────────────────────────
    // TRX pour l'énergie / la bande passante, rachetés deux fois

    // L'adresse de dépôt personnelle de la victime sur Coinhouse : non étiquetée
    // dans l'outil (absente de la base d'attribution), elle se reconnaît à son
    // balayage vers le hot wallet Coinhouse.
    const deposit = own.newDeposit()
    w.hiddenAttribution.add(deposit)

    // Historique : le client paie, la victime transfère vers son dépôt Coinhouse
    const nMonths = r.int(4, 6)
    own.withdraw(victim, r.int(150, 400), w.at(-(nMonths * 30 + r.int(10, 25)) * 24), 'TRX')
    own.withdraw(victim, r.int(80, 200), w.at(-r.int(40, 60) * 24), 'TRX')
    const legit: { tx: Tx; value: number; sweep?: Tx }[] = []
    for (let i = 0; i < nMonths; i++) {
      const tIn = w.at(-(nMonths - i) * 30 * 24 - r.float(60, 110))
      const invoice = Math.round(r.float(2500, 9000) / 50) * 50
      w.transfer({ time: tIn, from: client, to: victim, value: invoice, asset: 'USDT' })
      const v = Math.round((invoice * r.float(0.85, 0.98)) / 50) * 50
      const res = own.receive(victim, v, tIn + r.int(4, 30) * HOUR, { asset: 'USDT', depositAddr: deposit })
      legit.push({ tx: res.tx, value: v, sweep: res.sweep })
    }
    const lastLegit = legit[legit.length - 1]
    const prevLegit = legit[legit.length - 3]

    // ── Le réseau : un hub qui finance des sosies en TRX et en USDT ──────────
    const hub = w.addr('tron', { entity: attackerE })
    const hubFundTx = hubSrc.withdraw(hub, r.int(40000, 90000), w.at(-40 * 24), 'TRX')
    w.fundAccount(hub, r.int(300, 900), 'USDT', w.at(-38 * 24))

    /** Sosie financé par le hub (TRX puis quelques USDT), qui envoie ensuite sa poussière. */
    const armFake = (imitated: string, tDust: number, target: string, dustV: number) => {
      const fake = w.addr('tron', { entity: attackerE, addr: lookalike(r, 'tron', A(w, imitated), 6, 5) })
      const gasTx = w.transfer({ time: tDust - r.int(2, 10) * HOUR, from: hub, to: fake, value: r.int(20, 60), asset: 'TRX' })
      w.transfer({ time: tDust - r.int(5, 90) * 60, from: hub, to: fake, value: r.pick([1, 2, 5]), asset: 'USDT', autoFund: false })
      const dustTx = w.transfer({ time: tDust, from: fake, to: target, value: dustV, asset: 'USDT', autoFund: false })
      return { fake, gasTx, dustTx }
    }

    // Le sosie de l'affaire : poussière quelques minutes après le dernier dépôt légitime
    const dust = r.pick([0.01, 0.01, 0.05, 0.1, 1])
    const armed = armFake(deposit, lastLegit.tx.time + r.int(3, 25) * 60, victim, dust)
    const poison = armed.fake
    const poisonGas = armed.gasTx
    const tPoison = armed.dustTx

    // Le collecteur du moment (le réseau en change régulièrement)
    const collector = w.addr('tron', { entity: attackerE })
    w.transfer({ time: w.at(-6 * 24), from: hub, to: collector, value: r.int(100, 300), asset: 'TRX' })

    // Le même hub empoisonne d'autres cibles ; certaines finissent par payer le sosie
    const nFakes = r.int(5, 7)
    const nPaid = r.int(2, 3)
    const paid: { target: string; fake: string; pay: Tx; fwd: Tx; value: number }[] = []
    for (let i = 0; i < nFakes; i++) {
      const target = w.addr('tron')
      const counterpart = w.addr('tron')
      const isPaid = i < nPaid
      const tPay = w.at(-r.float(20, 110))
      const tCp = isPaid ? tPay - r.int(6, 20) * DAY : w.at(-r.float(3, 30) * 24)
      const cpV = Math.round(r.float(300, 15000))
      const v = Math.round(r.float(900, 14000) / 10) * 10
      w.fundAccount(target, cpV + (isPaid ? v : 0) + Math.round(r.float(50, 5000)), 'USDT', tCp - r.int(20, 60) * DAY)
      w.transfer({ time: tCp, from: target, to: counterpart, value: cpV, asset: 'USDT' })
      const f = armFake(counterpart, tCp + r.int(3, 40) * 60, target, r.pick([0.01, 0.05, 0.1, 1]))
      if (isPaid) {
        const pay = w.transfer({ time: tPay, from: target, to: f.fake, value: v, asset: 'USDT' })
        const fwd = w.transfer({ time: tPay + r.int(3, 25) * 60, from: f.fake, to: collector, value: v, asset: 'USDT', autoFund: false })
        paid.push({ target, fake: f.fake, pay, fwd, value: v })
      }
    }

    // ── Deux autres empoisonneurs, étrangers au hub, ont aussi visé la victime ─
    // a) Sosie du client (mêmes 6 premiers et 5 derniers caractères)
    const otherE = w.customEntity({ name: 'Autre empoisonneur (inconnu)', category: 'suspect' })
    const decoyFake = w.addr('tron', { entity: otherE, addr: lookalike(r, 'tron', A(w, client), 6, 5) })
    // Hors de la fenêtre dépôt légitime → poussière du sosie de l'affaire
    let tDecoyIn = w.at(-r.float(20, 40) * 24)
    if (tDecoyIn > lastLegit.tx.time - HOUR && tDecoyIn < tPoison.time + HOUR) tDecoyIn = tPoison.time + 3 * HOUR
    w.fundAccount(decoyFake, r.int(15, 40), 'TRX', tDecoyIn - r.int(1, 8) * HOUR)
    w.fundAccount(decoyFake, r.pick([1, 2, 5]), 'USDT', tDecoyIn - r.int(10, 50) * 60)
    const tDecoy = w.transfer({ time: tDecoyIn, from: decoyFake, to: victim, value: r.pick([0.01, 0.1, 1]), asset: 'USDT', autoFund: false })
    // b) Sosie plus grossier de l'adresse de dépôt (4 premiers et 4 derniers caractères)
    const otherE2 = w.customEntity({ name: 'Autre empoisonneur (inconnu)', category: 'suspect' })
    const weakFake = w.addr('tron', { entity: otherE2, addr: lookalike(r, 'tron', A(w, deposit), 4, 4) })
    const tWeak = prevLegit.tx.time + r.int(10, 50) * 60
    w.fundAccount(weakFake, r.int(15, 40), 'TRX', tWeak - r.int(1, 6) * HOUR)
    w.fundAccount(weakFake, 1, 'USDT', tWeak - r.int(5, 40) * 60)
    const tWeakDust = w.transfer({ time: tWeak, from: weakFake, to: victim, value: r.pick([0.01, 0.02, 0.05]), asset: 'USDT', autoFund: false })

    // ── Grosse facture, envoi test, puis paiement détourné ──────────────────
    const bigInvoice = Math.round(r.float(18000, 60000) / 100) * 100
    const tBigIn = w.transfer({ time: w.at(-r.float(20, 40)), from: client, to: victim, value: bigInvoice, asset: 'USDT' })
    const testV = r.pick([10, 20, 25, 50])
    const tTest = w.transfer({ time: w.at(-r.float(0.4, 0.9)), from: victim, to: poison, value: testV, asset: 'USDT' })
    const lost = Math.round((bigInvoice * r.float(0.9, 0.98)) / 100) * 100
    const tLost = w.transfer({ time: w.at(0), from: victim, to: poison, value: lost, asset: 'USDT' })
    const lossTotal = testV + lost

    // Le sosie transfère chaque réception vers le collecteur (script automatique)
    const fwdTest = w.transfer({ time: tTest.time + r.int(2, 9) * 60, from: poison, to: collector, value: testV, asset: 'USDT' })
    const tFwd = w.transfer({ time: tLost.time + r.int(4, 30) * 60, from: poison, to: collector, value: lost, asset: 'USDT' })

    // Collecteur : une part vers l'exchange, des branches, puis la réserve
    const collected = roundAsset('USDT', w.balanceOf(collector, 'USDT'))
    const outV = Math.round((collected * r.float(0.28, 0.4)) / 10) * 10
    const dep = dest.receive(collector, outV, tFwd.time + r.int(3, 10) * HOUR, { asset: 'USDT' })
    const branches = decoyBranches(w, collector, { time: tFwd.time + r.int(14, 24) * HOUR, share: r.float(0.14, 0.22), branches: 3, asset: 'USDT', returnTo: hub })
    const reserve = w.addr('tron', { entity: attackerE })
    const reserveGas = w.transfer({ time: w.at(-r.float(30, 60)), from: hub, to: reserve, value: r.int(30, 80), asset: 'TRX' })
    const reserveTx = w.transfer({ time: tFwd.time + r.int(30, 54) * HOUR, from: collector, to: reserve, value: roundAsset('USDT', w.balanceOf(collector, 'USDT')), asset: 'USDT' })

    // Ironie du métier : les adresses du réseau reçoivent elles aussi de la poussière (en TRX)
    dusting(w, collector, { time: tFwd.time + 2 * DAY, n: r.int(1, 2), spreadH: 20, token: 'TRX' })
    dusting(w, reserve, { time: reserveTx.time + 2 * DAY, n: r.int(1, 2), spreadH: 20, token: 'TRX' })

    // Bruit de fond
    dest.noise(16, w.at(-4 * 24), w.at(4 * 24), 'USDT')
    own.noise(12, w.at(-30 * 24), w.at(3 * 24), 'USDT')
    hubSrc.noise(8, w.at(-45 * 24), w.at(3 * 24), 'TRX')

    // ── Réponses (monde final) ───────────────────────────────────────────────
    const held = roundAsset('USDT', w.balanceOf(reserve, 'USDT'))
    const hubSrcName = hubSrc.entity.name
    const fwdMin = Math.round((tFwd.time - tLost.time) / 60)
    const testGapMin = Math.round((tLost.time - tTest.time) / 60)
    const branchTotal = roundAsset('USDT', branches.reduce((s, b) => s + b.value, 0))
    const sleeping = branches.filter((b) => b.fate === 'dort')
    const reported = paid[0]
    const nVictimsCollector = paid.length + 1
    const recentLegit = legit.slice(-3)
    // Extrait continu de l'historique USDT de la victime, du dépôt « avant-avant-dernier » à la capture
    const captureT = tTest.time - 600
    const historyLines = w.txsOf(victim)
      .filter((t) => t.time >= prevLegit.tx.time && t.time < captureT && t.transfers.some((x) => x.asset === 'USDT'))
      .map((t) => {
        const x = t.transfers.find((y) => y.asset === 'USDT')!
        return x.to === victim
          ? { t: t.time, s: `↓ Reçu     ${trunc(A(w, x.from))}   +${amt(x.value, 'USDT')}` }
          : { t: t.time, s: `↑ Envoyé   ${trunc(A(w, x.to))}   -${amt(x.value, 'USDT')}` }
      })
    const plainteT = atHour(w.at(24), 10) + 40 * 60

    return {
      world: w,
      title: `Copier-coller fatal — ${city}`,
      briefing:
        `${victimName} (${city}), développeuse indépendante, est payée en USDT (réseau Tron) par un client étranger. Chaque mois, elle transfère ses USDT vers son adresse de dépôt Coinhouse pour les convertir en euros.\n\n` +
        `Le ${fmtDate(tLost.time)}, elle copie l'adresse depuis son historique, comme d'habitude, envoie d'abord ${amt(testV, 'USDT')} « pour tester », voit la transaction confirmée, puis envoie ${amt(lost, 'USDT')}. Rien n'est jamais arrivé chez Coinhouse.\n\n` +
        `Son historique contient plusieurs adresses presque identiques. Objectifs : distinguer sa véritable adresse de dépôt des sosies, isoler la transaction d'empoisonnement, remonter l'infrastructure qui finance les sosies et le collecteur qui regroupe les fonds de plusieurs victimes, puis localiser les USDT encore gelables par l'émetteur.`,
      evidence: [
        {
          id: 'plainte', type: 'plainte', title: 'Procès-verbal de plainte (extrait)', date: plainteT, author: victimName,
          body:
            `« Je fais ce virement tous les mois, je copie toujours la dernière adresse utilisée dans l'historique de mon application. Je vérifie le début et la fin, ils étaient identiques. Cette fois, comme le montant était important, j'ai d'abord envoyé ${amt(testV, 'USDT')} : la transaction était "confirmée", alors j'ai envoyé le reste ${testGapMin} minutes plus tard. Je n'ai pas pensé à vérifier que Coinhouse avait crédité le test.\n\n` +
            `Mon adresse Tron : ${A(w, victim)}\n` +
            `Le gros virement : ${tLost.hash}\n` +
            `Je n'ai pas l'adresse de dépôt Coinhouse sous la main : je la reprenais toujours dans l'historique. »`,
        },
        {
          id: 'capture', type: 'capture', title: 'Capture — historique de l\'application portefeuille (extrait, avant le virement)', date: captureT,
          body:
            `Historique USDT (TRC-20), du plus récent au plus ancien\n` +
            historyLines.sort((a, b) => b.t - a.t).map((l) => l.s).join('\n') +
            `\n(adresses tronquées par l'application : 6 premiers et 5 derniers caractères)`,
        },
        {
          id: 'note', type: 'rapport', title: 'Réponse de Coinhouse à réquisition', date: atHour(w.at(3 * 24), 11), author: 'Coinhouse — Service conformité',
          body:
            `Notre cliente dispose d'une adresse de dépôt USDT (TRC-20) dédiée, balayée vers notre portefeuille chaud après chaque crédit. Elle utilise la même adresse de dépôt depuis l'ouverture de son compte. Derniers dépôts crédités :\n` +
            recentLegit.map((l) => `• ${fmtDate(l.tx.time)} : ${amt(l.value, 'USDT')}`).join('\n') +
            `\n\nAucun dépôt de ${amt(testV, 'USDT')} ni de ${amt(lost, 'USDT')} n'a été reçu à la date indiquée.`,
        },
        {
          id: 'email', type: 'email', title: 'Message d\'un autre service enquêteur', date: atHour(w.at(4 * 24), 9) + 20 * 60, author: `Commissariat ${de(city2)}`,
          body:
            `Bonjour,\n` +
            `Nous traitons une plainte pour un virement d'USDT parti vers une adresse « qui ressemblait à celle de son fournisseur ». Notre plaignant a envoyé ${amt(reported.value, 'USDT')} le ${fmtDate(reported.pay.time)} à ${A(w, reported.fake)} (transaction ${reported.pay.hash}).\n` +
            `Votre dossier semble similaire : les fonds aboutissent-ils au même endroit ?\n` +
            `Cordialement`,
        },
        {
          id: 'note2', type: 'note', title: 'Note de l\'analyste : industrialisation du poisoning', date: atHour(w.at(3 * 24), 15), author: 'Cellule d\'appui',
          body:
            `• Les sosies sont générés par logiciel (recherche d'adresses « vanity » partageant le début et la fin de l'adresse imitée) et pré-positionnés en masse. Plusieurs équipes peuvent viser la même cible : chaque gros flux USDT attire des sosies.\n` +
            `• Sur Tron, une adresse neuve ne peut rien émettre sans TRX (activation, énergie, bande passante) : un même portefeuille « hub » finance généralement des dizaines de sosies.\n` +
            `• Les sosies ne gardent rien : un script transfère chaque réception vers un collecteur, qui regroupe les fonds de plusieurs victimes avant de les répartir.\n` +
            `• ${tether.name} peut geler des USDT détenus sur une adresse auto-hébergée, sur demande motivée des autorités : c'est souvent la seule mesure conservatoire rapide.`,
        },
      ],
      seeds: [victim],
      objectives: [
        {
          id: 'o14', type: 'address', points: 10,
          prompt: 'Parmi les adresses de l\'historique de la victime, laquelle est sa véritable adresse de dépôt Coinhouse ?',
          answer: [deposit],
          hint: 'Rapprochez les dépôts listés par Coinhouse (dates, montants) des sorties de la victime, puis regardez ce que devient chaque destinataire : une adresse de dépôt d\'exchange est balayée vers le portefeuille chaud de la plateforme.',
          explanation: `${A(w, deposit)} reçoit chaque mois les virements de la victime (${nMonths} dépôts, dont ceux du ${recentLegit.map((l) => fmtDate(l.tx.time, false)).join(', ')} cités par Coinhouse), et chaque dépôt est ensuite balayé vers le hot wallet Coinhouse (au plus ${Math.max(...legit.map((l) => Math.ceil(((l.sweep?.time ?? l.tx.time) - l.tx.time) / HOUR)))} h plus tard). Les sosies, eux, n'avaient rien reçu de la victime avant le vol : ils n'ont fait qu'expédier une poussière. Dans l'application, ${trunc(A(w, deposit))} et ${trunc(A(w, poison))} s'affichent à l'identique : seule la comparaison complète, ou le comportement on-chain, les distingue.`,
        },
        {
          id: 'o1', type: 'address', points: 10,
          prompt: 'Quelle est l\'adresse sosie qui a reçu le test et le virement détourné ?',
          answer: [poison],
          hint: 'Ouvrez le virement cité dans la plainte et comparez son destinataire, caractère par caractère, avec la véritable adresse de dépôt.',
          explanation: `${A(w, poison)} partage les 6 premiers et les 5 derniers caractères de l'adresse de dépôt légitime ${A(w, deposit)}, mais le milieu est totalement différent. Elle reçoit ${amt(testV, 'USDT')} puis ${amt(lost, 'USDT')}, et transfère chaque réception en quelques minutes : aucun balayage vers Coinhouse.`,
        },
        {
          id: 'o2', type: 'tx', points: 10,
          prompt: 'Quelle transaction a « empoisonné » l\'historique de la victime avec l\'adresse qui a ensuite reçu le virement ?',
          answer: [tPoison.id],
          hint: 'Regardez les flux entrants de la victime : plusieurs transferts minuscules, mais un seul vient de l\'adresse qui a reçu le virement.',
          explanation: `Le ${fmtDate(tPoison.time)}, ${Math.round((tPoison.time - lastLegit.tx.time) / 60)} minutes après son dernier dépôt légitime, l'adresse sosie lui envoie ${amt(dust, 'USDT')}. Cette poussière s'inscrit dans son historique juste au-dessus du vrai dépôt, avec le même affichage tronqué. Les deux autres poussières reçues (${trunc(A(w, weakFake))} et ${trunc(A(w, decoyFake))}) viennent d'autres adresses, que la victime n'a jamais payées.`,
        },
        {
          id: 'o11', type: 'addresses', points: 8,
          prompt: 'Deux autres adresses sosies ont visé la victime sans obtenir de paiement. Lesquelles ?',
          answer: [weakFake, decoyFake],
          hint: 'Listez toutes les poussières reçues par la victime et, pour chaque expéditeur, cherchez l\'adresse qu\'il imite parmi ses correspondants habituels.',
          explanation:
            `• ${A(w, weakFake)} imite grossièrement l'adresse de dépôt (seulement 4 premiers et 4 derniers caractères identiques) ; poussière de ${amt(tWeakDust.transfers[0].value, 'USDT')} le ${fmtDate(tWeakDust.time, false)}, juste après un dépôt légitime.\n` +
            `• ${A(w, decoyFake)} imite l'adresse du client ${A(w, client)} (6 premiers et 5 derniers caractères) ; poussière le ${fmtDate(tDecoy.time, false)}.\n` +
            `Aucune n'a reçu d'argent de la victime, et aucune n'est financée par le hub : ce sont d'autres équipes. Elles ne font pas partie du préjudice, mais elles montrent que chaque gros flux attire plusieurs empoisonneurs ; il faut les documenter sans les confondre avec l'auteur.`,
        },
        {
          id: 'o15', type: 'amount', points: 8, unit: 'USDT', tolerance: 0.01,
          prompt: 'Quel montant total la victime a-t-elle envoyé à l\'adresse sosie ?',
          answer: lossTotal,
          hint: 'Le gros virement n\'est pas seul : la plainte parle d\'un envoi test.',
          explanation: `${amt(testV, 'USDT')} de test puis ${amt(lost, 'USDT')} ${testGapMin} minutes plus tard : ${amt(lossTotal, 'USDT')}. L'envoi test ne protège pas d'un empoisonnement : il prouve seulement que l'adresse existe. Seule la confirmation du crédit côté Coinhouse aurait révélé l'erreur.`,
        },
        {
          id: 'o5', type: 'address', points: 8,
          prompt: 'Quelle adresse a financé en TRX l\'adresse sosie avant l\'empoisonnement ?',
          answer: [hub],
          hint: 'Ouvrez les tout premiers flux entrants de l\'adresse sosie, colonne Actif = TRX : quelques dizaines de TRX, quelques heures avant la poussière.',
          explanation: `${A(w, hub)} envoie ${amt(poisonGas.transfers[0].value, 'TRX')} puis quelques USDT au sosie, juste avant la poussière. C'est le « hub » du réseau : il finance ${nFakes + 1} sosies (chacun imitant le correspondant habituel d'une cible différente), ainsi que le collecteur et l'adresse de réserve, qui n'envoient aucune poussière. Le schéma TRX, puis USDT, puis poussière se répète pour chaque sosie ; ensuite, plus rien, sauf quand la cible se trompe et le paie : le sosie reverse alors aussitôt la somme au collecteur.`,
        },
        {
          id: 'o7', type: 'entity', points: 8,
          prompt: 'De quelle plateforme proviennent les TRX du hub ?',
          answer: [hubSrcKey],
          hint: 'Remontez les flux entrants du hub jusqu\'au plus ancien versement de TRX : il provient d\'un hot wallet étiqueté.',
          explanation: `Le ${fmtDate(hubFundTx.time, false)}, ${hubSrcName} verse ${amt(hubFundTx.transfers[0].value, 'TRX')} au hub depuis son hot wallet. Ce retrait est rattaché à un compte client : la réquisition (hash ${hubFundTx.hash.slice(0, 16)}…) peut désigner l'équipe qui opère les sosies, indépendamment du produit du vol. ${procedureFor(hubSrc.entity)}`,
        },
        {
          id: 'o8', type: 'address', points: 8,
          prompt: 'Vers quelle adresse le sosie a-t-il transféré les fonds détournés ?',
          answer: [collector],
          hint: 'L\'adresse sosie ne garde rien : regardez ses sorties d\'USDT quelques minutes après le test et après le virement.',
          explanation: `Quelques minutes après le test, puis ${fwdMin} minutes après le virement, le sosie transfère chaque réception vers ${A(w, collector)}. Ce collecteur a reçu ses TRX du même hub quelques jours plus tôt : il appartient au même réseau.`,
        },
        {
          id: 'o16', type: 'number', points: 8, unit: 'victimes',
          prompt: 'Combien de victimes (la plaignante comprise) ont vu leurs fonds aboutir sur ce collecteur ?',
          answer: nVictimsCollector,
          hint: 'Dépliez les entrées d\'USDT du collecteur : chaque expéditeur est un sosie. Remontez d\'un cran pour voir qui l\'a payé.',
          explanation: `Le collecteur reçoit les fonds de ${nVictimsCollector} sosies différents, chacun payé par une cible différente : la plaignante et ${paid.length} autres victimes, dont le plaignant ${de(city2)} (${amt(reported.value, 'USDT')} envoyés à ${trunc(A(w, reported.fake))}). Les autres cibles du hub ont reçu une poussière sans jamais payer. Les procédures doivent être jointes : même hub, même collecteur.`,
        },
        {
          id: 'o9', type: 'address', points: 8,
          prompt: 'Une partie des fonds part vers un exchange. Quelle adresse de dépôt faut-il citer dans la réquisition ?',
          answer: [dep.deposit],
          hint: 'Ce n\'est pas le hot wallet : c\'est l\'adresse qui reçoit les USDT du collecteur, avant d\'être balayée.',
          explanation: `Le ${fmtDate(dep.tx.time)}, le collecteur envoie ${amt(outV, 'USDT')} sur ${A(w, dep.deposit)}, adresse de dépôt propre à un client de ${dest.entity.name}, balayée ensuite vers le hot wallet. C'est elle qui désigne le titulaire du compte. ${procedureFor(dest.entity)}`,
        },
        {
          id: 'o13', type: 'address', points: 10,
          prompt: 'Après ce dépôt, le collecteur répartit le reste vers plusieurs adresses. Laquelle détient aujourd\'hui la plus grosse part du butin ?',
          answer: [reserve],
          hint: 'Comparez les montants des sorties du collecteur, puis ce que devient chaque destinataire.',
          explanation:
            `Le ${fmtDate(reserveTx.time)}, le collecteur vide son solde vers ${A(w, reserve)} : ${amt(reserveTx.transfers[0].value, 'USDT')}, qui n'ont plus bougé. Les ${branches.length} autres sorties sont des branches bien plus modestes (${amt(branchTotal, 'USDT')} au total) :\n` +
            branches.map((b) => `• ${trunc(A(w, b.address))} : ${amt(b.value, 'USDT')}, ${FATE[b.fate]}`).join('\n') +
            `\nLa réserve se distingue par son montant (tout le solde restant), par son activation en TRX par le hub le ${fmtDate(reserveGas.time, false)}, et par l'absence de toute sortie.`,
        },
        {
          id: 'o10', type: 'amount', points: 8, unit: 'USDT', tolerance: 0.01,
          prompt: 'Combien d\'USDT sont encore détenus sur cette adresse et peuvent faire l\'objet d\'une demande de gel ?',
          answer: held,
          hint: 'Solde actuel en USDT de l\'adresse de réserve (les poussières reçues ensuite sont en TRX).',
          explanation: `${A(w, reserve)} détient ${amt(held, 'USDT')}. Sur une adresse auto-hébergée, seul l'émetteur de l'USDT peut les bloquer : la demande de gel à ${tether.name} doit partir en urgence, avant le prochain mouvement. ${sleeping.length ? `La branche dormante ${sleeping.map((b) => `${trunc(A(w, b.address))} (${amt(b.value, 'USDT')})`).join(', ')} est à inclure dans la même demande. ` : ''}${procedureFor(tether)}`,
        },
        {
          id: 'o4', type: 'choice', points: 8,
          prompt: 'Quelle suite donner en priorité ?',
          hint: 'Où restent des fonds récupérables, et qui peut agir dessus le plus vite ?',
          ...choice(r,
            `Demander en urgence à ${tether.name} le gel des USDT de la réserve, requérir ${dest.entity.name} sur l'adresse de dépôt et ${hubSrcName} sur le retrait qui finance le hub`,
            [
              'Demander à Coinhouse de rembourser la victime, puisque l\'adresse sosie imitait son adresse de dépôt',
              'Classer : la victime a elle-même saisi la mauvaise adresse, il n\'y a pas d\'infraction pénale',
              `Requérir ${dest.entity.name} pour geler la réserve, puisque les fonds du collecteur y ont transité`,
            ]),
          explanation: `L'address poisoning est une escroquerie (manœuvre frauduleuse : sosie fabriqué et injecté dans l'historique). Les fonds récupérables sont sur la réserve (${amt(held, 'USDT')}), une adresse auto-hébergée sur laquelle aucun exchange n'a la main : seul ${tether.name} peut la geler. ${dest.entity.name} n'a reçu que ${amt(outV, 'USDT')} et se requiert sur l'adresse de dépôt (identité, gel du compte). Coinhouse n'est pas en cause : son adresse n'a jamais reçu les fonds.`,
        },
      ],
      truth: {
        path: [tTest.id, tLost.id, fwdTest.id, tFwd.id, dep.tx.id, ...(dep.sweep ? [dep.sweep.id] : []), reserveTx.id, hubFundTx.id, poisonGas.id, tPoison.id, lastLegit.tx.id, tBigIn.id],
        addresses: [poison, collector, reserve, hub, deposit, dep.deposit, weakFake, decoyFake],
        debrief:
          `1. La victime dépose chaque mois ses USDT sur ${A(w, deposit)} (Coinhouse), adresse balayée vers le hot wallet de la plateforme.\n` +
          `2. Le réseau génère un sosie ${A(w, poison)} (mêmes 6 premiers et 5 derniers caractères), le finance en TRX et en USDT depuis le hub ${A(w, hub)}, puis envoie ${amt(dust, 'USDT')} à la victime juste après un de ses dépôts. Le hub, approvisionné par un retrait ${hubSrcName}, finance ${nFakes + 1} sosies au total.\n` +
          `3. Au virement suivant, la victime copie l'adresse sosie depuis son historique : test de ${amt(testV, 'USDT')}, puis ${amt(lost, 'USDT')}.\n` +
          `4. Le sosie transfère tout vers le collecteur ${A(w, collector)}, qui reçoit aussi le produit de ${paid.length} autres victimes. Il dépose ${amt(outV, 'USDT')} sur ${dest.entity.name} (adresse de dépôt ${A(w, dep.deposit)}), éclate ${amt(branchTotal, 'USDT')} en ${branches.length} branches, puis vide le reste vers la réserve ${A(w, reserve)}, qui détient encore ${amt(held, 'USDT')} : c'est là que se joue la récupération (gel ${tether.name}).\n` +
          `5. Fausses pistes : deux autres sosies (l'un imitant grossièrement le dépôt, l'autre le client), étrangers au hub, ont aussi visé la victime sans être payés ; les branches du collecteur sont de petits montants (dormante, dépensée, renvoyée au hub ou ré-éclatée) et ne portent pas l'essentiel des fonds.\n\n` +
          `À retenir : en address poisoning, l'adresse légitime se prouve par son comportement (dépôts réguliers, balayage vers l'exchange) et par la réponse de la plateforme ; la sosie n'a qu'une poussière à son actif avant le vol. La transaction d'empoisonnement précède nécessairement le détournement, et le hub de financement relie souvent des dizaines de sosies et plusieurs victimes.`,
      },
      hints: [
        'Comparez la réponse de Coinhouse (dates, montants) avec les sorties de la victime : une seule adresse reçoit ses dépôts mois après mois et les reverse au hot wallet Coinhouse.',
        'Dépliez les flux entrants de la victime et triez par montant : plusieurs expéditeurs envoient des sommes ridicules. Lequel est le destinataire du virement ?',
        'Remontez les TRX reçus par le sosie : qui finance ses frais ? Puis descendez : où part chaque réception ?',
        'Sur le collecteur, comparez les sorties : un dépôt d\'exchange, plusieurs petites branches et un gros transfert final qui ne bouge plus.',
      ],
    }
  },
}
