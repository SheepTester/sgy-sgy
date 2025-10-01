import styles from '../page.module.css'
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
      <h1 className={styles.heading}>
        Past <em className={styles.title}>Free Food Events</em>{' '}
        <span className={styles.atUcsd}>
          at UC San Diego
          <sub>TM</sub>
        </span>
      </h1>
      <p className={styles.description}>
        Page generated {fmt.format(new Date())}. For now, only the events from
        the past week are visible. <Link href='/'>See upcoming events.</Link>
      </p>
      <EventList events={events} mode='past' />
    </>
  )
}
