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
function escape (text: string, { useBr = false, useNbsp = false }: EscapeOptions = {}): string {
  return text.replace(/[<>&" ]|\r?\n/g, char => (
    char[char.length - 1] === '\n'
      ? (useBr ? '<br>' : '&#010;')
      : char === ' ' && !useNbsp
        ? ' '
        : `&${escapes[char]};`
  ))
}

type Attributes = Record<string, string | boolean | (string | false | null | undefined)[] | Record<string, string | false | null | undefined> | null | undefined>

type Child = string | Html | Attributes | Child[] | null | undefined

function attributes (attributes: Attributes = {}): string {
  let str = ''
  for (const [key, value] of Object.entries(attributes)) {
    if (typeof value === 'string') {
      str += ` ${key}="${escape(value)}"`
    } else if (Array.isArray(value)) {
      str += ` ${key}="${
        value
          .filter((token): token is string => !!token)
          .map(token => escape(token))
          .join(' ')
      }"`
    } else if (value === true) {
      str += key
    } else if (value) {
      str += ` ${key}="${
        Object.entries(value)
          .filter((entry): entry is [string, string] => !!entry[1])
          .map(([key, value]) => `${key}:${escape(value)}`)
          .join(';')
      }"`
    }
  }
  return str
}

function childrenToHtml (children: Child[], attrTarget: Attributes): string {
  let innerHtml = ''
  for (const child of children) {
    if (typeof child === 'string') {
      innerHtml += escape(child, { useBr: true, useNbsp: true })
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
export const base = selfClosingElement('base')

export function raw (html: string): Html {
  return new Html(html)
}
