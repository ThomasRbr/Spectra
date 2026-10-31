import { FICHES, TOOLBOX_CATEGORIES, ficheHtml, ficheItemCount, itemKey, lessonTitle, modeleById, type Fiche } from '../../academy/toolbox'
import { openPrintable } from '../../lib/printable'
import { useUi } from '../../store/ui'
import { Icon, ProgressBar, tint } from '../common'
import { useFicheChecks } from './checks'

export function FicheView({ fiche, onBack, onOpenModele, onOpenFiche }: { fiche: Fiche; onBack: () => void; onOpenModele: (id: string) => void; onOpenFiche: (id: string) => void }) {
  const { checked, toggle, reset } = useFicheChecks(fiche.id)
  const cat = TOOLBOX_CATEGORIES[fiche.category]
  const total = ficheItemCount(fiche)
  const critKeys = fiche.sections.flatMap((s, si) => s.items.map((it, ii) => (it.critique ? itemKey(si, ii) : '')).filter(Boolean))
  const done = fiche.sections.reduce((n, s, si) => n + s.items.filter((_, ii) => checked.has(itemKey(si, ii))).length, 0)
  const critLeft = critKeys.filter((k) => !checked.has(k)).length
  const lessons = fiche.lessons.filter((id) => lessonTitle(id))
  const modeles = (fiche.modeles ?? []).map(modeleById).filter((m): m is NonNullable<typeof m> => !!m)
  const sameCat = FICHES.filter((f) => f.category === fiche.category && f.id !== fiche.id)

  return (
    <div className="mx-auto max-w-7xl px-8 py-8 animate-fadein">
      <button className="btn-ghost -ml-2 !px-2 text-dense" onClick={onBack}>
        <Icon name="ArrowLeft" size={15} /> Boîte à outils
      </button>

      <div className="mt-3 flex flex-wrap items-start gap-4">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl border" style={{ color: tint(cat.color), borderColor: `${cat.color}55`, background: `${cat.color}14` }}>
          <Icon name={fiche.icon} size={26} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="chip" style={{ color: tint(cat.color), background: `${cat.color}18` }}>
              <Icon name={cat.icon} size={11} /> {cat.label}
            </span>
            <span className="chip bg-ink-800 text-ink-300">Fiche réflexe</span>
          </div>
          <h1 className="mt-1.5 text-page font-semibold leading-tight tracking-tight text-white">{fiche.title}</h1>
          <p className="mt-1.5 max-w-3xl text-body leading-relaxed text-ink-200">{fiche.summary}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-5">
          <div className="flex gap-3 rounded-xl border border-accent/30 bg-accent/5 px-4 py-3">
            <Icon name="Clock" size={16} className="mt-0.5 shrink-0 text-accent" />
            <div className="text-dense leading-relaxed text-ink-100">
              <div className="mb-0.5 text-micro font-semibold uppercase tracking-wider text-accent">Quand l'utiliser</div>
              {fiche.when}
            </div>
          </div>

          {fiche.sections.map((s, si) => {
            const sDone = s.items.filter((_, ii) => checked.has(itemKey(si, ii))).length
            return (
              <section key={si} className="rounded-xl border border-ink-700/70 bg-ink-900/70">
                <div className="flex items-center gap-3 border-b border-ink-700/60 px-4 py-3">
                  <span className="grid h-6 w-6 place-items-center rounded-md bg-ink-800 font-mono text-micro text-ink-200">{si + 1}</span>
                  <h2 className="flex-1 text-body font-semibold text-white">{s.title}</h2>
                  <span className={`font-mono text-micro ${sDone === s.items.length ? 'text-emerald-400' : 'text-ink-400'}`}>
                    {sDone}/{s.items.length}
                  </span>
                </div>
                <ul className="divide-y divide-ink-800/80">
                  {s.items.map((it, ii) => {
                    const k = itemKey(si, ii)
                    const on = checked.has(k)
                    return (
                      <li key={ii}>
                        <button onClick={() => toggle(k)} className={`flex w-full gap-3 px-4 py-2.5 text-left transition hover:bg-ink-800/50 ${on ? 'opacity-60' : ''}`} aria-pressed={on}>
                          <Icon name={on ? 'SquareCheckBig' : 'Square'} size={17} className={`mt-0.5 shrink-0 ${on ? 'text-emerald-400' : it.critique ? 'text-rose-400' : 'text-ink-400'}`} />
                          <span className="min-w-0 flex-1">
                            <span className={`text-body leading-snug ${on ? 'text-ink-300 line-through decoration-ink-500' : 'text-ink-100'}`}>{it.text}</span>
                            {it.critique && (
                              <span className="chip ml-2 border border-rose-500/40 bg-rose-500/10 align-middle text-rose-300">
                                <Icon name="TriangleAlert" size={10} /> Critique
                              </span>
                            )}
                            {it.detail && <span className="mt-0.5 block text-meta leading-relaxed text-ink-300">{it.detail}</span>}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )
          })}

          <section className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
            <div className="flex items-center gap-2 text-dense font-semibold text-amber-300">
              <Icon name="ShieldAlert" size={16} /> Pièges à éviter
            </div>
            <ul className="mt-2 space-y-1.5">
              {fiche.pitfalls.map((p, i) => (
                <li key={i} className="flex gap-2 text-dense leading-relaxed text-ink-100">
                  <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                  {p}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-xl panel p-4">
            <div className="flex items-baseline justify-between">
              <div className="label">Progression</div>
              <div className="font-mono text-meta text-ink-200">
                {done}/{total}
              </div>
            </div>
            <ProgressBar value={done / Math.max(1, total)} color={done === total ? '#34d399' : '#7ea6ff'} className="mt-2" />
            <div className={`mt-2 flex items-center gap-1.5 text-meta ${critLeft ? 'text-rose-300' : 'text-emerald-400'}`}>
              <Icon name={critLeft ? 'TriangleAlert' : 'CircleCheck'} size={13} />
              {critLeft ? `${critLeft} point(s) critique(s) restant(s)` : 'Tous les points critiques sont traités'}
            </div>
            <div className="mt-4 grid gap-2">
              <button className="btn-primary" onClick={() => openPrintable(ficheHtml(fiche), `fiche-${fiche.id}.html`)}>
                <Icon name="Printer" size={15} /> Imprimer la fiche
              </button>
              <button
                className="btn-outline"
                disabled={!done}
                onClick={() => {
                  if (confirm('Décocher tous les items de cette fiche ?')) reset()
                }}
              >
                <Icon name="RotateCcw" size={14} /> Réinitialiser
              </button>
            </div>
            <div className="mt-3 text-micro leading-relaxed text-ink-400">Les cases cochées sont conservées sur ce poste uniquement. La fiche imprimée est vierge.</div>
          </div>

          {lessons.length > 0 && (
            <div className="rounded-xl panel p-4">
              <div className="label flex items-center gap-1.5">
                <Icon name="GraduationCap" size={13} /> Leçons liées
              </div>
              <div className="mt-2 grid gap-1">
                {lessons.map((id) => (
                  <button key={id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-dense text-ink-200 transition hover:bg-ink-800 hover:text-white" onClick={() => useUi.getState().openLesson(id)}>
                    <Icon name="BookOpen" size={13} className="shrink-0 text-accent" />
                    <span className="flex-1">{lessonTitle(id)}</span>
                    <Icon name="ChevronRight" size={13} className="text-ink-500" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {modeles.length > 0 && (
            <div className="rounded-xl panel p-4">
              <div className="label flex items-center gap-1.5">
                <Icon name="FileText" size={13} /> Modèles de documents
              </div>
              <div className="mt-2 grid gap-1">
                {modeles.map((m) => (
                  <button key={m.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-dense text-ink-200 transition hover:bg-ink-800 hover:text-white" onClick={() => onOpenModele(m.id)}>
                    <Icon name={m.icon} size={13} className="shrink-0 text-violet-300" />
                    <span className="flex-1">{m.title}</span>
                    <Icon name="ChevronRight" size={13} className="text-ink-500" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {fiche.tools && fiche.tools.length > 0 && (
            <div className="rounded-xl panel p-4">
              <div className="label flex items-center gap-1.5">
                <Icon name="Wrench" size={13} /> Outils utiles
              </div>
              <ul className="mt-2 space-y-1.5">
                {fiche.tools.map((t, i) => (
                  <li key={i} className="flex gap-2 text-dense leading-snug text-ink-200">
                    <Icon name="ChevronRight" size={12} className="mt-0.5 shrink-0 text-accent" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {sameCat.length > 0 && (
            <div className="rounded-xl panel p-4">
              <div className="label">Même catégorie</div>
              <div className="mt-2 grid gap-1">
                {sameCat.map((f) => (
                  <button key={f.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-dense text-ink-200 transition hover:bg-ink-800 hover:text-white" onClick={() => onOpenFiche(f.id)}>
                    <Icon name={f.icon} size={13} className="shrink-0" color={cat.color} />
                    <span className="flex-1">{f.title}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
