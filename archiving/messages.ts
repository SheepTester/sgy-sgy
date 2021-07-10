import { ensureDir } from 'https://deno.land/std@0.97.0/fs/ensure_dir.ts'
import { cachePath } from './cache.ts'
import * as html from './html-maker.ts'
import { root } from './init.ts'
import { me } from './me.ts'
import {
  expect,
  asyncMap,
  parseHtml,
  shouldBeElement,
  stringToPath,
} from './utilts.ts'

type Message = {
  'author_id': number
  id: number
  'last_updated': number
  /** Actually null when fetching a list of messages */
  message: string
  'message_status': 'unread' | 'read'
  mid: null
  'recipient_ids': string
  subject: string
}

/** From /v1/messages/[inbox|sent] */
type MessageListResponse = {
  links: {
    next?: string
    self: string
  }
  messages: Message[]
}

/** From /v1/messages/[inbox|sent]/<id> */
type MessageResponse = {
  /** A thread of messages */
  message: Message[]
}

export async function getMessages (type: 'inbox' | 'sent'): Promise<Message[][]> {
  const messageIds: number[] = []
  let response: MessageListResponse
  let index = 0
  do {
    response = await cachePath(`/v1/messages/${type}?start=${index}&limit=200`)
    messageIds.push(...response.messages.map(message => message.id))
    index += 200
  } while (response.links.next)
  const messages = []
  for (const id of messageIds) {
    const response: MessageResponse = await cachePath(`/v1/messages/${type}/${id}`)
    const { message } = response
    messages.push(message)
  }
  return messages
}

const outPath = `./output/courses/messages/`
await ensureDir(outPath)

for (const type of ['inbox', 'sent'] as const) {
  const messages = await getMessages(type)
}
