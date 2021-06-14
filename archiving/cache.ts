import { ensureFile } from 'https://deno.land/std@0.97.0/fs/ensure_file.ts'
import { options, root } from './init.ts'
import { stringToPath } from './utilts.ts'

await ensureFile('./cache/log.txt')
await Deno.writeTextFile('./cache/log.txt', '')
const log = await Deno.open('./cache/log.txt', { append: true })
const encoder = new TextEncoder()

type CacheType = 'json' | 'html'

export async function cachePath (
  path: string,
  type: CacheType = 'json',
): Promise<any> {
  if (path === '') {
    throw new Error('Path is empty.')
  }
  const filePath = `./cache/${stringToPath(path.replace(/^\//, ''), {
    allowSlash: true,
  })}.${type}`
  try {
    const file = await Deno.readTextFile(filePath)
    log
      .write(encoder.encode(`Loading ${path} from cache\n`))
      .catch(console.error)
    return type === 'html' ? file : JSON.parse(file)
  } catch {
    const response = await fetch(root + path, options)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    const json = await (type === 'html' ? response.text() : response.json())
    log.write(encoder.encode(`Saving ${path} to cache\n`)).catch(console.error)
    await ensureFile(filePath)
    await Deno.writeTextFile(
      filePath,
      type === 'html' ? json : JSON.stringify(json, null, '\t'),
    )
    return json
  }
}
