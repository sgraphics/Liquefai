"use client";
import Image from "next/image";
import { useState, useEffect } from "react";
import TradingCard from "./components/TradingCard";

export default function Home() {
  const [bubbles, setBubbles] = useState<Array<{
    size: number;
    distance: number;
    position: number;
    time: number;
    delay: number;
  }>>([]);
  
  useEffect(() => {
    // Generate bubbles on client side only
    setBubbles(Array.from({ length: 128 }, () => ({
      size: 2 + Math.random() * 4,
      distance: 6 + Math.random() * 4,
      position: -5 + Math.random() * 110,
      time: 2 + Math.random() * 2,
      delay: -1 * (2 + Math.random() * 2)
    })));
  }, []);

  return (
    <main className="min-h-screen bg-[#f5fdff] flex flex-col items-center p-4">
      {/* Footer with goo effect */}
      <footer className="footer">
        <div className="bubbles">
          {bubbles.map((bubble, i) => (
            <div
              key={i}
              className="bubble"
              style={{
                '--size': `${bubble.size}rem`,
                '--distance': `${bubble.distance}rem`,
                '--position': `${bubble.position}%`,
                '--time': `${bubble.time}s`,
                '--delay': `${bubble.delay}s`
              } as React.CSSProperties}
            />
          ))}
        </div>
        {/* Blur overlay - adjusted blur settings */}
        <div className="absolute inset-0 backdrop-blur-xl bg-[#f5fdff]/50" style={{ backdropFilter: 'blur(30px)', display: 'none' }} />
      </footer>

      {/* SVG Filter */}
      <svg style={{ position: 'fixed', top: '100vh' }}>
        <defs>
          <filter id="blob">
            <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9"
              result="blob"
            />
          </filter>
        </defs>
      </svg>

      {/* Main Content - with higher z-index */}
      <div className="relative z-10 w-full flex flex-col items-center">
        {/* Logo */}
        <div className="w-full max-w-7xl">
          <Image
            src="/logo.png"
            alt="Liquefai Logo"
            width={150}
            height={40}
            className="mt-3"
            priority
          />
        </div>

        {/* Slogan - with transition */}
        <div className="text-center mt-20 mb-16">
          <h1 className="text-4xl font-semibold mb-2">
            AI liquidity aggregator
          </h1>
          <p className="text-gray-500 text-lg">
            Making swaps sweeter since Agentic Eth '25
          </p>
        </div>

        <TradingCard />
      </div>
    </main>
  );
}
