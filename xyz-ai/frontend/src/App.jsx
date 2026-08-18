export default function App() {
  return (
    <main className="chat-shell">
      <h1>XYZ AI</h1>
      <p>Connected to XYZ AI</p>
      <section aria-label="Empty chat shell">
        <div className="messages" />
        <input aria-label="Chat message" disabled placeholder="Chat will be available in a later phase" />
        <button type="button" disabled>Send</button>
      </section>
    </main>
  );
}
