import { World, type Tx } from '../engine/world'
import { exchange, DAY, HOUR } from '../engine/patterns'
import { adaEnterprise, adaScript, adaWallet, lockToScript, stakeSiblings } from '../engine/cardano'
import { cardanoStakeAddress, cardanoStakeTail } from '../engine/addressgen'
import { keccak256 } from '../engine/keccak'
import { roundAsset, usd } from '../engine/chains'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, fakeCity, fakeHandle, fakePerson, fmtDate, procedureFor } from './util'

const ada = (v: number) => amt(roundAsset('ADA', v), 'ADA')
const r6 = (v: number) => roundAsset('ADA', v)
const usdFmt = (v: number) => `${Math.round(v).toLocaleString('fr-FR')} $`

const POOLS = [
  { name: 'HelioStake', ticker: 'HELIO' },
  { name: 'AdaRendement Pro', ticker: 'ARPRO' },
  { name: 'Cardano Yield Club', ticker: 'CYCLB' },
  { name: 'StakeNova', ticker: 'NOVA' },
]

export const adaCardanoStaking: ScenarioTemplate = {
  id: 'cardano-staking',
  title: 'Le faux pool de staking',
  tagline: 'Un « rendement garanti » sur Cardano : la clé de staking trahit le portefeuille, le datum désigne le bénéficiaire.',
  description:
    'Un prétendu pool de staking Cardano promet un rendement garanti et demande aux investisseurs d\'envoyer leurs ADA sur des adresses « personnelles ». Toutes ces adresses partagent pourtant la même clé de staking. Regroupez le portefeuille de l\'escroc sans attendre la moindre entrée commune, chiffrez la collecte, lisez le datum d\'un contrat de verrouillage et retrouvez la plateforme où les fonds sont rapatriés.',
  difficulty: 3,
  chains: ['ada'],
  skills: ['utxo', 'lecture_tx', 'cioh', 'exchange_id', 'typologies'],
  estMinutes: 40,
  lessons: ['cardano-eutxo', 'clustering'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const T = w.at(0)
    const P = r.pick(POOLS)
    const plaig = fakePerson(r)
    const g = plaig.g
    const city = fakeCity(r)
    const handle = fakeHandle(r)
    const exKey = r.pick(['binance', 'kraken', 'coinbase', 'okx'] as const)

    const scamE = w.customEntity({ name: `${P.name} (faux pool de staking)`, category: 'scam' })
    const victimE = w.customEntity({ name: plaig.name, category: 'victim' })
    const ex = exchange(w, exKey, 'ada')
    const W = adaWallet(w, { entity: scamE })

    // ── Adresses de l'escroc : adresse « du pool » publiée sur le site + adresses « personnelles » ──
    const site = W.newAddress()
    const nV = r.int(5, 7)
    const k = r.int(0, nV - 1) // la plaignante
    const sharedIdx = new Set(r.shuffle([...Array(nV).keys()].filter((i) => i !== k)).slice(0, 2))
    const victims = Array.from({ length: nV }, (_, i) => {
      const addr = i === k ? w.addr('ada', { entity: victimE }) : w.addr('ada')
      const dep = sharedIdx.has(i) ? site : W.newAddress()
      return { addr, dep }
    })

    // ── Versements des victimes (1 à 3 chacune) ─────────────────────────────
    const pays: { tx: Tx; value: number; victim: number }[] = []
    let t = T
    victims.forEach((v, i) => {
      const n = i === k ? 2 : r.int(1, 3)
      let tv = t
      for (let j = 0; j < n; j++) {
        const value = r.int(i === k ? 30 : 8, i === k ? 90 : 160) * 100
        pays.push({ tx: w.utxoTx({ time: tv, from: [v.addr], to: [{ address: v.dep, value }] }), value, victim: i })
        tv += Math.round(r.float(2, 9) * DAY)
      }
      t += Math.round(r.float(1, 4) * DAY)
    })
    const collected = r6(pays.reduce((s, p) => s + p.value, 0))
    const plaigPays = pays.filter((p) => p.victim === k)
    const plaigTotal = r6(plaigPays.reduce((s, p) => s + p.value, 0))
    const lastPay = Math.max(...pays.map((p) => p.tx.time))

    // ── « Rendements » versés à la plaignante (schéma de Ponzi) ──────────────
    const vk = victims[k]
    const yields: Tx[] = []
    let ty = plaigPays[0].tx.time + Math.round(r.float(6, 8) * DAY)
    for (let j = 0; j < 2; j++) {
      const src = W.addresses.filter((a) => w.unspentValue(a, ty) > 500).sort((a, b) => w.unspentValue(b, ty) - w.unspentValue(a, ty))[0]
      const y = r6(plaigPays[0].value * r.float(0.018, 0.022))
      yields.push(w.utxoTx({ time: ty, from: [src], to: [{ address: vk.addr, value: y }] }))
      ty += 7 * DAY + Math.round(r.float(-6, 6) * HOUR)
    }
    const yieldTotal = r6(yields.reduce((s, x) => s + x.outputs.find((o) => o.address === vk.addr)!.value, 0))

    // ── Regroupement de toutes les adresses du portefeuille ─────────────────
    const consT = Math.max(lastPay, ty) + Math.round(r.float(1, 4) * DAY)
    const holders = [...new Set(stakeSiblings(w, site))].filter((a) => w.unspentValue(a, consT) > 0)
    const main = W.newAddress()
    const consIn = holders.reduce((s, a) => s + w.unspentValue(a, consT), 0)
    const consFee = w.estimateFee('ada', holders.length, 1)
    const cons = w.utxoTx({ time: consT, from: holders, to: [{ address: main, value: r6(consIn - consFee) }], fee: consFee, change: null, spendAll: true })

    // ── Verrouillage sur un contrat avec datum (bénéficiaire = portefeuille de l'escroc) ──
    const script = adaScript(w, { label: 'Contrat de verrouillage à échéance (vesting)', name: 'Vesting à échéance (Plutus V2)' })
    const ben = W.newAddress()
    const lockT = consT + Math.round(r.float(3, 20) * HOUR)
    const lockVal = r6(Math.round(cons.outputs[0].value * r.float(0.3, 0.45) / 1000) * 1000)
    const deadline = lockT + r.int(150, 330) * DAY
    const pkh = keccak256(`pkh:${A(w, ben)}`).slice(0, 56)
    const datum =
      `{"constructor":0,"fields":[{"bytes":"${pkh}"},{"int":${deadline * 1000}}]}\n` +
      `Décodé : beneficiaire = ${A(w, ben)}\n` +
      `         echeance = ${deadline * 1000} (POSIX ms, ${fmtDate(deadline, false)})`
    const lock = lockToScript(w, { from: main, script, value: lockVal, time: lockT, datum })
    const afterLock = lock.outputs.find((o) => o.address !== script)!.address

    // ── Rapatriement vers une plateforme (adresse de dépôt « enterprise ») ───
    const exT = lockT + Math.round(r.float(1, 5) * DAY)
    const exDep = adaEnterprise(w, { entity: ex.entity, label: `${ex.entity.name} — Adresse de dépôt`, tags: ['deposit'] })
    const avail = w.unspentValue(afterLock, exT)
    const deposit = r6(Math.floor((avail * r.float(0.8, 0.9)) / 1000) * 1000)
    const exTx = w.utxoTx({ time: exT, from: [afterLock], to: [{ address: exDep, value: deposit }] })
    const rest = exTx.outputs.find((o) => o.address !== exDep)!
    // Balayage vers le portefeuille chaud, avec les dépôts d'autres clients
    const swT = exT + Math.round(r.float(1, 6) * HOUR)
    const others = Array.from({ length: r.int(2, 5) }, () => {
      const d = adaEnterprise(w, { entity: ex.entity, label: `${ex.entity.name} — Adresse de dépôt`, tags: ['deposit'] })
      w.fund(d, r.int(3, 400) * 50, swT - r.int(600, 20 * 3600))
      return d
    })
    const swFrom = r.shuffle([exDep, ...others])
    const swIn = swFrom.reduce((s, d) => s + w.unspentValue(d, swT), 0)
    const swFee = w.estimateFee('ada', swFrom.length, 1)
    const sweep = w.utxoTx({ time: swT, from: swFrom, to: [{ address: ex.hot, value: r6(swIn - swFee) }], fee: swFee, change: null, spendAll: true, tags: ['sweep'], method: 'consolidation' })

    // ── Bruit : autres utilisateurs de Cardano, activité de la plateforme ───
    ex.noise(14, T - 3 * DAY, exT + 5 * DAY)
    const decoys = [w.addr('ada'), w.addr('ada')]
    for (const d of decoys) {
      for (let j = 0; j < r.int(1, 3); j++) w.fund(d, r.int(5, 120) * 100, T + r.int(-20, 20) * DAY)
      w.utxoTx({ time: exT + r.int(1, 10) * DAY, from: [d], to: [{ address: w.addr('ada'), value: r.int(2, 40) * 100 }] })
    }

    // ── Réponses ─────────────────────────────────────────────────────────────
    const family = stakeSiblings(w, site)
    const nFamily = family.length
    const fakeStakes = Array.from({ length: 3 }, () => cardanoStakeAddress(cardanoStakeTail(r)))
    const forumW = r.shuffle([site, ...victims.filter((v, i) => i !== k && v.dep !== site).map((v) => v.dep)]).slice(0, 4)
    const forum = r.shuffle([...forumW, ...decoys])
    const name = ex.entity.name
    const collectedUsd = usd('ADA', collected)
    const tail = W.tail

    return {
      world: w,
      title: `Faux pool de staking « ${P.name} »`,
      briefing:
        `${plaig.name}, ${g('domicilié', 'domiciliée')} à ${city}, a investi ${ada(plaigTotal)} dans « ${P.name} » (ticker ${P.ticker}), présenté sur les réseaux sociaux comme un pool de staking Cardano offrant un « rendement garanti de 2 % par semaine ». Après deux versements de « rendement », plus rien ; le site a fermé. ${g('Il', 'Elle')} a porté plainte pour escroquerie.\n\n` +
        `Sur Cardano, une adresse de base (addr1q…) combine une partie « paiement » et une partie « staking ». Un même portefeuille réutilise sa clé de staking pour toutes ses adresses : elle se lit à la fin de chaque adresse et regroupe le portefeuille sans qu'aucune transaction commune soit nécessaire. Les adresses « enterprise » (addr1v…) n'ont pas de partie staking ; les adresses de script (addr1w…) verrouillent des fonds avec une donnée (datum) que le contrat lira.\n\n` +
        `Votre mission : établir que toutes les adresses de dépôt appartiennent au même portefeuille, chiffrer la collecte, lire le contrat sur lequel une partie des fonds est verrouillée, puis identifier la plateforme qui a reçu le reste.`,
      evidence: [
        {
          id: 'plainte', type: 'plainte', title: 'Procès-verbal de plainte (extrait)', date: exT + r.int(2, 6) * DAY, author: plaig.name,
          body:
            `« Sur le site, chaque investisseur avait un « espace client » qui affichait une adresse de dépôt personnelle. La mienne : ${A(w, vk.dep)}.\n\n` +
            `J'ai fait deux virements depuis mon portefeuille ${A(w, vk.addr)} : le ${fmtDate(plaigPays[0].tx.time, false)} et le ${fmtDate(plaigPays[1].tx.time, false)}. On m'a versé deux fois des « intérêts », ce qui m'a mis en confiance, puis plus rien. Le support m'a parlé d'un « blocage des fonds dans le contrat de staking jusqu'à l'échéance ». »`,
        },
        {
          id: 'site', type: 'capture', title: `Capture du site de « ${P.name} » (archive)`, date: T - r.int(5, 20) * DAY,
          body:
            `${P.name} — Pool de staking ${P.ticker}\n` +
            `★ Rendement GARANTI : 2 % par semaine, versé chaque lundi\n` +
            `★ Vos ADA sont « stakés » dans notre contrat sécurisé et vous sont restitués à l'échéance\n\n` +
            `Pour participer : connectez-vous à votre espace client et envoyez vos ADA à votre adresse personnelle, ou directement à l'adresse du pool :\n${A(w, site)}`,
        },
        {
          id: 'forum', type: 'forum', title: 'Fil de discussion de victimes sur un forum', date: exT + r.int(1, 4) * DAY, author: `@${handle}`,
          body:
            `On recense les adresses de dépôt de ${P.name} pour les transmettre à la police. Voilà celles que les membres m'ont envoyées :\n` +
            forum.map((a) => `- ${A(w, a)}`).join('\n') +
            `\n\nAttention, certains ont pu se tromper et coller leur propre adresse…`,
        },
        {
          id: 'note', type: 'note', title: 'Note du chef de groupe — Cardano', date: exT + r.int(3, 7) * DAY, author: 'Chef de groupe — Section de recherches',
          body:
            `• Dans l'inspecteur, une adresse de base affiche sa clé de staking (stake1u…) et les autres adresses connues qui la partagent ; le cluster les regroupe.\n` +
            `• Une sortie envoyée à une adresse de script porte un datum : le panneau « Datums (eUTXO) » de la transaction l'affiche, avec sa forme décodée.\n` +
            `• Les plateformes utilisent souvent des adresses « enterprise » (addr1v…) pour les dépôts de leurs clients.\n` +
            `• Rappel : déléguer ses ADA à un vrai pool de staking ne les déplace pas. Ils restent dans le portefeuille de leur propriétaire.`,
        },
      ],
      seeds: [vk.addr],
      objectives: [
        {
          id: 'o1', type: 'choice', points: 8,
          prompt: 'Quelle est la clé de staking de l\'adresse de dépôt « personnelle » communiquée à la plaignante ?',
          ...choice(r, W.stake, fakeStakes),
          hint: 'Sélectionnez l\'adresse de dépôt citée dans la plainte : l\'inspecteur affiche sa clé de staking sous l\'en-tête.',
          explanation: `${W.stake}. La partie staking est encodée à la fin de l'adresse de base (avant les 6 caractères de somme de contrôle) : …${tail.slice(0, 12)}…${tail.slice(-6)}. Toute adresse qui porte ce même segment est dérivée du même portefeuille, à une réserve près (voir la question sur les limites).`,
        },
        {
          id: 'o2', type: 'number', points: 10,
          prompt: 'Combien d\'adresses connues (en comptant celle de la plaignante) partagent cette clé de staking ?',
          answer: nFamily,
          hint: 'Le panneau de la clé de staking indique combien d\'autres adresses connues la partagent ; le cluster les liste.',
          explanation: `${nFamily} adresses : l'adresse « du pool » publiée sur le site, ${victims.filter((v) => v.dep !== site).length} adresses « personnelles » remises aux investisseurs, les adresses de rendu créées par le portefeuille à chaque dépense, l'adresse de regroupement et l'adresse désignée dans le datum. Les « espaces clients » ne faisaient que dériver de nouvelles adresses du même portefeuille : l'escroc n'avait qu'une seule caisse.`,
        },
        {
          id: 'o3', type: 'addresses', points: 10,
          prompt: 'Parmi les adresses recensées sur le forum des victimes, lesquelles appartiennent au portefeuille de l\'escroc ?',
          answer: forumW,
          hint: 'Comparez la fin de chaque adresse (partie staking) ou ouvrez chacune : seule la clé de staking fait foi.',
          explanation: `${forumW.length} adresses portent la clé ${W.stake.slice(0, 16)}… : ${forumW.map((a) => A(w, a).slice(0, 12) + '…').join(', ')}. Les deux autres ont chacune leur propre clé de staking, sans lien avec le portefeuille : ce sont des adresses de membres du forum (erreur de copier-coller). Les intégrer à la procédure aurait mis en cause des tiers.`,
        },
        {
          id: 'o4', type: 'amount', points: 10, unit: 'ADA', tolerance: 0.01,
          prompt: 'Quel montant total (en ADA) les victimes ont-elles versé sur les adresses du portefeuille ?',
          answer: collected,
          hint: 'Additionnez les entrées venues de l\'extérieur sur les adresses de la famille de staking, sans compter les mouvements internes (rendus, regroupement).',
          explanation: `${pays.length} versements de ${nV} victimes, soit ${ada(collected)} (environ ${usdFmt(collectedUsd)}), dont ${ada(plaigTotal)} pour la plaignante. Les mouvements entre adresses de la même clé de staking (rendus, regroupement) ne sont pas de la collecte : les compter reviendrait à gonfler le préjudice.`,
        },
        {
          id: 'o5', type: 'amount', points: 8, unit: 'ADA', tolerance: 0.01,
          prompt: 'Combien d\'ADA ont été reversés à la plaignante sous forme de « rendements » ?',
          answer: yieldTotal,
          hint: 'Regardez les entrées de l\'adresse de la plaignante qui viennent d\'adresses de la même clé de staking que le pool.',
          explanation: `Deux versements, ${yields.map((y) => ada(y.outputs.find((o) => o.address === vk.addr)!.value)).join(' et ')}, soit ${ada(yieldTotal)}, environ 2 % de son premier dépôt par semaine. Ils viennent des adresses de l'escroc, c'est-à-dire de l'argent des autres victimes : la mécanique d'un schéma de Ponzi. Ces sommes viennent en déduction du préjudice de la plaignante.`,
        },
        {
          id: 'o6', type: 'tx', points: 8,
          prompt: 'Quelle transaction verrouille une partie des fonds sur un contrat ?',
          answer: [lock.id],
          hint: 'Après le regroupement de toutes les adresses, une dépense envoie des ADA vers une adresse addr1w… (adresse de script).',
          explanation: `${lock.hash.slice(0, 16)}… envoie ${ada(lockVal)} vers ${A(w, script).slice(0, 16)}…, une adresse de script (contrat « vesting » à échéance), avec un datum sur la sortie ; le reste revient en rendu à une adresse de la même clé de staking. C'est le « contrat de staking » invoqué par le support : un simple coffre à échéance dont le bénéficiaire est l'escroc.`,
        },
        {
          id: 'o7', type: 'amount', points: 6, unit: 'ADA', tolerance: 0.005,
          prompt: 'Combien d\'ADA sont verrouillés sur ce contrat ?',
          answer: lockVal,
          hint: 'C\'est la sortie vers l\'adresse addr1w… de la transaction de verrouillage.',
          explanation: `${ada(lockVal)} reposent sur le contrat jusqu'à l'échéance inscrite dans le datum (${fmtDate(deadline, false)}). Tant qu'ils n'en sortent pas, ils sont identifiés et immobiles : une saisie pourra viser le bénéficiaire au moment du déblocage, et l'échéance donne une date à surveiller.`,
        },
        {
          id: 'o8', type: 'address', points: 10,
          prompt: 'Quelle adresse le datum désigne-t-il comme bénéficiaire ?',
          answer: [ben],
          hint: 'Ouvrez la transaction de verrouillage, panneau « Datums (eUTXO) » : la forme décodée donne le bénéficiaire. Cherchez ensuite cette adresse.',
          explanation: `Le datum contient le hash de la clé de paiement du bénéficiaire et l'échéance (POSIX en millisecondes) ; décodé, il désigne ${A(w, ben)}. Cette adresse n'a encore jamais reçu de transaction, mais elle porte la même clé de staking que les adresses de dépôt : seul le portefeuille de l'escroc pourra récupérer les fonds à l'échéance. Le datum, public et en clair, documente l'intention.`,
        },
        {
          id: 'o9', type: 'entity', points: 8,
          prompt: 'Vers quelle plateforme le reste des fonds est-il rapatrié ?',
          answer: [exKey],
          hint: 'Suivez le rendu de la transaction de verrouillage : il part vers une adresse addr1v… étiquetée.',
          explanation: `${ada(deposit)} partent vers une adresse de dépôt de ${name}, balayée vers son portefeuille chaud. ${procedureFor(ex.entity)} Avec l'adresse de dépôt et le hash, la plateforme identifie le compte, son KYC et ses retraits ; une demande de gel s'impose.`,
        },
        {
          id: 'o10', type: 'address', points: 8,
          prompt: 'Quelle est l\'adresse de dépôt utilisée sur cette plateforme ?',
          answer: [exDep],
          hint: 'Une adresse addr1v… : « enterprise », sans partie staking.',
          explanation: `${A(w, exDep)} : adresse « enterprise » (addr1v…), sans clé de staking, ce qui est courant pour les adresses de dépôt des plateformes. Elle ne se rattache donc au portefeuille de l'escroc que par la transaction qui l'alimente (${exTx.hash.slice(0, 12)}…). ${ada(rest.value)} restent en rendu sur une adresse de la famille de staking.`,
        },
        {
          id: 'o11', type: 'choice', points: 8,
          prompt: 'Que vaut l\'heuristique de la clé de staking partagée ?',
          ...choice(r,
            'Elle est forte (visible sans transaction, propre au portefeuille) mais pas absolue : n\'importe qui peut fabriquer une adresse avec la partie staking d\'un tiers, et les adresses enterprise y échappent',
            [
              'Elle est infaillible : une clé de staking prouve à elle seule l\'identité du propriétaire',
              'Elle est plus faible que les entrées communes, car une clé de staking peut être partagée par tous les délégataires d\'un pool',
              'Elle ne vaut rien sur Cardano, où chaque adresse est indépendante comme sur Bitcoin',
            ]),
          hint: 'Qui choisit la partie staking d\'une adresse ? Et que contient une adresse addr1v… ?',
          explanation: `Un portefeuille met sa propre clé de staking dans toutes ses adresses de base : le regroupement est immédiat, avant même la première dépense, et plus robuste que les entrées communes (pas d'exception de type CoinJoin). Mais la partie staking n'est qu'une donnée de l'adresse : on peut construire une adresse dont la partie paiement est à soi et la partie staking à quelqu'un d'autre (pour lui faire toucher les récompenses), et les adresses enterprise n'ont pas de partie staking. Déléguer à un pool ne change pas la clé de staking : tous les délégataires d'un pool gardent des clés distinctes. On corrobore donc par les flux (regroupement, rendus), comme ici.`,
        },
        {
          id: 'o12', type: 'choice', points: 6,
          prompt: 'Quel élément technique aurait dû alerter les investisseurs ?',
          ...choice(r,
            'Une vraie délégation Cardano ne déplace pas les fonds : on délègue sa clé de staking et les ADA restent dans son portefeuille',
            [
              'Un vrai pool de staking exige toujours un dépôt sur une adresse de script',
              'Un vrai pool verse ses récompenses depuis une adresse enterprise',
              'Un rendement de 2 % par semaine est normal sur Cardano, seul le site était suspect',
            ]),
          hint: 'Relisez la note du chef de groupe.',
          explanation: `Sur Cardano, le staking est « liquide » : le détenteur signe un certificat de délégation vers un pool, ses ADA ne bougent pas et restent dépensables, et les récompenses (de l'ordre de quelques pour cent par an, non garanties) arrivent sur son adresse de récompense. Demander d'envoyer ses ADA à quelqu'un, avec un rendement garanti de 2 % par semaine (plus de 100 % par an), signe l'escroquerie.`,
        },
      ],
      truth: {
        path: [...pays.map((p) => p.tx.id), ...yields.map((y) => y.id), cons.id, lock.id, exTx.id, sweep.id],
        addresses: [...new Set([vk.dep, site, ...victims.map((v) => v.dep)]), main, ben, afterLock, rest.address, exDep, script],
        debrief:
          `1. ${P.name} remet à chaque investisseur une adresse « personnelle » : ce sont des adresses de base du même portefeuille, toutes porteuses de la clé de staking ${W.stake} (${nFamily} adresses connues au total).\n` +
          `2. ${nV} victimes versent ${ada(collected)} en ${pays.length} virements ; la plaignante reçoit ${ada(yieldTotal)} de « rendements » prélevés sur les dépôts des autres (Ponzi).\n` +
          `3. ${cons.hash.slice(0, 12)}… regroupe toutes les adresses sur ${A(w, main).slice(0, 16)}… ; ${lock.hash.slice(0, 12)}… verrouille ${ada(lockVal)} sur un contrat de vesting dont le datum désigne ${A(w, ben).slice(0, 16)}… (même clé de staking), échéance au ${fmtDate(deadline, false)}.\n` +
          `4. ${ada(deposit)} sont rapatriés chez ${name} sur l'adresse enterprise ${A(w, exDep).slice(0, 16)}… ; ${ada(rest.value)} restent dans le portefeuille.\n\n` +
          `À retenir : sur Cardano, la clé de staking regroupe un portefeuille dès sa première adresse, sans attendre une dépense commune ; c'est un indice fort, à corroborer, car la partie staking d'une adresse peut être empruntée. Les datums sont publics et lisibles : ils disent qui pourra récupérer des fonds verrouillés, et quand. Enfin, une vraie délégation ne déplace jamais les fonds : toute offre de « staking » qui exige un envoi d'ADA est suspecte.`,
      },
      hints: [
        'Ouvrez l\'adresse de dépôt de la plaignante : sa clé de staking et les adresses qui la partagent s\'affichent sous l\'en-tête.',
        'Le cluster d\'une adresse de base inclut toutes les adresses de la même clé de staking : partez de là pour chiffrer la collecte.',
        'Ne comptez que les entrées venues d\'adresses extérieures au portefeuille : les rendus et le regroupement sont internes.',
        'La transaction qui envoie des ADA vers une adresse addr1w… porte un datum : sa forme décodée désigne une adresse à rechercher.',
        'Les adresses addr1v… n\'ont pas de clé de staking : c\'est souvent le signe d\'une adresse de plateforme.',
      ],
    }
  },
}
