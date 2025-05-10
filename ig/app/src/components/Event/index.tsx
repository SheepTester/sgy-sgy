import Link from 'next/link'
import styles from './styles.module.css'
import Image from 'next/image'

export type EventObject = {
  mongoDbId: string
  postId: string
  referencedUrl: string | null
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

const fmtPT = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Los_Angeles',
  dateStyle: 'short',
  timeStyle: 'short'
})

export type EventProps = {
  event: EventObject
  consensusInfo?: {
    sources: number
    updateTime: Date | null
  }
  now: { now: number; today: number }
}
export function Event ({ event, consensusInfo, now }: EventProps) {
  const [postType, username, postId] = event.postId.split('/')
  const url =
    postType === 'story'
      ? `https://instagram.com/stories/${username}/${postId}`
      : `https://instagram.com/p/${postId}/`
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
      className={`${styles.image}`}
      width={80}
      height={100}
    />
  ) : (
    <div className={`${styles.image}`} title={hoverText}>
      View source
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
      <div className={styles.rhs}>
        <h3 className={styles.title}>
          {event.referencedUrl ? (
            <Link href={event.referencedUrl} rel='noreferrer'>
              {text}
            </Link>
          ) : (
            text
          )}
        </h3>
        <p className={styles.hasIcon}>
          <span className={styles.icon}>📅</span>
          <span>
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
              <span
                className={styles.liveIndicator}
                aria-label='(happening now)'
              />
            ) : null}
          </span>
        </p>
        <p className={styles.hasIcon}>
          <span className={styles.icon}>📍</span>
          <span>{event.location || '(unknown location)'}</span>
        </p>
        {consensusInfo && consensusInfo.sources > 1 ? (
          <p className={styles.credit}>
            {consensusInfo.updateTime
              ? `Last advertised ${fmtPT.format(consensusInfo.updateTime)}.`
              : 'Scraped before May 4.'}{' '}
            Based on {consensusInfo.sources} sources.
          </p>
        ) : (
          <p className={styles.credit}>
            From a{' '}
            <Link href={url} rel='noreferrer'>
              {postType}
            </Link>{' '}
            by{' '}
            <Link
              href={`https://www.instagram.com/${username}/`}
              rel='noreferrer'
            >
              @{username}
            </Link>
            {consensusInfo?.updateTime
              ? ` on ${fmtPT.format(consensusInfo.updateTime)}`
              : ''}
            .
          </p>
        )}
        {/* {event.caption ? <p>{event.caption}</p> : null} */}
      </div>
      <div className={styles.lhs}>
        {url ? (
          <Link href={url} rel='noreferrer'>
            {image}
          </Link>
        ) : (
          image
        )}
      </div>
    </article>
  )
}
