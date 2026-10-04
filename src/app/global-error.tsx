"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en-IN">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: 24, textAlign: "center" }}>
        <h1>Something went wrong</h1>
        <p>Please try again. Your data is safe.</p>
        <button onClick={reset} style={{ padding: "12px 20px", marginTop: 12 }}>
          Try again
        </button>
      </body>
    </html>
  );
}
