import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const customers = sqliteTable('customers', {
    id: text('id').primaryKey(),
    lastConnection: text('last_connection').notNull(),
    totalVisits: integer('total_visits').notNull().default(0),
    treesPlanted: integer('trees_planted').notNull().default(0)
});

export const visits = sqliteTable('visits', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    customerId: text('customer_id')
        .notNull()
        .references(() => customers.id),
    visitedAt: text('visited_at').notNull()
});
