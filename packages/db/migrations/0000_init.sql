CREATE TABLE "actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"command_id" varchar(128) NOT NULL,
	"action_type" varchar(24) NOT NULL,
	"status" varchar(24) NOT NULL,
	"source" varchar(24) DEFAULT 'manual' NOT NULL,
	"before_state" jsonb NOT NULL,
	"after_state" jsonb,
	"request" jsonb NOT NULL,
	"response" jsonb,
	"message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "board_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"turn" integer NOT NULL,
	"revision" integer NOT NULL,
	"raw_payload" jsonb NOT NULL,
	"normalized_ads" jsonb NOT NULL,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"client_command_id" varchar(128) NOT NULL,
	"expected_revision" integer NOT NULL,
	"action_type" varchar(24) NOT NULL,
	"status" varchar(24) DEFAULT 'pending' NOT NULL,
	"request" jsonb NOT NULL,
	"response" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "experiments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(128) NOT NULL,
	"policy_version" varchar(64) NOT NULL,
	"configuration" jsonb NOT NULL,
	"knowledge_version" varchar(64) NOT NULL,
	"status" varchar(24) DEFAULT 'running' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"upstream_game_id" varchar(128) NOT NULL,
	"status" varchar(24) DEFAULT 'ready' NOT NULL,
	"lives" integer NOT NULL,
	"gold" integer NOT NULL,
	"level" integer NOT NULL,
	"score" integer NOT NULL,
	"turn" integer NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"raw_state" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reputation_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"turn" integer,
	"people" double precision NOT NULL,
	"state" double precision NOT NULL,
	"underworld" double precision NOT NULL,
	"raw_payload" jsonb NOT NULL,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "shop_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"revision" integer NOT NULL,
	"raw_payload" jsonb NOT NULL,
	"items" jsonb NOT NULL,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_snapshots" ADD CONSTRAINT "board_snapshots_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commands" ADD CONSTRAINT "commands_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_owner_id_players_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reputation_snapshots" ADD CONSTRAINT "reputation_snapshots_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_snapshots" ADD CONSTRAINT "shop_snapshots_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "actions_game_sequence_uq" ON "actions" USING btree ("game_id","sequence");--> statement-breakpoint
CREATE UNIQUE INDEX "actions_game_command_uq" ON "actions" USING btree ("game_id","command_id");--> statement-breakpoint
CREATE INDEX "board_snapshots_game_revision_idx" ON "board_snapshots" USING btree ("game_id","revision");--> statement-breakpoint
CREATE UNIQUE INDEX "commands_game_client_id_uq" ON "commands" USING btree ("game_id","client_command_id");--> statement-breakpoint
CREATE INDEX "experiments_started_idx" ON "experiments" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "games_owner_created_idx" ON "games" USING btree ("owner_id","created_at");--> statement-breakpoint
CREATE INDEX "reputation_snapshots_game_observed_idx" ON "reputation_snapshots" USING btree ("game_id","observed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_hash_uq" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "shop_snapshots_game_revision_idx" ON "shop_snapshots" USING btree ("game_id","revision");