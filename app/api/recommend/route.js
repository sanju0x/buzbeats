import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { searchTracks } from "@/lib/audiusClient";
import { saveRadioSession } from "@/lib/supabaseServer";

export async function POST(request) {
  const { language = "english", mood = "feelgood", exclude = [] } = await request.json();
  const session = await getServerSession(authOptions);

  const suggestions = fallbackTracksFor(language, mood, exclude);
  const resolved = [];

  for (const suggestion of suggestions) {
    const query = `${suggestion.title} ${suggestion.artist}`;
    try {
      const results = await searchTracks(query);
      const best = results[0];
      if (best) {
        resolved.push({
          ...best,
          requestedTitle: suggestion.title,
          requestedArtist: suggestion.artist,
        });
      }
    } catch (err) {
      console.error(`[recommend] Audius search failed for "${query}":`, err.message);
    }
  }

  if (resolved.length === 0) {
    await persistSession({ session, language, mood, tracks: [], source: "fallback" });
    return NextResponse.json(
      { tracks: [], error: "audius_search_returned_nothing", message: "No Audius streams matched the fallback playlist." },
      { status: 404 }
    );
  }

  const sessionId = await persistSession({
    session,
    language,
    mood,
    tracks: resolved,
    source: "fallback",
  });

  return NextResponse.json({ tracks: resolved, sessionId, source: "fallback" });
}

function fallbackTracksFor(language, mood, exclude) {
  const excluded = new Set(exclude.map((title) => String(title).toLowerCase().trim()).filter(Boolean));
  const languageTracks = FALLBACK_TRACKS[language] || FALLBACK_TRACKS.english;
  const moodTracks = languageTracks[mood] || languageTracks.feelgood || FALLBACK_TRACKS.english.feelgood;
  const filtered = moodTracks.filter((track) => !excluded.has(track.title.toLowerCase()));
  return filtered.length ? filtered : moodTracks;
}

function parseGeminiSuggestions(data) {
  const raw = data?.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("").trim();
  if (!raw) return [];

  const cleaned = raw
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();

  const jsonStart = cleaned.indexOf("[");
  const jsonEnd = cleaned.lastIndexOf("]");
  const jsonText = jsonStart >= 0 && jsonEnd > jsonStart ? cleaned.slice(jsonStart, jsonEnd + 1) : cleaned;
  const parsed = JSON.parse(jsonText);
  const tracks = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.tracks) ? parsed.tracks : [];

  return tracks
    .map((track) => ({
      title: typeof track?.title === "string" ? track.title.trim() : "",
      artist: typeof track?.artist === "string" ? track.artist.trim() : "",
    }))
    .filter((track) => track.title && track.artist);
}

async function persistSession({ session, language, mood, tracks, source }) {
  try {
    return await saveRadioSession({
      userEmail: session?.user?.email,
      language,
      mood,
      tracks,
      source,
    });
  } catch (err) {
    console.error("[recommend] Supabase persistence failed:", err.message);
    return null;
  }
}

const FALLBACK_TRACKS = {
  english: {
    romantic: [
      { title: "Lover", artist: "Taylor Swift" },
      { title: "Perfect", artist: "Ed Sheeran" },
      { title: "All of Me", artist: "John Legend" },
      { title: "Adore You", artist: "Harry Styles" },
      { title: "Just the Way You Are", artist: "Bruno Mars" },
      { title: "At My Worst", artist: "Pink Sweat$" },
      { title: "Best Part", artist: "Daniel Caesar H.E.R." },
      { title: "Until I Found You", artist: "Stephen Sanchez" },
    ],
    sad: [
      { title: "Someone Like You", artist: "Adele" },
      { title: "Fix You", artist: "Coldplay" },
      { title: "Let Her Go", artist: "Passenger" },
      { title: "Say Something", artist: "A Great Big World Christina Aguilera" },
      { title: "Skinny Love", artist: "Birdy" },
      { title: "When I Was Your Man", artist: "Bruno Mars" },
      { title: "The Night We Met", artist: "Lord Huron" },
      { title: "Arcade", artist: "Duncan Laurence" },
    ],
    lofi: [
      { title: "Snowman", artist: "WYS" },
      { title: "Dreams", artist: "Joakim Karud" },
      { title: "Lofi Study", artist: "Lofi Fruits Music" },
      { title: "Coffee", artist: "beabadoobee" },
      { title: "Chillhop Essentials", artist: "Chillhop Music" },
      { title: "Aruarian Dance", artist: "Nujabes" },
      { title: "Feather", artist: "Nujabes Cise Starr" },
      { title: "Affection", artist: "Jinsang" },
    ],
    feelgood: [
      { title: "Good Life", artist: "OneRepublic" },
      { title: "Happy", artist: "Pharrell Williams" },
      { title: "Best Day Of My Life", artist: "American Authors" },
      { title: "Walking on Sunshine", artist: "Katrina and the Waves" },
      { title: "Can't Stop the Feeling", artist: "Justin Timberlake" },
      { title: "Sunday Best", artist: "Surfaces" },
      { title: "Uptown Funk", artist: "Mark Ronson Bruno Mars" },
      { title: "Levitating", artist: "Dua Lipa" },
    ],
  },
  hindi: {
    romantic: [
      { title: "Tum Hi Ho", artist: "Arijit Singh" },
      { title: "Raabta", artist: "Arijit Singh" },
      { title: "Pee Loon", artist: "Mohit Chauhan" },
      { title: "Kesariya", artist: "Arijit Singh" },
      { title: "Tera Ban Jaunga", artist: "Akhil Sachdeva Tulsi Kumar" },
      { title: "Ranjha", artist: "Jasleen Royal B Praak" },
      { title: "Shayad", artist: "Arijit Singh" },
      { title: "Hawayein", artist: "Arijit Singh" },
    ],
    sad: [
      { title: "Channa Mereya", artist: "Arijit Singh" },
      { title: "Agar Tum Saath Ho", artist: "Alka Yagnik Arijit Singh" },
      { title: "Phir Le Aya Dil", artist: "Arijit Singh" },
      { title: "Tujhe Bhula Diya", artist: "Mohit Chauhan Shekhar Ravjiani Shruti Pathak" },
      { title: "Bekhayali", artist: "Sachet Tandon" },
      { title: "Kalank", artist: "Arijit Singh" },
      { title: "Hamari Adhuri Kahani", artist: "Arijit Singh" },
      { title: "Tadap Tadap", artist: "KK" },
    ],
    lofi: [
      { title: "Iktara", artist: "Kavita Seth Amit Trivedi" },
      { title: "Kun Faya Kun", artist: "A.R. Rahman Javed Ali Mohit Chauhan" },
      { title: "Pehla Nasha", artist: "Udit Narayan Sadhana Sargam" },
      { title: "Aazaadiyan", artist: "Amit Trivedi" },
      { title: "Khaabon Ke Parinday", artist: "Alyssa Mendonsa Mohit Chauhan" },
      { title: "Ilahi", artist: "Arijit Singh" },
      { title: "Safarnama", artist: "Lucky Ali" },
      { title: "Shaam", artist: "Amit Trivedi Nikhil D'Souza" },
    ],
    feelgood: [
      { title: "Badtameez Dil", artist: "Benny Dayal Shefali Alvares" },
      { title: "Gallan Goodiyaan", artist: "Yashita Sharma Manish Kumar Tipu" },
      { title: "Kar Gayi Chull", artist: "Badshah Neha Kakkar" },
      { title: "London Thumakda", artist: "Labh Janjua Sonu Kakkar Neha Kakkar" },
      { title: "Kala Chashma", artist: "Amar Arshi Badshah Neha Kakkar" },
      { title: "Nashe Si Chadh Gayi", artist: "Arijit Singh" },
      { title: "Morni Banke", artist: "Guru Randhawa Neha Kakkar" },
      { title: "Ude Dil Befikre", artist: "Benny Dayal" },
    ],
  },
  tamil: {
    romantic: [
      { title: "Munbe Vaa", artist: "A.R. Rahman Shreya Ghoshal Naresh Iyer" },
      { title: "Enna Sona", artist: "A.R. Rahman Arijit Singh" },
      { title: "New York Nagaram", artist: "A.R. Rahman" },
      { title: "Hosanna", artist: "A.R. Rahman Vijay Prakash" },
      { title: "Vaseegara", artist: "Bombay Jayashri" },
      { title: "Anbil Avan", artist: "A.R. Rahman Chinmayi Devan Ekambaram" },
      { title: "Kaadhal Rojave", artist: "S. P. Balasubrahmanyam Sujatha" },
      { title: "Thalli Pogathey", artist: "A.R. Rahman Sid Sriram" },
    ],
    sad: [
      { title: "Nenjukkul Peidhidum", artist: "Harris Jayaraj Hariharan" },
      { title: "Pookkal Pookkum", artist: "G.V. Prakash Kumar Roop Kumar Rathod" },
      { title: "Po Nee Po", artist: "Anirudh Ravichander Mohit Chauhan" },
      { title: "Vennilave Vennilave", artist: "Hariharan Sadhana Sargam" },
      { title: "Kanave Kanave", artist: "Anirudh Ravichander" },
      { title: "Yaaro Yaarodi", artist: "A.R. Rahman" },
      { title: "Uyire Uyire", artist: "Hariharan K.S. Chithra" },
      { title: "Maruvaarthai", artist: "Sid Sriram" },
    ],
    lofi: [
      { title: "Malare", artist: "Vijay Yesudas" },
      { title: "Aaromale", artist: "A.R. Rahman Alphons Joseph" },
      { title: "Kannazhaga", artist: "Dhanush Shruti Haasan" },
      { title: "Naan Nee", artist: "Dhibu Ninan Thomas Shakthisree Gopalan" },
      { title: "Idhu Varai", artist: "Yuvan Shankar Raja Ajesh Andrea Jeremiah" },
      { title: "The Life of Ram", artist: "Govind Vasantha Pradeep Kumar" },
      { title: "Kadhaippoma", artist: "Leon James Sid Sriram" },
      { title: "Usure Pogudhey", artist: "A.R. Rahman Karthik" },
    ],
    feelgood: [
      { title: "Rowdy Baby", artist: "Dhee Dhanush" },
      { title: "Vaathi Coming", artist: "Anirudh Ravichander Gana Balachandar" },
      { title: "Arabic Kuthu", artist: "Anirudh Ravichander Jonita Gandhi" },
      { title: "Aaluma Doluma", artist: "Anirudh Ravichander Badshah" },
      { title: "Jimikki Kammal", artist: "Vineeth Sreenivasan Renjith Unni" },
      { title: "Enjoy Enjaami", artist: "Dhee Arivu" },
      { title: "Don'u Don'u Don'u", artist: "Anirudh Ravichander Alisha Thomas" },
      { title: "Mental Manadhil", artist: "A.R. Rahman Jonita Gandhi" },
    ],
  },
  malayalam: {
    romantic: [
      { title: "Malare", artist: "Vijay Yesudas" },
      { title: "Aaro Nenjil", artist: "Gowry Lekshmi" },
      { title: "Pavizha Mazha", artist: "KS Harisankar" },
      { title: "Uyire", artist: "Sid Sriram" },
      { title: "Mizhiyil Ninnum", artist: "Shahabaz Aman" },
      { title: "Vathikkalu Vellaripravu", artist: "Arjun Krishna Nithya Mammen" },
      { title: "Aaradhike", artist: "Sooraj Santhosh Madhuvanthi Narayan" },
      { title: "Ente Kannil Ninakkai", artist: "Nazriya Nazim Gopi Sundar" },
    ],
    sad: [
      { title: "Cherathukal", artist: "Sushin Shyam Sithara Krishnakumar" },
      { title: "Akale", artist: "Karthik" },
      { title: "Ariyathe Ariyathe", artist: "K.J. Yesudas K.S. Chithra" },
      { title: "Poomuthole", artist: "Vijay Yesudas" },
      { title: "Mizhiyariyaathe", artist: "K.J. Yesudas" },
      { title: "Ee Puzhayum", artist: "Vijay Yesudas" },
      { title: "Azhalinte Azhangalil", artist: "Nikhil Mathew" },
      { title: "Thaniye", artist: "Vishnu Vijay Sooraj Santhosh" },
    ],
    lofi: [
      { title: "Aaradhike", artist: "Sooraj Santhosh Madhuvanthi Narayan" },
      { title: "Parayuvaan", artist: "Sid Sriram Neha S. Nair" },
      { title: "Puthiyoru Pathayil", artist: "Nazriya Nazim" },
      { title: "Etho Mazhayil", artist: "Vijay Yesudas Shweta Mohan" },
      { title: "Uyiril Thodum", artist: "Sooraj Santhosh Anne Amie" },
      { title: "Kannil Kannil", artist: "Vineeth Sreenivasan" },
      { title: "Pularikalo", artist: "Shakthisree Gopalan Mohammed Maqbool Mansoor" },
      { title: "Manikya Malaraya Poovi", artist: "Vineeth Sreenivasan" },
    ],
    feelgood: [
      { title: "Jimikki Kammal", artist: "Vineeth Sreenivasan Renjith Unni" },
      { title: "Entammede Jimikki Kammal", artist: "Vineeth Sreenivasan" },
      { title: "Appangalembadum", artist: "Anna Katharina Valayil" },
      { title: "Lailakame", artist: "Haricharan" },
      { title: "Rasathi", artist: "Shreya Ghoshal" },
      { title: "Thudakkam Mangalyam", artist: "Vijay Yesudas Sachin Warrier" },
      { title: "Manikya Malaraya Poovi", artist: "Vineeth Sreenivasan" },
      { title: "Kudukku", artist: "Vineeth Sreenivasan" },
    ],
  },
};
