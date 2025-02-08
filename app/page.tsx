import Image from "next/image";

export default function Home() {
  // Generate bubbles exactly like the example
  const bubbles = Array.from({ length: 128 }, () => ({
    size: 2 + Math.random() * 4,
    distance: 6 + Math.random() * 4,
    position: -5 + Math.random() * 110,
    time: 2 + Math.random() * 2,
    delay: -1 * (2 + Math.random() * 2)
  }));

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
            src={`/logo.png?v=${Date.now()}`}
            alt="Liquefai Logo"
            width={150}
            height={40}
            className="mt-4"
            priority
          />
        </div>

        {/* Slogan */}
        <h1 className="text-4xl font-semibold mt-20 mb-16 text-center">
          AI liquidity aggregator
        </h1>

        {/* Container for tabs and card - centered */}
        <div className="w-full max-w-[500px] mx-auto">
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
          <div className="w-full bg-white rounded-3xl p-6 shadow-sm">
            {/* Examples */}
            <div className="mb-4">
              <p className="text-gray-500 mb-2">Examples:</p>
              <p className="text-gray-500">Find cheapest trade for ETH to BNB</p>
              <p className="text-gray-500">Split 10 ETH into 5 tokens</p>
              <p className="text-gray-500">Whats the cheapest pool for trading ETH</p>
            </div>

            {/* Input Area */}
            <textarea 
              className="w-full h-32 border rounded-xl p-4 mb-4 resize-none focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="Enter your trading request..."
            />

            {/* Get Started Button */}
            <button className="w-full bg-[#d3ffff] text-[#00bcff] font-semibold py-4 rounded-2xl hover:opacity-90 transition-opacity">
              Get started
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
