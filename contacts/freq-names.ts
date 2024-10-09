// deno run --allow-all contacts/freq-names.ts ../site/hello-world/ignored/ucsd-contacts.json

import { readLines } from 'https://deno.land/std@0.117.0/io/mod.ts'
import { ensureDir } from 'https://deno.land/std@0.117.0/fs/ensure_dir.ts'
import { bold, cyan, yellow } from 'https://deno.land/std@0.117.0/fmt/colors.ts'

type Contact = [
  unknown,
  unknown,
  (
    | [
        [
          unknown,
          string, // Full name
          null,
          string, // First name
          string | null, // Last name
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          string, // Last, first
          null,
          null,
          string // Full name again
        ],
        unknown
      ]
    | null
  )
]

await ensureDir('./contacts/private/')

function checkMatch (a: string, b: string, message: string) {
  if (a !== b) {
    console.warn(bold(yellow(message)), [a, b])
  }
}

function addFreq (frequencies: Map<string, number>, entry: string) {
  frequencies.set(entry, (frequencies.get(entry) ?? 0) + 1)
}

function mergeCases (frequencies: Map<string, number>): Map<string, number> {
  return new Map(
    Array.from(
      Map.groupBy(frequencies, ([name]) => name.toLowerCase()).values(),
      groups => [
        // Use the most used casing
        groups.reduce((cum, curr) => (cum[1] > curr[1] ? cum : curr))[0],
        groups.reduce((cum, curr) => cum + curr[1], 0)
      ]
    )
  )
}

function displayFreq (frequencies: Map<string, number>) {
  const sorted = [...frequencies].sort(([, a], [, b]) => b - a)
  const uniqueIndex = sorted.findIndex(([, times]) => times === 1)
  return (
    sorted
      .slice(0, uniqueIndex === -1 ? sorted.length : uniqueIndex)
      .map(([word, times], i) =>
        times === 1 ? `${i + 1}. ${word}` : `${i + 1}. ${word} (${times})`
      )
      .join('\n') +
    (uniqueIndex === -1
      ? ''
      : `\n\nand ${sorted.length - uniqueIndex} unique name(s).`)
    /* `\n\nUnique names: ${sorted
          .slice(uniqueIndex)
          .map(([word]) => word)
          .join(', ')}` */
  )
}

const frequencies = {
  fullName: new Map<string, number>(),
  firstName: new Map<string, number>(),
  lastName: new Map<string, number>()
}
let namesWithSpace = 0

const [fileName] = Deno.args
for await (const line of readLines(await Deno.open(fileName))) {
  if (line.length <= 2) {
    continue
  }

  const [, , names]: Contact = JSON.parse(line.slice(2))
  if (!names) {
    // baljuboori@ucsd.edu doesn't have a name
    console.log(yellow("This nerd doesn't have a name."), line)
    continue
  }
  const [
    [
      ,
      fullName,
      ,
      firstNameWithSpace,
      lastNameWithSpace,
      ,
      ,
      ,
      ,
      ,
      ,
      ,
      lastFirst,
      ,
      ,
      fullName2
    ]
  ] = names

  // Some names have extra spaces
  const firstName = firstNameWithSpace.trim().replaceAll(/\s+/g, ' ')
  const lastName = lastNameWithSpace?.trim().replaceAll(/\s+/g, ' ')
  if (firstName !== firstNameWithSpace || lastName !== lastNameWithSpace) {
    namesWithSpace++
  }
  if (lastName === undefined) {
    console.log(`${cyan(fullName)} does not have a last name.`)
  }

  checkMatch(
    lastName === undefined ? firstName : `${firstName} ${lastName}`,
    fullName,
    'The first name and last name together do not match the full name.'
  )
  checkMatch(
    lastName === undefined ? firstName : `${lastName}, ${firstName}`,
    lastFirst,
    'The last part of the last-name-comma-first-name does not match the first name.'
  )
  checkMatch(fullName, fullName2, 'The two full names do not match.')

  addFreq(frequencies.fullName, fullName)
  addFreq(frequencies.firstName, firstName)
  if (lastName !== undefined) {
    addFreq(frequencies.lastName, lastName)
  }
}

await Deno.writeTextFile(
  './contacts/private/names.md',
  `- [Full names](#full-names)
- [First names](#first-names)
- [Last names](#last-names)

## Full names

${displayFreq(mergeCases(frequencies.fullName))}

## First names

${displayFreq(mergeCases(frequencies.firstName))}

## Last names

${displayFreq(mergeCases(frequencies.lastName))}
`
)

console.log(`There were ${namesWithSpace} names with a space at one end.`)
