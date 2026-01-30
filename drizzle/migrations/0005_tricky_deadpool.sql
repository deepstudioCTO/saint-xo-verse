CREATE TABLE "concept_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text,
	"storage_path" text NOT NULL,
	"public_url" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "generations" ADD COLUMN "type" text DEFAULT 'video' NOT NULL;--> statement-breakpoint
ALTER TABLE "generations" ADD COLUMN "concept_image_id" uuid;--> statement-breakpoint
ALTER TABLE "generations" ADD COLUMN "prompt" text;--> statement-breakpoint
ALTER TABLE "generations" ADD COLUMN "resolution" text;--> statement-breakpoint
ALTER TABLE "generations" ADD COLUMN "output_url" text;--> statement-breakpoint
ALTER TABLE "generations" ADD COLUMN "output_storage_path" text;