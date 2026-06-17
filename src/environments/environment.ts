// Production environment.
// supabaseUrl + supabaseAnonKey are safe to expose to the client — the anon
// key only grants what RLS allows (handoff §6). All privileged keys
// (Anthropic, Whisper, TTS) live in Edge Function secrets, never here.
export const environment = {
  production: true,
  supabaseUrl: '__SET_IN_ENV__',
  supabaseAnonKey: '__SET_IN_ENV__',
};
