import { parseNotes } from './notes';

describe('parseNotes', () => {
  it('turns headings, bullets and plain lines into display lines', () => {
    expect(parseNotes('## New look\n- Calmer **design**\n\nPlain line')).toEqual([
      { kind: 'heading', text: 'New look' },
      { kind: 'item', text: 'Calmer design' },
      { kind: 'text', text: 'Plain line' },
    ]);
  });

  it('returns nothing for empty notes', () => {
    expect(parseNotes('  \n ')).toEqual([]);
  });
});
