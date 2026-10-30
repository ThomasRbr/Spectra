import { World, type Tx } from '../engine/world'
import { exchange, HOUR, DAY } from '../engine/patterns'
import { roundAsset } from '../engine/chains'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, fakeCity, fakePerson, fmtDate, procedureFor } from './util'

// Fausse plateforme d'investissement sur Tron : chaque client reçoit une
// « adresse de dépôt personnelle » (contrôlée par l'escroc), balayée vers une
// adresse de collecte qui paie aussi les frais en TRX (achetés sur l'exchange
// de sortie), puis dépôt d'une partie des USDT sur cet exchange et versement
// d'une « commission » à un rabatteur. Le reste dort sur la collecte : gel possible.

const PLATFORMS = ['TronVest Capital', 'Quantis Yield', 'Nexora Invest', 'CapitalWave AI', 'Stellaris Trade', 'BlueOak Markets'] as const

const usdt = (v: number) => roundAsset('USDT', v)
const trx = (v: number) => roundAsset('TRX', v)
const h1 = (sec: number) => Math.round((sec / 3600) * 10) / 10

export const debTronUsdt: ScenarioTemplate = {
  id: 'deb-tron-usdt',
  title: 'USDT sur Tron : la fausse plateforme',
  tagline: 'Des USDT, des frais en TRX et une adresse de collecte à repérer.',
  description:
    'Une victime a versé des USDT (réseau Tron) sur une fausse plateforme d\'investissement. Suivez les jetons depuis son « adresse de dépôt personnelle » jusqu\'à l\'adresse qui centralise les fonds, recensez les autres clients piégés, puis suivez les sorties : l\'exchange, une commission versée à un tiers, et le reliquat encore gelable. Vous apprendrez à distinguer la valeur (USDT) des frais (TRX) et les bons réflexes face à des USDT encore présents sur une adresse.',
  difficulty: 1,
  chains: ['tron'],
  skills: ['lecture_tx', 'tokens', 'tron', 'exchange_id', 'gel'],
  estMinutes: 30,
  lessons: ['tron-usdt', 'stablecoins', 'suivre-flux', 'exchanges', 'gel-stablecoins'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const victimP = fakePerson(r)
    const victimName = victimP.name
    const g = victimP.g
    const city = fakeCity(r)
    const platform = r.pick(PLATFORMS)

    const destKey = r.pick(['binance', 'okx', 'kraken'] as const)
    const fundKey = r.pick((['binance', 'okx', 'kraken', 'coinhouse'] as const).filter((k) => k !== destKey))
    const dest = exchange(w, destKey, 'tron')
    const fund = exchange(w, fundKey, 'tron')

    const scamE = w.customEntity({ name: `« ${platform} » (fausse plateforme)`, category: 'scam', description: 'Fausse plateforme d\'investissement en USDT : faux tableau de bord, faux gains, retraits impossibles.' })
    const brokerE = w.customEntity({ name: 'Bénéficiaire de commissions (inconnu)', category: 'suspect', description: 'Adresse rémunérée par la collecte de la fausse plateforme.' })
    const victimE = w.customEntity({ name: victimName, category: 'victim' })
    const victim = w.addr('tron', { entity: victimE })
    const depV = w.addr('tron', { entity: scamE })
    const collector = w.addr('tron', { entity: scamE })
    const broker = w.addr('tron', { entity: brokerE })

    const usdtFee = () => trx(r.float(13, 28))
    const sweepsTimes: number[] = []
    const path: Tx[] = []

    // L'escroc achète des TRX pour payer les frais (énergie) de ses balayages
    const trxBuy = dest.withdraw(collector, trx(r.int(900, 2400)), w.at(-r.float(72, 140)), 'TRX')

    /** Recharge TRX puis balayage de l'adresse de dépôt vers la collecte. */
    const sweep = (dep: string, t: number): { topup: Tx; sw: Tx } => {
      const topup = w.transfer({ time: t - r.int(3, 25) * 60, from: collector, to: dep, value: trx(r.int(20, 35)), asset: 'TRX', fee: 1.1 })
      const sw = w.transfer({ time: t, from: dep, to: collector, value: w.balanceOf(dep, 'USDT'), asset: 'USDT', fee: usdtFee() })
      sweepsTimes.push(t)
      return { topup, sw }
    }

    // ── La victime ────────────────────────────────────────────────────────────
    const p1 = usdt(r.int(6, 20) * 100)
    const p2 = usdt(r.int(25, 80) * 100)
    const T0 = w.at(0)
    fund.withdraw(victim, trx(r.int(60, 150)), w.at(-r.float(30, 60)), 'TRX')
    fund.withdraw(victim, usdt(p1 + r.int(0, 4) * 10), w.at(-r.float(2, 10)), 'USDT')
    const pay1 = w.transfer({ time: T0, from: victim, to: depV, value: p1, asset: 'USDT', fee: usdtFee() })
    const s1 = sweep(depV, T0 + Math.round(r.float(1, 6) * HOUR))
    const p2T = w.at(r.float(80, 140))
    fund.withdraw(victim, usdt(p2 + r.int(0, 5) * 10), p2T - Math.round(r.float(3, 20) * HOUR), 'USDT')
    const pay2 = w.transfer({ time: p2T, from: victim, to: depV, value: p2, asset: 'USDT', fee: usdtFee() })
    const s2 = sweep(depV, p2T + Math.round(r.float(1, 6) * HOUR))
    path.push(pay1, s1.sw, pay2, s2.sw)

    // ── Autres clients de la plateforme (chacun son adresse de dépôt) ────────
    const nOthers = r.int(3, 4)
    const others: { payer: string; dep: string; value: number; tx: Tx }[] = []
    for (let i = 0; i < nOthers; i++) {
      const dep = w.addr('tron', { entity: scamE })
      const v = w.addr('tron')
      const value = usdt(r.int(5, 60) * 100)
      const t = w.at(r.float(-60, 150))
      w.fundAccount(v, usdt(value + r.int(0, 8) * 10), 'USDT', t - Math.round(r.float(2, 48) * HOUR))
      const tx = w.transfer({ time: t, from: v, to: dep, value, asset: 'USDT', fee: usdtFee() })
      sweep(dep, t + Math.round(r.float(1, 8) * HOUR))
      others.push({ payer: v, dep, value, tx })
    }
    const nDeposits = nOthers + 1

    // ── Dépôt sur l'exchange ─────────────────────────────────────────────────
    const depT = Math.max(...sweepsTimes) + Math.round(r.float(5, 20) * HOUR)
    const collected = usdt(w.balanceOf(collector, 'USDT'))
    const depAmt = usdt(Math.floor((collected * r.float(0.6, 0.78)) / 100) * 100)
    const dep = dest.receive(collector, depAmt, depT, { asset: 'USDT' })
    path.push(dep.tx)
    if (dep.sweep) path.push(dep.sweep)
    const delayH = h1(dep.tx.time - pay2.time)

    // ── « Commission » versée à un tiers (rabatteur ou complice) ─────────────
    const commission = usdt(Math.round((collected * r.float(0.08, 0.12)) / 10) * 10)
    const commTx = w.transfer({ time: depT + Math.round(r.float(3, 30) * HOUR), from: collector, to: broker, value: commission, asset: 'USDT', fee: usdtFee() })
    path.push(commTx)
    const left = usdt(w.balanceOf(collector, 'USDT'))

    // ── Bruit de fond ────────────────────────────────────────────────────────
    dest.noise(14, w.at(-4 * 24), w.at(9 * 24), 'USDT')
    dest.noise(6, w.at(-4 * 24), w.at(9 * 24), 'TRX')
    fund.noise(8, w.at(-4 * 24), w.at(8 * 24), 'USDT')

    const destName = dest.entity.name
    const shownBalance = usdt(Math.round(((p1 + p2) * r.float(1.25, 1.6)) / 10) * 10)
    const witness = others[0]
    const witnessP = fakePerson(r)
    const witnessCity = fakeCity(r)
    const mule = fakePerson(r)
    const muleAge = r.int(19, 23)

    return {
      world: w,
      title: `Fausse plateforme « ${platform} » — ${city}`,
      briefing:
        `${victimName}, demeurant à ${city}, dépose plainte pour escroquerie. Contacté${g('', 'e')} par une « conseillère » sur une application de messagerie, ${g('il', 'elle')} a ouvert un compte sur la plateforme « ${platform} », qui promettait des rendements quotidiens sur des USDT. ${g('Il', 'Elle')} a versé deux fois des USDT depuis son portefeuille personnel, sur le réseau Tron (USDT-TRC20). Le tableau de bord affichait des gains… jusqu'à la demande de retrait, refusée sans « frais de déblocage ».\n\n` +
        `Sur Tron, la monnaie native est le TRX ; l'USDT y circule comme un jeton (standard TRC-20). Les deux apparaissent dans les transactions : il faut savoir lequel porte la valeur. Un autre service vous transmet en outre le signalement d'un second client de la même plateforme.\n\n` +
        `Votre mission : suivre les USDT jusqu'à l'adresse qui centralise les fonds de la plateforme, mesurer l'ampleur de l'escroquerie (nombre de clients, montants), identifier toutes les sorties et ce qui reste gelable, puis préparer les demandes urgentes.`,
      evidence: [
        {
          id: 'plainte', type: 'plainte', title: 'Procès-verbal de plainte (extrait)', date: depT + DAY, author: victimName,
          body:
            `« J'ai acheté des USDT sur une plateforme d'achat, ainsi qu'un peu de TRX parce que mon portefeuille m'indiquait qu'il en fallait "pour les frais".\n\n` +
            `J'ai envoyé ${amt(p1, 'USDT')} le ${fmtDate(pay1.time)}, puis ${amt(p2, 'USDT')} le ${fmtDate(pay2.time)}, à l'adresse de dépôt indiquée dans mon espace client.\n\n` +
            `Mon adresse Tron : ${A(w, victim)}\n` +
            `Identifiant (hash) du second envoi : ${pay2.hash} »`,
        },
        {
          id: 'capture-plateforme', type: 'capture', title: `Capture de l'espace client « ${platform} »`, date: p2T + DAY,
          body:
            `${platform.toUpperCase()} — Mon portefeuille\n` +
            `Solde : ${amt(shownBalance, 'USDT')} (+${r.int(25, 60)} % ce mois-ci)\n\n` +
            `Votre adresse de dépôt personnelle (USDT, réseau TRC-20 uniquement) :\n${A(w, depV)}\n\n` +
            `Retrait : bloqué — « frais de conformité » à régler avant tout retrait.`,
        },
        {
          id: 'capture-wallet', type: 'capture', title: 'Capture — application portefeuille de la victime', date: pay2.time,
          body: `Envoyé · USDT (TRC-20)\n-${amt(p2, 'USDT')}\nÀ : ${A(w, depV)}\nFrais réseau : ${amt(pay2.fee, 'TRX')} (énergie + bande passante)\nStatut : Confirmé`,
        },
        {
          id: 'signalement', type: 'pv', title: `Signalement transmis par la brigade de ${witnessCity}`, date: depT + 2 * DAY, author: `Brigade de ${witnessCity}`,
          body:
            `Plainte de ${witnessP.name} pour escroquerie : même mode opératoire (« conseillère » sur messagerie, plateforme « ${platform} », retrait refusé).\n\n` +
            `${witnessP.g('Le plaignant', 'La plaignante')} déclare avoir versé ${amt(witness.value, 'USDT')} le ${fmtDate(witness.tx.time, false)} sur « son » adresse de dépôt personnelle :\n${A(w, witness.dep)}\n\n` +
            `Nous transmettons pour rapprochement éventuel avec votre procédure.`,
        },
      ],
      seeds: [victim],
      objectives: [
        {
          id: 'o1', type: 'address', points: 10,
          prompt: 'Quelle adresse centralise les USDT de la plateforme (adresse de collecte) ?',
          answer: [collector],
          hint: 'L\'adresse de dépôt de l\'espace client n\'est qu\'une étape : suivez les USDT qui en sortent. La bonne adresse reçoit aussi les USDT d\'autres adresses de dépôt.',
          explanation: `L'adresse de dépôt « personnelle » ${A(w, depV)} est contrôlée par l'escroc : elle est vidée vers ${A(w, collector)}, qui reçoit aussi les USDT d'autres adresses de dépôt (d'autres clients piégés, dont celui du signalement de ${witnessCity}). C'est l'adresse de collecte. Elle envoie également de petites sommes en TRX à chaque adresse de dépôt, juste avant de la vider : c'est le carburant des frais.`,
        },
        {
          id: 'o6', type: 'number', points: 9, tolerance: 0, unit: 'adresses de dépôt',
          prompt: 'Combien d\'adresses de dépôt distinctes (celle de la victime comprise) la collecte a-t-elle vidées de leurs USDT ?',
          answer: nDeposits,
          hint: 'Sélectionnez la collecte et listez ses transferts entrants d\'USDT : notez l\'adresse émettrice de chacun. Une même adresse de dépôt peut avoir été vidée deux fois.',
          explanation: `${nDeposits} adresses de dépôt : celle de ${victimName} (vidée deux fois, après chacun de ses versements) et ${nOthers} autres, dont celle citée dans le signalement de ${witnessCity}. Chaque adresse de dépôt correspond à un client de la plateforme : c'est une estimation minimale du nombre de victimes, à transmettre au parquet pour un éventuel regroupement des procédures. On compte des adresses distinctes, pas des transactions.`,
        },
        {
          id: 'o7', type: 'amount', points: 9, unit: 'USDT', tolerance: 0.01,
          prompt: 'Quel montant total d\'USDT la collecte a-t-elle reçu des adresses de dépôt ?',
          answer: collected,
          hint: 'Additionnez les transferts entrants d\'USDT de la collecte, ou lisez le total reçu dans le résumé de l\'adresse (rubrique USDT, pas TRX).',
          explanation: `${amt(collected, 'USDT')} reçus en ${nDeposits + 1} balayages. Les versements de ${victimName} (${amt(usdt(p1 + p2), 'USDT')}) n'en représentent qu'une partie : c'est le préjudice global apparent de la plateforme sur la période, à rapprocher des autres plaintes. Les TRX reçus (achat de « carburant ») ne s'additionnent pas : ce ne sont pas des fonds de victimes.`,
        },
        {
          id: 'o4', type: 'choice', points: 8,
          prompt: `L'envoi de ${amt(p2, 'USDT')} affiche des frais de ${amt(pay2.fee, 'TRX')}. Que faut-il en comprendre ?`,
          hint: 'Regardez dans quelle unité sont exprimés le montant transféré et les frais de la transaction : ce ne sont pas les mêmes actifs.',
          ...choice(r,
            'Les frais se paient en TRX, la monnaie native ; l\'USDT n\'est que le jeton transporté',
            [
              'La plateforme a prélevé une commission en TRX sur chaque dépôt de la victime',
              'Une partie des USDT a été convertie en TRX pendant l\'envoi, à l\'insu de la victime',
              'Le TRX est le vrai montant envoyé ; l\'USDT affiché n\'est qu\'une estimation en dollars',
            ]),
          explanation: `Sur Tron, chaque transaction consomme de l'énergie et de la bande passante, payées en TRX (ou couvertes par des TRX mis en réserve). L'USDT est un jeton TRC-20 géré par un smart contract : la valeur transférée est en USDT, les frais en TRX. C'est pourquoi la victime a dû acheter des TRX, et pourquoi la collecte envoie des TRX à chaque adresse de dépôt avant de la vider : sans TRX, impossible de déplacer les USDT.`,
        },
        {
          id: 'o8', type: 'tx', points: 10,
          prompt: 'D\'où viennent les TRX que la collecte redistribue aux adresses de dépôt ? Désignez la transaction qui les lui a fournis.',
          answer: [trxBuy.id],
          hint: 'Parmi les transferts entrants de la collecte, ignorez les USDT : un seul transfert de TRX arrive, quelques jours avant les faits, depuis une adresse étiquetée.',
          explanation: `Le ${fmtDate(trxBuy.time)}, la collecte reçoit ${amt(trxBuy.transfers[0].value, 'TRX')} depuis le hot wallet de ${destName} (${trxBuy.hash.slice(0, 12)}…) : c'est un retrait effectué depuis un compte client de cette plateforme. Remonter le financement des frais est un réflexe précieux : quelqu'un a dû acheter ce « carburant », et ce retrait désigne un compte, donc un titulaire, indépendamment du dépôt de sortie. La réquisition à ${destName} visera les deux opérations.`,
        },
        {
          id: 'o2', type: 'entity', points: 9,
          prompt: 'Sur quelle plateforme l\'adresse de collecte a-t-elle déposé des USDT ?',
          answer: [destKey],
          hint: 'Dépliez les sorties de l\'adresse de collecte et ignorez les petits envois de TRX : un transfert d\'USDT important part vers une adresse étiquetée.',
          explanation: `La collecte envoie ${amt(depAmt, 'USDT')} vers une adresse de dépôt ${destName}, aussitôt balayée vers le hot wallet de la plateforme. C'est le point de sortie à réquisitionner. ${procedureFor(dest.entity)}`,
        },
        {
          id: 'o3', type: 'amount', points: 9, unit: 'USDT', tolerance: 0.01,
          prompt: 'Combien d\'USDT ont été déposés sur cette plateforme ?',
          answer: depAmt,
          hint: 'Ouvrez la transaction de la collecte vers l\'adresse de dépôt : lisez le montant du transfert de jeton (USDT), pas les frais en TRX.',
          explanation: `${amt(depAmt, 'USDT')}, soit environ ${Math.round((depAmt / collected) * 100)} % de ce que la collecte avait reçu. Le dépôt dépasse les versements de ${victimName} (${amt(usdt(p1 + p2), 'USDT')}) car les fonds de plusieurs victimes sont mêlés.`,
        },
        {
          id: 'o9', type: 'number', points: 8, tolerance: 1, unit: 'heures',
          prompt: 'Combien d\'heures se sont écoulées entre le second versement de la victime et le dépôt sur l\'exchange ?',
          answer: delayH,
          hint: 'Comparez l\'horodatage de la transaction citée dans la plainte et celui du transfert de la collecte vers l\'adresse de dépôt (la chronologie aide).',
          explanation: `Environ ${delayH} h séparent le versement de ${amt(p2, 'USDT')} (${fmtDate(pay2.time)}) du dépôt sur ${destName} (${fmtDate(dep.tx.time)}). Ce délai mesure la fenêtre d'action : quand la plainte est déposée, les fonds ont déjà quitté la blockchain publique pour un compte d'exchange. D'où l'intérêt d'une demande de gel adressée sans attendre à la plateforme, en même temps que la réquisition.`,
        },
        {
          id: 'o10', type: 'address', points: 10,
          prompt: 'Après le dépôt sur l\'exchange, la collecte verse encore des USDT à une adresse non étiquetée. Laquelle ?',
          answer: [broker],
          hint: 'Classez les sorties d\'USDT de la collecte par date : la dernière ne va ni vers une adresse de dépôt d\'exchange, ni vers une adresse de dépôt de la plateforme.',
          explanation: `Le ${fmtDate(commTx.time)}, ${amt(commission, 'USDT')} partent vers ${A(w, broker)}, une adresse qui n'a rien d'une adresse de dépôt (elle ne reverse rien à un hot wallet). Un montant rond, versé juste après l'encaissement, évoque la rémunération d'un intervenant (« conseillère », rabatteur, prestataire) : c'est une hypothèse à vérifier, pas une conclusion. Cette adresse est une nouvelle cible : USDT éventuellement gelables, et piste vers un autre membre du réseau.`,
        },
        {
          id: 'o11', type: 'amount', points: 10, unit: 'USDT', tolerance: 0.01,
          prompt: 'Combien d\'USDT restent sur l\'adresse de collecte après toutes ses sorties ?',
          answer: left,
          hint: 'Lisez le solde USDT de la collecte dans son résumé, ou calculez : total reçu − dépôt sur l\'exchange − dernier versement.',
          explanation: `${amt(left, 'USDT')} = ${amt(collected, 'USDT')} reçus − ${amt(depAmt, 'USDT')} déposés sur ${destName} − ${amt(commission, 'USDT')} versés à ${A(w, broker)}. C'est le montant immédiatement gelable par l'émetteur, à citer dans la demande.`,
        },
        {
          id: 'o5', type: 'choice', points: 8,
          prompt: 'Des USDT dorment encore sur l\'adresse de collecte. Qui peut les bloquer le plus rapidement ?',
          hint: 'L\'USDT n\'est pas une monnaie native de Tron : quelqu\'un l\'émet et gère le smart contract du jeton.',
          ...choice(r,
            'Tether, l\'émetteur de l\'USDT, qui peut geler les jetons présents sur une adresse',
            [
              'Les validateurs du réseau Tron, par un vote d\'urgence sur la transaction',
              'TronScan, l\'explorateur de blocs qui affiche l\'adresse de collecte',
              'La plateforme où la victime a acheté ses USDT, avant leur envoi',
            ]),
          explanation: `L'USDT est un stablecoin centralisé : son émetteur, Tether, peut inscrire une adresse sur liste noire et rendre ses jetons inutilisables. La demande passe par son portail dédié aux forces de l'ordre, en citant l'adresse ${A(w, collector)}, le solde (${amt(left, 'USDT')}), les hash, et utilement l'adresse ${A(w, broker)} qui détient ${amt(commission, 'USDT')}. Il s'agit d'une mesure conservatoire volontaire de l'émetteur ; la saisie relève ensuite des règles de la saisie pénale. Les validateurs ne bloquent pas un jeton, un explorateur ne fait qu'afficher, et la plateforme d'achat de la victime ne contrôle plus des fonds déjà partis.`,
        },
        {
          id: 'o12', type: 'choice', points: 8,
          prompt: `La plateforme de sortie répond : le compte crédité est au nom de ${mule.name}, ${muleAge} ans, ${mule.g('étudiant', 'étudiante')}, ouvert trois semaines avant les faits, avec des connexions depuis l'étranger. Que peut-on en conclure ?`,
          hint: 'Demandez-vous ce que l\'exchange a réellement vérifié : l\'identité du titulaire du compte, ou celle de la personne qui l\'utilise ?',
          ...choice(r,
            `Le titulaire peut être un prête-nom (« mule ») : c'est une piste à vérifier, pas la preuve de l'identité de l'auteur`,
            [
              `${mule.name} est l'auteur de l'escroquerie : l'identité vérifiée par l'exchange suffit à le démontrer`,
              'La réponse est inexploitable : une identité KYC n\'a aucune valeur dans une procédure pénale',
              'Les connexions depuis l\'étranger prouvent que les fonds ont quitté le territoire et ne sont plus saisissables',
            ]),
          explanation: `Le profil (compte récent, titulaire jeune, connexions depuis l'étranger) est typique d'un compte ouvert ou prêté pour encaisser les fonds d'autrui. L'identité KYC désigne le titulaire du compte, pas nécessairement l'auteur : il faut l'entendre, examiner ses retraits (IBAN, autres adresses), les adresses IP et les appareils, et rechercher qui a donné les ordres. Cette réponse reste précieuse : elle ouvre la suite de l'enquête et permet de demander le gel du compte.`,
        },
      ],
      truth: {
        path: path.map((t) => t.id),
        addresses: [depV, collector, dep.deposit, broker],
        debrief:
          `1. ${victimName} envoie ${amt(p1, 'USDT')} puis ${amt(p2, 'USDT')} à son « adresse de dépôt personnelle » ${A(w, depV)}. Cette adresse n'appartient pas à un exchange : elle est contrôlée par la fausse plateforme, qui en crée une par client pour donner l'illusion d'un vrai service.\n` +
          `2. Après chaque versement, la collecte ${A(w, collector)} envoie quelques TRX sur l'adresse de dépôt (pour payer l'énergie), puis la vide de ses USDT. Elle fait de même pour ${nOthers} autres adresses de dépôt, dont celle du signalement de ${witnessCity} : ${nDeposits} clients au moins, ${amt(collected, 'USDT')} encaissés.\n` +
          `3. Les TRX de la collecte proviennent d'un retrait ${destName} (${trxBuy.hash.slice(0, 10)}…), quelques jours avant les faits.\n` +
          `4. Environ ${delayH} h après le second versement de la victime, la collecte dépose ${amt(depAmt, 'USDT')} sur une adresse de dépôt ${destName}, balayée ensuite vers le hot wallet.\n` +
          `5. Elle verse ensuite ${amt(commission, 'USDT')} à ${A(w, broker)} (rémunération probable d'un intervenant, à vérifier).\n` +
          `6. ${amt(left, 'USDT')} restent sur la collecte.\n\n` +
          `À retenir : sur Tron, on suit les USDT (la valeur) et on lit les TRX comme des frais. Une adresse qui reçoit les jetons de nombreuses adresses de dépôt et leur envoie du TRX est une collecte. Ses entrées mesurent l'ampleur de l'escroquerie ; ses sorties désignent les cibles (exchange, complices, reliquat).\n\n` +
          `Réflexes de l'enquêteur : (1) demander sans attendre à Tether le gel des USDT restant sur la collecte et sur l'adresse bénéficiaire de la commission ; (2) requérir ${destName} sur l'adresse de dépôt et sur le retrait de TRX (identité, IP, retraits, IBAN) avec une demande de gel du compte, en gardant à l'esprit que le titulaire peut être un prête-nom ; (3) signaler au parquet le nombre de clients piégés et le montant global pour un regroupement des procédures.`,
      },
      hints: [
        'Partez du portefeuille de la victime : dépliez ses sorties, puis celles de l\'adresse de dépôt de la plateforme.',
        'Les petits transferts de TRX vont dans l\'autre sens (de la collecte vers les adresses de dépôt) : ce sont des frais, pas la valeur. Suivez les USDT.',
        'Les entrées d\'USDT de la collecte sont autant de clients piégés ; son unique entrée de TRX dit qui a acheté le « carburant ».',
        'Une adresse étiquetée « Adresse de dépôt » qui reverse tout à un hot wallet appartient à un exchange : arrêtez-vous là et réquisitionnez. Vérifiez ensuite les sorties suivantes de la collecte.',
      ],
    }
  },
}
