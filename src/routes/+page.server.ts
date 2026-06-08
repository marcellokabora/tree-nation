import type { PageServerLoad } from './$types.js';
import { getVisits, getTotalTreesPlanted } from '$lib/services/visit.service.js';

export const load: PageServerLoad = () => {
    return {
        visitsPerMinute: getVisits('minute'),
        visitsPerHour: getVisits('hour'),
        visitsPerDay: getVisits('day'),
        visitsPerWeek: getVisits('week'),
        visitsPerMonth: getVisits('month'),
        totalTrees: getTotalTreesPlanted(),
    };
};
