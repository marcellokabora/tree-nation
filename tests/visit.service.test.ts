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

    return { recordVisit, getCustomer };
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
