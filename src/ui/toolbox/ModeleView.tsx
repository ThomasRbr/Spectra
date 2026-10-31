import { useDeferredValue, useMemo, useState } from 'react'
import { NOTICE, TOOLBOX_CATEGORIES, initialValues, lessonTitle, type FieldValues, type Modele, type ModeleField } from '../../academy/toolbox'
import { openPrintable } from '../../lib/printable'
import { useProfile } from '../../store/profile'
import { useUi } from '../../store/ui'
import { Icon, tint } from '../common'

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* repli ci-dessous */
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.cssText = 'position:fixed;left:-9999px;top:0'
    document.body.append(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  } catch {
    return false
  }
}

export function ModeleView({ modele, onBack }: { modele: Modele; onBack: () => void }) {
  const name = useProfile((s) => s.name)
  const unit = useProfile((s) => s.unit)
  const [values, setValues] = useState<FieldValues>(() => initialValues(modele, { name, unit }))
  const deferred = useDeferredValue(values)
  const html = useMemo(() => modele.render(deferred), [modele, deferred])
  const cat = TOOLBOX_CATEGORIES[modele.category]
  const set = (k: string, val: string) => setValues((v) => ({ ...v, [k]: val }))
  const lessons = (modele.lessons ?? []).filter((id) => lessonTitle(id))

  return (
    <div className="mx-auto max-w-[1500px] px-8 py-8 animate-fadein">
      <button className="btn-ghost -ml-2 !px-2 text-dense" onClick={onBack}>
        <Icon name="ArrowLeft" size={15} /> Boîte à outils
      </button>

      <div className="mt-3 flex flex-wrap items-start gap-4">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl border" style={{ color: tint(cat.color), borderColor: `${cat.color}55`, background: `${cat.color}14` }}>
          <Icon name={modele.icon} size={26} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="chip" style={{ color: tint(cat.color), background: `${cat.color}18` }}>
              <Icon name={cat.icon} size={11} /> {cat.label}
            </span>
            <span className="chip bg-ink-800 text-ink-300">Modèle de document</span>
          </div>
          <h1 className="mt-1.5 text-page font-semibold leading-tight tracking-tight text-white">{modele.title}</h1>
          <p className="mt-1.5 max-w-3xl text-body leading-relaxed text-ink-200">{modele.description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" onClick={() => openPrintable(modele.render(values), `${modele.id}.html`)}>
            <Icon name="Printer" size={15} /> Imprimer / PDF
          </button>
          <button
            className="btn-outline"
            onClick={async () => {
              const ok = await copyText(modele.text(values))
              useUi.getState().notify(ok ? 'Texte copié dans le presse-papiers' : 'Copie impossible sur ce poste')
            }}
          >
            <Icon name="Copy" size={14} /> Copier le texte
          </button>
        </div>
      </div>

      <div className="mt-4 flex gap-2.5 rounded-xl border border-violet-400/30 bg-violet-400/5 px-4 py-2.5 text-dense leading-relaxed text-ink-100">
        <Icon name="Scale" size={15} className="mt-0.5 shrink-0 text-violet-300" />
        <span>
          <strong className="text-violet-200">{NOTICE}</strong> Les références juridiques sont indicatives : vérifiez-les avant tout usage en procédure. Les champs saisis ne sont pas enregistrés.
        </span>
      </div>

      <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <div className="min-w-0">
          <div className="rounded-xl border border-ink-700/70 bg-ink-900/70 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="label">Champs du document</div>
              <button
                className="btn-ghost !px-2 !py-1 text-meta"
                onClick={() => {
                  if (confirm('Effacer la saisie et revenir aux valeurs par défaut ?')) setValues(initialValues(modele, { name, unit }))
                }}
              >
                <Icon name="RotateCcw" size={13} /> Réinitialiser
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {modele.fields.map((f) => (
                <FieldInput key={f.key} f={f} value={values[f.key] ?? ''} onChange={(val) => set(f.key, val)} />
              ))}
            </div>
            <div className="mt-3 text-meta leading-relaxed text-ink-400">Un champ laissé vide apparaît comme une ligne à compléter à la main sur le document imprimé.</div>
          </div>

          {lessons.length > 0 && (
            <div className="mt-4 rounded-xl panel p-4">
              <div className="label flex items-center gap-1.5">
                <Icon name="GraduationCap" size={13} /> Leçons liées
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {lessons.map((id) => (
                  <button key={id} className="btn-outline !py-1 text-meta" onClick={() => useUi.getState().openLesson(id)}>
                    <Icon name="BookOpen" size={12} /> {lessonTitle(id)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="min-w-0 xl:sticky xl:top-6 xl:self-start">
          <div className="mb-2 flex items-center gap-2">
            <div className="label">Aperçu</div>
            <span className="text-micro text-ink-400">mis à jour pendant la saisie</span>
          </div>
          <iframe title={`Aperçu — ${modele.title}`} srcDoc={html} className="h-[calc(100vh-150px)] min-h-[520px] w-full rounded-xl border border-ink-700 bg-white shadow-panel" sandbox="allow-modals allow-scripts" />
        </div>
      </div>
    </div>
  )
}

function FieldInput({ f, value, onChange }: { f: ModeleField; value: string; onChange: (v: string) => void }) {
  const id = `tbx-${f.key}`
  const wide = f.wide || f.type === 'textarea'
  return (
    <label htmlFor={id} className={`block ${wide ? 'sm:col-span-2' : ''}`}>
      <span className="mb-1 block text-meta font-medium text-ink-200">{f.label}</span>
      {f.type === 'textarea' ? (
        <textarea id={id} className="input min-h-[84px] resize-y font-mono !text-dense leading-relaxed" placeholder={f.placeholder} value={value} onChange={(e) => onChange(e.target.value)} rows={4} />
      ) : f.type === 'select' ? (
        <select id={id} className="input" value={value} onChange={(e) => onChange(e.target.value)}>
          {(f.options ?? []).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <input id={id} type={f.type === 'date' ? 'date' : 'text'} className="input" placeholder={f.placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
      )}
      {f.help && <span className="mt-1 block text-micro text-ink-400">{f.help}</span>}
    </label>
  )
}
