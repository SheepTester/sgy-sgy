import { ensureDir } from 'https://deno.land/std@0.97.0/fs/ensure_dir.ts'
import { options, root } from './init.ts'
import { stringToPath } from './utilts.ts'

await ensureDir('./cache/')

type CacheType = 'json' | 'html'

export async function cachePath (path: string, type: CacheType = 'json'): Promise<any> {
  const filePath = `./cache/${stringToPath(path.replace(/^\//, ''))}.${type}`
  try {
    const file = await Deno.readTextFile(filePath)
    console.log(`Loading ${path} from cache`)
    return type === 'html' ? file : JSON.parse(file)
  } catch {
    const json = await fetch(root + path, options)
      .then(r => type === 'html' ? r.text() : r.json())
    console.log(`Saving ${path} to cache`)
    await Deno.writeTextFile(
      filePath,
      type === 'html' ? json : JSON.stringify(json, null, '\t')
    )
    return json
  }
}
