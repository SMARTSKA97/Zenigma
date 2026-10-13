import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export interface NoteLine {
  kind: 'heading' | 'item' | 'text';
  text: string;
  /** For a heading: which kind of section it opens, so it can be coloured and given an icon. */
  tone?: 'new' | 'improved' | 'fixed' | 'soon';
}

const TONES: [RegExp, NonNullable<NoteLine['tone']>][] = [
  [/^(new|added|features?)\b/i, 'new'],
  [/^(fix|bug)/i, 'fixed'],
  [/^(improv|chang|updated)/i, 'improved'],
  [/^(coming|upcoming|next|planned)/i, 'soon'],
];

/** Turns simple release notes (headings, "- " bullets, plain lines) into display lines. */
export function parseNotes(source: string): NoteLine[] {
  const lines: NoteLine[] = [];
  for (const raw of source.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('<!--')) continue;
    const clean = (t: string) => t.replace(/\*\*(.+?)\*\*/g, '$1').replace(/`(.+?)`/g, '$1');
    if (/^#{1,6}\s/.test(line)) {
      const text = clean(line.replace(/^#{1,6}\s+/, ''));
      lines.push({ kind: 'heading', text, tone: TONES.find(([re]) => re.test(text))?.[1] });
    }
    else if (/^[-*•]\s+/.test(line)) lines.push({ kind: 'item', text: clean(line.replace(/^[-*•]\s+/, '')) });
    else lines.push({ kind: 'text', text: clean(line) });
  }
  return lines;
}

@Component({
  selector: 'app-notes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './notes.html',
  styleUrl: './notes.scss',
})
export class Notes {
  readonly text = input.required<string>();
  protected readonly icons = { new: '✦', improved: '↑', fixed: '✓', soon: '◷' };
  protected readonly lines = computed(() => parseNotes(this.text()));
}
