CREATE TABLE "images" (
	"id" serial PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"week_str" text NOT NULL,
	"day_of_week" integer DEFAULT 1,
	"x" integer DEFAULT 0,
	"y" integer DEFAULT 0,
	"width" integer DEFAULT 280,
	"height" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "terminology_tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"image_id" integer,
	"term" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "weeks" (
	"id" serial PRIMARY KEY NOT NULL,
	"week_str" text NOT NULL,
	"notes_height" integer DEFAULT 256,
	"notes" text DEFAULT '',
	CONSTRAINT "weeks_week_str_unique" UNIQUE("week_str")
);
--> statement-breakpoint
ALTER TABLE "terminology_tags" ADD CONSTRAINT "terminology_tags_image_id_images_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."images"("id") ON DELETE cascade ON UPDATE no action;