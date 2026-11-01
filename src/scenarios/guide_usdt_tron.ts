import { World } from '../engine/world'
import { exchange, HOUR, DAY } from '../engine/patterns'
import { roundAsset } from '../engine/chains'
import type { ScenarioTemplate } from './types'
import { A, de, amt, choice, fakeCity, fakeHandle, fakePerson, fmtDate, procedureFor } from './util'

/** Solde USDT d'une adresse à l'instant `t`, recalculé depuis son historique (le solde du moteur n'est pas daté). */
function usdtAt(w: World, addr: string, t: number): number {
  let s = 0
  for (const tx of w.txsOf(addr)) {
    if (tx.time > t) break
    for (const f of w.flowIn(tx, addr)) if (f.asset === 'USDT') s += f.value
    for (const f of w.flowOut(tx, addr)) if (f.asset === 'USDT') s -= f.value
  }
  return s
}

/** Premier instant ≥ `after` tombant en journée (entre 9 h et 19 h environ, heure de Paris). */
function daytime(w: World, after: number): number {
  let t = Math.floor(after / DAY) * DAY + w.rng.int(8 * 60, 17 * 60) * 60
  if (t < after) t += DAY
  return t
}

/**
 * Tutoriel 3 : USDT sur Tron, collecteur d'un réseau d'escroquerie sentimentale.
 * Le collecteur paie ses « chatteurs », encaisse une tranche sur un exchange,
 * puis déplace l'essentiel du reste vers une adresse de réserve : les fonds
 * sont encore détenus, et gelables par l'émetteur.
 */
export const guideUsdtTron: ScenarioTemplate = {
  id: 'guide-usdt-tron',
  guided: true,
  title: 'Tutoriel 3 : USDT sur Tron et gel des fonds',
  tagline: 'Pas à pas sur Tron : TRX ou USDT, remonter au collecteur, trier ses sorties, retrouver où dorment les fonds et les faire geler à temps.',
  description:
    'Mission guidée. Une victime d\'escroquerie sentimentale à l\'investissement a versé des USDT sur le réseau Tron. Le guide vous apprend à distinguer le TRX de l\'USDT-TRC20, à remonter jusqu\'au portefeuille collecteur, à recenser les autres victimes et le portefeuille « carburant » du réseau, à trier les sorties du collecteur (salaires, encaissement, réserve), à filtrer une période sur la frise et à viser, pour le gel par l\'émetteur, les adresses où les fonds se trouvent aujourd\'hui.',
  difficulty: 1,
  chains: ['tron'],
  skills: ['tron', 'tokens', 'typologies', 'gel', 'exchange_id'],
  estMinutes: 50,
  lessons: ['tron-usdt', 'stablecoins', 'gel-stablecoins', 'typologies', 'exchanges', 'gel-saisie', 'requisitions'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const victimP = fakePerson(r)
    const victimName = victimP.name
    const g = victimP.g
    const city = fakeCity(r)
    const brand = r.pick(['Lumina Trade', 'CoinMarina', 'Orchid Exchange', 'SilkFX Pro'])
    const persona = victimP.female ? r.pick(['« Daniel »', '« Alex »', '« Mike »']) : r.pick(['« Lina »', '« Jessica »', '« Mei »'])

    const cv = exchange(w, 'coinhouse', 'tron')
    const outKey = r.pick(['binance', 'okx', 'kraken'] as const)
    const ex = exchange(w, outKey, 'tron')
    const exName = ex.entity.name
    const tether = w.entity('tether')

    const op = w.customEntity({ name: `Réseau « ${brand} » (opérateurs inconnus)`, category: 'suspect' })
    const victimE = w.customEntity({ name: victimName, category: 'victim' })
    const victim = w.addr('tron', { entity: victimE })

    // Portefeuille « carburant » des opérateurs : du TRX pour payer les frais de leurs adresses
    const gasW = w.addr('tron', { entity: op })
    w.fundAccount(gasW, 30000, 'TRX', w.at(-50 * 24, 6 * 3600))
    const collector = w.addr('tron', { entity: op })
    const gasToCollector = w.transfer({ time: w.at(-40 * 24, 6 * 3600), from: gasW, to: collector, value: 800, asset: 'TRX' })

    // La victime : un peu de TRX acheté sur Coinhouse (pour les frais), puis des USDT avant chaque versement
    const trxFund = cv.withdraw(victim, r.int(80, 250), w.at(-r.int(25, 35) * 24), 'TRX')
    const vDep = w.addr('tron', { entity: op })
    w.transfer({ time: w.at(-24 * 24, 5 * 3600), from: gasW, to: vDep, value: 50, asset: 'TRX' })
    const nPay = 3
    const pays: string[] = []
    const fwds: string[] = []
    let vTotal = 0
    for (let k = 0; k < nPay; k++) {
      const t = w.at(-(20 - k * r.float(4, 6)) * 24)
      // Le dernier versement est toujours le plus gros (la victime, mise en confiance, « investit » davantage)
      const value = k + 1 === nPay ? Math.round(r.float(5000, 9000) / 100) * 100 : Math.round(r.float(1500, 4500) / 100) * 100
      cv.withdraw(victim, value + r.int(2, 30), t - r.int(2, 8) * HOUR, 'USDT')
      pays.push(w.transfer({ time: t, from: victim, to: vDep, value, asset: 'USDT' }).id)
      fwds.push(w.transfer({ time: t + r.int(15, 120) * 60, from: vDep, to: collector, value, asset: 'USDT' }).id)
      vTotal += value
    }

    // D'autres victimes (deux à quatre), chacune avec sa propre « adresse de dépôt » remontant au
    // collecteur ; chaque relais reçoit son TRX du même portefeuille « carburant »
    const nOthers = r.int(2, 4)
    const others: { victim: string; relay: string }[] = []
    const othersPays: string[] = []
    const othersFwds: string[] = []
    let othersTotal = 0
    for (let i = 0; i < nOthers; i++) {
      const oa = w.addr('tron', { entity: w.customEntity({ name: 'Victime non identifiée', category: 'victim' }) })
      const od = w.addr('tron', { entity: op })
      w.transfer({ time: w.at(-(30 - i * 2) * 24, 5 * 3600), from: gasW, to: od, value: 50, asset: 'TRX' })
      others.push({ victim: oa, relay: od })
      const nP = r.int(1, 2)
      for (let k = 0; k < nP; k++) {
        const t = w.at(-r.float(6, 21) * 24)
        const value = Math.round(r.float(2000, 15000) / 100) * 100
        w.fundAccount(oa, value + r.int(0, 40), 'USDT', t - r.int(1, 5) * HOUR)
        othersPays.push(w.transfer({ time: t, from: oa, to: od, value, asset: 'USDT' }).id)
        othersFwds.push(w.transfer({ time: t + r.int(15, 120) * 60, from: od, to: collector, value, asset: 'USDT' }).id)
        othersTotal += value
      }
    }
    const nVictims = nOthers + 1
    const grand = vTotal + othersTotal

    // Les « chatteurs » du réseau sont payés en USDT par le collecteur : petits montants ronds,
    // à intervalles réguliers (deux employés, trois paies). Chaque paie n'intervient qu'une fois
    // le collecteur suffisamment approvisionné.
    const worker1 = w.addr('tron')
    const worker2 = w.addr('tron')
    const wages: { to: string; id: string; value: number; time: number }[] = []
    for (const [to, daysBefore] of [[worker1, r.float(12, 14)], [worker2, r.float(8, 10)], [worker1, r.float(4, 6)]] as const) {
      let t = w.at(-daysBefore * 24)
      const value = r.pick([400, 500, 600, 750, 800])
      while (usdtAt(w, collector, t) < value * 1.5 && t < w.at(-3 * 24)) t += 6 * HOUR
      const tx = w.transfer({ time: t, from: collector, to, value, asset: 'USDT', autoFund: false })
      wages.push({ to, id: tx.id, value, time: t })
    }

    // Décaissement partiel vers un exchange, puis, quelques heures plus tard, l'essentiel du
    // reste part vers une adresse de réserve du réseau, où il dort encore
    const plainteT = daytime(w, w.at(-r.float(3, 8)))
    const outT = w.at(-r.float(28, 44))
    const outAmt = Math.round((grand * r.float(0.25, 0.4)) / 100) * 100
    const outRes = ex.receive(collector, outAmt, outT, { asset: 'USDT', sweepDelayH: r.float(1, 4) })
    const exDeposit = outRes.deposit
    const reserve = w.addr('tron', { entity: op })
    const reserveT = Math.round(outT + (plainteT - outT) * r.float(0.45, 0.7))
    const reserveAmt = Math.floor((w.balanceOf(collector, 'USDT') * r.float(0.8, 0.9)) / 100) * 100
    const toReserve = w.transfer({ time: reserveT, from: collector, to: reserve, value: reserveAmt, asset: 'USDT' })

    // Bruit de fond
    ex.noise(10, w.at(-12 * 24), w.at(2 * 24), 'USDT')
    cv.noise(6, w.at(-30 * 24), w.at(0), 'USDT')

    // ── Réponses, calculées sur le monde final ──
    const received = w.summary(collector).received.USDT ?? 0
    const collectorLeft = roundAsset('USDT', w.balanceOf(collector, 'USDT'))
    const reserveHeld = roundAsset('USDT', w.balanceOf(reserve, 'USDT'))
    const freezable = roundAsset('USDT', collectorLeft + reserveHeld)
    const wagesTotal = wages.reduce((s, x) => s + x.value, 0)
    const handle = fakeHandle(r)
    // Délai entre le dernier mouvement du collecteur (vers la réserve) et la plainte (en heures, au dixième)
    const sinceMoveH = Math.round((plainteT - reserveT) / 360) / 10
    // Écart entre l'encaissement et le transfert vers la réserve (en heures, arrondi)
    const gapH = Math.round((reserveT - outT) / 3600)
    // Victimes ayant payé plusieurs fois (le plaignant compris)
    const nRepeat = 1 + others.filter((o) => othersPays.filter((id) => w.tx(id).transfers[0].to === o.relay).length > 1).length

    return {
      world: w,
      title: `Romance et faux trading « ${brand} » — ${city}`,
      briefing:
        `${victimName} (${city}) a fait la connaissance de ${persona} sur un réseau social. Après des semaines d'échanges quotidiens, ${persona} lui a présenté « ${brand} », une plateforme de trading où ${victimP.female ? 'il' : 'elle'} aurait multiplié ses gains. ${victimName} a versé des USDT à trois reprises, sur le réseau Tron, vers son « adresse de dépôt personnelle ». Pour retirer, on lui réclame maintenant une « taxe » de 20 %.\n\n` +
        `${g('Il', 'Elle')} dépose plainte aujourd'hui, ${fmtDate(plainteT)}. Votre mission : suivre les USDT jusqu'au portefeuille qui centralise l'argent des victimes, trier ce qu'il en a fait, retrouver où les fonds se trouvent encore et décider des actions urgentes.\n\n` +
        `C'est une **mission guidée** : le guide pas à pas flotte en haut à gauche du graphe. Les étapes se valident d'elles-mêmes ; « Je bloque » donne le chemin exact. Les indices sont gratuits.`,
      evidence: [
        {
          id: 'plainte', type: 'plainte', title: 'Procès-verbal de plainte (extrait)', date: plainteT, author: victimName,
          body:
            `« J'ai acheté des USDT sur Coinhouse, en choisissant le réseau "TRC20" comme on me l'avait dit, et je les ai envoyés depuis mon portefeuille. J'ai fait trois versements, le dernier, le plus gros, le ${fmtDate(w.tx(pays[nPay - 1]).time, false)}. Au total : ${amt(vTotal, 'USDT')}.\n\n` +
            `Mon adresse Tron : ${A(w, victim)} »`,
        },
        {
          id: 'capture', type: 'capture', title: `Capture — page « Dépôt » ${de(brand)}`, date: w.tx(pays[0]).time - 3600,
          body: `${brand} · Dépôt\nActif : USDT · Réseau : TRC20 uniquement\nVotre adresse de dépôt personnelle :\n${A(w, vDep)}\n⚠️ Tout dépôt sur un autre réseau sera définitivement perdu.`,
        },
        {
          id: 'chat', type: 'telegram', title: `Conversation avec ${persona}`, author: `@${handle}`, date: plainteT - 2 * 86400,
          body: `${persona.replace(/[«»]/g, '').trim()} : Ton portefeuille ${brand} est à +280 %, je suis tellement ${victimP.female ? 'fier' : 'fière'} de toi\n${persona.replace(/[«»]/g, '').trim()} : Pour débloquer le retrait il faut d'abord régler la taxe de 20 %, c'est la règle\n${persona.replace(/[«»]/g, '').trim()} : Envoie sur la même adresse, le support valide en 24 h`,
        },
        {
          id: 'note', type: 'note', title: 'Note de la cellule d\'appui — escroqueries sentimentales', date: plainteT + 2 * HOUR, author: 'Cellule d\'appui',
          body:
            `Rappel sur ce mode opératoire : les « conseillers » et « amoureux » sont souvent des employés (« chatteurs ») de centres d'appel organisés, payés en USDT par petits versements réguliers depuis le portefeuille qui collecte l'argent des victimes. Les fonds, eux, sont encaissés par tranches, et le reste est régulièrement déplacé vers des adresses de réserve.\n\n` +
            `Un gel par Tether ne bloque que les USDT présents sur l'adresse visée au moment du gel : viser l'adresse où les fonds se trouvent AUJOURD'HUI.`,
        },
      ],
      seeds: [],
      objectives: [
        {
          id: 'o1', type: 'address', points: 10,
          prompt: 'Quelle est l\'adresse du portefeuille collecteur du réseau ?',
          answer: [collector],
          hint: 'Suivez les USDT reçus par l\'« adresse de dépôt » de la plateforme : vers où repartent-ils ?',
          explanation: `L'« adresse de dépôt ${brand} » de la victime n'est qu'une adresse de passage : chaque versement est reversé en moins de deux heures vers ${A(w, collector)}, qui reçoit aussi l'argent d'autres victimes par leurs propres adresses de passage.`,
        },
        {
          id: 'o6', type: 'number', points: 10, unit: 'victimes', tolerance: 0,
          prompt: `Combien de victimes distinctes, ${g('plaignant compris', 'plaignante comprise')}, ont alimenté le collecteur ?`,
          answer: nVictims,
          hint: 'Dépliez les entrées du collecteur : chaque adresse relais qui lui envoie des USDT correspond à une victime. Remontez les entrées de chaque relais pour vérifier.',
          explanation: `${nVictims} victimes : ${victimName} et ${nOthers} autres personnes non identifiées. Chacune a reçu ${de(brand)} sa propre « adresse de dépôt » (un relais), et chaque relais reverse tout au collecteur. On compte des victimes (les expéditeurs des relais), pas des transactions : certaines ont payé plusieurs fois. Le portefeuille qui envoie du TRX au collecteur n'est pas une victime : il appartient au réseau. Ces victimes inconnues sont à identifier (rapprochement avec d'autres plaintes, réquisitions sur l'origine de leurs fonds).`,
        },
        {
          id: 'o7', type: 'amount', points: 8, unit: 'USDT', tolerance: 0.005,
          prompt: 'Combien d\'USDT le collecteur a-t-il reçus au total ?',
          answer: received,
          hint: 'Sélectionnez le collecteur et lisez son « Total reçu », partie USDT uniquement.',
          explanation: `${amt(received, 'USDT')} : ${amt(vTotal, 'USDT')} venant ${de(victimName)} et ${amt(othersTotal, 'USDT')} venant des ${nOthers} autres victimes. C'est le préjudice minimal visible on-chain pour l'ensemble du réseau, à reporter dans le rapport (le TRX reçu, lui, n'est que du carburant).`,
        },
        {
          id: 'o8', type: 'address', points: 8,
          prompt: 'Quelle adresse approvisionne en TRX le collecteur et les adresses relais ?',
          answer: [gasW],
          hint: 'Parmi les entrées du collecteur, cherchez celle en TRX (pas en USDT) ; vérifiez qu\'elle alimente aussi les relais.',
          explanation: `${A(w, gasW)} envoie ${amt(gasToCollector.transfers[0].value, 'TRX')} au collecteur le ${fmtDate(gasToCollector.time, false)} et 50 TRX à chaque relais, avant leurs premiers versements. Sur Tron, il faut du TRX (ou de l'énergie) pour transférer de l'USDT : ce portefeuille « carburant » est l'outil des opérateurs. Il rattache tous les relais au même réseau et constitue une piste à part entière (d'où vient son propre TRX ?).`,
        },
        {
          id: 'o11', type: 'choice', points: 8,
          prompt: 'Qu\'est-ce qui permet de rattacher les adresses relais au même réseau que le collecteur ?',
          ...choice(r,
            'Elles reversent chaque versement au collecteur en moins de deux heures et reçoivent leur TRX du même portefeuille carburant',
            [
              'Elles portent toutes l\'étiquette « Adresse de dépôt » d\'un exchange connu de la base',
              'Elles ont été créées le même jour, ce qui suffit à établir un propriétaire commun',
              'Elles appartiennent aux victimes, qui les ont créées elles-mêmes sur le site de la plateforme',
            ]),
          hint: 'Regardez d\'où vient le TRX des relais et où partent leurs USDT.',
          explanation: `Deux faits concordants : chaque relais vide ses USDT vers le même collecteur en moins de deux heures, et chacun a reçu 50 TRX du même portefeuille ${A(w, gasW).slice(0, 10)}… avant son premier versement. Aucun de ces relais n'est étiqueté : ce ne sont pas des adresses d'exchange, mais des adresses générées par les escrocs pour chaque « client ». Une date de création commune serait, seule, un indice bien trop faible.`,
        },
        {
          id: 'o4', type: 'entity', points: 8,
          prompt: 'Sur quelle plateforme une partie des fonds a-t-elle déjà été encaissée ?',
          answer: [outKey],
          hint: 'Dépliez les sorties du collecteur : une adresse porte une étiquette « Adresse de dépôt ».',
          explanation: `${amt(outAmt, 'USDT')} ont été déposés sur une adresse de dépôt ${exName}, puis balayés vers son hot wallet. ${procedureFor(ex.entity)} On y demande l'identité du titulaire et un blocage conservatoire du compte. Ce n'est qu'une tranche : l'essentiel du reste est parti ailleurs, vers une adresse non attribuée.`,
        },
        {
          id: 'o9', type: 'tx', points: 8,
          prompt: 'Quelle transaction a envoyé des USDT du collecteur vers la plateforme d\'encaissement ? (à citer dans la réquisition)',
          answer: [outRes.tx.id],
          hint: 'Sélectionnez la flèche (ou la ligne d\'Historique) qui relie le collecteur à l\'adresse de dépôt de la plateforme.',
          explanation: `La transaction ${outRes.tx.hash.slice(0, 16)}… du ${fmtDate(outRes.tx.time)} transfère ${amt(outAmt, 'USDT')} du collecteur vers ${A(w, exDeposit)}, adresse de dépôt ${de(exName)}. La réquisition cite cette adresse de dépôt et cette transaction (hash, date, montant) : la plateforme retrouve ainsi le compte crédité et peut le bloquer.`,
        },
        {
          id: 'o20', type: 'number', points: 8, unit: 'versements',
          prompt: 'Combien de petits versements ronds le collecteur a-t-il faits vers des adresses non attribuées, hors adresse de réserve ?',
          answer: wages.length,
          hint: 'Dans les sorties du collecteur, écartez l\'adresse de dépôt étiquetée et la grosse sortie récente ; comptez les transactions restantes (une même adresse peut être payée deux fois).',
          explanation: `${wages.length} versements (${wages.map((x) => `${amt(x.value, 'USDT')} le ${fmtDate(x.time, false)}`).join(', ')}) vers ${new Set(wages.map((x) => x.to)).size} adresses, pour ${amt(wagesTotal, 'USDT')} au total. Montants ronds, modestes, espacés de quelques jours, dont deux vers la même adresse : le profil de salaires, conforme à la note de la cellule d'appui sur les « chatteurs » payés en USDT. Ce ne sont ni l'encaissement ni la réserve : on ne les suit pas en priorité, mais on les signale. Leurs bénéficiaires sont des membres présumés du réseau, à identifier plus tard.`,
        },
        {
          id: 'o17', type: 'address', points: 10,
          prompt: 'Vers quelle adresse le collecteur a-t-il déplacé l\'essentiel des USDT qui lui restaient ?',
          answer: [reserve],
          hint: 'C\'est la plus grosse sortie du collecteur, la plus récente, vers une adresse non attribuée qui n\'a rien dépensé depuis.',
          explanation: `Le ${fmtDate(toReserve.time)}, environ ${gapH} heures après l'encaissement sur ${exName}, le collecteur envoie ${amt(reserveAmt, 'USDT')} vers ${A(w, reserve)}. Ce n'est pas un salaire (montant sans commune mesure, une seule fois) ni un encaissement (aucune étiquette, et l'adresse n'a rien reversé depuis) : c'est une **adresse de réserve** du réseau, où les fonds dorment. C'est là qu'il faut viser le gel en priorité.`,
        },
        {
          id: 'o18', type: 'amount', points: 10, unit: 'USDT', tolerance: 0.005,
          prompt: 'Quel montant total d\'USDT peut encore être gelé sur les adresses du réseau (collecteur et réserve) ?',
          answer: freezable,
          hint: 'Additionnez le « Solde actuel » en USDT du collecteur et celui de l\'adresse de réserve.',
          explanation: `${amt(freezable, 'USDT')} : ${amt(reserveHeld, 'USDT')} sur la réserve et ${amt(collectorLeft, 'USDT')} restés sur le collecteur. Ce dernier a reçu ${amt(received, 'USDT')}, payé ${amt(wagesTotal, 'USDT')} de salaires, encaissé ${amt(outAmt, 'USDT')} chez ${exName} et déplacé ${amt(reserveAmt, 'USDT')} vers la réserve. Demander le gel du seul collecteur aurait laissé échapper l'essentiel : le gel ne bloque que ce qui est encore sur l'adresse visée.`,
        },
        {
          id: 'o19', type: 'number', points: 8, unit: 'heures', tolerance: 2,
          prompt: 'Combien d\'heures se sont écoulées entre le dernier mouvement du collecteur (vers la réserve) et le dépôt de plainte ?',
          answer: sinceMoveH,
          hint: 'La date de la plainte figure dans le procès-verbal ; celle du transfert vers la réserve dans le panneau de la transaction (« Date (Paris) ») ou sur la frise.',
          explanation: `Transfert vers la réserve le ${fmtDate(toReserve.time)}, plainte le ${fmtDate(plainteT)} : environ ${sinceMoveH.toLocaleString('fr-FR')} heures. Le réseau est actif : il a encaissé une tranche puis, environ ${gapH} heures plus tard, déplacé le reste. La réserve peut à son tour se vider à tout moment : c'est ce qui justifie une demande de gel immédiate, avant même la réquisition de la plateforme.`,
        },
        {
          id: 'o3', type: 'entity', points: 10,
          prompt: 'À quelle entité demander le gel des USDT encore présents sur les adresses du réseau ?',
          answer: ['tether'],
          hint: 'Qui émet l\'USDT ? Cherchez la catégorie « Émetteur de stablecoin » dans la liste.',
          explanation: `${tether.name}, l'émetteur de l'USDT, peut geler (« blacklister ») une adresse : les jetons qu'elle détient ne peuvent plus bouger. La demande, motivée, passe par son portail dédié aux forces de l'ordre et vise chaque adresse détentrice (ici la réserve et le collecteur) ; la saisie des fonds relève ensuite d'une décision judiciaire.`,
        },
        {
          id: 'o5', type: 'choice', points: 12,
          prompt: 'Quelles actions engager en priorité ?',
          ...choice(r,
            'Demander sans attendre à Tether le gel de la réserve et du collecteur, puis requérir la plateforme d\'encaissement',
            [
              'Demander à Tether le gel du seul collecteur, puisque c\'est lui qui a reçu l\'argent des victimes',
              'Attendre que la réserve envoie ses USDT vers un exchange, pour tout requérir en une seule fois',
              'Requérir d\'abord Coinhouse, qui a vendu les USDT à la victime avant chacun de ses versements',
            ]),
          hint: 'Où se trouvent les fonds aujourd\'hui, et qu\'est-ce qui peut disparaître le plus vite ?',
          explanation: `Le gel est une course contre la montre et il ne bloque que ce qui est encore sur l'adresse visée : la réserve détient ${amt(reserveHeld, 'USDT')}, le collecteur ${amt(collectorLeft, 'USDT')}. Geler le seul collecteur laisserait filer l'essentiel. Demande de gel à ${tether.name} d'abord (quelques heures à quelques jours), réquisition ${de(exName)} sur l'adresse de dépôt ensuite, pour identifier qui encaisse. Coinhouse ne peut que confirmer les achats de la victime.`,
        },
      ],
      truth: {
        path: [...pays, ...fwds, ...othersPays, ...othersFwds, outRes.tx.id, ...(outRes.sweep ? [outRes.sweep.id] : []), toReserve.id],
        addresses: [vDep, collector, reserve, gasW, exDeposit, ...others.map((o) => o.relay)],
        debrief:
          `Ce qui s'est passé :\n\n` +
          `1. ${victimName} achète des USDT sur Coinhouse (réseau Tron) et les envoie en trois fois, ${amt(vTotal, 'USDT')} au total, à son « adresse de dépôt » ${brand} ${A(w, vDep)}.\n` +
          `2. Cette adresse n'est qu'un relais : chaque versement repart en moins de deux heures vers le collecteur ${A(w, collector)}. ${nOthers} autres victimes alimentent le même collecteur par leurs propres relais (${amt(othersTotal, 'USDT')}) : ${nVictims} victimes et ${amt(received, 'USDT')} au total.\n` +
          `3. Un portefeuille « carburant » des opérateurs (${A(w, gasW)}) envoie du TRX aux relais et au collecteur : sans TRX (ou énergie), impossible de payer les frais d'un transfert d'USDT sur Tron. C'est lui qui rattache tous les relais au réseau.\n` +
          `4. Le collecteur paie ${wages.length} salaires de « chatteurs » (${amt(wagesTotal, 'USDT')}), encaisse ${amt(outAmt, 'USDT')} sur ${exName} (transaction ${outRes.tx.hash.slice(0, 12)}…), puis, environ ${gapH} heures plus tard, déplace ${amt(reserveAmt, 'USDT')} vers l'adresse de réserve ${A(w, reserve)}, environ ${sinceMoveH.toLocaleString('fr-FR')} heures avant la plainte.\n` +
          `5. Les fonds sont toujours détenus : ${amt(reserveHeld, 'USDT')} sur la réserve, ${amt(collectorLeft, 'USDT')} sur le collecteur, soit ${amt(freezable, 'USDT')} gelables par ${tether.name}.\n\n` +
          `Les fausses pistes du dossier et comment les écarter :\n\n` +
          `- Le portefeuille carburant parmi les entrées du collecteur : il n'envoie que du TRX. Ce n'est pas une victime mais un outil du réseau.\n` +
          `- Les petits versements ronds du collecteur : des salaires, pas l'encaissement. On les note, on ne les suit pas en priorité.\n` +
          `- Le solde du collecteur : il paraît modeste, mais ce n'est pas parce que l'argent a été encaissé. L'essentiel dort sur la réserve, non étiquetée : un gel visant le seul collecteur l'aurait manqué.\n\n` +
          `À retenir :\n\n` +
          `- Sur Tron, le **TRX** est l'actif natif (frais), l'**USDT-TRC20** est un jeton émis par Tether. C'est le réseau le plus utilisé pour l'USDT dans les escroqueries.\n` +
          `- Les escroqueries sentimentales à l'investissement donnent à chaque victime une « adresse de dépôt » qui remonte à un **collecteur** commun : ses entrées révèlent les autres victimes, qu'on compte par expéditeur et non par transaction.\n` +
          `- Le portefeuille qui fournit le **carburant** (TRX) signe l'appartenance des relais au même réseau.\n` +
          `- On **trie** les sorties d'un collecteur : salaires (petits, ronds, réguliers), encaissement (adresse de dépôt étiquetée), réserve (grosse sortie vers une adresse qui ne bouge plus).\n` +
          `- Des USDT encore présents peuvent être **gelés par l'émetteur**, sur l'adresse où ils se trouvent au moment du gel : c'est la priorité absolue, avant même la réquisition de l'exchange.\n` +
          `- La frise chronologique aide à dater les mouvements et à mesurer l'urgence : ici, le dernier mouvement précède la plainte d'environ ${sinceMoveH.toLocaleString('fr-FR')} heures.`,
      },
      hints: [
        'Le guide flotte en haut à gauche du graphe. Le bouton « Je bloque » de chaque étape donne le chemin exact.',
        'Sur Tron, chaque montant indique son actif : TRX (actif natif, sert aux frais) ou USDT (jeton TRC-20). Suivez les USDT.',
        'Le « Solde actuel » d\'une adresse, en haut du panneau d\'analyse, montre ce qu\'elle détient encore : des USDT encore là sont gelables par l\'émetteur.',
        'Les entrées du collecteur (bouton « Entrées ») montrent tous les relais qui l\'alimentent : un relais = une victime, à confirmer en dépliant ses propres entrées.',
        'Une grosse sortie récente vers une adresse non étiquetée qui ne bouge plus : c\'est là que dorment les fonds.',
      ],
      guide: [
        {
          title: 'Ajoutez l\'adresse de la victime',
          text:
            `Onglet **Pièces** ▸ plainte : cliquez l'adresse Tron surlignée de la victime (elle commence par T). Elle s'ajoute au graphe et s'affiche dans le panneau **Analyse**.\n\n` +
            `Tron fonctionne, comme Ethereum, par **comptes** : chaque adresse a un solde par actif, et il n'y a pas de rendu.`,
          tip: 'Dossier ▸ onglet **Pièces** ▸ « Procès-verbal de plainte » ▸ cliquez l\'adresse surlignée.',
          check: { kind: 'onGraph', address: victim },
        },
        {
          title: 'TRX ou USDT ? Lisez l\'Historique',
          text:
            `Onglet **Historique** du panneau : les montants sont suivis de leur actif. Le **TRX** est l'actif natif de Tron : il sert à payer les frais (sous forme d'« énergie » et de « bande passante »). L'**USDT** est un jeton **TRC-20**, émis par la société Tether.\n\n` +
            `Cliquez la ligne **entrante en TRX** venant de « Coinhouse — Hot Wallet » : la victime a d'abord acheté un peu de TRX, juste pour pouvoir payer les frais de ses envois d'USDT.`,
          tip: 'Panneau Analyse ▸ onglet **Historique** ▸ filtre « Entrantes » si besoin ▸ cliquez la ligne verte dont le montant est en TRX (la plus ancienne, tout en bas).',
          check: { kind: 'selected', id: trxFund.id },
        },
        {
          title: 'Marquez la victime',
          text:
            `Revenez à l'adresse de la victime (clic sur son nœud) et marquez-la **Victime**. Sur un graphe qui grandit, ce marquage vert évite de confondre la victime avec les autres adresses, et il sera repris dans le rapport.`,
          tip: 'Clic droit sur le nœud de la victime ▸ « Marquer : Victime ». Ou bouton **Marquer** du panneau ▸ Victime.',
          check: { kind: 'flagged', address: victim, flag: 'victim' },
        },
        {
          title: 'Dépliez ses versements',
          text:
            `Dépliez les **sorties** de la victime (double-clic sur son nœud). Ses trois versements d'USDT partent vers une même adresse : son « adresse de dépôt » ${brand}, celle de la capture d'écran.\n\n` +
            `Cette adresse n'a pas d'étiquette : ce n'est pas une vraie plateforme, juste un portefeuille contrôlé par les escrocs.`,
          tip: 'Double-cliquez le nœud de la victime (ou clic droit ▸ « Déplier les sorties »). Une seule flèche apparaît : elle regroupe les trois versements.',
          check: { kind: 'txRevealed', tx: pays[0] },
        },
        {
          title: 'Remontez jusqu\'au collecteur',
          text:
            `Dépliez les sorties de cette « adresse de dépôt » (double-clic). Chaque versement repart en moins de deux heures vers une **autre adresse** : c'est le **collecteur**, le portefeuille qui centralise l'argent des victimes.\n\n` +
            `Les fausses plateformes donnent une adresse différente à chaque victime, mais tout remonte au même endroit.`,
          tip: 'Double-cliquez l\'adresse située à droite de la victime. Appuyez sur L pour réorganiser le graphe si besoin.',
          check: { kind: 'onGraph', address: collector },
        },
        {
          title: 'Marquez le collecteur et lisez son solde',
          text:
            `Sélectionnez le collecteur et marquez-le **Suspect**. Comparez son **Total reçu** et son **Solde actuel**, en haut du panneau : il ne détient plus qu'une petite partie de ce qu'il a reçu en **USDT**.\n\n` +
            `L'argent a donc bougé. Encaissé ? Dépensé ? Mis de côté ailleurs ? C'est capital : des USDT encore présents quelque part peuvent être **gelés** par leur émetteur. Nous le saurons en triant ses sorties.`,
          tip: 'Clic droit sur le collecteur ▸ « Marquer : Suspect ». Puis lisez les cases « Total reçu » et « Solde actuel » du panneau Analyse.',
          check: { kind: 'flagged', address: collector, flag: 'suspect' },
        },
        {
          title: 'Désignez le collecteur',
          text: `Sélectionnez le collecteur sur le graphe et cliquez **« Utiliser l'adresse sélectionnée »** dans l'objectif 1.`,
          tip: 'Clic sur le nœud marqué Suspect ▸ objectif 1 ▸ « Utiliser l\'adresse sélectionnée ».',
          check: { kind: 'correct', objective: 'o1' },
        },
        {
          title: 'Dépliez les entrées du collecteur',
          text:
            `Qui d'autre alimente ce collecteur ? Dépliez ses **entrées** : bouton **Entrées** du panneau, ou clic droit ▸ « Déplier les entrées ».\n\n` +
            `Plusieurs adresses apparaissent à gauche. Celles qui envoient des **USDT** sont des relais, comme l'« adresse de dépôt » ${de(victimName)} : chacune a été attribuée par ${brand} à une victime différente. Une autre envoie seulement du **TRX** : nous y reviendrons.`,
          tip: 'Sélectionnez le collecteur ▸ bouton **Entrées** (flèche verte). Appuyez sur L pour réorganiser le graphe.',
          check: { kind: 'txRevealed', tx: othersFwds[0] },
        },
        {
          title: 'Remontez aux autres victimes',
          text:
            `Pour chaque relais qui envoie des USDT au collecteur, dépliez à son tour ses **entrées** : l'expéditeur non attribué qui apparaît est une victime. Marquez chacune **Victime**.\n\n` +
            `Comptez ensuite les victimes, **${g('plaignant compris', 'plaignante comprise')}**, et saisissez le nombre dans l'objectif 2. On compte des personnes (des adresses expéditrices), pas des transactions : ${nRepeat > 1 ? `${nRepeat} victimes, ${victimName} ${g('compris', 'comprise')}, ont payé plusieurs fois` : `${victimName} a payé trois fois`}.`,
          tip: 'Pour chaque relais (adresse non attribuée envoyant des USDT au collecteur) : clic ▸ bouton **Entrées** ▸ clic droit sur l\'expéditeur ▸ « Marquer : Victime ». Puis onglet **Marqués** du Dossier : comptez les victimes.',
          check: { kind: 'correct', objective: 'o6' },
        },
        {
          title: 'Chiffrez le total collecté',
          text:
            `Sélectionnez le collecteur : la case **Total reçu** donne ce qu'il a reçu, actif par actif. Reportez la partie **USDT** dans l'objectif 3. C'est le préjudice minimal du réseau visible on-chain, toutes victimes confondues.`,
          tip: 'Clic sur le collecteur ▸ case « Total reçu » ▸ montant suivi de « USDT » (ignorez le TRX).',
          check: { kind: 'correct', objective: 'o7' },
        },
        {
          title: 'Le portefeuille carburant',
          text:
            `Parmi les entrées du collecteur, une adresse n'envoie que du **TRX**. Cliquez-la et lisez son Historique : elle a aussi envoyé 50 TRX à chaque relais, avant leur premier versement. C'est le portefeuille **« carburant »** des opérateurs, qui paie les frais de toutes leurs adresses.\n\n` +
            `Marquez-le **Suspect** et désignez-le dans l'objectif 4.`,
          tip: 'Repérez la flèche en TRX qui arrive sur le collecteur ▸ clic sur son expéditeur ▸ objectif 4 ▸ « Utiliser l\'adresse sélectionnée ».',
          check: { kind: 'correct', objective: 'o8' },
        },
        {
          title: 'Un même réseau ?',
          text:
            `Objectif 5 : sur quels faits s'appuyer pour affirmer que les relais appartiennent au réseau du collecteur ? Pensez à ce que vous venez d'observer : où partent leurs USDT, et d'où vient leur TRX.\n\n` +
            `Dans un rapport, un rattachement s'écrit toujours avec ses indices : c'est leur convergence qui le rend solide.`,
          tip: 'Objectif 5 : cochez la réponse qui reprend les deux observations faites sur le graphe.',
          check: { kind: 'answered', objective: 'o11' },
        },
        {
          title: 'Filtrez une période sur la frise',
          text:
            `Ouvrez la **Frise** chronologique (bouton « Frise » en haut, ou touche T) : chaque trait est une transaction affichée sur le graphe, placée à sa date. **Glissez** la souris sur la frise pour sélectionner la période des versements de la victime : le reste du graphe s'estompe.\n\n` +
            `Dater les mouvements permet de vérifier le récit de la plainte et de mesurer l'**urgence** : combien de temps s'est écoulé depuis le dernier mouvement des escrocs ? Annulez ensuite le filtre (croix « Filtre : … »).`,
          tip: 'Bouton **Frise** (icône de panneau en bas, barre du haut) ou touche T ▸ cliquez-glissez horizontalement sur la zone des traits. Le filtre s\'annule avec la croix « Filtre : … ».',
          check: { kind: 'tool', tool: 'timeline' },
        },
        {
          title: 'Triez les sorties du collecteur',
          text:
            `Dépliez les **sorties** du collecteur (double-clic). Plusieurs destinations apparaissent ; triez-les par **étiquette**, **montant** et **date** :\n\n` +
            `- une adresse étiquetée **« ${exName} — Adresse de dépôt »** : le réseau a **encaissé** une tranche sur une plateforme ;\n` +
            `- de **petits montants ronds**, espacés de quelques jours, vers des adresses non attribuées ;\n` +
            `- une **grosse sortie récente** vers une autre adresse non attribuée.\n\n` +
            `Commencez par l'encaissement : renseignez la plateforme dans l'objectif 6.`,
          tip: 'Double-cliquez le collecteur (marqué Suspect), ou clic droit ▸ « Déplier les sorties ». Annulez le filtre de la frise si les nouveaux nœuds apparaissent estompés. Objectif 6 : menu déroulant ▸ ' + exName + '.',
          check: { kind: 'onGraph', address: exDeposit },
        },
        {
          title: 'Citez l\'encaissement',
          text:
            `Cliquez la **flèche** qui relie le collecteur à l'adresse de dépôt ${de(exName)} : sur un modèle à comptes, une flèche qui ne porte qu'une transaction vaut sélection de cette transaction. Utilisez-la dans l'objectif 7 (« Utiliser la transaction sélectionnée »).\n\n` +
            `C'est cette transaction (hash, date, montant) que la réquisition citera, avec l'adresse de dépôt.`,
          tip: `Clic sur la flèche collecteur ▸ « ${exName} — Adresse de dépôt » (ou, dans l'Historique du collecteur, sur la ligne sortante vers cette adresse) ▸ objectif 7 ▸ « Utiliser la transaction sélectionnée ».`,
          check: { kind: 'correct', objective: 'o9' },
        },
        {
          title: 'Écartez les salaires',
          text:
            `Relisez la **note de la cellule d'appui** (Pièces) : les « chatteurs » de ces réseaux sont payés en USDT, par petits versements réguliers. Les petites sorties rondes du collecteur ont exactement ce profil : ce ne sont **ni l'encaissement ni les fonds mis de côté**.\n\n` +
            `Comptez ces versements (des transactions, pas des adresses : un même employé peut être payé deux fois) et saisissez le nombre dans l'objectif 8. On les signale, mais on ne s'y attarde pas : l'argent des victimes est ailleurs.`,
          tip: 'Collecteur sélectionné ▸ onglet **Historique** ▸ filtre « Sortantes » : comptez les lignes de quelques centaines d\'USDT vers des adresses non étiquetées.',
          check: { kind: 'correct', objective: 'o20' },
        },
        {
          title: 'Retrouvez où dorment les fonds',
          text:
            `Reste la **grosse sortie récente**. Cliquez son destinataire : aucune étiquette, et son Historique ne montre aucune sortie depuis. Son **Solde actuel** contient l'essentiel de ce que le collecteur détenait encore : c'est une **adresse de réserve** du réseau.\n\n` +
            `Marquez-la **Suspect** et désignez-la dans l'objectif 9.`,
          tip: 'Repérez, parmi les sorties du collecteur, la flèche au plus gros montant vers une adresse non étiquetée ▸ clic sur cette adresse ▸ objectif 9 ▸ « Utiliser l\'adresse sélectionnée ».',
          check: { kind: 'correct', objective: 'o17' },
        },
        {
          title: 'Chiffrez ce qui reste gelable',
          text:
            `Les USDT gelables sont ceux qui se trouvent **aujourd'hui** sur les adresses du réseau : additionnez la partie **USDT** du « Solde actuel » de la réserve et celle du collecteur, et reportez le total dans l'objectif 10.`,
          tip: 'Réserve sélectionnée ▸ « Solde actuel » (USDT) ; collecteur sélectionné ▸ « Solde actuel » (USDT). Additionnez, sans espace entre les milliers.',
          check: { kind: 'correct', objective: 'o18' },
        },
        {
          title: 'Mesurez l\'urgence',
          text:
            `Comparez la **date du transfert vers la réserve** (panneau de la transaction, « Date (Paris) ») et la **date de la plainte** (en tête du procès-verbal). Saisissez l'écart en heures dans l'objectif 11 (une marge de deux heures est tolérée).\n\n` +
            `Un mouvement aussi récent signifie que le réseau est actif : la réserve peut partir dans l'heure.`,
          tip: 'Flèche collecteur ▸ réserve sélectionnée ▸ « Date (Paris) ». Pièces ▸ plainte ▸ date indiquée. Écart en heures (ex. de 9 h la veille à 15 h le lendemain = 30 h).',
          check: { kind: 'correct', objective: 'o19' },
        },
        {
          title: 'Le gel : pourquoi c\'est urgent',
          text:
            `L'USDT a une particularité : son émetteur, **Tether**, peut **geler** une adresse. Les jetons qu'elle détient sont alors bloqués. Mais le gel ne bloque que ce qui est **encore sur l'adresse visée** au moment où il prend effet : demander le gel du seul collecteur aurait laissé filer la réserve.\n\n` +
            `L'ordre des priorités : 1) demande de gel à Tether sur la réserve et sur le collecteur, via son portail dédié aux forces de l'ordre, en lien avec le magistrat ; 2) réquisition ${de(exName)} sur l'adresse de dépôt (identité, IP, blocage du compte) ; 3) identification des autres victimes et des bénéficiaires des salaires.\n\n` +
            `⚖> Le gel par l'émetteur est une mesure volontaire et conservatoire : la saisie des fonds relève ensuite d'une décision judiciaire (saisie pénale), à préparer avec le parquet ou le juge d'instruction.`,
          check: { kind: 'manual' },
        },
        {
          title: 'Terminez et remettez le rapport',
          text:
            `Objectif 12 : l'émetteur de l'USDT figure dans la liste, groupe « Autres entités de la base » (catégorie « Émetteur de stablecoin »). Objectif 13 : appuyez-vous sur l'étape « Le gel : pourquoi c'est urgent ».\n\n` +
            `Puis cliquez **Remettre le rapport** pour lire le débriefing.`,
          tip: 'Objectif 12 : menu déroulant ▸ Tether. Objectif 13 : cochez une réponse.',
          check: { kind: 'answered', objective: 'o5' },
        },
      ],
    }
  },
}
