const languageNames = {
  english: "English",
  hindi: "Hindi",
  malayalam: "Malayalam",
  tamil: "Tamil",
};

const moodNames = {
  romantic: "romantic love",
  sad: "slow mellow emotional",
  lofi: "lo-fi chill focus",
  feelgood: "feel-good upbeat",
};

export const YT_MUSIC_PLAYLISTS = [
  { id: "auto", name: "Automatic mix", query: "popular songs" },
  { id: "fresh", name: "Fresh releases", query: "latest new songs" },
  { id: "hits", name: "Top hits", query: "top hits songs" },
  { id: "indie", name: "Indie discovery", query: "indie songs" },
  { id: "acoustic", name: "Acoustic room", query: "acoustic songs" },
  { id: "classics", name: "Evergreen classics", query: "evergreen classic songs" },
];

export function playlistById(id) {
  return YT_MUSIC_PLAYLISTS.find((playlist) => playlist.id === id) || YT_MUSIC_PLAYLISTS[0];
}

export function defaultYtMusicSearch(language = "english", mood = "feelgood", playlistId = "auto", variation = 0) {
  const languageName = languageNames[language] || languageNames.english;
  const moodName = moodNames[mood] || moodNames.feelgood;
  const playlist = playlistById(playlistId);
  const variations = [
    playlist.query,
    `${playlist.query} mix`,
    `${playlist.query} hidden gems`,
    `${playlist.query} listener favorites`,
    `${playlist.query} trending`,
  ];
  const flavor = variations[Math.abs(Number(variation) || 0) % variations.length];
  return `${languageName} ${moodName} ${flavor}`;
}

export function automaticMixName(language = "english", mood = "feelgood", playlistId = "auto") {
  const languageName = languageNames[language] || languageNames.english;
  const moodName = moodNames[mood] || moodNames.feelgood;
  const playlist = playlistById(playlistId);
  return `${languageName} ${moodName} · ${playlist.name}`;
}
