const charNames: Record<string, string> = {
  '`': 'tick',
  '~': 'tilde',
  '!': 'bang',
  '@': 'at',
  '#': 'hash',
  '$': 'cash',
  '%': 'percent',
  '^': 'hat',
  '&': 'and',
  '*': 'start',
  '(': 'lparen',
  ')': 'rparen',
  '-': 'dash',
  '_': 'sub',
  '=': 'eq',
  '+': 'plus',
  '[': 'lsquare',
  ']': 'rsquare',
  '{': 'lcurly',
  '}': 'rcurly',
  '\\': 'back',
  '|': 'pipe',
  ';': 'semi',
  ':': 'colon',
  '\'': 'apos',
  '"': 'quote',
  ',': 'comma',
  '.': 'dot',
  '<': 'lt',
  '>': 'gt',
  '/': 'slash',
  '?': 'q',
}

export function stringToPath (string: string): string {
  return string.replace(/[^A-Za-z0-9]/g, char => {
    switch (char) {
      case '/': return '.'
      case ' ': return '-'
      default: return `_${
        charNames[char] || '-' + char.charCodeAt(0).toString(16).padStart(4, '0')
      }_`
    }
  })
}
