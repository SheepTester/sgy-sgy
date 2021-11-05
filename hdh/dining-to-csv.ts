import { MenuResults } from './dining-common.ts'

const locations: Record<string, MenuResults> = {}

for await (const entry of Deno.readDir('./dining/')) {
  if (entry.name.endsWith('.json')) {
    const locationId = entry.name.split('.')[0]
    locations[locationId] = await Deno.readTextFile(
      `./dining/${locationId}.json`
    ).then(JSON.parse)
  }
}

console.log(locations)
