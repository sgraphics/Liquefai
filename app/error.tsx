'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="p-8 flex flex-col items-center justify-center">
      <div className="p-4 bg-red-50 rounded-lg max-w-md w-full">
        <h2 className="text-red-800 font-semibold mb-2">Something went wrong!</h2>
        <p className="text-red-600 mb-4">{error.message}</p>
        <button
          onClick={reset}
          className="px-4 py-2 bg-red-100 text-red-800 rounded-md hover:bg-red-200 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
} 