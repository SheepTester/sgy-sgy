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
      <h1 className={styles.heading}>
        Upcoming <em className={styles.title}>Free Food Events</em>{' '}
        <span className={styles.atUcsd}>
          at UC San Diego
          <sub>TM</sub>
        </span>
      </h1>
      <p className={styles.description}>
        Every day, I scroll through posts and stories posted by UCSD orgs on
        Instagram. I scan them with an LLM to get event information, but it's
        wrong like more than half the time (a.k.a. correct some of the time :D),
        so{' '}
        <Link href='https://github.com/SheepTester/sgy-sgy/issues'>
          prompt engineering ideas
        </Link>{' '}
        would be appreciated. If you don't trust AI (which is fair), I also have
        an{' '}
        <Link href='https://sheep.thingkingland.app/as-finance/'>
          <strong>alternate list of free food</strong>
        </Link>{' '}
        that clubs are ordering using your tuition, pulled directly from
        Associated Students. Let's get your tuition's worth!
      </p>
      <p className={styles.description}>
        Message{' '}
        <Link href='https://www.instagram.com/eventcollatorucsd/'>
          @eventcollatorucsd
        </Link>{' '}
        if I'm missing any events. Check out the code on{' '}
        <Link href='https://github.com/SheepTester/sgy-sgy/tree/master/ig'>
          GitHub
        </Link>
        . Made by Chaitya and{' '}
        <Link href='https://sheeptester.github.io/'>Sean</Link>. Page generated{' '}
        {fmt.format(new Date())}. <Link href='/past'>See past events.</Link>
      </p>
      <EventList events={events} mode='upcoming' />
    </>
  )
}
