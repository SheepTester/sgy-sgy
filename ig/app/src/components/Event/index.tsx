import Link from 'next/link';
import styles from './styles.module.css'
import Image from 'next/image';


export type EventObject = {
  id: string
  url: string | null
  freeStuff: string[];
  location: string
  /** UTC time */
  start: Date
  /** UTC time */
  end: Date|null
  imageUrl: string|null;
  /** PT */
      postTimestamp: Date|null;
      caption: string;
}

/** 1 hour */
export const DEFAULT_EVENT_LENGTH = 1 * 60 * 60 * 10000

const fmt = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  dateStyle: 'long',
  timeStyle: 'short'
})

export type EventProps = {
  event: EventObject
  now: {now:number,today: number}
}
export function Event ({event, now}: EventProps) {
  const text = <><span className={styles.faded}>Free</span> {event.freeStuff.join(', ')}</>
  const image = event.imageUrl ? <Image src={event.imageUrl} alt={`preview of Instagram source image`} loading='lazy'  className={`${styles.image} ${styles.imgLocator}`} width={80} height={100} /> : <div  className={`${styles.image} ${styles.imgLocator}`} >{event.url ? 'View source' : ''}</div>
  return <article className={styles.event}>
    <h3 className={styles.title}>{event.url ? <Link href={event.url}>
    {text}</Link> : text}</h3>
    <span className={styles.timeIcon}>📅</span><p className={styles.time}>{event.end ? fmt.formatRange(event.start,event.end) : fmt.format(event.start)}</p>
    <span className={styles.locationIcon}>📍</span><p className={styles.location}>{event.location || '(unknown location)'}</p>
    {event.url ? <Link href={event.url} className={styles.imgLocator}>
    {image}</Link> : image}
  </article>
}