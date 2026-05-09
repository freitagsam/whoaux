// Spotify OAuth scopes — these must also be configured in Clerk Dashboard
// under Configure → SSO Connections → Spotify → Scopes
export const SPOTIFY_SCOPES = [
  "user-top-read",
  "user-library-read",
  "user-read-recently-played",
  "user-read-currently-playing",
  "playlist-read-private",
  "playlist-read-collaborative",
  "user-read-email",
  "user-read-private",
].join(" ");
