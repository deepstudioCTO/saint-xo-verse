CREATE TABLE "character_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"character_id" text NOT NULL,
	"variant_id" text NOT NULL,
	"storage_path" text NOT NULL,
	"public_url" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
