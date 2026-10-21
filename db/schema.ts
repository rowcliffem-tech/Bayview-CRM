import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// An owner-scoped, atomically versioned workspace document. A single CAS write
// keeps delivered deals, stock status and lead outcomes consistent together.
export const workspaces = sqliteTable('workspaces', {
  ownerId: text('owner_id').primaryKey(),
  revision: integer('revision').notNull().default(1),
  data: text('data').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// Licence data is kept out of the general workspace response and CSV exports.
export const customerLicenses = sqliteTable('customer_licenses', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull(),
  leadId: text('lead_id').notNull(),
  profile: text('profile_json').notNull(),
  frontKey: text('front_key').notNull(),
  backKey: text('back_key').notNull(),
  frontType: text('front_type').notNull(),
  backType: text('back_type').notNull(),
  createdAt: text('created_at').notNull(),
});
