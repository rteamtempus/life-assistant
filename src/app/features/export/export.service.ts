import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '../../core/supabase.service';

/**
 * Therapist export (handoff §5: a clean export for therapist sessions). Pulls
 * a date range and formats it as plain Markdown — presence-focused (§1.1),
 * non-diagnostic. Entirely client-side: no AI, works today, the owner stays in
 * control of what leaves the app.
 */
@Injectable({ providedIn: 'root' })
export class ExportService {
  private readonly supabase = inject(SupabaseService);

  async buildMarkdown(days: number): Promise<string> {
    const end = new Date();
    const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
    const startIso = start.toISOString();

    const [reflections, checkIns, urges, insights] = await Promise.all([
      this.supabase.client
        .from('reflections')
        .select('*')
        .gte('period_end', startIso.slice(0, 10))
        .order('period_end', { ascending: false }),
      this.supabase.client
        .from('check_ins')
        .select('mood, energy, activation, note, created_at')
        .gte('created_at', startIso)
        .order('created_at', { ascending: true }),
      this.supabase.client
        .from('urge_events')
        .select('kind, rode_out, acted_on, underlying_need, occurred_at')
        .gte('occurred_at', startIso),
      this.supabase.client
        .from('entry_insights')
        .select('summary, what_helped, stressors'),
    ]);

    const ci = checkIns.data ?? [];
    const ue = urges.data ?? [];
    const ins = insights.data ?? [];

    const ridOut = ue.filter((u) => u.rode_out === true).length;
    const avg = (xs: (number | null)[]) => {
      const v = xs.filter((x): x is number => x != null);
      return v.length ? (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) : '—';
    };

    const whatHelped = new Set<string>();
    for (const i of ins) for (const h of (i.what_helped ?? []) as string[]) whatHelped.add(h);
    const stressors = new Set<string>();
    for (const i of ins) for (const s of (i.stressors ?? []) as string[]) stressors.add(s);

    const fmtDate = (d: Date) => d.toISOString().slice(0, 10);

    const lines: string[] = [];
    lines.push(`# Therapy session notes`);
    lines.push(`_${fmtDate(start)} → ${fmtDate(end)} · ${days} days_`);
    lines.push('');

    if (reflections.data?.length) {
      lines.push(`## Weekly reflections`);
      for (const r of reflections.data) {
        lines.push(`### Week ending ${r.period_end}`);
        if (r.summary) lines.push(r.summary);
        for (const h of (r.highlights ?? []) as string[]) lines.push(`- ✅ ${h}`);
        for (const o of (r.gentle_observations ?? []) as string[]) lines.push(`- 👀 ${o}`);
        if (r.therapist_note) {
          lines.push('');
          lines.push(`> ${r.therapist_note}`);
        }
        lines.push('');
      }
    }

    lines.push(`## At a glance`);
    lines.push(`- Check-ins logged: ${ci.length}`);
    lines.push(`- Avg mood / energy / activation: ${avg(ci.map((c) => c.mood))} / ${avg(ci.map((c) => c.energy))} / ${avg(ci.map((c) => c.activation))}`);
    lines.push(`- Urges logged: ${ue.length} — **ridden out: ${ridOut}**`);
    lines.push('');

    if (whatHelped.size) {
      lines.push(`## What helped`);
      for (const h of [...whatHelped]) lines.push(`- ${h}`);
      lines.push('');
    }
    if (stressors.size) {
      lines.push(`## Recurring stressors`);
      for (const s of [...stressors]) lines.push(`- ${s}`);
      lines.push('');
    }

    const notes = ci.filter((c) => c.note?.trim());
    if (notes.length) {
      lines.push(`## Check-in notes`);
      for (const n of notes) lines.push(`- _${(n.created_at as string).slice(0, 10)}_: ${n.note}`);
      lines.push('');
    }

    lines.push('---');
    lines.push('_Self-tracked notes to support a therapy conversation. Observations, not diagnoses._');
    return lines.join('\n');
  }
}
