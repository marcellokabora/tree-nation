import { eq, sql } from 'drizzle-orm';
import { X_VISITS_PER_TREE } from '../config.js';
import { db } from '../db/index.js';
import { customers, visits } from '../db/schema.js';

export type Customer = typeof customers.$inferSelect;
export type VisitBucket = { time: string; count: number };
export type Granularity = 'minute' | 'hour' | 'day' | 'week' | 'month';

export function recordVisit(customerId: string): Customer {
    const now = new Date().toISOString();

    // Upsert customer — create on first visit, otherwise increment visits + update last_connection
    db.insert(customers)
        .values({ id: customerId, lastConnection: now, totalVisits: 1, treesPlanted: 0 })
        .onConflictDoUpdate({
            target: customers.id,
            set: {
                lastConnection: now,
                totalVisits: sql`${customers.totalVisits} + 1`
            }
        })
        .run();

    // Insert visit row
    db.insert(visits).values({ customerId, visitedAt: now }).run();

    // Fetch updated customer
    const customer = db.select().from(customers).where(eq(customers.id, customerId)).get()!;

    // If total visits is a multiple of X, plant a tree
    if (customer.totalVisits % X_VISITS_PER_TREE === 0) {
        db.update(customers)
            .set({ treesPlanted: sql`${customers.treesPlanted} + 1` })
            .where(eq(customers.id, customerId))
            .run();
        customer.treesPlanted += 1;
    }

    return customer;
}

export function getCustomer(customerId: string): Customer | undefined {
    return db.select().from(customers).where(eq(customers.id, customerId)).get();
}

export function getVisits(granularity: Granularity = 'hour'): VisitBucket[] {
    const fmts: Record<Granularity, string> = {
        minute: '%Y-%m-%dT%H:%M:00Z',
        hour: '%Y-%m-%dT%H:00:00Z',
        day: '%Y-%m-%d',
        week: '%Y-%m-%d',
        month: '%Y-%m-01',
    };
    const windows: Record<Granularity, string> = {
        minute: '-2 hours',
        hour: '-24 hours',
        day: '-30 days',
        week: '-84 days',
        month: '-12 months',
    };
    const fmt = fmts[granularity];
    const window = windows[granularity];
    // Week: bucket by the Monday of each week
    const timeExpr = () => granularity === 'week'
        ? sql<string>`strftime('%Y-%m-%d', ${visits.visitedAt}, '-6 days', 'weekday 1')`
        : sql<string>`strftime(${fmt}, ${visits.visitedAt})`;
    return db
        .select({ time: timeExpr(), count: sql<number>`cast(count(*) as integer)` })
        .from(visits)
        .where(sql`${visits.visitedAt} >= datetime('now', ${window})`)
        .groupBy(timeExpr())
        .orderBy(timeExpr())
        .all();
}

export function getTotalTreesPlanted(): number {
    const result = db
        .select({ total: sql<number>`cast(coalesce(sum(${customers.treesPlanted}), 0) as integer)` })
        .from(customers)
        .get();
    return result?.total ?? 0;
}
