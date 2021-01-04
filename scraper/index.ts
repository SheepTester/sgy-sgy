/// deno run --allow-read=./ --allow-write=./private/ --allow-env --allow-net index.ts

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

function wait (time: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, time))
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
    throw new Error(`${response.status} (${response.url}): ${await response.text()}`)
  }
  console.log(request)
  return await response.json()
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
    const data = await get(location)
    if (type === 'folder') {
      const subpath = path + id + '/'
      await ensureDir(subpath)
      await Deno.writeTextFile(subpath + 'README.md', `# ${title}\n`)
      await Deno.writeTextFile(subpath + 'items.json', JSON.stringify(data, null, '\t'))
      await getFolder(sectionId, data['folder-item'], subpath)
    } else {
      await Deno.writeTextFile(path + id + '.json', JSON.stringify(data, null, '\t'))
      if (type === 'discussion') {
        // Docs say it's paged but it doesn't seem to care about ?start and
        // &limit so I'm assuming it's not actually paged.
        const comments = await get(location + '/comments')
        await Deno.writeTextFile(path + id + '_comments.json', JSON.stringify(comments, null, '\t'))
      }
      if ('grade_item_id' in data) {
        const submissions = await get(`/v1/sections/${sectionId}/submissions/${data.grade_item_id}?with_attachments=1&all_revisions=1`)
        await Deno.writeTextFile(path + id + '_submissions.json', JSON.stringify(submissions, null, '\t'))
      }
    }
  }
}

await ensureDir('./private/')

const grades = await get(`/users/${userId}/grades`)
await Deno.writeTextFile('./private/grades.json', JSON.stringify(grades, null, '\t'))

const sections = await get(`/users/${userId}/sections`)
await Deno.writeTextFile('./private/sections.json', JSON.stringify(sections, null, '\t'))

await ensureDir('./private/courses/')
for (const { id, course_title, section_title } of sections.section) {
  await ensureDir(`./private/courses/${id}/`)

  const folder = await get(`/courses/${id}/folder/0`)
  await Deno.writeTextFile(`./private/courses/${id}/README.md`, `# ${course_title} ${section_title}\n`)
  await Deno.writeTextFile(`./private/courses/${id}/items.json`, JSON.stringify(folder, null, '\t'))

  // idk what the actual limit of limit is, but it's probably at least 100, and
  // probably all my classes've posted less than 100 updates
  const updates = await get(`/v1/sections/${id}/updates?with_attachments=1&limit=1000`)
  await Deno.writeTextFile(`./private/courses/${id}/updates.json`, JSON.stringify(updates, null, '\t'))

  await getFolder(id, folder['folder-item'], `./private/courses/${id}/`)

  break // TEMP
}
