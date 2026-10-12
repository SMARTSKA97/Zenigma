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
    if (!line) continue;
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
  template: `
    @for (line of lines(); track $index) {
      @switch (line.kind) {
        @case ('heading') {
          <h4>{{ line.text }}</h4>
        }
        @case ('item') {
          <p class="item"><i aria-hidden="true"></i><span>{{ line.text }}</span></p>
        }
        @default {
          <p>{{ line.text }}</p>
        }
      }
    }
  `,
  styles: `
    :host {
      display: block;
    }
    h4 {
      margin: 1rem 0 0.4rem;
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--muted);
    }
    h4:first-child {
      margin-top: 0;
    }
    p {
      margin: 0 0 0.6rem;
      font-size: 0.95rem;
      line-height: 1.45;
    }
    .item {
      display: grid;
      grid-template-columns: 6px 1fr;
      gap: 0.75rem;
      align-items: start;
    }
    .item i {
      width: 6px;
      height: 6px;
      margin-top: 0.55em;
      border-radius: 50%;
      background: var(--accent);
    }
  `,
})
export class Notes {
  readonly text = input.required<string>();
  protected readonly lines = computed(() => parseNotes(this.text()));
}
