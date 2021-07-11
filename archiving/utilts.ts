import {
  DOMParser,
  Element,
  HTMLDocument,
} from 'https://deno.land/x/deno_dom@v0.1.12-alpha/deno-dom-wasm.ts'

const charNames: Record<string, string> = {
  '`': 'tick',
  '~': 'tilde',
  '!': 'bang',
  '@': 'at',
  '#': 'hash',
  $: 'cash',
  '%': 'percent',
  '^': 'hat',
  '&': 'and',
  '*': 'start',
  '(': 'lparen',
  ')': 'rparen',
  '-': 'dash',
  _: 'sub',
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
  "'": 'apos',
  '"': 'quote',
  ',': 'comma',
  '.': 'dot',
  '<': 'lt',
  '>': 'gt',
  '/': 'slash',
  '?': 'q',
}

export interface StringToPath {
  allowSlash?: boolean
}

export function stringToPath (
  string: string,
  { allowSlash = false }: StringToPath = {},
): string {
  return (
    string.replace(
      /[^A-Za-z0-9`~!@#$%^&()\-=+[\];',]|\.(?:$|(?=\/))/g,
      char => {
        switch (char) {
          case '/':
            return allowSlash ? '/' : '{slash}'
          case ' ':
            return '_'
          default:
            return `{${
              charNames[char] ??
              'u+' +
                char.charCodeAt(0).toString(16).padStart(4, '0').toUpperCase()
            }}`
        }
      },
    ) || '{empty}'
  )
}

export function parseHtml (html: string): HTMLDocument {
  const document = new DOMParser().parseFromString(html, 'text/html')
  if (!document) {
    throw new Error('document from parsed HTML is null')
  }
  return document
}

export function expect<T> (value: T | null | undefined): T {
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

export async function asyncMap<A, B> (
  iterable: Iterable<A>,
  map: (value: A) => Promise<B>,
): Promise<B[]> {
  const results = []
  for (const value of iterable) {
    results.push(await map(value))
  }
  return results
}

export function delay (duration: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, duration))
}
