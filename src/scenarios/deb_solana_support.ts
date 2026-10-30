import { World, type Tx } from '../engine/world'
import { exchange, HOUR, DAY } from '../engine/patterns'
import { roundAsset } from '../engine/chains'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, fakeCity, fakeHandle, fakePerson, fmtDate, procedureFor } from './util'

// Faux support technique de portefeuille : la victime « vérifie » son
// portefeuille en envoyant des SOL, puis ses USDC (jeton SPL), à l'escroc, qui
// dépose aussitôt sur un exchange. Avant de déposer, il alimente en SOL un
// nouveau portefeuille (frais de la prochaine opération), qui reçoit quelques
// jours plus tard les fonds d'une nouvelle victime.

const sol = (v: number) => roundAsset('SOL', v)
const usdc = (v: number) => roundAsset('USDC', v)

export const debSolanaSupport: ScenarioTemplate = {
  id: 'deb-solana-support',
  title: 'Solana : le faux support technique',
  tagline: 'Signatures, SOL natif et jetons SPL : premier traçage sur Solana.',
  description:
    'Un faux « support technique » a convaincu une victime d\'envoyer des SOL pour « vérifier » son portefeuille, puis ses USDC. Retrouvez l\'adresse de l\'escroc et une autre victime du même jour, suivez les fonds jusqu\'à l\'adresse de dépôt d\'un exchange, repérez le portefeuille que l\'escroc prépare pour la suite, et découvrez comment Solana présente ses comptes, ses transactions (signatures) et ses jetons.',
  difficulty: 1,
  chains: ['sol'],
  skills: ['lecture_tx', 'evm', 'tokens', 'exchange_id', 'requisition'],
  estMinutes: 30,
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
    const s2 = w.addr('sol', { entity: scamE })
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
    const otherTx = w.transfer({ time: oT, from: other, to: s1, value: oV, asset: 'SOL' })
    const totalIn = sol(v1 + v2 + oV)

    // ── Alimentation d'un nouveau portefeuille (frais de la suite) ──────────
    const gasV = sol(r.float(0.25, 0.6))
    const gasTx = w.transfer({ time: pay3.time + r.int(5, 25) * 60, from: s1, to: s2, value: gasV, asset: 'SOL' })
    path.push(gasTx)

    // ── Dépôt sur l'exchange (même adresse pour SOL et USDC) ────────────────
    const depT = gasTx.time + Math.round(r.float(0.5, 3) * HOUR)
    const solDep = sol(w.balanceOf(s1, 'SOL') - r.float(0.003, 0.02))
    const d1 = dest.receive(s1, solDep, depT, { asset: 'SOL' })
    const deposit = d1.deposit
    const usdcDep = usdc(w.balanceOf(s1, 'USDC'))
    const d2 = dest.receive(s1, usdcDep, depT + r.int(2, 15) * 60, { asset: 'USDC', depositAddr: deposit })
    path.push(d1.tx, ...(d1.sweep ? [d1.sweep] : []), d2.tx, ...(d2.sweep ? [d2.sweep] : []))
    const delayMin = Math.round((d1.tx.time - pay1.time) / 60)

    // ── Quelques jours plus tard : une nouvelle victime paie le nouveau portefeuille
    const next = w.addr('sol')
    const nV = sol(r.float(2, 12))
    const nT = depT + Math.round(r.float(50, 100) * HOUR)
    w.fundAccount(next, sol(nV + r.float(0.05, 0.5)), 'SOL', nT - Math.round(r.float(3, 40) * DAY))
    const nextTx = w.transfer({ time: nT, from: next, to: s2, value: nV, asset: 'SOL' })

    // ── Bruit de fond ────────────────────────────────────────────────────────
    dest.noise(14, w.at(-3 * 24), w.at(6 * 24), 'SOL')
    dest.noise(8, w.at(-3 * 24), w.at(6 * 24), 'USDC')
    fund.noise(8, w.at(-5 * 24), w.at(4 * 24), 'SOL')

    const destName = dest.entity.name
    const totalSol = sol(v1 + v2)
    const nextP = fakePerson(r)

    return {
      world: w,
      title: `Faux support technique — ${city}`,
      briefing:
        `${victimName}, demeurant à ${city}, dépose plainte pour escroquerie. Après avoir signalé un bug de son application de portefeuille sur un forum, ${g('il', 'elle')} a été ${g('contacté', 'contactée')} en message privé par un « agent du support ». Celui-ci lui a expliqué que son portefeuille devait être « vérifié » : un petit envoi test de SOL, puis le reste « pour synchronisation », enfin ses USDC. Rien n'est revenu.\n\n` +
        `Solana fonctionne par comptes, comme Ethereum : pas d'adresse de rendu, un solde par actif. Son actif natif est le SOL ; les autres jetons (dont l'USDC) suivent le standard SPL. Les explorateurs appellent « signature » l'identifiant d'une transaction.\n\n` +
        `Votre mission : identifier l'adresse de l'escroc et les autres personnes qui l'ont payée, suivre toutes ses sorties jusqu'à l'exchange, relever l'adresse de dépôt à réquisitionner et repérer ce que l'escroc prépare pour la suite.`,
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
        {
          id: 'forum', type: 'forum', title: 'Fil du forum d\'entraide de l\'application (capture)', date: nT + DAY,
          body:
            `[${fmtDate(T0 - 3 * HOUR)}] ${victimName.split(' ')[0]} : Bonjour, mon solde ne s'affiche plus depuis la mise à jour, quelqu'un a une solution ?\n` +
            `[${fmtDate(T0 - 2 * HOUR)}] Modérateur : Attention, de faux agents contactent les membres en privé. Le support ne demande JAMAIS d'envoyer des fonds.\n` +
            `[${fmtDate(nT + 2 * HOUR)}] ${nextP.name.split(' ')[0]} : Même chose pour moi, un « agent » m'a fait faire une « vérification » aujourd'hui, j'ai tout perdu…`,
        },
      ],
      seeds: [victim],
      objectives: [
        {
          id: 'o1', type: 'address', points: 10,
          prompt: 'Quelle est l\'adresse Solana de l\'escroc ?',
          answer: [s1],
          hint: 'La capture ne montre pas l\'adresse : ouvrez la signature citée dans la plainte, ou dépliez les sorties du portefeuille de la victime.',
          explanation: `Les trois envois de la victime (${amt(totalSol, 'SOL')} et ${amt(vUsdcHeld, 'USDC')}) vont vers ${A(w, s1)}. Une adresse Solana est une suite de 32 à 44 caractères en base 58, sans préfixe.`,
        },
        {
          id: 'o6', type: 'address', points: 9,
          prompt: 'Le même jour, une autre personne a envoyé des SOL à l\'escroc. Quelle est son adresse ?',
          answer: [other],
          hint: 'Listez les transferts entrants de l\'adresse de l\'escroc : écartez ceux de la victime, il en reste un.',
          explanation: `${A(w, other)} envoie ${amt(oV, 'SOL')} le ${fmtDate(otherTx.time)}, quelques heures avant ${victimName}. C'est très probablement une autre victime du même faux support : son adresse permet de remonter à la plateforme où elle a acheté ses SOL, de l'identifier et de recueillir sa plainte. Elle n'est pas « suspecte » pour autant : on parle de victime apparente tant que rien ne prouve le contraire.`,
        },
        {
          id: 'o9', type: 'amount', points: 9, unit: 'SOL', tolerance: 0.001,
          prompt: 'Combien de SOL l\'adresse de l\'escroc a-t-elle reçus au total ?',
          answer: totalIn,
          hint: 'Additionnez tous les transferts entrants en SOL (pas les USDC), ou lisez le total reçu dans le résumé de l\'adresse.',
          explanation: `${amt(totalIn, 'SOL')} : ${amt(v1, 'SOL')} + ${amt(v2, 'SOL')} de ${victimName}, et ${amt(oV, 'SOL')} de l'autre victime. Les USDC se comptent à part (actif distinct). Ce total sert à vérifier la cohérence des sorties : ce qui entre doit se retrouver dans ce qui sort, plus un petit reste pour les frais.`,
        },
        {
          id: 'o4', type: 'choice', points: 8,
          prompt: 'Dans la plainte, la victime cite une « signature ». De quoi s\'agit-il ?',
          hint: 'Collez la chaîne citée dans la recherche : sur quoi tombez-vous ?',
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
          id: 'o5', type: 'choice', points: 8,
          prompt: 'Les USDC de la victime ont-ils circulé comme ses SOL ?',
          hint: 'Comparez l\'actif indiqué sur les arêtes et la monnaie dans laquelle sont payés les frais.',
          ...choice(r,
            'Non : l\'USDC est un jeton SPL, mais ses frais se paient quand même en SOL',
            [
              'Oui : sur Solana, l\'USDC est converti en SOL dès qu\'il quitte le portefeuille',
              'Non : l\'USDC circule sur Ethereum, la victime a donc utilisé un bridge',
              'Oui : l\'USDC est une monnaie native de Solana, au même titre que le SOL',
            ]),
          explanation: 'Le SOL est l\'actif natif : il paie les frais (quelques fractions de centime) et la réserve des comptes. L\'USDC est un jeton émis par Circle au standard SPL, transféré par le programme de jetons ; chaque portefeuille le détient dans un « compte de jetons » rattaché à son adresse, que les explorateurs affichent sous le portefeuille propriétaire. On suit donc les deux actifs séparément. Comme l\'USDT, l\'USDC a un émetteur capable de geler des jetons encore présents sur une adresse.',
        },
        {
          id: 'o10', type: 'address', points: 10,
          prompt: 'Avant de déposer les fonds, l\'escroc envoie une petite somme de SOL vers un autre portefeuille non étiqueté. Lequel ?',
          answer: [s2],
          hint: 'Parmi les sorties de l\'adresse de l\'escroc, une seule ne va pas vers l\'adresse de dépôt : un petit montant de SOL, quelques minutes après le dernier envoi de la victime.',
          explanation: `Le ${fmtDate(gasTx.time)}, ${amt(gasV, 'SOL')} partent vers ${A(w, s2)}. Ce petit montant ne sert pas à encaisser : il paie les frais et la réserve d'un nouveau portefeuille. ${A(w, s2)} reçoit d'ailleurs ${amt(nV, 'SOL')} d'une autre personne quelques jours plus tard (${fmtDate(nextTx.time, false)}), ce qui concorde avec le message posté sur le forum : l'escroc a recommencé. Suivre l'alimentation en frais (le « carburant ») est un excellent moyen de relier les portefeuilles successifs d'un même auteur.`,
        },
        {
          id: 'o2', type: 'address', points: 9,
          prompt: 'Quelle est l\'adresse de dépôt de l\'exchange à mentionner dans la réquisition ?',
          answer: [deposit],
          hint: 'Suivez les gros montants qui sortent de l\'adresse de l\'escroc : l\'adresse qui les reçoit puis les reverse aussitôt à un hot wallet étiqueté est l\'adresse de dépôt.',
          explanation: `${A(w, deposit)} est une adresse de dépôt ${destName} : elle reçoit les SOL et les USDC de l'escroc, puis les reverse au hot wallet de la plateforme. C'est elle qui permet à ${destName} de retrouver le compte client.`,
        },
        {
          id: 'o7', type: 'entity', points: 9,
          prompt: 'À quelle plateforme appartient cette adresse de dépôt ?',
          answer: [destKey],
          hint: 'Regardez l\'étiquette de l\'adresse vers laquelle l\'adresse de dépôt reverse les fonds.',
          explanation: `L'adresse de dépôt reverse tout au hot wallet étiqueté de ${destName} : c'est un compte client de cette plateforme. ${procedureFor(dest.entity)}`,
        },
        {
          id: 'o3', type: 'amount', points: 9, unit: 'SOL', tolerance: 0.001,
          prompt: 'Combien de SOL ont été déposés sur cette adresse de dépôt ?',
          answer: solDep,
          hint: 'Ouvrez la transaction de l\'escroc vers l\'adresse de dépôt et lisez le transfert en SOL (pas celui en USDC).',
          explanation: `${amt(solDep, 'SOL')} : les SOL reçus (${amt(totalIn, 'SOL')}), moins ${amt(gasV, 'SOL')} envoyés au nouveau portefeuille et une fraction laissée sur l'adresse pour les frais. Les USDC (${amt(usdcDep, 'USDC')}) font l'objet d'un transfert distinct vers la même adresse de dépôt.`,
        },
        {
          id: 'o8', type: 'number', points: 8, tolerance: 3, unit: 'minutes',
          prompt: 'Combien de minutes se sont écoulées entre l\'envoi « test » de la victime et le premier dépôt de l\'escroc sur l\'exchange ?',
          answer: delayMin,
          hint: 'Comparez l\'horodatage du premier envoi de la victime (le plus petit) et celui du transfert de SOL vers l\'adresse de dépôt.',
          explanation: `Environ ${delayMin} minutes (${fmtDate(pay1.time)} → ${fmtDate(d1.tx.time)}). Le faux support encaisse presque immédiatement : quand la victime comprend, les fonds sont déjà sur un compte d'exchange. Seule une demande de gel adressée sans délai à la plateforme peut encore préserver ce qui n'a pas été retiré.`,
        },
        {
          id: 'o11', type: 'choice', points: 8,
          prompt: 'Que faire du nouveau portefeuille alimenté par l\'escroc ?',
          hint: 'Ce portefeuille a-t-il reçu quelque chose après avoir été alimenté ?',
          ...choice(r,
            'Le placer sous surveillance, le citer dans la réquisition et rechercher qui l\'a payé ensuite : c\'est la suite de l\'activité',
            [
              'Demander aux validateurs de Solana de bloquer ce portefeuille',
              'L\'ignorer : il n\'a reçu qu\'une somme négligeable destinée aux frais',
              'Le signaler comme adresse de la victime, puisqu\'il a reçu des fonds issus de son portefeuille',
            ]),
          explanation: `${A(w, s2)} est contrôlé par le même auteur (il a été alimenté par l'escroc) et il a déjà reçu les fonds d'une autre personne. On pose une alerte sur l'adresse, on la mentionne dans la réquisition à ${destName} (l'escroc y a peut-être aussi un compte), et on remonte le payeur suivant (${A(w, next)}) pour identifier et contacter cette nouvelle victime. Aucun validateur ne bloque un portefeuille, et un faible montant n'en fait pas une piste négligeable : c'est le lien entre deux opérations.`,
        },
      ],
      truth: {
        path: path.map((t) => t.id),
        addresses: [s1, deposit, s2],
        debrief:
          `1. Sur les instructions du faux support, ${victimName} envoie ${amt(v1, 'SOL')} (« test »), puis ${amt(v2, 'SOL')}, puis ${amt(vUsdcHeld, 'USDC')} à ${A(w, s1)}.\n` +
          `2. Le même jour, une autre victime (${A(w, other)}) envoie ${amt(oV, 'SOL')} à cette adresse : ${amt(totalIn, 'SOL')} reçus au total.\n` +
          `3. Quelques minutes après le dernier envoi, l'escroc alimente un nouveau portefeuille ${A(w, s2)} avec ${amt(gasV, 'SOL')} (frais de la suite).\n` +
          `4. Environ ${delayMin} minutes après l'envoi « test », l'escroc dépose ${amt(solDep, 'SOL')} et ${amt(usdcDep, 'USDC')} sur l'adresse de dépôt ${destName} ${A(w, deposit)}, aussitôt balayée vers le hot wallet.\n` +
          `5. Quelques jours plus tard, le nouveau portefeuille reçoit ${amt(nV, 'SOL')} d'une nouvelle victime, qui témoigne sur le même forum.\n\n` +
          `À retenir : sur Solana, une transaction s'appelle par sa signature, les adresses n'ont pas de préfixe, et l'on distingue l'actif natif (SOL) des jetons SPL (USDC, USDT…). Le modèle à comptes ne produit pas de rendu : un petit reste demeure simplement sur l'adresse. Les petits envois de SOL vers des portefeuilles neufs relient les opérations successives d'un même auteur.\n\n` +
          `Réflexes de l'enquêteur : agir vite (le dépôt suit le vol de quelques minutes à quelques heures) ; requérir ${destName} sur l'adresse de dépôt (identité, IP, retraits) avec demande de gel ; surveiller le nouveau portefeuille et identifier les autres victimes ; signaler le faux compte de support à la plateforme où il a contacté la victime. Un vrai support ne demande jamais d'envoyer des fonds ni la phrase de récupération.`,
      },
      hints: [
        'Dépliez les sorties du portefeuille de la victime : ses trois envois vont vers la même adresse.',
        'Les entrées de l\'adresse de l\'escroc ne viennent pas toutes de la victime : regardez qui d\'autre l\'a payée.',
        'Depuis l\'adresse de l\'escroc, deux destinations : une petite somme vers un portefeuille neuf, et les gros montants vers une adresse qui reverse tout à un hot wallet.',
        'Chaque arête indique l\'actif : SOL natif ou USDC (jeton SPL).',
      ],
    }
  },
}
