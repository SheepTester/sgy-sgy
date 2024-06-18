// ts-node-esm explore/finance/scrape.ts

import { parse, HTMLElement, Node } from 'node-html-parser'
import { fetchApplication, fetchTerm } from './fetch'
import { expect } from '../../lib/assert'

function children (element: Node): HTMLElement[] {
  return Array.from(element.childNodes).filter(
    (node): node is HTMLElement => node instanceof HTMLElement
  )
}

export type Event = {
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

export async function getEvents (termId: number): Promise<Event[]> {
  const doc = parse(await fetchTerm(termId))
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
  return results
}

export type Application = {
  org: string
  eventName: string
  date: string
  venue: string
  onCampus: boolean
  description: string
  attendanceEstimate: number
  admissionCharge: boolean
  philanthropic: boolean
  otherFunding: string
  status: string
  created: string
  changed: string
}

export async function getApplication (finId: number) {
  const doc = parse(await fetchApplication(finId))
  const questions: Record<string, string> = {}
  for (const dl of doc.getElementsByTagName('dl')) {
    const items = children(dl)
    for (let i = 0; i < items.length; i += 2) {
      const dt = items[i].textContent.trim()
      const dd = items[i + 1].textContent.trim()
      const checkbox = items[i + 1].querySelector('input')
      questions[dt] = checkbox
        ? checkbox.getAttribute('checked') ?? 'unchecked'
        : dd
    }
  }
  console.log(questions)
  return questions
}

import fs from 'fs/promises'
await fs.writeFile(
  'explore/finance/apps.json',
  JSON.stringify(
    await getEvents(1030).then(events =>
      Promise.all(events.slice(0, 20).map(({ finId }) => getApplication(finId)))
    )
  )
)
