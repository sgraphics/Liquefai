import Image from "next/image";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f5fdff] flex flex-col items-center p-4">
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

      {/* Container for tabs and card */}
      <div className="w-full max-w-[500px]">
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
    </main>
  );
}
