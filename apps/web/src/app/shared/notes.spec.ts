import { parseNotes } from './notes';

describe('parseNotes', () => {
  it('turns headings, bullets and plain lines into display lines', () => {
    expect(parseNotes('## New look\n- Calmer **design**\n\nPlain line')).toEqual([
      { kind: 'heading', text: 'New look', tone: 'new' },
      { kind: 'item', text: 'Calmer design' },
      { kind: 'text', text: 'Plain line' },
    ]);
  });

  it('tones the section headings', () => {
    const tones = parseNotes('## Fixed\n## Coming up\n## Improved\n## Other').map((l) => l.tone);
    expect(tones).toEqual(['fixed', 'soon', 'improved', undefined]);
  });

  it('returns nothing for empty notes', () => {
    expect(parseNotes('  \n ')).toEqual([]);
  });
});
