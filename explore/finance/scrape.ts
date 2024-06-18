// ts-node-esm explore/finance/scrape.ts

import { parse, HTMLElement, Node } from 'node-html-parser'
import { fetchTerm } from './fetch'
import { expect } from '../../lib/assert'

function children (element: Node): HTMLElement[] {
  return Array.from(element.childNodes).filter(
    (node): node is HTMLElement => node instanceof HTMLElement
  )
}

type Event = {
  finId: string
  organization: string
  name: string
  date: Date
  venue: string
  awarded: string
  updated: Date
  details: string
  postEval?: string
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
    finId,
    organization,
    name,
    date: new Date(
      `${date.slice(0, 4)}-${date.slice(4, 6)}-${
        date.slice(6).split(/\r?\n/)[0]
      }`
    ),
    venue,
    awarded,
    updated: new Date(
      `${updated.slice(0, 4)}-${updated.slice(4, 6)}-${
        updated.slice(6).split(/\r?\n/)[0]
      }`
    ),
    details:
      row.querySelector('.btn-success')?.getAttribute('href') ??
      expect('.btn-success[href]'),
    postEval: row.querySelector('.btn-info')?.getAttribute('href')
  })
}
console.log(results)
