// Moteur « smart contracts, DeFi et Bitcoin moderne » : vrais sélecteurs et
// sujets d'événements, décodage, traçage à travers agrégateur / WETH / prêt /
// pool, contrats de dépôt, témoins, inscriptions, clé de staking Cardano.
// Lancer : npx tsx scripts/check-contrats.ts
import { World } from '../src/engine/world'
import { dex } from '../src/engine/patterns'
import { addLiquidity, aggregator, approve, failedTx, forwarderExchange, lending, removeLiquidity, splitPayment, transferFrom, weth } from '../src/engine/defi'
import { callOf, calldata, internalCalls, txLogs } from '../src/engine/evm'
import { keccak256, selectorOf, topicOf } from '../src/engine/keccak'
import { traceFunds } from '../src/engine/tracing'
import { inscribe, marketplace, runeTransfer } from '../src/engine/ordinals'
import { txSize, unlockOf } from '../src/engine/script'
import { adaWallet } from '../src/engine/cardano'
import { changeAnalysis, clusterOf } from '../src/engine/analysis'
import { depositAnalysis } from '../src/engine/heuristics'
import { decodeCalldata } from '../src/lib/sandbox'

let failed = 0
const ok = (cond: boolean, label: string) => {
  if (!cond) failed++
  console.log(`${cond ? 'ok   ' : 'ÉCHEC'} ${label}`)
}

// Keccak et ABI
ok(keccak256('') === 'c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470', 'keccak256 de la chaîne vide')
ok(selectorOf('transfer(address,uint256)') === '0xa9059cbb' && selectorOf('approve(address,uint256)') === '0x095ea7b3', 'sélecteurs transfer / approve')
ok(topicOf('Transfer(address,address,uint256)') === '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef', 'topic0 de Transfer')

const w = new World(7)
const u = dex(w, 'uniswap', 'eth')
const thief = w.addr('eth')
const victim = w.addr('eth')
w.fundAccount(victim, 20000, 'USDC', w.at(-48))
const ap = approve(w, { owner: victim, spender: thief, asset: 'USDC', time: w.at(-1) })
const tf = transferFrom(w, { spender: thief, owner: victim, to: thief, value: 20000, asset: 'USDC', time: w.at(0) })
ok(tf.signer === thief && txLogs(w, tf)[0]?.name === 'Transfer', 'transferFrom signé par l\'attaquant, événement Transfer')
const dec = decodeCalldata(calldata(w, 'eth', callOf(w, ap).call!))
ok(dec.signature === 'approve(address,uint256)' && dec.params[0].value === w.get(thief).addr.toLowerCase(), 'décodage de l\'approve (spender)')
const sw = aggregator(w, 'oneinch', 'eth', u).swap({ trader: thief, route: ['USDC', 'ETH', 'DAI'], amountIn: 8000, time: w.at(1) })
ok(txLogs(w, sw.tx).filter((l) => l.name === 'Swap').length === 2, 'agrégateur : deux événements Swap')
w.fundAccount(thief, 10, 'ETH', w.at(1.5))
weth(w).wrap(thief, 2, w.at(2))
const ln = lending(w)
const sup = ln.supply({ from: thief, value: 5, time: w.at(3) })
const bor = ln.borrow({ from: thief, value: 7000, asset: 'USDT', time: w.at(4) })
ok(txLogs(w, sup).some((l) => l.name === 'Supply') && txLogs(w, bor).some((l) => l.name === 'Borrow'), 'prêt : événements Supply et Borrow')
const lp = addLiquidity(w, u, { from: thief, assetA: 'ETH', amountA: 1, assetB: 'USDC', time: w.at(5) })
const clean = w.addr('eth')
w.transfer({ time: w.at(6), from: thief, to: clean, value: lp.lp, asset: 'LP' })
const rm = removeLiquidity(w, u, { from: clean, assetA: 'ETH', assetB: 'USDC', lp: lp.lp, time: w.at(7) })
ok(internalCalls(w, rm.tx).length === 1, 'retrait de liquidité : ETH versé en transaction interne')
const fx = forwarderExchange(w, 'binance')
const dep = fx.receive(thief, 6000, w.at(8), { asset: 'USDT' })
fx.receive(clean, 0.5, w.at(9))
fx.noise(6, w.at(0), w.at(20), 'USDT')
ok(dep.flush?.creates?.[0] === dep.deposit, 'premier reversement : déploiement CREATE2 du contrat de dépôt')
ok(depositAnalysis(w, dep.deposit).role === 'deposit', 'heuristique : contrat de dépôt reconnu')
const splitter = w.addr('eth', { contract: { name: 'Splitter', type: 'splitter' } })
const sp = splitPayment(w, { from: thief, splitter, value: 1, time: w.at(10), shares: [{ to: w.addr('eth'), pct: 0.7 }, { to: w.addr('eth'), pct: 0.3 }] })
ok(internalCalls(w, sp).length === 2, 'répartiteur : deux transactions internes')
const fail = failedTx(w, { signer: thief, to: splitter, value: 3, time: w.at(11), reason: 'Ownable: caller is not the owner' })
ok(fail.status === 'reverted' && fail.transfers.length === 0 && txLogs(w, fail).length === 0, 'transaction échouée : aucun transfert ni événement')
const tr = traceFunds(w, { txId: tf.id, address: thief, asset: 'USDC' }, { method: 'haircut' })
ok(tr.endpoints.some((e) => e.entity.id === 'binance'), 'traçage : USDC → pool LP → retrait ailleurs → contrat de dépôt Binance')

// Garantie marquée → emprunt rattaché
const w2 = new World(9)
const h = w2.addr('eth')
const src = w2.addr('eth')
w2.fundAccount(src, 30, 'ETH', w2.at(-5))
const stolen = w2.transfer({ time: w2.at(0), from: src, to: h, value: 30, asset: 'ETH' })
const l2 = lending(w2)
l2.supply({ from: h, value: 30, time: w2.at(1) })
l2.borrow({ from: h, value: 50000, asset: 'USDC', time: w2.at(2) })
const tr2 = traceFunds(w2, { txId: stolen.id, address: h }, { method: 'fifo' })
ok(tr2.collateral.length === 1 && Math.abs(tr2.collateral[0].usd - 50000) < 1, 'traçage : emprunt rattaché à la garantie marquée')

// Bitcoin moderne
const b = new World(11)
const owner = b.addr('btc', { kind: 'p2tr' })
b.fund(owner, 0.01, b.at(-10))
const ins = inscribe(b, { owner, content: 'Hello', contentType: 'text/plain', time: b.at(0), size: 4200 })
ok(unlockOf(b, ins.reveal, 0).type.includes('script') && (txSize(b, ins.reveal)?.witnessBytes ?? 0) > 4000, 'révélation d\'inscription : dépense Taproot par script, gros témoin')
const buyer = b.addr('btc', { kind: 'p2wpkh' })
const sale = marketplace(b).sell({ ins, seller: ins.holder, buyer, price: 0.05, time: b.at(3) })
ok(sale.tx.ord?.carrier === 1 && sale.tx.outputs[1].address === sale.receive, 'vente PSBT : inscription en sortie 1')
const rt = runeTransfer(b, { from: buyer, to: b.addr('btc', { kind: 'p2tr' }), rune: 'TEST•RUNE', amount: 1000, time: b.at(4) })
const rc = changeAnalysis(b, rt).find((c) => c.n === rt.ord!.carrier)
ok(!!rt.opReturn && (!rc || rc.prob < 0.2), 'runes : OP_RETURN, sortie porteuse écartée du rendu')
const ms = b.addr('btc', { kind: 'p2wsh', multisig: { m: 2, n: 3 } })
b.fund(ms, 1, b.at(-5))
const msTx = b.utxoTx({ time: b.at(5), from: [ms], to: [{ address: b.addr('btc', { kind: 'p2tr' }), value: 0.6 }] })
msTx.multisigSigners = { 0: [1, 3] }
ok(unlockOf(b, msTx, 0).multisig?.signed.join(',') === '1,3', 'multisig 2-sur-3 : clés n° 1 et 3 lues dans le témoin')

// Cardano
const c = new World(5)
const wal = adaWallet(c)
const a1 = wal.newAddress()
const a2 = wal.newAddress()
c.fund(a1, 1200, c.at(-5))
const ch = c.utxoTx({ time: c.at(0), from: [a1], to: [{ address: c.addr('ada'), value: 300 }] })
const change = ch.outputs.find((o) => c.get(o.address).wallet === wal.wallet)
ok(c.get(a1).addr.length === 103 && c.get(a1).addr.slice(-45, -6) === c.get(a2).addr.slice(-45, -6), 'Cardano : partie staking commune en fin d\'adresse')
ok(!!change && c.get(change.address).stake === wal.stake && clusterOf(c, a2).includes(a1), 'Cardano : rendu sur la même clé de staking, adresses regroupées')

console.log(failed ? `\n${failed} échec(s)` : '\nTout est conforme.')
process.exit(failed ? 1 : 0)
