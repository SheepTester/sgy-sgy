import styles from './page.module.css'
import { EventList } from '@/components/EventList'
import Link from 'next/link'
import { getEvents } from '@/util/getEvents'

/** cache for 5 min */
export const revalidate = 300

const fmt = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Los_Angeles',
  dateStyle: 'long',
  timeStyle: 'long'
})

export default async function Home () {
  const events = await getEvents()

  return (
    <>
      <h1>
        Upcoming free food events at UC San Diego
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
        would be appreciated. Made by Sean and Chaitya. Page generated{' '}
        {fmt.format(new Date())}. <Link href='/past'>See past events.</Link>
      </p>
      <EventList events={events} mode='upcoming' />
    </>
  )
}
