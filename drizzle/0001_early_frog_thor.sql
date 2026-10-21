CREATE TABLE `customer_licenses` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`lead_id` text NOT NULL,
	`profile_json` text NOT NULL,
	`front_key` text NOT NULL,
	`back_key` text NOT NULL,
	`front_type` text NOT NULL,
	`back_type` text NOT NULL,
	`created_at` text NOT NULL
);
