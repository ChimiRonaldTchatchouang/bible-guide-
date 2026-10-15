CREATE TYPE "public"."group_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'editor', 'admin');--> statement-breakpoint
CREATE TYPE "public"."testament" AS ENUM('AT', 'NT');--> statement-breakpoint
CREATE TABLE "books" (
	"id" smallint PRIMARY KEY NOT NULL,
	"code" varchar(3) NOT NULL,
	"slug" varchar(40) NOT NULL,
	"name" varchar(80) NOT NULL,
	"abbreviation" varchar(10) NOT NULL,
	"testament" "testament" NOT NULL,
	"chapter_count" smallint NOT NULL,
	CONSTRAINT "books_code_unique" UNIQUE("code"),
	CONSTRAINT "books_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "cross_references" (
	"id" serial PRIMARY KEY NOT NULL,
	"from_book_id" smallint NOT NULL,
	"from_chapter" smallint NOT NULL,
	"from_verse" smallint NOT NULL,
	"book_id" smallint NOT NULL,
	"chapter_start" smallint NOT NULL,
	"verse_start" smallint DEFAULT 1 NOT NULL,
	"chapter_end" smallint NOT NULL,
	"verse_end" smallint
);
--> statement-breakpoint
CREATE TABLE "day_completions" (
	"user_id" uuid NOT NULL,
	"plan_id" integer NOT NULL,
	"day_number" smallint NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "day_completions_user_id_plan_id_day_number_pk" PRIMARY KEY("user_id","plan_id","day_number")
);
--> statement-breakpoint
CREATE TABLE "favorites" (
	"user_id" uuid NOT NULL,
	"group_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "favorites_user_id_group_id_pk" PRIMARY KEY("user_id","group_id")
);
--> statement-breakpoint
CREATE TABLE "group_parallels" (
	"id" serial PRIMARY KEY NOT NULL,
	"group_id" integer NOT NULL,
	"book_id" smallint NOT NULL,
	"chapter_start" smallint NOT NULL,
	"verse_start" smallint DEFAULT 1 NOT NULL,
	"chapter_end" smallint NOT NULL,
	"verse_end" smallint,
	"note" text,
	"position" smallint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "group_themes" (
	"group_id" integer NOT NULL,
	"theme_id" integer NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "group_themes_group_id_theme_id_pk" PRIMARY KEY("group_id","theme_id")
);
--> statement-breakpoint
CREATE TABLE "notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"group_id" integer,
	"reference" varchar(60),
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "passage_groups" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(120) NOT NULL,
	"title" varchar(200) NOT NULL,
	"book_id" smallint NOT NULL,
	"chapter_start" smallint NOT NULL,
	"verse_start" smallint DEFAULT 1 NOT NULL,
	"chapter_end" smallint NOT NULL,
	"verse_end" smallint,
	"context_story" text,
	"teaching" text,
	"source_section_id" integer,
	"status" "group_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "passage_groups_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "plan_enrollments" (
	"user_id" uuid NOT NULL,
	"plan_id" integer NOT NULL,
	"start_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plan_enrollments_user_id_plan_id_pk" PRIMARY KEY("user_id","plan_id")
);
--> statement-breakpoint
CREATE TABLE "reading_plan_days" (
	"id" serial PRIMARY KEY NOT NULL,
	"plan_id" integer NOT NULL,
	"day_number" smallint NOT NULL,
	"title" varchar(200)
);
--> statement-breakpoint
CREATE TABLE "reading_plan_items" (
	"day_id" integer NOT NULL,
	"group_id" integer NOT NULL,
	"theme_id" integer,
	"position" smallint DEFAULT 0 NOT NULL,
	CONSTRAINT "reading_plan_items_day_id_group_id_pk" PRIMARY KEY("day_id","group_id")
);
--> statement-breakpoint
CREATE TABLE "reading_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(80) NOT NULL,
	"name" varchar(150) NOT NULL,
	"description" text,
	"total_days" smallint DEFAULT 365 NOT NULL,
	"published" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reading_plans_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refresh_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "section_parallels" (
	"id" serial PRIMARY KEY NOT NULL,
	"section_id" integer NOT NULL,
	"book_id" smallint NOT NULL,
	"chapter_start" smallint NOT NULL,
	"verse_start" smallint DEFAULT 1 NOT NULL,
	"chapter_end" smallint NOT NULL,
	"verse_end" smallint,
	"position" smallint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sections" (
	"id" serial PRIMARY KEY NOT NULL,
	"book_id" smallint NOT NULL,
	"chapter_start" smallint NOT NULL,
	"verse_start" smallint DEFAULT 1 NOT NULL,
	"chapter_end" smallint NOT NULL,
	"verse_end" smallint,
	"title" text,
	"heading_start" boolean DEFAULT false NOT NULL,
	"parallels_raw" text
);
--> statement-breakpoint
CREATE TABLE "themes" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(80) NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text,
	"icon" varchar(60),
	"color" varchar(9),
	"parent_id" integer,
	"position" integer DEFAULT 0 NOT NULL,
	"published" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "themes_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(254) NOT NULL,
	"password_hash" text NOT NULL,
	"display_name" varchar(100),
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verses" (
	"id" serial PRIMARY KEY NOT NULL,
	"book_id" smallint NOT NULL,
	"chapter" smallint NOT NULL,
	"verse" smallint NOT NULL,
	"text" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cross_references" ADD CONSTRAINT "cross_references_from_book_id_books_id_fk" FOREIGN KEY ("from_book_id") REFERENCES "public"."books"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cross_references" ADD CONSTRAINT "cross_references_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "day_completions" ADD CONSTRAINT "day_completions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "day_completions" ADD CONSTRAINT "day_completions_plan_id_reading_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."reading_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_group_id_passage_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."passage_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_parallels" ADD CONSTRAINT "group_parallels_group_id_passage_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."passage_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_parallels" ADD CONSTRAINT "group_parallels_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_themes" ADD CONSTRAINT "group_themes_group_id_passage_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."passage_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_themes" ADD CONSTRAINT "group_themes_theme_id_themes_id_fk" FOREIGN KEY ("theme_id") REFERENCES "public"."themes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_group_id_passage_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."passage_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passage_groups" ADD CONSTRAINT "passage_groups_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passage_groups" ADD CONSTRAINT "passage_groups_source_section_id_sections_id_fk" FOREIGN KEY ("source_section_id") REFERENCES "public"."sections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_enrollments" ADD CONSTRAINT "plan_enrollments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_enrollments" ADD CONSTRAINT "plan_enrollments_plan_id_reading_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."reading_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_plan_days" ADD CONSTRAINT "reading_plan_days_plan_id_reading_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."reading_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_plan_items" ADD CONSTRAINT "reading_plan_items_day_id_reading_plan_days_id_fk" FOREIGN KEY ("day_id") REFERENCES "public"."reading_plan_days"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_plan_items" ADD CONSTRAINT "reading_plan_items_group_id_passage_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."passage_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_plan_items" ADD CONSTRAINT "reading_plan_items_theme_id_themes_id_fk" FOREIGN KEY ("theme_id") REFERENCES "public"."themes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "section_parallels" ADD CONSTRAINT "section_parallels_section_id_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "section_parallels" ADD CONSTRAINT "section_parallels_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sections" ADD CONSTRAINT "sections_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "themes" ADD CONSTRAINT "themes_parent_id_themes_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."themes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verses" ADD CONSTRAINT "verses_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cross_refs_from_idx" ON "cross_references" USING btree ("from_book_id","from_chapter","from_verse");--> statement-breakpoint
CREATE INDEX "group_parallels_group_idx" ON "group_parallels" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "group_themes_theme_idx" ON "group_themes" USING btree ("theme_id");--> statement-breakpoint
CREATE INDEX "notes_user_idx" ON "notes" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "groups_status_idx" ON "passage_groups" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "plan_day_uq" ON "reading_plan_days" USING btree ("plan_id","day_number");--> statement-breakpoint
CREATE INDEX "plan_items_group_idx" ON "reading_plan_items" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "refresh_tokens_user_idx" ON "refresh_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "section_parallels_section_idx" ON "section_parallels" USING btree ("section_id");--> statement-breakpoint
CREATE INDEX "sections_book_idx" ON "sections" USING btree ("book_id","chapter_start","verse_start");--> statement-breakpoint
CREATE INDEX "themes_parent_idx" ON "themes" USING btree ("parent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "verses_ref_uq" ON "verses" USING btree ("book_id","chapter","verse");--> statement-breakpoint
CREATE INDEX "verses_fts_idx" ON "verses" USING gin (to_tsvector('french', "text"));