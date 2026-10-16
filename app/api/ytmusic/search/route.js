// Keep the old endpoint compatible, but route every request through the
// automatic language + mood queue. Free-form URLs and pasted searches are no
// longer part of the playback flow.
export { POST, runtime, dynamic } from "@/app/api/recommend/route";
