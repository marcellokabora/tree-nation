import { json } from '@sveltejs/kit';
import { getVisits, getTotalTreesPlanted } from '$lib/services/visit.service.js';

export function GET() {
    const totalTrees = getTotalTreesPlanted();
    return json({
        visitsPerMinute: getVisits('minute'),
        visitsPerHour: getVisits('hour'),
        visitsPerDay: getVisits('day'),
        visitsPerWeek: getVisits('week'),
        visitsPerMonth: getVisits('month'),
        totalTrees,
    });
}
