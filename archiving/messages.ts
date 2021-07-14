// deno-lint-ignore-file camelcase

import { ensureDir } from 'https://deno.land/std@0.97.0/fs/ensure_dir.ts'
import { cachePath } from './cache.ts'
import * as html from './html-maker.ts'
import { expect, parseHtml, shouldBeElement } from './utilts.ts'

type Message = {
  author_id: number
  id: number
  last_updated: number
  /** Actually null when fetching a list of messages */
  message: string
  message_status: 'unread' | 'read'
  mid: null
  recipient_ids: string
  subject: string
}

/** From /v1/messages/[inbox|sent] */
type MessageListResponse = {
  links: {
    next?: string
    self: string
  }
  message: Message[]
}

type ThreadMessage = {
  name: string
  pfp: string
  date: string
  messageHtml: string
}

type Thread = {
  subject: string
  messages: ThreadMessage[]
}

export async function getMessages (type: 'inbox' | 'sent'): Promise<Thread[]> {
  const messageIds: number[] = []
  let response: MessageListResponse
  let index = 0
  do {
    response = await cachePath(`/v1/messages/${type}?start=${index}&limit=200`)
    messageIds.push(...response.message.map(({ id }) => id))
    index += 200
  } while (response.links.next)
  const threads: Thread[] = []
  for (const id of new Set(messageIds)) {
    const messagePage = await cachePath(`/messages/view/${id}`, 'html').then(
      parseHtml,
    )
    const subject = expect(messagePage.querySelector('.message-title h2'))
      .textContent
    const messages: ThreadMessage[] = []
    for (const messageBoxNode of messagePage.querySelectorAll(
      '.s_message_box',
    )) {
      const messageBox = shouldBeElement(messageBoxNode)
      const name = expect(messageBox.querySelector('.name a')).textContent
      const pfp = expect(
        expect(messageBox.querySelector('.profile-picture img')).getAttribute(
          'src',
        ),
      )
      const date = expect(messageBox.querySelector('.name span')).textContent
      const messageParagraph = expect(
        messageBox.querySelector('.message-body p'),
      )
      for (const linkNode of messageParagraph.querySelectorAll('a')) {
        const link = shouldBeElement(linkNode)
        if (!link.getAttribute('href')?.startsWith('mailto:')) {
          link.textContent = link.getAttribute('href') ?? ''
        }
      }
      const message = messageParagraph.innerHTML
      messages.push({
        name,
        pfp,
        date,
        messageHtml: message,
      })
    }
    threads.push({
      subject,
      messages,
    })
  }
  return threads
}

const outPath = `./output/messages/`
await ensureDir(outPath)

for (const type of ['inbox', 'sent'] as const) {
  const messages = await getMessages(type)
  await Deno.writeTextFile(
    `${outPath}/${type}.html`,
    html.body(
      html.h1(type),
      messages.map(({ subject, messages }) =>
        html.div(
          html.h2(subject),
          messages.map(({ name, pfp, date, messageHtml }) =>
            html.div(
              html.h3(
                { style: { display: 'flex', 'align-items': 'center' } },
                html.img({
                  style: {
                    height: '45px',
                    'margin-right': '10px',
                  },
                  src: pfp,
                }),
                name,
                ' ',
                html.em({ style: { color: 'grey' } }, date),
              ),
              html.p(html.raw(messageHtml)),
            ),
          ),
        ),
      ),
    ).html,
  )
}
