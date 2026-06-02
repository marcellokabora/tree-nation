import { getVisits, getTotalTreesPlanted } from '$lib/services/visit.service.js';
import type { PageServerLoad } from './$types.js';

const EMPTY = { visitsPerMinute: [], visitsPerHour: [], visitsPerDay: [], visitsPerWeek: [], visitsPerMonth: [], totalTrees: 0, totalVisitsToday: 0 };

export const load: PageServerLoad = () => {
    try {
        // throw new Error('simulated failure');

        const visitsPerMinute = getVisits('minute');
        const visitsPerHour = getVisits('hour');
        const visitsPerDay = getVisits('day');
        const visitsPerWeek = getVisits('week');
        const visitsPerMonth = getVisits('month');
        const totalTrees = getTotalTreesPlanted();
        const totalVisitsToday = visitsPerHour.reduce((sum, h) => sum + h.count, 0);

        return { ...EMPTY, visitsPerMinute, visitsPerHour, visitsPerDay, visitsPerWeek, visitsPerMonth, totalTrees, totalVisitsToday, loadError: null };
    } catch {
        return { ...EMPTY, loadError: 'Failed to load dashboard data. Please refresh.' };
    }
};
