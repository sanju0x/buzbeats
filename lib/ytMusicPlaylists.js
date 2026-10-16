const languageNames = {
  english: "English",
  hindi: "Hindi",
  malayalam: "Malayalam",
  tamil: "Tamil",
};

const moodNames = {
  romantic: "romantic",
  sad: "slow and mellow",
  lofi: "lo-fi focus",
  feelgood: "feel-good",
};

export const YT_MUSIC_PLAYLISTS = [
  { id: "feel-good", name: "Feel-good mix", query: "feel good songs playlist" },
  { id: "lofi-focus", name: "Lo-fi focus", query: "lofi beats study playlist" },
  { id: "coffeehouse", name: "Coffeehouse", query: "acoustic coffeehouse playlist" },
  { id: "romantic", name: "Romantic mix", query: "romantic songs playlist" },
  { id: "slow-mellow", name: "Slow & mellow", query: "slow mellow songs playlist" },
  { id: "desi-hits", name: "Desi hits", query: "latest desi hits playlist" },
];

export function defaultYtMusicSearch(language = "english", mood = "feelgood") {
  const languageName = languageNames[language] || "English";
  const moodName = moodNames[mood] || "feel-good";
  return `${languageName} ${moodName} songs playlist`;
}

export function playlistById(id) {
  return YT_MUSIC_PLAYLISTS.find((playlist) => playlist.id === id) || null;
}
