import { pgTable, text, timestamp, integer, doublePrecision, jsonb, boolean } from "drizzle-orm/pg-core";
import { ProjectSettings, Line, Region, WhisperWord } from "@/shared/schema";

export const projects = pgTable("projects", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  status: text("status").notNull().default("draft"), // draft | ingesting | transcribing | aligning | ready | error
  settingsJson: jsonb("settings_json").$type<ProjectSettings>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const assets = pgTable("assets", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), // mix | instrumental | vocals | lyrics
  filename: text("filename").notNull(),
  mime: text("mime").notNull(),
  bytes: integer("bytes").notNull(),
  sha256: text("sha256").notNull(),
  durationSec: doublePrecision("duration_sec").notNull().default(0),
  sampleRate: integer("sample_rate").notNull().default(44100),
  channels: integer("channels").notNull().default(2),
  storagePath: text("storage_path").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const asrJobs = pgTable("asr_jobs", {
  id: text("id").primaryKey(),
  assetId: text("asset_id").notNull(),
  model: text("model").notNull(),
  paramsHash: text("params_hash").notNull(),
  rawJson: jsonb("raw_json").notNull(),
  status: text("status").notNull().default("completed"),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const documents = pgTable("documents", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  version: integer("version").notNull().default(1),
  lyricsOriginal: text("lyrics_original").notNull().default(""),
  linesJson: jsonb("lines_json").$type<Line[]>().notNull().default([]),
  regionsJson: jsonb("regions_json").$type<Region[]>().notNull().default([]),
  wordsJson: jsonb("words_json").$type<WhisperWord[]>().notNull().default([]),
  alignmentJson: jsonb("alignment_json").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const jobs = pgTable("jobs", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // transcribe | align | export
  status: text("status").notNull().default("pending"), // pending | processing | completed | failed
  progress: integer("progress").notNull().default(0),
  payloadJson: jsonb("payload_json").$type<Record<string, unknown>>(),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
