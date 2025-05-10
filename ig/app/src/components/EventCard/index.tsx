import { Fragment } from 'react'
import { Event, EventObject } from '../Event'
import styles from './styles.module.css'

export type EventCardProps = {
  events: EventObject[]
  now: { now: number; today: number }
}
export function EventCard ({ events, now }: EventCardProps) {
  return (
    <div className={styles.card}>
      {events.map((event, i) => (
        <Fragment key={event.mongoDbId}>
          {i > 0 ? <hr className={styles.line} /> : null}
          <Event event={event} now={now} />
        </Fragment>
      ))}
    </div>
  )
}
