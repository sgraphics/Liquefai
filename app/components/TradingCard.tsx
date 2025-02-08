"use client";
import { useState } from "react";

export default function TradingCard() {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
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
  );
} 