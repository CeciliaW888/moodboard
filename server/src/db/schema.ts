import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const images = pgTable("images", {
  id: serial("id").primaryKey(),
  url: text("url").notNull(),
  weekStr: text("week_str").notNull(), // e.g. "2026-W08"
  dayOfWeek: integer("day_of_week").notNull(), // 1 for Mon, 2 for Tue... 7 for Sun
  createdAt: timestamp("created_at").defaultNow(),
});

export const terminologyTags = pgTable("terminology_tags", {
  id: serial("id").primaryKey(),
  imageId: integer("image_id").references(() => images.id, { onDelete: 'cascade' }),
  term: text("term").notNull(), // e.g. "Glassmorphism"
  createdAt: timestamp("created_at").defaultNow(),
});

export const weeks = pgTable("weeks", {
  id: serial("id").primaryKey(),
  weekStr: text("week_str").notNull().unique(), // e.g. "2026-W08"
  notesHeight: integer("notes_height").default(256), // pixels for third row
  notes: text("notes").default(""), // user notes content
});
