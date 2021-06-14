import { ensureFile } from 'https://deno.land/std@0.97.0/fs/ensure_file.ts'
import { options, root } from './init.ts'
import { stringToPath } from './utilts.ts'

type CacheType = 'json' | 'html'

export async function cachePath (path: string, type: CacheType = 'json'): Promise<any> {
  if (path === '') {
    throw new Error('Path is empty.')
  }
  const filePath = `./cache/${
    stringToPath(path.replace(/^\//, ''), { allowSlash: true })
  }.${type}`
  try {
    const file = await Deno.readTextFile(filePath)
    console.log(`Loading ${path} from cache`)
    return type === 'html' ? file : JSON.parse(file)
  } catch {
    const response = await fetch(root + path, options)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    const json = await (type === 'html' ? response.text() : response.json())
    console.log(`Saving ${path} to cache`)
    await ensureFile(filePath)
    await Deno.writeTextFile(
      filePath,
      type === 'html' ? json : JSON.stringify(json, null, '\t')
    )
    return json
  }
}
