import { useEffect, useState } from 'react'
import { Icon } from '../../ui/common'
import { Rng } from '../../engine/rng'
import { CHAINS } from '../../engine/chains'
import { C, Explain, Instr, Seg, base58check, hexToBytes, sha256Bytes, toHex } from './kit'

type Net = 'btc' | 'eth'

function genPriv(seed: number): string {
  const r = new Rng(seed * 7919 + 13)
  let s = ''
  for (let i = 0; i < 64; i++) s += '0123456789abcdef'[r.int(0, 15)]
  return s
}

interface Derived {
  pub: string
  fp: string
  address: string
  checksum: string
}

async function derive(priv: string, net: Net): Promise<Derived> {
  // Simplification pédagogique : la vraie clé publique est k·G sur la courbe secp256k1.
  const pubX = toHex(await sha256Bytes(new TextEncoder().encode('secp256k1-sim:' + priv)))
  const pub = (parseInt(priv.slice(-1), 16) % 2 === 0 ? '02' : '03') + pubX
  const h = await sha256Bytes(hexToBytes(pub))
  if (net === 'btc') {
    // Réel : RIPEMD-160(SHA-256(pub)) ; ici les 20 premiers octets de SHA-256.
    const fp = h.slice(0, 20)
    const { address, checksum } = await base58check(0x00, fp)
    return { pub, fp: toHex(fp), address, checksum }
  }
  // Réel : Keccak-256(pub non compressée), 20 derniers octets.
  const fp = h.slice(12)
  return { pub, fp: toHex(fp), address: '0x' + toHex(fp), checksum: '' }
}

const STAGES = [
  { id: 0, icon: 'KeyRound', title: 'Clé privée', color: C.rose },
  { id: 1, icon: 'Key', title: 'Clé publique', color: C.violet },
  { id: 2, icon: 'Fingerprint', title: 'Empreinte', color: C.amber },
  { id: 3, icon: 'Wallet', title: 'Adresse', color: C.green },
]

const ARROWS: Record<Net, string[]> = {
  btc: ['Multiplication sur courbe elliptique (secp256k1)', 'SHA-256 puis RIPEMD-160', 'Version 0x00 + Base58Check'],
  eth: ['Multiplication sur courbe elliptique (secp256k1)', 'Keccak-256, 20 derniers octets', 'Préfixe 0x (+ casse EIP-55)'],
}

const DETAILS: Record<number, string> = {
  0: "Un nombre aléatoire de 256 bits (64 caractères hexadécimaux). C'est LE secret : quiconque le détient peut dépenser les fonds. Le portefeuille la dérive en général d'une phrase de récupération de 12 ou 24 mots — c'est elle qu'il faut chercher en perquisition (papier, coffre, gestionnaire de mots de passe).",
  1: "Obtenue par multiplication de la clé privée sur une courbe elliptique. Elle peut être publiée sans risque : elle sert à vérifier les signatures. Sur Bitcoin, elle apparaît dans la transaction au moment où l'adresse dépense.",
  2: "Un hachage de la clé publique, plus court (20 octets). Il ajoute une seconde couche à sens unique et raccourcit l'adresse.",
  3: "L'empreinte encodée de façon lisible, avec un préfixe qui identifie le réseau et le type, et une somme de contrôle qui détecte les fautes de frappe. C'est ce que la victime a copié-collé et ce que vous rechercherez dans l'explorateur.",
}

export default function KeysDerivation() {
  const [seed, setSeed] = useState(1)
  const [priv, setPriv] = useState(() => genPriv(1))
  const [net, setNet] = useState<Net>('btc')
  const [d, setD] = useState<Derived | null>(null)
  const [stage, setStage] = useState(0)
  const [reverse, setReverse] = useState<number | null>(null)
  const [prevAddr, setPrevAddr] = useState<string | null>(null)

  useEffect(() => {
    let ok = true
    derive(priv, net).then((r) => {
      if (ok) setD(r)
    })
    return () => {
      ok = false
    }
  }, [priv, net])

  function newKey() {
    setPrevAddr(d?.address ?? null)
    const s = seed + 1
    setSeed(s)
    setPriv(genPriv(s))
  }
  function flipOne() {
    setPrevAddr(d?.address ?? null)
    const last = parseInt(priv.slice(-1), 16)
    setPriv(priv.slice(0, -1) + ((last + 1) % 16).toString(16))
  }

  const values = [priv, d?.pub ?? '…', d?.fp ?? '…', d?.address ?? '…']
  const netCol = CHAINS[net].color

  return (
    <div className="space-y-3">
      <Instr>Générez une clé ou modifiez un seul caractère de la clé privée : toute la chaîne de dérivation se recalcule. Cliquez sur une étape pour l'expliquer, ou sur une flèche « ← » pour tenter de remonter.</Instr>
      <div className="flex flex-wrap items-center gap-2">
        <Seg<Net>
          value={net}
          onChange={(n) => {
            setPrevAddr(null)
            setNet(n)
          }}
          options={[
            { id: 'btc', label: 'Bitcoin' },
            { id: 'eth', label: 'Ethereum' },
          ]}
        />
        <div className="flex-1" />
        <button className="btn-outline !py-1 text-xs" onClick={flipOne}>
          <Icon name="PenLine" size={13} /> Modifier 1 caractère
        </button>
        <button className="btn-primary !py-1 text-xs" onClick={newKey}>
          <Icon name="Dices" size={13} /> Nouvelle clé
        </button>
      </div>

      <div className="space-y-0">
        {STAGES.map((s, i) => (
          <div key={s.id}>
            <button
              type="button"
              onClick={() => {
                setStage(i)
                setReverse(null)
              }}
              className={`w-full rounded-xl border p-2.5 text-left transition ${stage === i ? 'bg-ink-800' : 'border-ink-700 bg-ink-850/80 hover:border-ink-500'}`}
              style={stage === i ? { borderColor: `${s.color}88`, boxShadow: `0 0 18px -8px ${s.color}` } : undefined}
            >
              <div className="flex items-center gap-2">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg" style={{ background: `${s.color}1a`, color: s.color }}>
                  <Icon name={s.icon} size={14} />
                </span>
                <span className="text-[12.5px] font-semibold text-white">{s.title}</span>
                {i === 0 && <span className="chip bg-rose-500/15 text-rose-300">SECRET</span>}
                {i > 0 && <span className="chip bg-emerald-500/10 text-emerald-300">public</span>}
                {i === 3 && <span className="chip" style={{ color: netCol, background: `${netCol}18` }}>{CHAINS[net].name}</span>}
              </div>
              <div className={`mt-1.5 break-all font-mono text-[11.5px] leading-relaxed ${i === 3 ? 'text-[12.5px] text-white' : 'text-ink-200'}`}>
                {values[i]}
                {i === 3 && d?.checksum && <span className="ml-2 text-[10.5px] text-ink-400">(somme de contrôle : {d.checksum})</span>}
              </div>
            </button>
            {i < 3 && (
              <div className="flex items-center gap-2 py-1 pl-4">
                <Icon name="ArrowDown" size={14} className="text-accent" />
                <span className="flex-1 text-[11px] text-ink-300">{ARROWS[net][i]}</span>
                <button className={`btn-ghost !px-2 !py-0.5 text-[11px] ${reverse === i ? '!text-rose-300' : ''}`} onClick={() => setReverse(i)} aria-label={`Tenter de remonter de l'étape ${i + 2} à l'étape ${i + 1}`}>
                  ← remonter
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {reverse !== null ? (
        <Explain tone="bad" title="Impossible de remonter">
          Retrouver la <strong>{STAGES[reverse].title.toLowerCase()}</strong> à partir de la <strong>{STAGES[reverse + 1].title.toLowerCase()}</strong> est calculatoirement impossible : {reverse === 0 ? 'inverser une multiplication sur courbe elliptique (problème du logarithme discret) prendrait des milliards d\'années à tous les ordinateurs du monde.' : reverse === 1 ? 'une fonction de hachage est à sens unique ; on ne peut que tester des clés au hasard.' : "l'encodage, lui, se décode facilement — mais on ne retrouve que l'empreinte, qui reste à sens unique."} Conséquence pour l'enquête : une adresse ne révèle jamais la clé ; pour saisir les fonds il faut obtenir la clé privée ou la phrase de récupération.
        </Explain>
      ) : (
        <Explain>
          <strong>{STAGES[stage].title}.</strong> {DETAILS[stage]}
          {prevAddr && d && prevAddr !== d.address && (
            <>
              {' '}
              Vous venez de changer la clé : l'adresse est passée de <span className="font-mono text-ink-300">{prevAddr.slice(0, 10)}…</span> à <span className="font-mono text-accent">{d.address.slice(0, 10)}…</span>, totalement différente.
            </>
          )}
          <div className="mt-1 text-[11px] text-ink-400">Simplifié : la clé publique et les hachages sont ici simulés avec SHA-256 (le Base58Check est réel). Le principe — un seul sens de calcul — est identique.</div>
        </Explain>
      )}
    </div>
  )
}
