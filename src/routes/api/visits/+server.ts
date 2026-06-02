import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { recordVisit } from '$lib/services/visit.service.js';

const VisitSchema = z.object({
    customerId: z.string().min(1, 'customerId is required')
});

export async function POST({ request }) {
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const result = VisitSchema.safeParse(body);
    if (!result.success) {
        return json({ error: result.error.issues[0].message }, { status: 400 });
    }

    const customer = recordVisit(result.data.customerId);

    return json({
        customerId: customer.id,
        totalVisits: customer.totalVisits,
        treesPlanted: customer.treesPlanted,
        lastConnection: customer.lastConnection
    });
}
