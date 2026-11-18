ALTER TABLE "actions" DROP CONSTRAINT "actions_game_id_games_id_fk";
--> statement-breakpoint
ALTER TABLE "board_snapshots" DROP CONSTRAINT "board_snapshots_game_id_games_id_fk";
--> statement-breakpoint
ALTER TABLE "commands" DROP CONSTRAINT "commands_game_id_games_id_fk";
--> statement-breakpoint
ALTER TABLE "reputation_snapshots" DROP CONSTRAINT "reputation_snapshots_game_id_games_id_fk";
--> statement-breakpoint
ALTER TABLE "shop_snapshots" DROP CONSTRAINT "shop_snapshots_game_id_games_id_fk";
--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_snapshots" ADD CONSTRAINT "board_snapshots_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commands" ADD CONSTRAINT "commands_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reputation_snapshots" ADD CONSTRAINT "reputation_snapshots_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_snapshots" ADD CONSTRAINT "shop_snapshots_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;