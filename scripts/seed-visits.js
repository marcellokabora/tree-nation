/**
 * Sends N visits to the local dev server to seed the dashboard with test data.
 * Usage: npm run seed [-- --visits=15 --customer=my-id --url=http://localhost:5173]
 */

const args = Object.fromEntries(
    process.argv.slice(2).map(a => a.replace('--', '').split('='))
);

const BASE_URL = args.url ?? process.env.npm_config_url ?? 'http://localhost:5173';
const CUSTOMER_ID = args.customer ?? process.env.npm_config_customer ?? 'test-customer-1';
const TOTAL_VISITS = Number(args.visits ?? args.visit ?? process.env.npm_config_visits ?? process.env.npm_config_visit ?? 10);

console.log(`Sending ${TOTAL_VISITS} visits for "${CUSTOMER_ID}" to ${BASE_URL}...\n`);

for (let i = 1; i <= TOTAL_VISITS; i++) {
    const res = await fetch(`${BASE_URL}/api/visits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: CUSTOMER_ID }),
    });

    if (!res.ok) {
        console.error(`Visit ${i} failed: ${res.status} ${res.statusText}`);
        process.exit(1);
    }

    const data = await res.json();
    const tree = data.treesPlanted > 0 ? ` 🌳 trees planted: ${data.treesPlanted}` : '';
    console.log(`Visit ${String(i).padStart(3, ' ')}: totalVisits=${data.totalVisits}${tree}`);
}

console.log('\nDone! Open the dashboard and click "Refresh now".');
