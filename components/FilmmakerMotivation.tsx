'use client';

import { useEffect, useState } from 'react';

const QUOTES = [
  { text: "The most honest form of filmmaking is to make a film for yourself.", author: "Peter Jackson" },
  { text: "Cinema is a mirror by which we often see ourselves.", author: "Martin Scorsese" },
  { text: "A story should have a beginning, a middle and an end, but not necessarily in that order.", author: "Jean-Luc Godard" },
  { text: "Every film should have its own world, a logic and feel to it that expands your reality.", author: "David Fincher" },
  { text: "Film is a battleground. Love, hate, action, violence, death — in one word, emotion.", author: "Samuel Fuller" },
  { text: "The cinema is not a craft. It is an art. It does not mean that the cinema is a luxury though.", author: "François Truffaut" },
  { text: "Film is life with the dull bits cut out.", author: "Alfred Hitchcock" },
  { text: "A film is a petrified fountain of thought.", author: "Jean Cocteau" },
  { text: "Every great film should seem new every time you see it.", author: "Roger Ebert" },
  { text: "You have to dream intensely, persistently, wildly. The cinema needs dreamers.", author: "Akira Kurosawa" },
  { text: "The secret to film is that it's an illusion.", author: "George Lucas" },
  { text: "Movies touch our hearts and awaken our vision, and change the way we see things.", author: "Martin Scorsese" },
  { text: "A film is not about something. It is something.", author: "Jean-Luc Godard" },
  { text: "No matter what happens, I have to keep making films. That is my life.", author: "Hayao Miyazaki" },
  { text: "The editing room is where the film is made the third time — the first in writing, the second in production.", author: "Francis Ford Coppola" },
  { text: "A film is never really good unless the camera is an eye in the head of a poet.", author: "Orson Welles" },
];

export default function FilmmakerMotivation() {
  const [idx,    setIdx]    = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    // Random starting quote
    setIdx(Math.floor(Math.random() * QUOTES.length));
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setIdx(i => (i + 1) % QUOTES.length);
        setFading(false);
      }, 400);
    }, 9000);
    return () => clearInterval(timer);
  }, []);

  const q = QUOTES[idx];

  return (
    <div style={{
      display:      'flex',
      alignItems:   'center',
      gap:          14,
      padding:      '12px 16px',
      borderRadius: 8,
      borderLeft:   '2px solid rgba(191,153,83,0.4)',
      background:   'transparent',
      transition:   'opacity 0.4s ease',
      opacity:      fading ? 0 : 1,
    }}>
      <div style={{ minWidth: 0 }}>
        <p style={{
          fontFamily:   "'Playfair Display', Georgia, serif",
          fontStyle:    'italic',
          fontSize:     13,
          lineHeight:   1.55,
          color:        '#1A1815',
          opacity:      0.75,
          marginBottom: 4,
        }}>
          "{q.text}"
        </p>
        <p style={{
          fontSize:      9,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color:         '#BF9953',
          fontWeight:    600,
        }}>
          — {q.author}
        </p>
      </div>
    </div>
  );
}
