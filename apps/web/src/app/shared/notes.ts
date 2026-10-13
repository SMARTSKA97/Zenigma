import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export interface NoteLine {
  kind: 'heading' | 'item' | 'text';
  text: string;
}

/** Turns simple release notes (headings, "- " bullets, plain lines) into display lines. */
export function parseNotes(source: string): NoteLine[] {
  const lines: NoteLine[] = [];
  for (const raw of source.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('<!--')) continue;
    const clean = (t: string) => t.replace(/\*\*(.+?)\*\*/g, '$1').replace(/`(.+?)`/g, '$1');
    if (/^#{1,6}\s/.test(line)) lines.push({ kind: 'heading', text: clean(line.replace(/^#{1,6}\s+/, '')) });
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
  protected readonly lines = computed(() => parseNotes(this.text()));
}
