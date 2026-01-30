import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createBucket() {
  const { data, error } = await supabase.storage.createBucket("motion-videos", {
    public: true,
    allowedMimeTypes: ["video/mp4", "video/quicktime", "image/jpeg", "image/png"],
  });

  if (error) {
    if (error.message.includes("already exists")) {
      console.log("✓ Bucket 'motion-videos' already exists");
    } else {
      console.error("✗ Error creating bucket:", error.message);
      process.exit(1);
    }
  } else {
    console.log("✓ Bucket 'motion-videos' created successfully");
  }
}

createBucket();
