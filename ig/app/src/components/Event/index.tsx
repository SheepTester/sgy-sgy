import Link from 'next/link'
import styles from './styles.module.css'
import Image from 'next/image'

export type EventObject = {
  mongoDbId: string
  postId: string
  url: string | null
  freeStuff: string[]
  location: string
  /** UTC time */
  start: Date
  /** UTC time */
  end: Date | null
  imageUrl: string | null
  /** PT */
  postTimestamp: Date | null
  caption: string
}

/** 1 hour */
export const DEFAULT_EVENT_LENGTH = 1 * 60 * 60 * 1000
/** 1 day in ms */
const DAY_LENGTH = 24 * 60 * 60 * 1000

const fmt = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  dateStyle: 'medium',
  timeStyle: 'short'
})

export type EventProps = {
  event: EventObject
  now: { now: number; today: number }
}
export function Event ({ event, now }: EventProps) {
  const [postType, username, postId] = event.postId.split('/')
  const hoverText = `Source: a ${postType} by @${username}`
  const text = (
    <>
      <span className={styles.faded}>Free</span> {event.freeStuff.join(', ')}
    </>
  )
  const image = event.imageUrl ? (
    <Image
      src={event.imageUrl}
      alt={`preview of Instagram source image`}
      title={hoverText}
      loading='lazy'
      className={`${styles.image} ${styles.imgLocator}`}
      width={80}
      height={100}
    />
  ) : (
    <div className={`${styles.image} ${styles.imgLocator}`} title={hoverText}>
      {event.url ? 'View source' : ''}
    </div>
  )
  const parts = event.end
    ? fmt.formatRangeToParts(event.start, event.end)
    : fmt.formatToParts(event.start)
  const index = parts.findIndex(part => part.type === 'year') + 1
  const isToday =
    now.today <= event.start.getTime() &&
    event.start.getTime() < now.today + DAY_LENGTH
  const end = event.end
    ? event.end.getTime()
    : event.start.getTime() + DEFAULT_EVENT_LENGTH
  return (
    <article className={styles.event}>
      <h3 className={styles.title}>
        {event.url ? <Link href={event.url}>{text}</Link> : text}
      </h3>
      <span className={styles.timeIcon}>📅</span>
      <p className={styles.time}>
        <span className={isToday ? styles.today : ''}>
          {parts
            .slice(0, index)
            .map(part => part.value)
            .join('')}
        </span>
        {parts
          .slice(index)
          .map(part => part.value)
          .join('')}
        &nbsp;
        {event.start.getTime() <= now.now && now.now < end ? (
          <span className={styles.liveIndicator} aria-label='(happening now)' />
        ) : null}
      </p>
      <span className={styles.locationIcon}>📍</span>
      <p className={styles.location}>
        {event.location || '(unknown location)'}
      </p>
      {event.url ? (
        <Link href={event.url} className={styles.imgLocator}>
          {image}
        </Link>
      ) : (
        image
      )}
    </article>
  )
}
