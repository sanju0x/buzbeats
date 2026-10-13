export const RADIO_STATIONS = [
  { id: "spotify-lofi", name: "lofi beats", country: "Global", region: "International", language: "Instrumental", genre: "Lo-fi / Study", streamUrl: "https://open.spotify.com/playlist/37i9dQZF1DWWQRwui0ExPn", sourceType: "playlist", tags: ["lofi", "lo-fi", "study", "beats", "chill", "focus", "spotify"] },
  { id: "spotify-chill", name: "Chill Hits", country: "Global", region: "International", language: "English", genre: "Chill Pop", streamUrl: "https://open.spotify.com/playlist/37i9dQZF1DX4WYpdgoIcn6", sourceType: "playlist", tags: ["chill", "hits", "pop", "relax", "spotify"] },
  { id: "spotify-desi-hits", name: "Desi Hits", country: "India", region: "India", language: "Hindi / Punjabi / Multi-language", genre: "Desi Hits", streamUrl: "https://open.spotify.com/playlist/37i9dQZF1DWTwzVdyRpXm1", sourceType: "playlist", tags: ["desi", "india", "hindi", "punjabi", "bollywood", "spotify"] },
  { id: "spotify-hot-hits-hindi", name: "Hot Hits Hindi", country: "India", region: "India", language: "Hindi", genre: "Bollywood Hits", streamUrl: "https://open.spotify.com/playlist/37i9dQZF1DX0XUfTFmNBRM", sourceType: "playlist", tags: ["hindi", "bollywood", "hot", "hits", "india", "spotify"] },
  { id: "spotify-malayalam-feel-good", name: "Malayalam Feel Good", country: "India", region: "India", language: "Malayalam", genre: "Feel Good Malayalam", streamUrl: "https://open.spotify.com/playlist/4OInQcL3jqnzYxfcveTN4d", sourceType: "playlist", tags: ["malayalam", "kerala", "feel", "good", "evergreen", "spotify"] },
  { id: "spotify-malayalam-indie", name: "The Sound of Malayalam Indie", country: "India", region: "India", language: "Malayalam", genre: "Malayalam Indie", streamUrl: "https://open.spotify.com/playlist/6CWjQWGgG9iSsMFiXoTcEy", sourceType: "playlist", tags: ["malayalam", "indie", "kerala", "spotify"] },
  { id: "spotify-malayalam-party", name: "Malayalam Party Hits", country: "India", region: "India", language: "Malayalam", genre: "Malayalam Dance", streamUrl: "https://open.spotify.com/playlist/6vfZ0qdHrsmOV1LUiaK7oS", sourceType: "playlist", tags: ["malayalam", "party", "dance", "kerala", "spotify"] },
];

export function selectRadioStation({ stationId, language = "english", mood = "feelgood" } = {}) {
  if (stationId) return RADIO_STATIONS.find((station) => station.id === stationId) || null;
  if (mood === "lofi") return RADIO_STATIONS[0];
  if (language === "malayalam") return RADIO_STATIONS.find((station) => station.id === (mood === "sad" ? "spotify-malayalam-indie" : "spotify-malayalam-feel-good"));
  if (language === "hindi") return RADIO_STATIONS.find((station) => station.id === "spotify-hot-hits-hindi");
  if (language === "english") return RADIO_STATIONS[1];
  return null;
}
