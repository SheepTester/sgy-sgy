'use client'

import { Fragment, useEffect, useState } from 'react'
import { DEFAULT_EVENT_LENGTH, EventObject } from '../Event'
import styles from './styles.module.css'
import { EventCard } from '../EventCard'

const fmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Los_Angeles',
  dateStyle: 'short',
  timeStyle: 'medium',
  hour12: false
})
function getNow (): { now: number; today: number } {
  const [date, time] = fmt.format(new Date()).split(', ')
  const [y, mo, d] = date.split('-').map(Number)
  const [h, m, s] = time.split(':').map(Number)
  return { now: Date.UTC(y, mo - 1, d, h, m, s), today: Date.UTC(y, mo - 1, d) }
}

const fmtDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'UTC',
  dateStyle: 'full'
})

/**
 * among events referencing the same post, see what time is most common. if
 * there's a tie, default to most recent
 */
function getMostCommonDate (events: EventObject[]): {
  start: Date
  end: Date | null
} {
  return Array.from(
    Map.groupBy(
      events,
      event => `${event.start.getTime()}-${event.end?.getTime()}`
    ).values()
  ).sort(
    (a, b) =>
      b.length - a.length ||
      Math.max(...b.map(event => event.postTimestamp?.getTime() ?? 0)) -
        Math.max(...a.map(event => event.postTimestamp?.getTime() ?? 0))
  )[0][0]
}

export type EventListProps = {
  events: EventObject[]
}
export function EventList ({ events }: EventListProps) {
  const [now, setNow] = useState(getNow)

  console.log('now is', new Date(now.now).toISOString())
  useEffect(() => {
    setNow(getNow())
  }, [])

  const map = (events: EventObject[]) =>
    Array.from(
      Map.groupBy(events, event =>
        Date.UTC(
          event.start.getUTCFullYear(),
          event.start.getUTCMonth(),
          event.start.getUTCDate()
        )
      ),
      ([date, events]) => (
        <Fragment key={date}>
          <h3 className={styles.date}>{fmtDate.format(new Date(date))}</h3>
          {Array.from(
            Map.groupBy(events, event => event.url),
            ([url, events]) =>
              url !== null
                ? [
                  {
                    uuid: `url:${url}`,
                    events,
                    time: getMostCommonDate(events)
                  }
                ]
                : events.map(event => ({
                  uuid: `id:${event.mongoDbId}`,
                  events: [event],
                  time: event
                }))
          )
            .flat()
            .sort(
              (a, b) =>
                a.time.start.getTime() - b.time.start.getTime() ||
                (a.time.end?.getTime() ?? 0) - (b.time.end?.getTime() ?? 0)
            )
            .map(({ uuid, events }) => (
              <EventCard events={events} now={now} key={uuid} />
            ))}
        </Fragment>
      )
    )

  return (
    <>
      <h2 id='upcoming'>Upcoming events</h2>
      <div className={styles.list}>
        {map(
          events.filter(
            event =>
              (event.end
                ? event.end?.getTime()
                : event.start.getTime() + DEFAULT_EVENT_LENGTH) > now.now
          )
        )}
      </div>
      <h2 id='past'>Past events</h2>
      <div className={styles.list}>
        {map(
          events.filter(
            event =>
              (event.end
                ? event.end?.getTime()
                : event.start.getTime() + DEFAULT_EVENT_LENGTH) <= now.now
          )
        ).reverse()}
      </div>
    </>
  )
}
