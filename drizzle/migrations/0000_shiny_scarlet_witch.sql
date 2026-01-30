CREATE TABLE "generations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prediction_id" text,
	"provider" text DEFAULT 'replicate' NOT NULL,
	"image_url" text NOT NULL,
	"motion_video_url" text,
	"motion_preset_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"video_url" text,
	"duration" integer,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "motion_videos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"storage_path" text NOT NULL,
	"thumbnail_path" text,
	"duration" real NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
