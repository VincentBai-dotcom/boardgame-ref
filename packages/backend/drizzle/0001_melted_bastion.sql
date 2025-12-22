CREATE TYPE "public"."user_role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TABLE "email_verification_token" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	CONSTRAINT "email_verification_token_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "password_reset_token" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	CONSTRAINT "password_reset_token_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "refresh_token" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(255) NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now(),
	"expires_at" timestamp with time zone NOT NULL,
	"last_used_at" timestamp with time zone,
	"user_agent" text,
	"ip_address" "inet",
	"revoked_at" timestamp with time zone,
	"revoked_reason" varchar(100),
	CONSTRAINT "refresh_token_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "game" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"publisher" text,
	"year_published" integer,
	"bgg_id" integer,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "game_name_unique" UNIQUE("name"),
	CONSTRAINT "game_bgg_id_unique" UNIQUE("bgg_id")
);
--> statement-breakpoint
CREATE TABLE "rule_chunk" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rulebook_id" uuid NOT NULL,
	"game_id" uuid NOT NULL,
	"chunk_text" text NOT NULL,
	"embedding" vector(1536) NOT NULL,
	"chunk_index" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "rulebook" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"title" text NOT NULL,
	"rulebook_type" text NOT NULL,
	"edition" text,
	"version" text,
	"language" text DEFAULT 'en' NOT NULL,
	"full_text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "rulebook_game_id_title_edition_language_unique" UNIQUE("game_id","title","edition","language"),
	CONSTRAINT "rulebook_type_check" CHECK ("rulebook"."rulebook_type" IN ('base', 'expansion', 'quickstart', 'reference', 'faq', 'other'))
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"email_verified" boolean DEFAULT false,
	"password_hash" text,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"oauth_provider" varchar(50),
	"oauth_provider_user_id" varchar(255),
	"oauth_refresh_token" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"last_login_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "user_email_unique" UNIQUE("email"),
	CONSTRAINT "user_oauth_provider_oauth_provider_user_id_unique" UNIQUE("oauth_provider","oauth_provider_user_id"),
	CONSTRAINT "auth_method_check" CHECK (("user"."password_hash" IS NOT NULL AND "user"."oauth_provider" IS NULL) OR ("user"."password_hash" IS NULL AND "user"."oauth_provider" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "email_verification_token" ADD CONSTRAINT "email_verification_token_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_token" ADD CONSTRAINT "password_reset_token_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_token" ADD CONSTRAINT "refresh_token_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_chunk" ADD CONSTRAINT "rule_chunk_rulebook_id_rulebook_id_fk" FOREIGN KEY ("rulebook_id") REFERENCES "public"."rulebook"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_chunk" ADD CONSTRAINT "rule_chunk_game_id_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."game"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rulebook" ADD CONSTRAINT "rulebook_game_id_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."game"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_email_verification_token_user_id" ON "email_verification_token" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_email_verification_token_hash" ON "email_verification_token" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "idx_password_reset_token_user_id" ON "password_reset_token" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_password_reset_token_hash" ON "password_reset_token" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "idx_refresh_token_user_id" ON "refresh_token" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_refresh_token_hash" ON "refresh_token" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "idx_refresh_token_expires" ON "refresh_token" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_game_name" ON "game" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_game_bgg_id" ON "game" USING btree ("bgg_id") WHERE "game"."bgg_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_rule_chunk_rulebook_id" ON "rule_chunk" USING btree ("rulebook_id");--> statement-breakpoint
CREATE INDEX "idx_rule_chunk_game_id" ON "rule_chunk" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "idx_rule_chunk_index" ON "rule_chunk" USING btree ("rulebook_id","chunk_index");--> statement-breakpoint
CREATE INDEX "idx_rule_chunk_embedding_cosine" ON "rule_chunk" USING hnsw ("embedding" vector_cosine_ops) WITH (m=16,ef_construction=64);--> statement-breakpoint
CREATE INDEX "idx_rulebook_game_id" ON "rulebook" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "idx_rulebook_language" ON "rulebook" USING btree ("language");--> statement-breakpoint
CREATE INDEX "idx_rulebook_type" ON "rulebook" USING btree ("rulebook_type");--> statement-breakpoint
CREATE INDEX "idx_user_email" ON "user" USING btree ("email") WHERE "user"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_user_oauth" ON "user" USING btree ("oauth_provider","oauth_provider_user_id") WHERE "user"."oauth_provider" IS NOT NULL;