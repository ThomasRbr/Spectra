import { World, type Tx } from '../engine/world'
import { exchange, HOUR, DAY } from '../engine/patterns'
import { roundAsset } from '../engine/chains'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, fakeCity, fakeHandle, fakePerson, fmtDate, procedureFor } from './util'

// Faux support technique de portefeuille : la victime « vérifie » son
// portefeuille en envoyant des SOL, puis ses USDC (jeton SPL), à l'escroc, qui
// dépose aussitôt sur un exchange.

const sol = (v: number) => roundAsset('SOL', v)
const usdc = (v: number) => roundAsset('USDC', v)

export const debSolanaSupport: ScenarioTemplate = {
  id: 'deb-solana-support',
  title: 'Solana : le faux support technique',
  tagline: 'Signatures, SOL natif et jetons SPL : premier traçage sur Solana.',
  description:
    'Un faux « support technique » a convaincu une victime d\'envoyer des SOL pour « vérifier » son portefeuille, puis ses USDC. Suivez les fonds jusqu\'à l\'adresse de dépôt d\'un exchange et découvrez comment Solana présente ses comptes, ses transactions (signatures) et ses jetons.',
  difficulty: 1,
  chains: ['sol'],
  skills: ['lecture_tx', 'evm', 'tokens', 'exchange_id', 'requisition'],
  estMinutes: 12,
  lessons: ['bases-blockchain', 'explorateur-blocs', 'solana', 'exchanges', 'requisitions'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const victimP = fakePerson(r)
    const victimName = victimP.name
    const g = victimP.g
    const city = fakeCity(r)
    const fakeAgent = fakeHandle(r)

    const destKey = r.pick(['binance', 'coinbase', 'kraken', 'okx'] as const)
    const fundKey = r.pick((['binance', 'coinbase', 'kraken', 'okx'] as const).filter((k) => k !== destKey))
    const dest = exchange(w, destKey, 'sol')
    const fund = exchange(w, fundKey, 'sol')

    const scamE = w.customEntity({ name: 'Faux support technique (inconnu)', category: 'scam', description: 'Escroc se faisant passer pour l\'assistance d\'une application de portefeuille.' })
    const victimE = w.customEntity({ name: victimName, category: 'victim' })
    const victim = w.addr('sol', { entity: victimE })
    const s1 = w.addr('sol', { entity: scamE })
    const path: Tx[] = []

    // ── Avoirs de la victime (achats anciens) ────────────────────────────────
    const vSolHeld = sol(r.float(12, 45))
    const vUsdcHeld = usdc(r.int(8, 40) * 50)
    fund.withdraw(victim, sol(vSolHeld * 0.4), w.at(-r.int(40, 200) * 24), 'SOL')
    fund.withdraw(victim, sol(vSolHeld * 0.6), w.at(-r.int(5, 30) * 24), 'SOL')
    fund.withdraw(victim, vUsdcHeld, w.at(-r.int(5, 60) * 24), 'USDC')

    // ── « Vérification » : un petit test, puis presque tout ─────────────────
    const T0 = w.at(0)
    const v1 = sol(r.pick([0.5, 1, 1.5, 2]))
    const pay1 = w.transfer({ time: T0, from: victim, to: s1, value: v1, asset: 'SOL' })
    const v2 = sol(Math.floor((w.balanceOf(victim, 'SOL') - r.float(0.05, 0.3)) * 100) / 100)
    const pay2 = w.transfer({ time: T0 + r.int(6, 20) * 60, from: victim, to: s1, value: v2, asset: 'SOL' })
    const pay3 = w.transfer({ time: pay2.time + r.int(10, 40) * 60, from: victim, to: s1, value: vUsdcHeld, asset: 'USDC' })
    path.push(pay1, pay2, pay3)

    // ── Une autre victime du même jour ───────────────────────────────────────
    const other = w.addr('sol')
    const oV = sol(r.float(3, 15))
    const oT = T0 - Math.round(r.float(1, 5) * HOUR)
    w.fundAccount(other, sol(oV + r.float(0.1, 1)), 'SOL', oT - Math.round(r.float(5, 60) * DAY))
    w.transfer({ time: oT, from: other, to: s1, value: oV, asset: 'SOL' })

    // ── Dépôt sur l'exchange (même adresse pour SOL et USDC) ────────────────
    const depT = pay3.time + Math.round(r.float(0.5, 3) * HOUR)
    const solDep = sol(w.balanceOf(s1, 'SOL') - r.float(0.003, 0.02))
    const d1 = dest.receive(s1, solDep, depT, { asset: 'SOL' })
    const deposit = d1.deposit
    const usdcDep = usdc(w.balanceOf(s1, 'USDC'))
    const d2 = dest.receive(s1, usdcDep, depT + r.int(2, 15) * 60, { asset: 'USDC', depositAddr: deposit })
    path.push(d1.tx, ...(d1.sweep ? [d1.sweep] : []), d2.tx, ...(d2.sweep ? [d2.sweep] : []))

    // ── Bruit de fond ────────────────────────────────────────────────────────
    dest.noise(14, w.at(-3 * 24), w.at(6 * 24), 'SOL')
    dest.noise(8, w.at(-3 * 24), w.at(6 * 24), 'USDC')
    fund.noise(8, w.at(-5 * 24), w.at(4 * 24), 'SOL')

    const destName = dest.entity.name
    const totalSol = sol(v1 + v2)

    return {
      world: w,
      title: `Faux support technique — ${city}`,
      briefing:
        `${victimName}, demeurant à ${city}, dépose plainte pour escroquerie. Après avoir signalé un bug de son application de portefeuille sur un forum, ${g('il', 'elle')} a été ${g('contacté', 'contactée')} en message privé par un « agent du support ». Celui-ci lui a expliqué que son portefeuille devait être « vérifié » : un petit envoi test de SOL, puis le reste « pour synchronisation », enfin ses USDC. Rien n'est revenu.\n\n` +
        `Solana fonctionne par comptes, comme Ethereum : pas d'adresse de rendu, un solde par actif. Son actif natif est le SOL ; les autres jetons (dont l'USDC) suivent le standard SPL. Les explorateurs appellent « signature » l'identifiant d'une transaction.\n\n` +
        `Votre mission : identifier l'adresse de l'escroc, suivre les fonds jusqu'à l'exchange et relever l'adresse de dépôt à réquisitionner.`,
      evidence: [
        {
          id: 'plainte', type: 'plainte', title: 'Procès-verbal de plainte (extrait)', date: depT + DAY, author: victimName,
          body:
            `« L'agent s'appelait "${fakeAgent}". Il m'a fait envoyer ${amt(v1, 'SOL')} pour tester, puis ${amt(v2, 'SOL')} quelques minutes plus tard, puis mes ${amt(vUsdcHeld, 'USDC')}. Son compte a disparu le soir même.\n\n` +
            `Mon adresse Solana : ${A(w, victim)}\n` +
            `Signature de l'envoi de ${amt(v2, 'SOL')} (${fmtDate(pay2.time)}) :\n${pay2.hash} »`,
        },
        {
          id: 'capture', type: 'capture', title: 'Capture de la conversation (message privé)', author: fakeAgent, date: T0 - HOUR,
          body:
            `[Support officiel ✅] Bonjour, votre portefeuille présente une désynchronisation de validateur.\n` +
            `Pour éviter le gel de vos actifs, une vérification est nécessaire :\n` +
            `1) envoyez ${amt(v1, 'SOL')} à l'adresse de vérification (QR code ci-dessous)\n` +
            `2) puis le solde restant, qui vous sera recrédité sous 10 minutes\n` +
            `[QR code — illisible sur la capture]\n` +
            `Ne communiquez avec personne d'autre, le support ne vous contactera jamais publiquement.`,
        },
      ],
      seeds: [victim],
      objectives: [
        {
          id: 'o1', type: 'address', points: 20,
          prompt: 'Quelle est l\'adresse Solana de l\'escroc ?',
          answer: [s1],
          hint: 'La capture ne montre pas l\'adresse : ouvrez la signature citée dans la plainte, ou dépliez les sorties du portefeuille de la victime.',
          explanation: `Les trois envois de la victime (${amt(totalSol, 'SOL')} et ${amt(vUsdcHeld, 'USDC')}) vont vers ${A(w, s1)}. Une adresse Solana est une suite de 32 à 44 caractères en base 58, sans préfixe.`,
        },
        {
          id: 'o2', type: 'address', points: 20,
          prompt: 'Quelle est l\'adresse de dépôt de l\'exchange à mentionner dans la réquisition ?',
          answer: [deposit],
          hint: 'Suivez les sorties de l\'escroc : l\'adresse qui reçoit les fonds puis les reverse aussitôt à un hot wallet étiqueté est l\'adresse de dépôt.',
          explanation: `${A(w, deposit)} est une adresse de dépôt ${destName} : elle reçoit les SOL et les USDC de l'escroc, puis les reverse au hot wallet de la plateforme. C'est elle qui permet à ${destName} de retrouver le compte client. ${procedureFor(dest.entity)}`,
        },
        {
          id: 'o3', type: 'amount', points: 20, unit: 'SOL', tolerance: 0.01,
          prompt: 'Combien de SOL ont été déposés sur cette adresse de dépôt ?',
          answer: solDep,
          hint: 'Ouvrez la transaction de l\'escroc vers l\'adresse de dépôt et lisez le transfert en SOL (pas celui en USDC).',
          explanation: `${amt(solDep, 'SOL')} : les SOL de ${victimName} (${amt(totalSol, 'SOL')}) plus ceux d'une autre victime (${amt(oV, 'SOL')}), moins une fraction laissée sur l'adresse pour les frais. Les USDC (${amt(usdcDep, 'USDC')}) font l'objet d'un transfert distinct vers la même adresse de dépôt.`,
        },
        {
          id: 'o4', type: 'choice', points: 20,
          prompt: 'Dans la plainte, la victime cite une « signature ». De quoi s\'agit-il ?',
          ...choice(r,
            'De l\'identifiant unique de la transaction, l\'équivalent d\'un hash',
            [
              'De la clé privée de la victime, qu\'il faut aussitôt saisir dans l\'outil',
              'D\'une preuve juridique du consentement de la victime au virement',
              'Du code de vérification envoyé par le faux support, sans valeur on-chain',
            ]),
          explanation: 'Sur Solana, une transaction est identifiée par sa première signature (une longue chaîne en base 58). C\'est elle que l\'on recherche dans un explorateur et que l\'on cite dans une réquisition, comme un hash de transaction sur Bitcoin ou Ethereum. Elle prouve que la transaction a été autorisée par la clé de l\'émetteur, mais ne révèle pas cette clé. Une clé privée ou une phrase de récupération ne doit jamais être saisie dans un outil d\'analyse.',
        },
        {
          id: 'o5', type: 'choice', points: 20,
          prompt: 'Les USDC de la victime ont-ils circulé comme ses SOL ?',
          ...choice(r,
            'Non : l\'USDC est un jeton SPL, mais ses frais se paient quand même en SOL',
            [
              'Oui : sur Solana, l\'USDC est converti en SOL dès qu\'il quitte le portefeuille',
              'Non : l\'USDC circule sur Ethereum, la victime a donc utilisé un bridge',
              'Oui : l\'USDC est une monnaie native de Solana, au même titre que le SOL',
            ]),
          explanation: 'Le SOL est l\'actif natif : il paie les frais (quelques fractions de centime) et la réserve des comptes. L\'USDC est un jeton émis par Circle au standard SPL, transféré par le programme de jetons ; chaque portefeuille le détient dans un « compte de jetons » rattaché à son adresse, que les explorateurs affichent sous le portefeuille propriétaire. On suit donc les deux actifs séparément. Comme l\'USDT, l\'USDC a un émetteur capable de geler des jetons encore présents sur une adresse.',
        },
      ],
      truth: {
        path: path.map((t) => t.id),
        addresses: [s1, deposit],
        debrief:
          `1. Sur les instructions du faux support, ${victimName} envoie ${amt(v1, 'SOL')} (« test »), puis ${amt(v2, 'SOL')}, puis ${amt(vUsdcHeld, 'USDC')} à ${A(w, s1)}.\n` +
          `2. Le même jour, une autre victime envoie ${amt(oV, 'SOL')} à cette adresse.\n` +
          `3. Moins de quelques heures plus tard, l'escroc dépose ${amt(solDep, 'SOL')} et ${amt(usdcDep, 'USDC')} sur l'adresse de dépôt ${destName} ${A(w, deposit)}, aussitôt balayée vers le hot wallet.\n\n` +
          `À retenir : sur Solana, une transaction s'appelle par sa signature, les adresses n'ont pas de préfixe, et l'on distingue l'actif natif (SOL) des jetons SPL (USDC, USDT…). Le modèle à comptes ne produit pas de rendu : un petit reste demeure simplement sur l'adresse.\n\n` +
          `Réflexes de l'enquêteur : agir vite (le dépôt suit le vol de quelques heures) ; requérir ${destName} sur l'adresse de dépôt (identité, IP, retraits) avec demande de gel ; signaler le faux compte de support à la plateforme où il a contacté la victime. Un vrai support ne demande jamais d'envoyer des fonds ni la phrase de récupération.`,
      },
      hints: [
        'Dépliez les sorties du portefeuille de la victime : ses trois envois vont vers la même adresse.',
        'Depuis l\'adresse de l\'escroc, une seule destination reçoit les fonds, avant de tout reverser à un hot wallet.',
        'Chaque arête indique l\'actif : SOL natif ou USDC (jeton SPL).',
      ],
    }
  },
}
