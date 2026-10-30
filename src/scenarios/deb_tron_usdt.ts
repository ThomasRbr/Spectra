import { World, type Tx } from '../engine/world'
import { exchange, HOUR, DAY } from '../engine/patterns'
import { roundAsset } from '../engine/chains'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, fakeCity, fakePerson, fmtDate, procedureFor } from './util'

// Fausse plateforme d'investissement sur Tron : chaque client reçoit une
// « adresse de dépôt personnelle » (contrôlée par l'escroc), balayée vers une
// adresse de collecte qui paie aussi les frais en TRX, puis dépôt d'une partie
// des USDT sur un exchange. Le reste dort sur la collecte : gel possible.

const PLATFORMS = ['TronVest Capital', 'Quantis Yield', 'Nexora Invest', 'CapitalWave AI', 'Stellaris Trade', 'BlueOak Markets'] as const

const usdt = (v: number) => roundAsset('USDT', v)
const trx = (v: number) => roundAsset('TRX', v)

export const debTronUsdt: ScenarioTemplate = {
  id: 'deb-tron-usdt',
  title: 'USDT sur Tron : la fausse plateforme',
  tagline: 'Des USDT, des frais en TRX et une adresse de collecte à repérer.',
  description:
    'Une victime a versé des USDT (réseau Tron) sur une fausse plateforme d\'investissement. Suivez les jetons depuis son « adresse de dépôt personnelle » jusqu\'à l\'adresse qui centralise les fonds, puis jusqu\'à l\'exchange. Vous apprendrez à distinguer la valeur (USDT) des frais (TRX) et le bon réflexe face à des USDT encore présents sur une adresse.',
  difficulty: 1,
  chains: ['tron'],
  skills: ['lecture_tx', 'tokens', 'tron', 'exchange_id', 'gel'],
  estMinutes: 15,
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
    const victimE = w.customEntity({ name: victimName, category: 'victim' })
    const victim = w.addr('tron', { entity: victimE })
    const depV = w.addr('tron', { entity: scamE })
    const collector = w.addr('tron', { entity: scamE })

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
    for (let i = 0; i < nOthers; i++) {
      const dep = w.addr('tron', { entity: scamE })
      const v = w.addr('tron')
      const value = usdt(r.int(5, 60) * 100)
      const t = w.at(r.float(-60, 150))
      w.fundAccount(v, usdt(value + r.int(0, 8) * 10), 'USDT', t - Math.round(r.float(2, 48) * HOUR))
      w.transfer({ time: t, from: v, to: dep, value, asset: 'USDT', fee: usdtFee() })
      sweep(dep, t + Math.round(r.float(1, 8) * HOUR))
    }

    // ── Dépôt sur l'exchange ─────────────────────────────────────────────────
    const depT = Math.max(...sweepsTimes) + Math.round(r.float(5, 20) * HOUR)
    const collected = w.balanceOf(collector, 'USDT')
    const depAmt = usdt(Math.floor((collected * r.float(0.6, 0.78)) / 100) * 100)
    const dep = dest.receive(collector, depAmt, depT, { asset: 'USDT' })
    path.push(dep.tx)
    if (dep.sweep) path.push(dep.sweep)
    const left = usdt(w.balanceOf(collector, 'USDT'))

    // ── Bruit de fond ────────────────────────────────────────────────────────
    dest.noise(14, w.at(-4 * 24), w.at(9 * 24), 'USDT')
    dest.noise(6, w.at(-4 * 24), w.at(9 * 24), 'TRX')
    fund.noise(8, w.at(-4 * 24), w.at(8 * 24), 'USDT')

    const destName = dest.entity.name
    const shownBalance = usdt(Math.round(((p1 + p2) * r.float(1.25, 1.6)) / 10) * 10)

    return {
      world: w,
      title: `Fausse plateforme « ${platform} » — ${city}`,
      briefing:
        `${victimName}, demeurant à ${city}, dépose plainte pour escroquerie. Contacté${g('', 'e')} par une « conseillère » sur une application de messagerie, ${g('il', 'elle')} a ouvert un compte sur la plateforme « ${platform} », qui promettait des rendements quotidiens sur des USDT. ${g('Il', 'Elle')} a versé deux fois des USDT depuis son portefeuille personnel, sur le réseau Tron (USDT-TRC20). Le tableau de bord affichait des gains… jusqu'à la demande de retrait, refusée sans « frais de déblocage ».\n\n` +
        `Sur Tron, la monnaie native est le TRX ; l'USDT y circule comme un jeton (standard TRC-20). Les deux apparaissent dans les transactions : il faut savoir lequel porte la valeur.\n\n` +
        `Votre mission : suivre les USDT jusqu'à l'adresse qui centralise les fonds de la plateforme, puis jusqu'à la plateforme de sortie, et préparer les demandes urgentes.`,
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
      ],
      seeds: [victim],
      objectives: [
        {
          id: 'o1', type: 'address', points: 20,
          prompt: 'Quelle adresse centralise les USDT de la plateforme (adresse de collecte) ?',
          answer: [collector],
          hint: 'L\'adresse de dépôt de l\'espace client n\'est qu\'une étape : suivez les USDT qui en sortent. La bonne adresse reçoit aussi les USDT d\'autres adresses de dépôt.',
          explanation: `L'adresse de dépôt « personnelle » ${A(w, depV)} est contrôlée par l'escroc : elle est vidée vers ${A(w, collector)}, qui reçoit aussi les USDT de ${nOthers} autres adresses de dépôt (d'autres clients piégés). C'est l'adresse de collecte. Elle envoie également de petites sommes en TRX à chaque adresse de dépôt, juste avant de la vider : c'est le carburant des frais.`,
        },
        {
          id: 'o2', type: 'entity', points: 20,
          prompt: 'Sur quelle plateforme l\'adresse de collecte a-t-elle déposé des USDT ?',
          answer: [destKey],
          hint: 'Dépliez les sorties de l\'adresse de collecte et ignorez les petits envois de TRX : un seul transfert d\'USDT important part vers une adresse étiquetée.',
          explanation: `La collecte envoie ${amt(depAmt, 'USDT')} vers une adresse de dépôt ${destName}, aussitôt balayée vers le hot wallet de la plateforme. C'est le point de sortie à réquisitionner. ${procedureFor(dest.entity)}`,
        },
        {
          id: 'o3', type: 'amount', points: 20, unit: 'USDT', tolerance: 0.01,
          prompt: 'Combien d\'USDT ont été déposés sur cette plateforme ?',
          answer: depAmt,
          hint: 'Ouvrez la transaction de la collecte vers l\'adresse de dépôt : lisez le montant du transfert de jeton (USDT), pas les frais en TRX.',
          explanation: `${amt(depAmt, 'USDT')}. La collecte avait reçu ${amt(usdt(collected), 'USDT')} au total : il lui reste ${amt(left, 'USDT')}. Le dépôt dépasse les versements de ${victimName} (${amt(usdt(p1 + p2), 'USDT')}) car les fonds de plusieurs victimes sont mêlés.`,
        },
        {
          id: 'o4', type: 'choice', points: 20,
          prompt: `L'envoi de ${amt(p2, 'USDT')} affiche des frais de ${amt(pay2.fee, 'TRX')}. Que faut-il en comprendre ?`,
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
          id: 'o5', type: 'choice', points: 20,
          prompt: 'Des USDT dorment encore sur l\'adresse de collecte. Qui peut les bloquer le plus rapidement ?',
          ...choice(r,
            'Tether, l\'émetteur de l\'USDT, qui peut geler les jetons présents sur une adresse',
            [
              'Les validateurs du réseau Tron, par un vote d\'urgence sur la transaction',
              'TronScan, l\'explorateur de blocs qui affiche l\'adresse de collecte',
              'La plateforme où la victime a acheté ses USDT, avant leur envoi',
            ]),
          explanation: `L'USDT est un stablecoin centralisé : son émetteur, Tether, peut inscrire une adresse sur liste noire et rendre ses jetons inutilisables. La demande passe par son portail dédié aux forces de l'ordre, en citant l'adresse ${A(w, collector)}, le solde (${amt(left, 'USDT')}) et les hash. Il s'agit d'une mesure conservatoire volontaire de l'émetteur ; la saisie relève ensuite des règles de la saisie pénale. Les validateurs ne bloquent pas un jeton, un explorateur ne fait qu'afficher, et la plateforme d'achat de la victime ne contrôle plus des fonds déjà partis.`,
        },
      ],
      truth: {
        path: path.map((t) => t.id),
        addresses: [depV, collector, dep.deposit],
        debrief:
          `1. ${victimName} envoie ${amt(p1, 'USDT')} puis ${amt(p2, 'USDT')} à son « adresse de dépôt personnelle » ${A(w, depV)}. Cette adresse n'appartient pas à un exchange : elle est contrôlée par la fausse plateforme, qui en crée une par client pour donner l'illusion d'un vrai service.\n` +
          `2. Après chaque versement, la collecte ${A(w, collector)} envoie quelques TRX sur l'adresse de dépôt (pour payer l'énergie), puis la vide de ses USDT. Elle fait de même pour ${nOthers} autres adresses de dépôt : ce sont d'autres victimes.\n` +
          `3. La collecte, alimentée en TRX par un retrait ${destName} (${trxBuy.hash.slice(0, 10)}…), dépose ${amt(depAmt, 'USDT')} sur une adresse de dépôt ${destName}, balayée ensuite vers le hot wallet.\n` +
          `4. ${amt(left, 'USDT')} restent sur la collecte.\n\n` +
          `À retenir : sur Tron, on suit les USDT (la valeur) et on lit les TRX comme des frais. Une adresse qui reçoit les jetons de nombreuses adresses de dépôt et leur envoie du TRX est une collecte.\n\n` +
          `Réflexes de l'enquêteur : (1) demander sans attendre à Tether le gel des USDT restant sur la collecte ; (2) requérir ${destName} sur l'adresse de dépôt (identité, IP, retraits, IBAN) avec une demande de gel du compte ; (3) noter que le retrait de TRX vers la collecte vient aussi de ${destName} : c'est une seconde piste vers le même titulaire.`,
      },
      hints: [
        'Partez du portefeuille de la victime : dépliez ses sorties, puis celles de l\'adresse de dépôt de la plateforme.',
        'Les petits transferts de TRX vont dans l\'autre sens (de la collecte vers les adresses de dépôt) : ce sont des frais, pas la valeur. Suivez les USDT.',
        'Une adresse étiquetée « Adresse de dépôt » qui reverse tout à un hot wallet appartient à un exchange : arrêtez-vous là et réquisitionnez.',
      ],
    }
  },
}
