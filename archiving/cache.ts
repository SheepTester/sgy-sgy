// deno-lint-ignore-file no-explicit-any
import { ensureFile } from 'https://deno.land/std@0.97.0/fs/ensure_file.ts'
import * as oauth from 'https://raw.githubusercontent.com/snsinfu/deno-oauth-1.0a/42155ce5fcefc89265353c579d07229cb3acddc9/mod.ts'
import { options, root } from './init.ts'
import { stringToPath, delay } from './utilts.ts'

await ensureFile('./cache/log.txt')
await Deno.writeTextFile('./cache/log.txt', '')
const log = await Deno.open('./cache/log.txt', { append: true })
const encoder = new TextEncoder()

type CacheResult = {
  json: any
  html: string
  file: Uint8Array
}
type CacheType = keyof CacheResult

function getFilePath (path: string, extension = ''): string {
  return `./cache/${stringToPath(path.replace(/^\//, ''), {
    allowSlash: true,
  })}${extension ? '.' + extension : ''}`
}

export class Http403 extends Error {
  name = this.constructor.name
}

type CacheOptions = {
  /**
   * Whether to cache the 403 error and throw a `Http403` error on encountering
   * a 403 HTTP error.
   */
  allow403?: boolean

  /**
   * Whether to reattempt the request after a while if Schoology ratelimits you.
   * You should leave this as default (true).
   */
  retry?: boolean

  /**
   * The path to store the cached result in.
   */
  cachePath?: string
}

export async function cachePath<T extends CacheType = 'json'> (
  path: string,
  type?: T,
  {
    allow403 = false,
    retry = true,
    cachePath: filePath = getFilePath(
      path,
      type === 'file' ? '' : type || 'json',
    ),
  }: CacheOptions = {},
): Promise<CacheResult[T]> {
  if (path === '') {
    throw new Error('Path is empty.')
  }
  try {
    if (type === 'file') {
      const file = await Deno.readFile(filePath)
      log
        .write(encoder.encode(`Loaded ${path} from cache\n`))
        .catch(console.error)
      return file
    } else {
      const file = await Deno.readTextFile(filePath)
      if (allow403 && (file === '403' || file === '403\n')) {
        throw new Http403('HTTP 403 error')
      }
      log
        .write(encoder.encode(`Loaded ${path} from cache\n`))
        .catch(console.error)
      return type === 'html' ? file : JSON.parse(file)
    }
  } catch {
    log.write(encoder.encode(`Saving ${path} to cache\n`)).catch(console.error)
    const response = await fetch(root + path, options)
    // When the SESS cookie is invalid, it redirects to id.pausd.org
    if (
      !response.url.startsWith(root) &&
      !new URL(response.url).hostname.endsWith('schoology.com')
    ) {
      throw new Error(
        `${path} redirected to ${response.url}, which is outside the Schoology domain.`,
      )
    }
    if (!response.ok) {
      if (response.status === 403 && allow403) {
        await ensureFile(filePath)
        await Deno.writeTextFile(filePath, '403\n')
        throw new Http403('HTTP 403 error')
      } else if (response.status === 429 && retry) {
        // Too many requests, try again after some time
        log
          .write(
            encoder.encode(
              `Received 429 error; waiting 5 seconds before retrying\n`,
            ),
          )
          .catch(console.error)
        await delay(5000)
        return cachePath(path, type, {
          allow403,
          retry: false,
          cachePath: filePath,
        })
      }
      throw new Error(
        `HTTP ${response.status} for ${response.url}: ${await response.text()}`,
      )
    }
    await ensureFile(filePath)
    if (type === 'file') {
      const bytes = new Uint8Array(await response.arrayBuffer())
      await Deno.writeFile(filePath, bytes)
      return bytes
    } else {
      const json = await (type === 'html' ? response.text() : response.json())
      await Deno.writeTextFile(
        filePath,
        type === 'html' ? json : JSON.stringify(json, null, '\t'),
      )
      return json
    }
  }
}

export function external (url: string): string {
  const params = new URLSearchParams()
  params.set('path', url)
  return `/link?${params}`
}

type MultiGetApiResponse = {
  response: {
    /** URL of request */
    location: string
    response_code: number
    headers?: unknown[] | null
    body?: any
  }[]
}

let oauthClient: Promise<oauth.OAuthClient> | undefined

async function actuallyMultiGet (
  paths: string[],
  target: Map<string, any>,
  allow403 = false,
): Promise<void> {
  if (!oauthClient) {
    oauthClient = Deno.readTextFile(
      new URL('../api-creds.json', import.meta.url),
    )
      .then(JSON.parse)
      .then(
        ({ key, secret }) =>
          new oauth.OAuthClient({
            consumer: { key, secret },
            signature: oauth.HMAC_SHA1,
          }),
      )
  }
  const client = await oauthClient
  const method = 'POST'
  const url = 'https://api.schoology.com/v1/multiget'
  const body = JSON.stringify({ request: paths })
  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: oauth.toAuthHeader(client.sign(method, url, { body })),
    },
    body,
  })
  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status} for ${response.url}: ${await response.text()}`,
    )
  }
  const { response: responses }: MultiGetApiResponse = await response.json()
  for (let i = 0; i < paths.length; i++) {
    const { location, response_code: status, body } = responses[i]
    const path = paths[i]
    const filePath = getFilePath(path, 'json')
    await ensureFile(filePath)
    if (allow403 && status === 403) {
      await Deno.writeTextFile(filePath, '403\n')
      target.set(path, null)
    } else if (Math.floor(status / 100) !== 2) {
      throw new Error(`HTTP ${status} for ${location}: ${body}`)
    } else {
      await Deno.writeTextFile(filePath, JSON.stringify(body, null, '\t'))
      target.set(path, body)
    }
  }
}

// Multi-get is only available on api.schoology.com, annoyingly
export async function multiGet (
  paths: string[],
  { allow403 = false } = {},
): Promise<Map<string, any>> {
  const responses = new Map()
  const needFetch: string[] = []
  for (const path of paths) {
    const filePath = getFilePath(path, 'json')
    try {
      const file = await Deno.readTextFile(filePath)
      if (allow403 && file === '403\n') {
        responses.set(path, null)
      } else {
        responses.set(path, JSON.parse(file))
      }
    } catch {
      needFetch.push(path)
    }
  }
  for (let i = 0; i < needFetch.length; i += 50) {
    // Maximum 50 requests per multi-get
    await actuallyMultiGet(needFetch.slice(i, i + 50), responses, allow403)
  }
  return responses
}

if (import.meta.main) {
  console.log(await multiGet(['/v1/users/2017219']))
}
