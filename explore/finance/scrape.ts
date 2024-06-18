// ts-node-esm explore/finance/scrape.ts

import { parse, HTMLElement, Node } from 'node-html-parser'
import { fetchTerm } from './fetch'
import { expect } from '../../lib/assert'
import { parseIntMaybe } from '../../lib/parseIntMaybe'

function children (element: Node): HTMLElement[] {
  return Array.from(element.childNodes).filter(
    (node): node is HTMLElement => node instanceof HTMLElement
  )
}

type Event = {
  /**
   * Details: `https://finance.ucsd.edu/Home/ViewApplication/<finId>`
   *
   * Post-evaluation form: `https://finance.ucsd.edu/Home/ViewPostEvaluation/<finId>`
   */
  finId: number
  organization: string
  name: string
  /** In UTC. */
  date: Date
  venue: string
  awarded?: number
  /** In UTC. */
  updated: Date
  hasPostEval: boolean
}

const doc = parse(await fetchTerm('1021'))
const table =
  doc
    .getElementById('FundedTable')
    ?.childNodes.findLast(node => node instanceof HTMLElement) ??
  expect('#FundedTable tbody')
const results: Event[] = []
for (const row of children(table)) {
  const [finId, organization, name, date, venue, awarded, updated] = children(
    row
  ).map(td => td.textContent.trim())
  results.push({
    finId: +finId,
    organization,
    name,
    date: new Date(
      `${date.slice(0, 4)}-${date.slice(4, 6)}-${
        date.slice(6).split(/\r?\n/)[0]
      }`
    ),
    venue,
    awarded: awarded ? +awarded.replace(/[$,]/g, '') : undefined,
    updated: new Date(
      `${updated.slice(0, 4)}-${updated.slice(4, 6)}-${
        updated.slice(6).split(/\r?\n/)[0]
      }`
    ),
    hasPostEval: !!row.querySelector('.btn-info')?.getAttribute('href')
  })
}
console.log(results)
