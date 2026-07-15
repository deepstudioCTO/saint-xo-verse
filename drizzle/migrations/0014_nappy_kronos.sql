CREATE TABLE "style_presets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"model" text,
	"prompt" text,
	"style_preset" text,
	"style_strength" real,
	"seed" integer,
	"aspect_ratio" text,
	"resolution" text,
	"batch_size" integer,
	"enhance_prompt" boolean,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "looks" DROP COLUMN "style_preset";--> statement-breakpoint
ALTER TABLE "looks" DROP COLUMN "style_strength";--> statement-breakpoint
ALTER TABLE "looks" DROP COLUMN "seed";--> statement-breakpoint
ALTER TABLE "looks" DROP COLUMN "aspect_ratio";--> statement-breakpoint
ALTER TABLE "looks" DROP COLUMN "resolution";--> statement-breakpoint
ALTER TABLE "looks" DROP COLUMN "batch_size";--> statement-breakpoint
ALTER TABLE "looks" DROP COLUMN "enhance_prompt";