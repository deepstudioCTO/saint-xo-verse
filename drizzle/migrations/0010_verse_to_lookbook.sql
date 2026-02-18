-- Step 1: Rename tables
ALTER TABLE "verses" RENAME TO "lookbooks";
ALTER TABLE "verse_characters" RENAME TO "personas";

-- Step 2: Rename columns
ALTER TABLE "personas" RENAME COLUMN "verse_id" TO "look_id";
ALTER TABLE "generations" RENAME COLUMN "verse_id" TO "lookbook_id";

-- Step 3: Add new column
ALTER TABLE "generations" ADD COLUMN "look_id" text;

-- Step 4: Create looks table
CREATE TABLE "looks" (
  "id" text PRIMARY KEY NOT NULL,
  "lookbook_id" text NOT NULL,
  "display_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Step 5: Seed initial looks and remap existing personas
INSERT INTO "looks" ("id", "lookbook_id", "display_order") VALUES
  ('00_01', '00', 0),
  ('00_02', '00', 1),
  ('00_03', '00', 2),
  ('00_04', '00', 3),
  ('01_01', '01', 0);

-- Remap existing personas from lookbook-level IDs to look-level IDs
UPDATE "personas" SET "look_id" = '00_01' WHERE "look_id" = '00';
UPDATE "personas" SET "look_id" = '01_01' WHERE "look_id" = '01';
