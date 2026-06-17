'use client'

import { useRouter } from 'next/navigation'
import { Playfair_Display, Montserrat } from 'next/font/google'
import styles from './page.module.css'

const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-welcome-serif',
  display: 'swap',
})

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-welcome-sans',
  display: 'swap',
})

export default function WelcomePage() {
  const router = useRouter()

  function choose(role: 'filmmaker' | 'producer') {
    document.cookie = `fyp_role=${role}; path=/; max-age=31536000; SameSite=Lax`
    router.push(role === 'filmmaker' ? '/' : '/producer/register')
  }

  return (
    <main className={`${styles.page} ${playfair.variable} ${montserrat.variable}`}>
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
  )
}
