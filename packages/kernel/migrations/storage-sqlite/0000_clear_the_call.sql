CREATE TABLE `artifacts` (
	`project_id` text NOT NULL,
	`id` text NOT NULL,
	`flow_name` text NOT NULL,
	`stage_name` text NOT NULL,
	`data` text NOT NULL,
	`created_at` text NOT NULL,
	`revision` integer NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`project_id`, `id`),
	FOREIGN KEY (`project_id`) REFERENCES `storage_projects`(`project_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "artifact_revision_range" CHECK("artifacts"."revision" > 0 AND "artifacts"."revision" <= 9007199254740991),
	CONSTRAINT "artifact_json" CHECK(json_valid("artifacts"."data"))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `artifact_stage` ON `artifacts` (`project_id`,`flow_name`,`stage_name`);--> statement-breakpoint
CREATE INDEX `artifact_created` ON `artifacts` (`project_id`,`created_at`,`id`);--> statement-breakpoint
CREATE TABLE `storage_projects` (
	`project_id` text PRIMARY KEY NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	CONSTRAINT "project_revision_range" CHECK("storage_projects"."revision" >= 0 AND "storage_projects"."revision" <= 9007199254740991)
);
--> statement-breakpoint
CREATE TABLE `records` (
	`project_id` text NOT NULL,
	`id` text NOT NULL,
	`flow_name` text NOT NULL,
	`stage_name` text NOT NULL,
	`data` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`project_id`, `id`),
	FOREIGN KEY (`project_id`) REFERENCES `storage_projects`(`project_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "record_json" CHECK(json_valid("records"."data"))
);
--> statement-breakpoint
CREATE INDEX `record_created` ON `records` (`project_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `record_stage_created` ON `records` (`project_id`,`flow_name`,`stage_name`,`created_at`,`id`);