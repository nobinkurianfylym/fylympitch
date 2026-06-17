'use client'

import { useRouter } from 'next/navigation'
import styles from './page.module.css'

export default function WelcomePage() {
  const router = useRouter()

  function choose(role: 'filmmaker' | 'producer') {
    document.cookie = `fyp_role=${role}; path=/; max-age=31536000; SameSite=Lax`
    router.push(role === 'filmmaker' ? '/' : '/producer/register')
  }

  return (
    <>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500&family=Montserrat:wght@400;500&display=swap"
      />
      <main className={styles.page}>
        <h1 className={styles.headline}>
          Every Great Film<br />
          Starts With The Right<br />
          <span className={styles.gold}>Discovery.</span>
        </h1>

        <div className={styles.rule} />

        <div className={styles.choices}>
          <button className={styles.btn} onClick={() => choose('filmmaker')}>
            I&apos;m a<br />Filmmaker
          </button>
          <button className={styles.btn} onClick={() => choose('producer')}>
            I&apos;m a Producer<br />or Investor
          </button>
        </div>
      </main>
    </>
  )
}
