// deno run --allow-all contacts/frequency-analyze.ts ../site/hello-world/ignored/ucsd-contacts.json

import { readLines } from 'https://deno.land/std@0.117.0/io/mod.ts'
import { ensureDir } from 'https://deno.land/std@0.117.0/fs/ensure_dir.ts'

await ensureDir('./contacts/private/')

type JsonValue = string | number | boolean | null
type Json = JsonValue | Json[]
type Frequency = {
  values: Map<JsonValue, number>
  array: Frequency[]
  arrayCount: number
}
const newFrequency = (): Frequency => {
  return {
    values: new Map(),
    array: [],
    arrayCount: 0
  }
}

/**
 * Creates a new `Map` in descending order.
 */
function sortMap<K> (map: Map<K, number>): Map<K, number> {
  return new Map([...map.entries()].sort(([, a], [, b]) => b - a))
}

/**
 * Mutates `frequencies`
 */
function analyze (value: Json, frequencies: Frequency) {
  if (Array.isArray(value)) {
    frequencies.arrayCount++
    while (frequencies.array.length < value.length) {
      frequencies.array.push(newFrequency())
    }
    for (const [i, entry] of value.entries()) {
      analyze(entry, frequencies.array[i])
    }
  } else {
    frequencies.values.set(value, (frequencies.values.get(value) ?? 0) + 1)
  }
}

const frequencies = newFrequency()

const [fileName] = Deno.args
for await (const line of readLines(await Deno.open(fileName))) {
  if (line.length > 2) {
    const contact: Json = JSON.parse(line.slice(2))
    analyze(contact, frequencies)
  }
}

const MAX_ENTRIES = 10
const MAX_ENTRIES_IF_UNIQUE = 3
function displayFrequency (frequencies: Frequency): string[] {
  const counts = [...frequencies.values.values()]
  const unique = counts.length > 0 && counts.every(count => count === 1)
  let lines: string[] = []
  const max = unique ? MAX_ENTRIES_IF_UNIQUE : MAX_ENTRIES
  for (const [value, times] of sortMap(frequencies.values)) {
    lines.push(
      `${typeof value === 'string' ? JSON.stringify(value) : value}: ${times}`
    )
    if (lines.length >= max) {
      if (frequencies.values.size > max) {
        lines.push(
          `# ... ${frequencies.values.size - max} of ${
            frequencies.values.size
          } not shown`
        )
      }
      break
    }
  }
  const valueCount = counts.reduce((a, b) => a + b, 0)
  if (frequencies.arrayCount > 0) {
    lines = [
      'array:',
      ...frequencies.array
        .flatMap(freq =>
          displayFrequency(freq).map(
            (line, i) => (i === 0 ? '- ' : '  ') + line
          )
        )
        .map(line => '  ' + line),
      ...lines
    ]
    lines[0] += ` # ${frequencies.arrayCount} array, ${valueCount +
      frequencies.arrayCount} total`
  } else {
    lines[0] += ` # ${valueCount} total`
  }
  if (unique) {
    lines[0] += ' (UNIQUE)'
  }
  return lines
}

Deno.writeTextFile(
  './contacts/private/frequencies.yml',
  frequencies.array
    .flatMap(freq =>
      displayFrequency(freq).map((line, i) => (i === 0 ? '- ' : '  ') + line)
    )
    .map(line => line + '\n')
    .join('')
)
