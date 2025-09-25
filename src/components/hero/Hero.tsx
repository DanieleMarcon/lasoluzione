'use client';
import { motion, useReducedMotion } from 'framer-motion';

export default function Hero() {
  const reduce = useReducedMotion();
  return (
    <section className="container" aria-labelledby="hero-title" style={{ paddingBlock: '2rem' }}>
      <motion.div
        initial={reduce ? {} : { opacity: 0, y: 16 }}
        animate={reduce ? {} : { opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        <h1 id="hero-title">Caffè, aperitivi ed eventi nel cuore di Milano</h1>
        <p>Scopri il calendario e prenota il tuo tavolo.</p>
        <a className="btn" href="#prenota">Prenota ora</a>
      </motion.div>
      <div style="margin-top:1rem">
        <img src="/images/hero.jpg" alt="Interni del bar" width="1200" height="600" style={{ width:'100%', height:'auto', borderRadius:'12px', border:'1px solid var(--color-border)'}} />
      </div>
    </section>
  );
}
