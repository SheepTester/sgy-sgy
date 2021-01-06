/// deno run --allow-read=./ --allow-write=./private/ --allow-env --allow-net index.ts --help

/*
In .env:
`HOST=${window.location.hostname}
UID=${Drupal.settings.s_common.user.uid}
CSRF_KEY=${Drupal.settings.s_common.csrf_key}
CSRF_TOKEN=${Drupal.settings.s_common.csrf_token}
SESS_ID=`
*/

import { config } from 'https://deno.land/x/dotenv/mod.ts'
import { Md5 } from 'https://deno.land/std@0.83.0/hash/md5.ts'
import { ensureDir } from 'https://deno.land/std@0.83.0/fs/ensure_dir.ts'
import { parse } from 'https://deno.land/std@0.83.0/flags/mod.ts'

const {
  help,
  'hard-refresh': hardRefresh,
} = parse(Deno.args, {
  boolean: [
    'hard-refresh',
    'help',
  ],
  alias: {
    h: 'help',
  },
})

if (help) {
  console.log('deno run --allow-read=./ --allow-write=./private/ --allow-env --allow-net index.ts [options]')
  console.log('Options:')
  console.log('--help (-h)\n\tShow help.')
  console.log('--hard-refresh\n\tForce reload everything from Schoology, even if the files already exist.')
  Deno.exit(0)
}

function wait (time: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, time))
}

class FetchError extends Error {
  response: Response
  responseText: string

  constructor (response: Response, responseText: string) {
    const text = responseText.length > 200
      ? responseText.slice(0, 100) + ' [...] ' + responseText.slice(-100)
      : responseText
    super(`${response.status} (${response.url}): ${text}`)
    this.name = this.constructor.name
    this.response = response
    this.responseText = responseText
  }
}

const {
  HOST,
  UID: userId,
  CSRF_KEY: csrfKey,
  CSRF_TOKEN: csrfToken,
  SESS_ID,
} = config({ safe: true })
const headers = {
  'X-Csrf-Key': csrfKey,
  'X-Csrf-Token': csrfToken,
  'Content-Type': 'application/json',
  cookie: `SESS${new Md5().update(HOST).toString()}=${SESS_ID}`,
}
const host = `https://${HOST}/v1`

async function get (request: string, retry: boolean = true): Promise<any> {
  request = request.replace(/^(?:https?:\/\/\w+\.schoology\.com)?\/v1/, '')
  const response = await fetch(host + request, { headers })
  if (!response.ok) {
    if (response.status === 429 && retry) {
      // Too many requests, so take a break
      console.log('Too many requests; retrying in 5 seconds')
      await wait(5000)
      return await get(request, false)
    }
    throw new FetchError(response, await response.text())
  }
  console.log(request)
  return await response.json()
}
async function fetchToFile (path: string, request: string, useFile: boolean = true): Promise<any> {
  if (useFile && !hardRefresh) {
    const file = await Deno.readTextFile(path).catch(() => null)
    if (file !== null) {
      return JSON.parse(file)
    }
  }
  const json = await get(request)
  await Deno.writeTextFile(path, JSON.stringify(json, null, '\t'))
  return json
}

interface FolderItem {
  id: number
  title: string
  type: string
  location: string
}

async function getFolder (
  sectionId: string,
  items: FolderItem[] | undefined,
  path: string,
) {
  if (!items) return
  for (const { id, title, type, location } of items) {
    if (!location) {
      console.warn(`${path}'s ${id} doesn't have a location for some reason.`)
      continue
    }
    const subpath = path + id + '/'
    if (type === 'folder') {
      await ensureDir(subpath)
    }
    const filePath = type === 'folder'
      ? subpath + 'items.json'
      : path + id + '.json'
    const loc = type === 'media-album'
      ? `/sections/${sectionId}/albums/${id}?withcontent=1`
      : location
    const data = await fetchToFile(filePath, loc).catch(err => {
      if (err instanceof FetchError && err.response.status === 403) {
        console.warn(`[!] ${err.response.url} 403'd.`)
        return { error: err.responseText }
      } else {
        return Promise.reject(err)
      }
    })
    if (type === 'folder') {
      await Deno.writeTextFile(subpath + 'README.md', `# ${title}\n`)
      await getFolder(sectionId, data['folder-item'], subpath)
    } else {
      if (type === 'discussion') {
        // Docs say it's paged but it doesn't seem to care about ?start and
        // &limit so I'm assuming it's not actually paged.
        await fetchToFile(path + id + '_comments.json', location + '/comments')
      }
      if ('grade_item_id' in data) {
        await fetchToFile(path + id + '_submissions.json', `/v1/sections/${sectionId}/submissions/${data.grade_item_id}?with_attachments=1&all_revisions=1`)
        await fetchToFile(path + id + '_submission_comments.json', `/v1/sections/${sectionId}/submissions/${data.grade_item_id}/${userId}/comments?limit=100`)
      }
      if (type === 'page') {
        // Docs say it's paged but it doesn't seem to care about ?start and
        // &limit so I'm assuming it's not actually paged.
        await fetchToFile(path + id + '_page.json', location.replace('page', 'pages') + '?withcontent=1&with_attachments=TRUE')
      }
    }
  }
}

await ensureDir('./private/')

await fetchToFile('./private/grades.json', `/users/${userId}/grades`)

const { section: sections } = await fetchToFile('./private/sections.json', `/users/${userId}/sections`)

await ensureDir('./private/courses/')
for (const { id, course_title, section_title } of sections) {
  await ensureDir(`./private/courses/${id}/`)

  const folder = await fetchToFile(`./private/courses/${id}/items.json`, `/courses/${id}/folder/0`)
  await Deno.writeTextFile(`./private/courses/${id}/README.md`, `# ${course_title} ${section_title}\n`)

  // idk what the actual limit of limit is, but it's probably at least 100, and
  // probably all my classes've posted less than 100 updates
  await fetchToFile(`./private/courses/${id}/updates.json`, `/v1/sections/${id}/updates?with_attachments=1&limit=1000`)

  await getFolder(id, folder['folder-item'], `./private/courses/${id}/`)
}
