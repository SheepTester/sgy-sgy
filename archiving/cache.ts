import { ensureDir } from 'https://deno.land/std@0.97.0/fs/ensure_dir.ts'
import { options, root } from './init.ts'
import { stringToPath } from './utilts.ts'

await ensureDir('./cache/')

export async function cachePath (path: string): Promise<any> {
  const filePath = './cache/' + stringToPath(path.replace(/^\//, '')) + '.json'
  try {
    const file = await Deno.readTextFile(filePath)
    return JSON.parse(file)
  } catch {
    const json = await fetch(root + path, options).then(r => r.json())
    await Deno.writeTextFile(filePath, JSON.stringify(json, null, '\t'))
    return json
  }
}
