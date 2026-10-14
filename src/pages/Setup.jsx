export default function Setup() {
  return (
    <main className="wrap status">
      <h1>Connect Supabase to start</h1>
      <p>Add these two variables to a <code>.env</code> file (or to your Vercel project settings), then restart the app:</p>
      <pre>{`VITE_SUPABASE_URL=...\nVITE_SUPABASE_ANON_KEY=...`}</pre>
      <p>You can find both under Project Settings, then API, in your Supabase dashboard.</p>
    </main>
  )
}
