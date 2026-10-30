import { World, type Tx } from '../engine/world'
import { exchange, tonTransfer, HOUR, DAY } from '../engine/patterns'
import { roundAsset } from '../engine/chains'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, fakeCity, fakeHandle, fakePerson, fmtDate, procedureFor } from './util'

// Arnaque à l'emploi sur Telegram (« tâches rémunérées ») payée en USDT sur
// TON. L'escroc rend une petite « commission » pour gagner la confiance, puis
// dépose sur l'adresse PARTAGÉE d'un exchange : le compte crédité n'est
// désigné que par le commentaire de la transaction. Une première recrue,
// signalée par un autre service, avait payé la même adresse avant les faits.

const COMPANIES = ['MediaBoost Agency', 'StarRank Digital', 'ClickWave Partners', 'Optima Reviews', 'TrendLab Marketing'] as const

const usdt = (v: number) => roundAsset('USDT', v)
const ton = (v: number) => roundAsset('TON', v)
const h1 = (sec: number) => Math.round((sec / 3600) * 10) / 10

export const debTonCommentaire: ScenarioTemplate = {
  id: 'deb-ton-commentaire',
  title: 'TON : le commentaire qui désigne le compte',
  tagline: 'Une fausse offre d\'emploi, des USDT sur TON et une adresse d\'exchange partagée.',
  description:
    'Recrutée sur Telegram pour des « tâches rémunérées », une victime a fini par prépayer des « missions premium » en USDT sur la blockchain TON. Retrouvez l\'adresse de l\'escroc, chiffrez le préjudice net, recensez les autres recrues, suivez les fonds jusqu\'à l\'exchange et relevez l\'information indispensable à la réquisition quand l\'adresse de dépôt est commune à tous les clients.',
  difficulty: 1,
  chains: ['ton'],
  skills: ['lecture_tx', 'tokens', 'memo', 'exchange_id', 'requisition'],
  estMinutes: 30,
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
    const payoutV = usdt(Math.round(p1 * r.float(1.25, 1.4)))
    const payout = tonTransfer(w, { from: s1, to: victim, value: payoutV, asset: 'USDT', comment: `${company} – commission`, time: T0 + Math.round(r.float(1, 4) * HOUR) })
    const pay2 = tonTransfer(w, { from: victim, to: s1, value: p2, asset: 'USDT', comment: 'Mission premium 2', time: payout.time + Math.round(r.float(2, 8) * HOUR) })
    const p3T = pay2.time + Math.round(r.float(20, 40) * HOUR)
    fund.withdraw(victim, usdt(p3 + r.int(0, 3) * 10), p3T - Math.round(r.float(2, 8) * HOUR), 'USDT')
    const pay3 = tonTransfer(w, { from: victim, to: s1, value: p3, asset: 'USDT', comment: 'Mission premium 3', time: p3T })
    path.push(pay1, payout, pay2, pay3)

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
    // Portefeuilles payeurs distincts : la première recrue, la victime, les autres recrues, le payeur en TON
    const nPayers = nOthers + 3

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
    const delayH = h1(dep1.time - pay3.time)
    const leftUsdt = usdt(w.balanceOf(s1, 'USDT'))

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
    const net = usdt(paid - payoutV)
    const earlyP = fakePerson(r)
    const earlyCity = fakeCity(r)

    return {
      world: w,
      title: `Fausse offre d'emploi « ${company} » — ${city}`,
      briefing:
        `${victimName}, demeurant à ${city}, dépose plainte pour escroquerie. ${g('Il', 'Elle')} a été ${g('contacté', 'contactée')} sur Telegram par une « recruteuse » de la société ${company} : quelques euros par vidéo « likée », depuis son téléphone. Après de petits gains réels, on lui a proposé des « missions premium » à prépayer en USDT, remboursées avec 30 % de commission… qui ne sont jamais arrivées.\n\n` +
        `Les paiements ont été faits sur la blockchain TON, depuis son portefeuille. Sur TON, chaque transfert peut porter un commentaire public. Certains exchanges y reçoivent tous les dépôts de leurs clients sur une seule adresse. Un autre service vous a par ailleurs transmis un signalement visant la même « société ».\n\n` +
        `Votre mission : retrouver l'adresse de l'escroc, chiffrer le préjudice réel de la victime, mesurer le nombre de recrues piégées, suivre les fonds jusqu'à l'exchange et relever ce qui permettra d'identifier le compte crédité.`,
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
        {
          id: 'signalement', type: 'pv', title: `Signalement transmis par le commissariat de ${earlyCity}`, date: depT + 3 * DAY, author: `Commissariat de ${earlyCity}`,
          body:
            `Main courante de ${earlyP.name}, recruté${earlyP.g('', 'e')} sur Telegram par « ${company} » pour des « tâches rémunérées ».\n\n` +
            `${earlyP.g('Il', 'Elle')} déclare avoir payé une « Mission VIP » de ${amt(earlyV, 'USDT')} (réseau TON) le ${fmtDate(earlyTx.time, false)}, sans jamais être remboursé${earlyP.g('', 'e')}. Hash et adresse non conservés : ${earlyP.g('il', 'elle')} a désinstallé son application de portefeuille.\n\n` +
            `Transmis pour rapprochement éventuel.`,
        },
      ],
      seeds: [victim],
      objectives: [
        {
          id: 'o1', type: 'address', points: 10,
          prompt: 'À quelle adresse TON la victime a-t-elle payé ses « missions » ?',
          answer: [s1],
          hint: 'Ouvrez la transaction citée dans la plainte, ou dépliez les sorties du portefeuille de la victime.',
          explanation: `Les trois paiements (${amt(paid, 'USDT')} au total) vont vers ${A(w, s1)}. Le transfert en sens inverse (« commission ») part de la même adresse : l'escroc rend une petite somme pour gagner la confiance de sa victime.`,
        },
        {
          id: 'o6', type: 'amount', points: 9, unit: 'USDT', tolerance: 0.01,
          prompt: 'Quel montant la « commission » renvoyée par l\'escroc à la victime représentait-elle ?',
          answer: payoutV,
          hint: 'Dans les transactions du portefeuille de la victime, cherchez le seul transfert entrant d\'USDT venant de l\'adresse de l\'escroc (son commentaire évoque une commission).',
          explanation: `${amt(payoutV, 'USDT')}, versés le ${fmtDate(payout.time)}, quelques heures après la première mission (${amt(p1, 'USDT')}) : un « gain » d'environ ${Math.round((payoutV / p1 - 1) * 100)} %. C'est le ressort de l'arnaque aux tâches : un premier retour réel, financé par l'argent des victimes, pour convaincre de payer davantage ensuite. Ce transfert entrant doit figurer au dossier : il réduit le préjudice et prouve le contact avec l'escroc.`,
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
          prompt: 'Combien de portefeuilles distincts (celui de la victime compris) ont envoyé des fonds à l\'adresse de l\'escroc ?',
          answer: nPayers,
          hint: 'Listez les transferts entrants de l\'adresse de l\'escroc, en USDT comme en TON, et comptez les adresses émettrices différentes. La victime a payé plusieurs fois.',
          explanation: `${nPayers} portefeuilles : celui de ${victimName} (trois paiements), celui de la recrue signalée à ${earlyCity}, ${nOthers} autre${nOthers > 1 ? 's' : ''} payant en USDT et un payant en TON. Les libellés « Mission premium » ou « Mission VIP » trahissent le même scénario. On compte des portefeuilles, pas des transactions, et on n'oublie pas l'actif natif : une victime qui paie en TON reste une victime.`,
        },
        {
          id: 'o8', type: 'tx', points: 9,
          prompt: 'Quelle transaction correspond au paiement de la recrue signalée par l\'autre service ?',
          answer: [earlyTx.id],
          hint: 'Le signalement donne une date et un montant : cherchez parmi les transferts entrants de l\'adresse de l\'escroc celui qui correspond aux deux.',
          explanation: `Le ${fmtDate(earlyTx.time)}, ${amt(earlyV, 'USDT')} arrivent sur ${A(w, s1)} avec le commentaire « Mission VIP » (${earlyTx.hash.slice(0, 12)}…) : montant et date concordent avec le signalement. C'est aussi le plus ancien paiement reçu par cette adresse : l'escroquerie a commencé avant les faits dénoncés par ${victimName}. Rattacher ainsi un signalement à une transaction permet d'informer l'autre service, de joindre les procédures et de retrouver l'adresse de la recrue, qu'elle avait perdue.`,
        },
        {
          id: 'o2', type: 'entity', points: 9,
          prompt: 'Sur quel exchange l\'escroc a-t-il déposé les fonds ?',
          answer: [destKey],
          hint: 'Dépliez les sorties de l\'adresse de l\'escroc : hors la petite « commission », les fonds partent vers une adresse étiquetée « Hot Wallet ».',
          explanation: `Les USDT et les TON partent vers ${A(w, dest.hot)}, l'adresse de ${destName} qui reçoit les dépôts de tous ses clients sur TON.`,
        },
        {
          id: 'o3', type: 'number', points: 10, tolerance: 0, unit: 'commentaire',
          prompt: 'Quel commentaire accompagne les dépôts de l\'escroc sur l\'exchange ?',
          answer: Number(memo),
          hint: 'Sélectionnez une transaction de l\'escroc vers le hot wallet : le champ « Commentaire (memo) » s\'affiche dans le panneau de droite. Les commentaires des paiements de la victime ne servent à rien ici.',
          explanation: `Les deux dépôts portent le commentaire ${memo}. Les autres dépôts reçus au même moment par ${destName} portent d'autres commentaires : ce sont d'autres clients. Les textes « Mission premium… » n'étaient que des libellés saisis par la victime, sans valeur pour la réquisition.`,
        },
        {
          id: 'o4', type: 'amount', points: 9, unit: 'USDT', tolerance: 0.01,
          prompt: 'Combien d\'USDT l\'escroc a-t-il déposés sur l\'exchange ?',
          answer: depUsdt,
          hint: 'Ne comptez que le dépôt en USDT parti de l\'adresse de l\'escroc, pas les dépôts voisins d\'autres clients.',
          explanation: `${amt(depUsdt, 'USDT')}. Le montant dépasse les paiements de ${victimName} (${amt(paid, 'USDT')}) : d'autres recrues ont payé la même adresse. Il reste ${amt(leftUsdt, 'USDT')} sur l'adresse de l'escroc.`,
        },
        {
          id: 'o10', type: 'amount', points: 8, unit: 'TON', tolerance: 0.01,
          prompt: 'L\'escroc a fait un second dépôt, dans l\'actif natif de la chaîne. Combien de TON a-t-il déposés ?',
          answer: depTon,
          hint: 'Le second transfert de l\'escroc vers le hot wallet porte le même commentaire que le premier ; lisez son montant en TON.',
          explanation: `${amt(depTon, 'TON')}, quelques minutes après le dépôt d'USDT et avec le même commentaire ${memo} : même compte client. Ces TON viennent pour l'essentiel de la recrue qui a payé en TON ; l'escroc en garde un peu pour payer les frais. La réquisition doit citer les deux dépôts (deux hash, deux actifs, un commentaire).`,
        },
        {
          id: 'o12', type: 'number', points: 8, tolerance: 1, unit: 'heures',
          prompt: 'Combien d\'heures se sont écoulées entre la troisième mission de la victime et le dépôt d\'USDT sur l\'exchange ?',
          answer: delayH,
          hint: 'Comparez l\'horodatage de la transaction citée dans la plainte et celui du dépôt d\'USDT vers le hot wallet.',
          explanation: `Environ ${delayH} h (${fmtDate(pay3.time)} → ${fmtDate(dep1.time)}). L'escroc encaisse dans la journée qui suit le dernier paiement : au moment de la plainte, les fonds sont déjà sur un compte d'exchange. D'où l'intérêt d'une demande de gel adressée à l'exchange sans attendre, avec la réquisition.`,
        },
        {
          id: 'o5', type: 'choice', points: 8,
          prompt: 'Pourquoi la réquisition à l\'exchange doit-elle mentionner ce commentaire ?',
          hint: 'Regardez combien de clients différents déposent sur la même adresse du hot wallet.',
          ...choice(r,
            'L\'adresse est commune à tous les clients : seul le commentaire, avec le hash, désigne le compte',
            [
              'Le commentaire contient la clé privée de l\'escroc : l\'exchange pourra alors bloquer ses fonds sans délai',
              'Sans commentaire, une transaction TON n\'est pas confirmée et le dépôt pourrait être annulé',
              'Le commentaire est le numéro de téléphone du client, ce qui dispense de demander son identité',
            ]),
          explanation: `${destName} reçoit sur ${A(w, dest.hot)} les dépôts de milliers de clients : sans le commentaire ${memo}, impossible de savoir quel compte a été crédité. La réquisition cite l'adresse, le commentaire, les hash (${dep1.hash.slice(0, 12)}… et ${dep2.hash.slice(0, 12)}…), dates et montants, et demande identité, IP, historique et gel du compte. ${procedureFor(dest.entity)}`,
        },
        {
          id: 'o11', type: 'choice', points: 8,
          prompt: 'Les USDT déposés sont désormais sur l\'adresse partagée de l\'exchange. Quel est le bon réflexe conservatoire ?',
          hint: 'Demandez-vous qui d\'autre détient des fonds sur cette adresse partagée.',
          ...choice(r,
            'Demander à l\'exchange de geler le compte client désigné par le commentaire, en citant hash, dates et montants',
            [
              'Demander à Tether de geler l\'adresse du hot wallet de l\'exchange qui a reçu les USDT',
              'Attendre la réponse à la réquisition d\'identification avant toute demande de gel',
              'Demander aux validateurs du réseau TON d\'annuler les deux dépôts',
            ]),
          explanation: `Une fois les fonds crédités sur un compte d'exchange, c'est l'exchange qui peut bloquer le compte de son client : on lui demande le gel en même temps que l'identification, en désignant le compte par le commentaire ${memo} et les hash. Faire geler le hot wallet par l'émetteur bloquerait les avoirs de milliers de clients étrangers à l'affaire : disproportionné et irréaliste. Attendre l'identification laisse le temps de retirer, et une transaction confirmée ne s'annule pas. Le petit reliquat resté sur l'adresse de l'escroc (${amt(leftUsdt, 'USDT')}) peut, lui, faire l'objet d'une demande de gel à Tether.`,
        },
      ],
      truth: {
        path: [earlyTx.id, ...path.map((t) => t.id)],
        addresses: [s1],
        debrief:
          `1. Avant les faits, une première recrue (signalée à ${earlyCity}) paie ${amt(earlyV, 'USDT')} à ${A(w, s1)} (« Mission VIP »).\n` +
          `2. ${victimName} paie ${amt(p1, 'USDT')}, ${amt(p2, 'USDT')} puis ${amt(p3, 'USDT')} (jetons USDT sur TON) à la même adresse. Entre les deux premiers paiements, l'escroc lui renvoie ${amt(payoutV, 'USDT')} de « commission » : technique classique de mise en confiance. Préjudice net : ${amt(net, 'USDT')}.\n` +
          `3. D'autres recrues paient la même adresse, en USDT et en TON : ${nPayers} portefeuilles payeurs au total.\n` +
          `4. Environ ${delayH} h après le dernier paiement de la victime, l'escroc dépose ${amt(depUsdt, 'USDT')} puis ${amt(depTon, 'TON')} sur l'adresse partagée de ${destName}, avec le commentaire ${memo}.\n\n` +
          `À retenir : sur TON (comme sur XRP avec le destination tag), un exchange peut utiliser une seule adresse pour tous ses clients. Le commentaire est alors l'identifiant du compte. Plusieurs commentaires circulent dans un dossier : seul celui des dépôts vers l'exchange désigne le compte de l'escroc. Le préjudice se calcule net des sommes rendues.\n\n` +
          `Réflexes de l'enquêteur : réquisition à ${destName} citant le commentaire, les hash, dates et montants, avec demande de gel du compte ; information du service de ${earlyCity} et rapprochement des procédures ; signalement du compte Telegram de la « recruteuse » ; recherche d'autres plaintes visant la même adresse.`,
      },
      hints: [
        'Partez du portefeuille de la victime : ses paiements partent tous vers la même adresse, et un transfert en revient.',
        'Les entrées de l\'adresse de l\'escroc sont autant de recrues : comptez les portefeuilles, en USDT comme en TON.',
        'Dépliez les sorties de cette adresse. L\'adresse finale reçoit énormément de dépôts de tiers : c\'est une adresse partagée d\'exchange.',
        'Dans le détail d\'une transaction TON, le commentaire apparaît dans un encadré « Commentaire (memo) ».',
      ],
    }
  },
}
