import styles from './page.module.css'
import Link from 'next/link'

export default async function Home() {
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
        I've moved to{' '}
        <Link href='https://sheeptester.github.io/ucsd-free-food/'>
          a new site
        </Link>
        !
      </p>
    </>
  )
}
