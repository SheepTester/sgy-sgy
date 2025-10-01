'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
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
 * among events referencing the same post, see what value is most common. if
 * there's a tie, default to most recently posted
 */
function getMostCommonValue (
  events: EventObject[],
  key: (event: EventObject) => string | number,
  ifEmpty?: EventObject
): EventObject {
  if (ifEmpty && events.length === 0) {
    return ifEmpty
  }
  return Array.from(Map.groupBy(events, key).values()).sort(
    (a, b) =>
      b.length - a.length ||
      Math.max(...b.map(event => event.postTimestamp?.getTime() ?? 0)) -
        Math.max(...a.map(event => event.postTimestamp?.getTime() ?? 0))
  )[0][0]
}

/**
 * among events with the same referenced post (`url`), get a consensus. assumes
 * events is already sorted most recently posted first
 */
function getConsensus (events: EventObject[]): EventObject {
  const allFreeStuff = new Map<string, string>()
  for (const { freeStuff } of events) {
    for (const item of freeStuff) {
      if (!allFreeStuff.has(item.toLowerCase())) {
        allFreeStuff.set(item.toLowerCase(), item)
      }
    }
  }
  const { start, end } = getMostCommonValue(
    events,
    event => `${event.start.getTime()}-${event.end?.getTime()}`
  )
  const { location } = getMostCommonValue(
    events.filter(event => event.location),
    event => event.location,
    events[0]
  )
  const { postTimestamp, referencedUrl } = events[events.length - 1]
  return {
    mongoDbId: `url:${referencedUrl}`,
    freeStuff: Array.from(allFreeStuff.values()),
    start,
    end,
    location,
    // use oldest image, which might be the post if available
    imageUrl: events.findLast(event => event.imageUrl)?.imageUrl ?? null,
    // link to latest post, or latest story if no posts
    postId:
      events.find(event => event.postId.startsWith('post/'))?.postId ??
      events[0].postId,
    // values not important
    referencedUrl,
    postTimestamp,
    caption: ''
  }
}

/**
 * - partitions and sorts by date, earliest first
 * - for each date, partitions by referenced post, and sorts by (consensus) time
 * - for each referenced post, sorts stories by post time
 */
function organizeEvents (events: EventObject[]): {
  date: number
  events: { consensus: EventObject; events: EventObject[] }[]
}[] {
  return Array.from(
    Map.groupBy(events, event =>
      Date.UTC(
        event.start.getUTCFullYear(),
        event.start.getUTCMonth(),
        event.start.getUTCDate()
      )
    ),
    ([date, events]) => ({
      date,
      events: Array.from(
        Map.groupBy(events, event => event.referencedUrl),
        ([url, events]) =>
          url !== null && events.length > 1
            ? [
              {
                // sort events first; `getConsensus` kind of relies on this behavior
                events: events.sort(
                  (a, b) =>
                    (b.postTimestamp?.getTime() ?? 0) -
                    (a.postTimestamp?.getTime() ?? 0)
                ),
                consensus: getConsensus(events)
              }
            ]
            : events.map(event => ({
              consensus: { ...event, mongoDbId: `id:${event.mongoDbId}` },
              events: [event]
            }))
      )
        .flat()
        .sort(
          (a, b) =>
            a.consensus.start.getTime() - b.consensus.start.getTime() ||
            (a.consensus.end?.getTime() ?? 0) -
              (b.consensus.end?.getTime() ?? 0)
        )
    })
  ).sort((a, b) => a.date - b.date)
}

export type EventListProps = {
  events: EventObject[]
  mode: 'upcoming' | 'past'
}
export function EventList ({ events, mode }: EventListProps) {
  const [now, setNow] = useState(getNow)

  console.log('now is', new Date(now.now).toISOString())
  useEffect(() => {
    setNow(getNow())
  }, [])

  const days = useMemo(() => {
    const days = organizeEvents(
      events.filter(
        mode === 'upcoming'
          ? event =>
            (event.end
              ? event.end?.getTime()
              : event.start.getTime() + DEFAULT_EVENT_LENGTH) > now.now
          : event =>
            (event.end
              ? event.end?.getTime()
              : event.start.getTime() + DEFAULT_EVENT_LENGTH) <= now.now
      )
    )
    return mode === 'past' ? days.toReversed().slice(0, 7) : days
  }, [now.now, mode])

  return (
    <div className={styles.list}>
      {days.map(({ date, events }) => (
        <Fragment key={date}>
          <h3 className={styles.date}>{fmtDate.format(new Date(date))}</h3>
          {events.map(({ consensus, events }) => (
            <EventCard
              consensus={consensus}
              events={events}
              now={now}
              key={consensus.mongoDbId}
            />
          ))}
        </Fragment>
      ))}
    </div>
  )
}
