"use client";
import { useState } from "react";
import { getChatResponse } from "../actions/chat";

// Define message type
interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function TradingCard() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!inputValue.trim()) return;

    setError(null);
    const userMessage: Message = {
      role: 'user',
      content: inputValue,
    };
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await getChatResponse(
        inputValue, 
        messages.map(msg => ({
          role: msg.role,
          content: msg.content,
        }))
      );

      if (!response.success) {
        throw new Error(response.error || 'Failed to get response');
      }

      if (response.data?.output) {
        const assistantMessage: Message = {
          role: 'assistant',
          content: response.data.output,
        };
        setMessages(prev => [...prev, assistantMessage]);
      }
    } catch (error) {
      console.error('Error:', error);
      setError(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExpandAndSubmit = async () => {
    setIsExpanded(true);
    if (inputValue.trim()) {
      await handleSubmit();
    }
  };

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
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4">
              {error}
              <button 
                onClick={() => setError(null)}
                className="ml-2 text-red-800 hover:underline"
              >
                Dismiss
              </button>
            </div>
          )}
          {messages.map((message, index) => (
            <div
              key={index}
              className={`mb-4 p-3 rounded-lg ${
                message.role === 'user'
                  ? 'bg-blue-50 ml-auto max-w-[80%]'
                  : 'bg-gray-50 mr-auto max-w-[80%]'
              }`}
            >
              {message.content}
            </div>
          ))}
          {isLoading && (
            <div className="text-gray-500 italic">AI is thinking...</div>
          )}
        </div>

        {/* Input Area - fixed height */}
        <div className={`transition-all duration-300 ${
          isExpanded ? 'mt-auto' : ''
        }`}>
          <textarea 
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            className="w-full h-32 border rounded-xl p-4 mb-4 resize-none focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all duration-300"
            placeholder="Enter your trading request..."
          />

          <button 
            onClick={() => {
              if (isExpanded) {
                handleSubmit();
              } else {
                handleExpandAndSubmit();
              }
            }}
            className="w-full bg-[#d3ffff] text-[#00bcff] font-semibold py-4 rounded-2xl hover:opacity-90 transition-opacity"
          >
            {isExpanded ? (isLoading ? 'Sending...' : 'Send') : 'Get started'}
          </button>
        </div>
      </div>
    </div>
  );
} 