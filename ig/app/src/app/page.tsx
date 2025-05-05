import Image from 'next/image'
import styles from './page.module.css'
import { eventsPromise } from '@/lib/eventsDb'
import { EventObject } from '@/components/Event'
import { EventList } from '@/components/EventList'
import Link from 'next/link'

/** cache for 5 min */
export const revalidate = 300

export default async function Home () {
  const db = await eventsPromise
  const rawEvents = await db.find({ result: true }).toArray()
  const events = rawEvents.flatMap((event): EventObject[] => {
    if (!event.result) {
      return []
    }
    return [
      {
        id: event._id.toString(),
        url: event.url,
        freeStuff: event.freeFood.map(item => item.replace(/^free\s+/i, '')),
        location: event.location,
        start: new Date(
          Date.UTC(
            event.date.year,
            event.date.month - 1,
            event.date.date,
            event.start.hour,
            event.start.minute
          )
        ),
        end: event.end
          ? new Date(
            Date.UTC(
              event.date.year,
              event.date.month - 1,
              event.date.date,
              event.end.hour,
              event.end.minute
            )
          )
          : null,
        imageUrl: event.previewData
          ? `data:image/webp;base64,${event.previewData}`
          : null,
        postTimestamp: event.postTimestamp ?? null,
        caption: event.caption ?? ''
      }
    ]
  })
  events.sort((a, b) => a.start.getTime() - b.start.getTime())

  return (
    <>
      <h1>
        Free food events at UC San Diego
        <sub style={{ fontSize: '0.3em' }}>TM</sub>
      </h1>
      <p className={styles.description}>
        Event posts were scanned with{' '}
        <Link href='https://github.com/SheepTester/sgy-sgy/blob/master/ig/scraper/scraper.ts#L229'>
          Google Gemini
        </Link>
        , which isn't perfect. Prompt engineering{' '}
        <Link href='https://github.com/SheepTester/sgy-sgy/issues'>
          improvements
        </Link>{' '}
        would be appreciated. Made by Sean and Chaitya.
      </p>
      <EventList events={events} />
    </>
  )
}
