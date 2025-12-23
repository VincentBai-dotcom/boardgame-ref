ALTER TABLE "rulebook" DROP CONSTRAINT "rulebook_game_id_title_edition_language_unique";--> statement-breakpoint
ALTER TABLE "game" DROP COLUMN "publisher";--> statement-breakpoint
ALTER TABLE "rulebook" DROP COLUMN "edition";--> statement-breakpoint
ALTER TABLE "rulebook" DROP COLUMN "version";--> statement-breakpoint
ALTER TABLE "rulebook" ADD CONSTRAINT "rulebook_game_id_title_language_unique" UNIQUE("game_id","title","language");