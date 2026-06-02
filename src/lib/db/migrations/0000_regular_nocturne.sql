CREATE TABLE `customers` (
	`id` text PRIMARY KEY NOT NULL,
	`last_connection` text NOT NULL,
	`total_visits` integer DEFAULT 0 NOT NULL,
	`trees_planted` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `visits` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`customer_id` text NOT NULL,
	`visited_at` text NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
