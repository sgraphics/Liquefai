"use client";
import Image from "next/image";
import { useState, useEffect } from "react";

export default function Home() {
  const [isExpanded, setIsExpanded] = useState(false);
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
            className="mt-4"
            priority
          />
        </div>

        {/* Slogan - with transition */}
        <div className={`text-center transition-all duration-300 ease-in-out ${
          isExpanded ? 'opacity-0 scale-90 h-0 mt-0 mb-0 transform' : 'mt-20 mb-16'
        }`}>
          <h1 className="text-4xl font-semibold mb-2">
            AI liquidity aggregator
          </h1>
          <p className="text-gray-500 text-lg">
            Making swaps cheaper since 2025
          </p>
        </div>

        {/* Container for tabs and card - centered */}
        <div className={`card-container w-full max-w-[500px] mx-auto ${
          isExpanded ? 'expanded' : ''
        }`}>
          {/* Tabs as pills */}
          <div className="flex gap-2 mb-4 px-2">
            <button className="px-6 py-2 rounded-full bg-white font-semibold text-black shadow-sm">
              Trade
            </button>
            <button className="px-6 py-2 rounded-full font-semibold text-gray-400">
              Mint
            </button>
          </div>

          {/* Main Card */}
          <div className="main-card w-full bg-white rounded-3xl p-6 shadow-sm">
            {/* Examples - fade out when expanded */}
            <div className={`mb-4 transition-all duration-300 ${
              isExpanded ? 'opacity-0 h-0 overflow-hidden' : 'opacity-100 h-auto'
            }`}>
              <p className="text-gray-500 mb-2">Examples:</p>
              <p className="text-gray-500">Find cheapest trade for ETH to BNB</p>
              <p className="text-gray-500">Split 10 ETH into 5 tokens</p>
              <p className="text-gray-500">Whats the cheapest pool for trading ETH</p>
            </div>

            {/* Chat Area - fade in when expanded */}
            <div className={`overflow-y-auto mb-4 transition-all duration-300 ${
              isExpanded ? 'opacity-100 flex-grow h-[calc(100%-180px)]' : 'opacity-0 h-0 overflow-hidden'
            }`}>
              {/* Chat messages will go here */}
            </div>

            {/* Input Area - fixed height */}
            <div className={`transition-all duration-300 ${
              isExpanded ? 'mt-auto' : ''
            }`}>
              <textarea 
                className="w-full h-32 border rounded-xl p-4 mb-4 resize-none focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all duration-300"
                placeholder="Enter your trading request..."
              />

              <button 
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full bg-[#d3ffff] text-[#00bcff] font-semibold py-4 rounded-2xl hover:opacity-90 transition-opacity"
              >
                {isExpanded ? 'Close' : 'Get started'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
