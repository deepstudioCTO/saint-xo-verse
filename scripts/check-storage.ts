import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function main() {
  const { data: videos, error: vErr } = await supabase.storage
    .from("motion-videos")
    .list("videos");
  console.log("Videos:", videos);
  if (vErr) console.log("Video Error:", vErr);

  const { data: thumbs, error: tErr } = await supabase.storage
    .from("motion-videos")
    .list("thumbnails");
  console.log("Thumbnails:", thumbs);
  if (tErr) console.log("Thumb Error:", tErr);
}

main();
