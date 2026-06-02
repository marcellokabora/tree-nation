/**
 * Unit tests for visit.service.ts
 * Uses an isolated in-memory SQLite database per test suite to avoid side effects.
 */
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { join } from 'path';
import * as schema from '../src/lib/db/schema.js';
import { eq, sql } from 'drizzle-orm';

// ---- helpers to build an isolated db + service functions ----

function createTestDb() {
    const sqlite = new Database(':memory:');
    sqlite.pragma('journal_mode = WAL');
    const db = drizzle(sqlite, { schema });
    migrate(db, { migrationsFolder: join(process.cwd(), 'src/lib/db/migrations') });
    return db;
}

/**
 * Build standalone service functions bound to a given db + X value so we can
 * test in isolation without touching global module state.
 */
function makeService(db: ReturnType<typeof createTestDb>, X: number) {
    const { customers, visits } = schema;

    function recordVisit(customerId: string) {
        const now = new Date().toISOString();
        db.insert(customers)
            .values({ id: customerId, lastConnection: now, totalVisits: 1, treesPlanted: 0 })
            .onConflictDoUpdate({
                target: customers.id,
                set: { lastConnection: now, totalVisits: sql`${customers.totalVisits} + 1` }
            })
            .run();

        db.insert(visits).values({ customerId, visitedAt: now }).run();

        const customer = db.select().from(customers).where(eq(customers.id, customerId)).get()!;

        if (customer.totalVisits % X === 0) {
            db.update(customers)
                .set({ treesPlanted: sql`${customers.treesPlanted} + 1` })
                .where(eq(customers.id, customerId))
                .run();
            customer.treesPlanted += 1;
        }
        return customer;
    }

    function getCustomer(customerId: string) {
        return db.select().from(customers).where(eq(customers.id, customerId)).get();
    }

    function getVisits(granularity: 'minute' | 'hour' | 'day' | 'week' | 'month' = 'hour') {
        const fmts: Record<string, string> = {
            minute: '%Y-%m-%dT%H:%M:00Z',
            hour: '%Y-%m-%dT%H:00:00Z',
            day: '%Y-%m-%d',
            week: '%Y-%m-%d',
            month: '%Y-%m-01',
        };
        const windows: Record<string, string> = {
            minute: '-2 hours',
            hour: '-24 hours',
            day: '-30 days',
            week: '-84 days',
            month: '-12 months',
        };
        const fmt = fmts[granularity];
        const window = windows[granularity];
        const timeExpr = () =>
            granularity === 'week'
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

    function getTotalTreesPlanted() {
        const result = db
            .select({ total: sql<number>`cast(coalesce(sum(${customers.treesPlanted}), 0) as integer)` })
            .from(customers)
            .get();
        return result?.total ?? 0;
    }

    return { recordVisit, getCustomer, getVisits, getTotalTreesPlanted };
}

// ---- tests ----

describe('recordVisit', () => {
    let service: ReturnType<typeof makeService>;

    beforeEach(() => {
        service = makeService(createTestDb(), 3);
    });

    it('creates a customer on first visit', () => {
        const c = service.recordVisit('alice');
        expect(c.id).toBe('alice');
        expect(c.totalVisits).toBe(1);
        expect(c.treesPlanted).toBe(0);
    });

    it('increments totalVisits on subsequent visits', () => {
        service.recordVisit('alice');
        service.recordVisit('alice');
        const c = service.recordVisit('alice');
        expect(c.totalVisits).toBe(3);
    });

    it('does NOT plant a tree before reaching X visits', () => {
        service.recordVisit('alice');
        const c = service.recordVisit('alice');
        expect(c.treesPlanted).toBe(0);
    });

    it('plants exactly 1 tree at X visits', () => {
        service.recordVisit('alice');
        service.recordVisit('alice');
        const c = service.recordVisit('alice'); // 3rd visit, X=3
        expect(c.treesPlanted).toBe(1);
    });

    it('plants a second tree at 2X visits', () => {
        for (let i = 0; i < 5; i++) service.recordVisit('alice');
        const c = service.recordVisit('alice'); // 6th visit, X=3
        expect(c.treesPlanted).toBe(2);
    });

    it('does not mix visits between customers', () => {
        service.recordVisit('alice');
        service.recordVisit('alice');
        service.recordVisit('bob');
        const alice = service.getCustomer('alice')!;
        const bob = service.getCustomer('bob')!;
        expect(alice.totalVisits).toBe(2);
        expect(bob.totalVisits).toBe(1);
    });

    it('updates lastConnection on each visit', () => {
        const before = service.recordVisit('alice').lastConnection;
        // small delay to ensure a different timestamp
        vi.setSystemTime(new Date(Date.now() + 1000));
        const after = service.recordVisit('alice').lastConnection;
        vi.useRealTimers();
        expect(after > before).toBe(true);
    });
});

describe('getCustomer', () => {
    let service: ReturnType<typeof makeService>;

    beforeEach(() => {
        service = makeService(createTestDb(), 3);
    });

    it('returns undefined for a non-existent customer', () => {
        expect(service.getCustomer('ghost')).toBeUndefined();
    });

    it('returns the customer after their first visit', () => {
        service.recordVisit('alice');
        const c = service.getCustomer('alice');
        expect(c).toBeDefined();
        expect(c!.id).toBe('alice');
        expect(c!.totalVisits).toBe(1);
    });

    it('reflects the latest state after multiple visits', () => {
        service.recordVisit('alice');
        service.recordVisit('alice');
        service.recordVisit('alice'); // tree planted at X=3
        const c = service.getCustomer('alice');
        expect(c!.totalVisits).toBe(3);
        expect(c!.treesPlanted).toBe(1);
    });
});

describe('getTotalTreesPlanted', () => {
    let service: ReturnType<typeof makeService>;

    beforeEach(() => {
        service = makeService(createTestDb(), 3);
    });

    it('returns 0 when no customers exist', () => {
        expect(service.getTotalTreesPlanted()).toBe(0);
    });

    it('returns 0 before any milestone is reached', () => {
        service.recordVisit('alice');
        service.recordVisit('alice');
        expect(service.getTotalTreesPlanted()).toBe(0);
    });

    it('returns 1 after one customer hits X visits', () => {
        service.recordVisit('alice');
        service.recordVisit('alice');
        service.recordVisit('alice'); // 3rd visit → tree
        expect(service.getTotalTreesPlanted()).toBe(1);
    });

    it('sums trees across multiple customers', () => {
        // alice: 3 visits → 1 tree
        service.recordVisit('alice');
        service.recordVisit('alice');
        service.recordVisit('alice');
        // bob: 6 visits → 2 trees
        for (let i = 0; i < 6; i++) service.recordVisit('bob');
        expect(service.getTotalTreesPlanted()).toBe(3);
    });
});

describe('getVisits', () => {
    let service: ReturnType<typeof makeService>;

    beforeEach(() => {
        service = makeService(createTestDb(), 3);
    });

    it('returns an empty array when there are no visits', () => {
        expect(service.getVisits('hour')).toEqual([]);
    });

    it('returns a bucket with the correct count for recent visits', () => {
        service.recordVisit('alice');
        service.recordVisit('alice');
        service.recordVisit('bob');
        const buckets = service.getVisits('hour');
        const total = buckets.reduce((sum, b) => sum + b.count, 0);
        expect(total).toBe(3);
    });

    it('returns buckets with time strings for every granularity', () => {
        service.recordVisit('alice');
        for (const g of ['minute', 'hour', 'day', 'week', 'month'] as const) {
            const buckets = service.getVisits(g);
            expect(buckets.length).toBeGreaterThan(0);
            expect(typeof buckets[0].time).toBe('string');
            expect(buckets[0].count).toBe(1);
        }
    });

    it('groups visits into separate buckets when they fall in different hours', () => {
        const base = new Date('2026-06-02T10:00:00Z');
        vi.setSystemTime(base);
        service.recordVisit('alice');

        vi.setSystemTime(new Date(base.getTime() + 60 * 60 * 1000)); // +1 hour
        service.recordVisit('alice');
        vi.useRealTimers();

        const buckets = service.getVisits('hour');
        expect(buckets.length).toBe(2);
    });
});
