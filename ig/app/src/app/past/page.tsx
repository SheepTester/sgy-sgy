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
      <h1>
        Past free food events at UC San Diego
        <sub style={{ fontSize: '0.3em' }}>TM</sub>
      </h1>
      <p className={styles.description}>
        Page generated {fmt.format(new Date())}.{' '}
        <Link href='/'>See upcoming events.</Link>
      </p>
      <EventList events={events} mode='past' />
    </>
  )
}
