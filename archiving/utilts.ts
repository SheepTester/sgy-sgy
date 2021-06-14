import { DOMParser, Element, HTMLDocument } from 'https://deno.land/x/deno_dom@v0.1.12-alpha/deno-dom-wasm.ts'

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

export function parseHtml (html: string): HTMLDocument {
  const document = new DOMParser().parseFromString(html, 'text/html')
  if (!document) {
    throw new Error('document from parsed HTML is null')
  }
  return document
}

export function assert<T> (value: T | null | undefined): T {
  if (value === null || value === undefined) {
    throw new Error('Value is ' + value)
  }
  return value
}

export function shouldBeElement (value: unknown): Element {
  if (value instanceof Element) {
    return value
  } else {
    throw new TypeError(`${value} is not Element`)
  }
}
