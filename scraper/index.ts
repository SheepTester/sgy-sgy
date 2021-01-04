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

await ensureDir('./private/')

const identity = <T>(value: T): T => value

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
const host = `https://${HOST}`

interface Response {
  response_code: number
  body: any
}

async function multiGet (requests: string[]): Promise<Response[]> {
  const response = await fetch(host + '/v1/multiget', {
    method: 'POST',
    body: JSON.stringify({
      request: requests,
    }),
    headers,
  })
  const json = await response.json()
  return json.response
}

interface Fulfill {
  resolve: (value: any) => void
  reject: (value: any) => void
}

const requests: [string, Fulfill][] = []
let getting = false
async function flush () {
  const multiget = requests.splice(0, 50)
  if (multiget.length === 0) {
    getting = false
    return
  } else {
    getting = true
  }
  const responses = await multiGet(multiget.map(req => req[0]))
  responses.forEach((response, i) => {
    if (Math.floor(response.response_code / 100) === 2) {
      multiget[i][1].resolve(response.body)
    } else {
      multiget[i][1].reject(JSON.stringify(response, null, 2))
    }
  })
  await flush()
}
function get (request: string): Promise<any> {
  let fulfill!: Fulfill
  const promise: Promise<any> = new Promise((resolve, reject) => {
    fulfill = { resolve, reject }
  })
  requests.push([request, fulfill])
  if (!getting) {
    getting = true
    Promise.resolve().then(() => flush())
  }
  return promise
}

const { section: sections } = await get(`/v1/users/${userId}/sections`)
await Promise.all(sections.map(async ({ course_id }: any) => {
  const items = await get(`/v1/courses/${course_id}/folder/0`).catch(identity)
  console.log(items)
}))
Deno.writeTextFile('./private/sections.json', JSON.stringify(sections, null, '\t'))
// console.log(await fetch(`${host}/v1/users/${userId}/sections`, { headers }).then(r => r.json()))
