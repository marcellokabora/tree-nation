import { json } from '@sveltejs/kit';
import { getCustomer } from '$lib/services/visit.service';
import type { RequestHandler } from './$types.js';

export const GET: RequestHandler = ({ params }) => {
    const customer = getCustomer(params.id);

    if (!customer) {
        return json({ error: 'Customer not found' }, { status: 404 });
    }

    return json({
        customerId: customer.id,
        totalVisits: customer.totalVisits,
        treesPlanted: customer.treesPlanted,
        lastConnection: customer.lastConnection
    });
};
