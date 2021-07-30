export class Html {
  html: string

  constructor (html: string) {
    this.html = html
  }
}

const escapes: Record<string, string> = {
  '<': 'lt',
  '>': 'gt',
  '&': 'amp',
  '"': 'quot',
  ' ': 'nbsp',
}
interface EscapeOptions {
  useBr?: boolean
  useNbsp?: boolean
}
function escape (
  text: string,
  { useBr = false, useNbsp = false }: EscapeOptions = {},
): string {
  return text.replace(/[<>&" ]|\r?\n/g, char =>
    char[char.length - 1] === '\n'
      ? useBr
        ? '<br>'
        : '&#010;'
      : char === ' ' && !useNbsp
      ? ' '
      : `&${escapes[char]};`,
  )
}

type Falsy = false | null | undefined

type Attributes = Record<
  string,
  string | boolean | (string | Falsy)[] | Record<string, string | Falsy> | Falsy
>

export type Child = string | Html | Attributes | Child[] | Falsy

function attributes (attributes: Attributes = {}): string {
  let str = ''
  for (const [key, value] of Object.entries(attributes)) {
    if (!value && value !== '') continue
    str += ' ' + key
    if (value === true) continue
    str += '="'
    if (typeof value === 'string') {
      str += escape(value)
    } else if (Array.isArray(value)) {
      str += value
        .filter((token): token is string => !!token)
        .map(token => escape(token))
        .join(' ')
    } else {
      str += Object.entries(value)
        .filter((entry): entry is [string, string] => !!entry[1])
        .map(([key, value]) => `${key}:${escape(value)}`)
        .join(';')
    }
    str += '"'
  }
  return str
}

function childrenToHtml (children: Child[], attrTarget: Attributes): string {
  let innerHtml = ''
  for (const child of children) {
    if (typeof child === 'string') {
      innerHtml += escape(child, { useBr: true })
    } else if (child instanceof Html) {
      innerHtml += child.html
    } else if (Array.isArray(child)) {
      innerHtml += childrenToHtml(child, attrTarget)
    } else if (child) {
      Object.assign(attrTarget, child)
    }
  }
  return innerHtml
}
function element (tag: string): (...children: Child[]) => Html {
  return (...children) => {
    const attr: Attributes = {}
    const innerHtml = childrenToHtml(children, attr)
    return new Html(`<${tag}${attributes(attr)}>${innerHtml}</${tag}>`)
  }
}

function selfClosingElement (tag: string): (attributes: Attributes) => Html {
  return attr => {
    return new Html(`<${tag}${attributes(attr)} />`)
  }
}

export const div = element('div')
export const ul = element('ul')
export const li = element('li')
export const dl = element('dl')
export const dt = element('dt')
export const dd = element('dd')
export const table = element('table')
export const tr = element('tr')
export const th = element('th')
export const td = element('td')
export const p = element('p')
export const a = element('a')
export const em = element('em')
export const strong = element('strong')
export const h1 = element('h1')
export const h2 = element('h2')
export const h3 = element('h3')
export const span = element('span')
export const details = element('details')
export const summary = element('summary')
export const style = element('style')
export const script = element('script')
export const iframe = element('iframe')
export const audio = element('audio')
export const body = element('body')
export const img = selfClosingElement('img')
export const base = selfClosingElement('base')

export function raw (html: string): Html {
  return new Html(html)
}

export function page (...children: Child[]): string {
  return [
    '<!doctype html>',
    '<html>',
    '<head>',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    '<style>',
    'body {',
    'white-space: pre-wrap;',
    '}',
    '@media (prefers-color-scheme: dark) {',
    ':root {',
    'color-scheme: dark;',
    '}',
    '}',
    '</style>',
    '</head>',
    body(children).html,
    '</html>',
  ].join('')
}
