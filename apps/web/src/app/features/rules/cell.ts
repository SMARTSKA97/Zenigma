/**
 * Figure cells are strings: an optional first mark ("+" good, "!" wrong, "?" look here), an optional colour "#0" to "#7",
 * then the text shown in the cell. "." is an empty cell.
 */
export function parseCell(cell: string): { mark: string; colour: string; text: string } {
  let rest = cell ?? '';
  let mark = '';
  if (/^[+!?]/.test(rest)) {
    mark = rest[0];
    rest = rest.slice(1);
  }
  let colour = '';
  const colourMatch = /^#([0-7])/.exec(rest);
  if (colourMatch) {
    colour = colourMatch[1];
    rest = rest.slice(1 + colourMatch[0].length - 1);
  }
  return { mark, colour, text: rest === '.' ? '' : rest };
}

export function cellClasses(cell: string): string {
  const p = parseCell(cell);
  return [p.colour ? 'c' + p.colour : '', p.mark === '+' ? 'good' : p.mark === '!' ? 'bad' : p.mark === '?' ? 'hint' : ''].filter(Boolean).join(' ');
}
