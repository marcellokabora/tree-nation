<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import type { PageData } from "./$types.js";
  import { barChart, type BarChartParams } from "$lib/actions/chart.js";

  let { data }: { data: PageData } = $props();

  type Granularity = "minute" | "hour" | "day" | "week" | "month";
  const VALID_GRANULARITIES: readonly Granularity[] = [
    "minute",
    "hour",
    "day",
    "week",
    "month",
  ];
  let granularity = $derived.by(() => {
    const g = $page.url.searchParams.get("granularity");
    return (
      VALID_GRANULARITIES.includes(g as Granularity) ? g : "hour"
    ) as Granularity;
  });

  const chartMeta: Record<Granularity, { title: string; window: string }> = {
    minute: { title: "Visits per Minute", window: "last 2h" },
    hour: { title: "Visits per Hour", window: "last 24h" },
    day: { title: "Visits per Day", window: "last 30 days" },
    week: { title: "Visits per Week", window: "last 12 weeks" },
    month: { title: "Visits per Month", window: "last 12 months" },
  };

  let fresh = $state<{
    visitsPerMinute: typeof data.visitsPerMinute;
    visitsPerHour: typeof data.visitsPerHour;
    visitsPerDay: typeof data.visitsPerDay;
    visitsPerWeek: typeof data.visitsPerWeek;
    visitsPerMonth: typeof data.visitsPerMonth;
    totalTrees: number;
  } | null>(null);

  let visitsPerMinute = $derived(
    fresh?.visitsPerMinute ?? data.visitsPerMinute,
  );
  let visitsPerHour = $derived(fresh?.visitsPerHour ?? data.visitsPerHour);
  let visitsPerDay = $derived(fresh?.visitsPerDay ?? data.visitsPerDay);
  let visitsPerWeek = $derived(fresh?.visitsPerWeek ?? data.visitsPerWeek);
  let visitsPerMonth = $derived(fresh?.visitsPerMonth ?? data.visitsPerMonth);
  let totalTrees = $derived(fresh?.totalTrees ?? data.totalTrees);
  let totalVisitsToday = $derived(
    visitsPerHour.reduce((s, h) => s + h.count, 0),
  );
  let lastRefreshed = $state(new Date().toLocaleTimeString());
  let fetchError = $state<string | null>(data.loadError);

  let activeBuckets = $derived(
    granularity === "minute"
      ? visitsPerMinute
      : granularity === "day"
        ? visitsPerDay
        : granularity === "week"
          ? visitsPerWeek
          : granularity === "month"
            ? visitsPerMonth
            : visitsPerHour,
  );

  let chartReady = $state(false);
  let refreshInterval: ReturnType<typeof setInterval>;

  async function refresh() {
    try {
      const res = await fetch("/api/stats/visits");
      if (!res.ok) {
        fetchError = `Failed to refresh data (${res.status})`;
        return;
      }
      const fetched = await res.json();
      fresh = {
        visitsPerMinute: fetched.visitsPerMinute,
        visitsPerHour: fetched.visitsPerHour,
        visitsPerDay: fetched.visitsPerDay,
        visitsPerWeek: fetched.visitsPerWeek,
        visitsPerMonth: fetched.visitsPerMonth,
        totalTrees: fetched.totalTrees,
      };
      fetchError = null;
      lastRefreshed = new Date().toLocaleTimeString();
    } catch {
      fetchError = "Could not reach the server. Check your connection.";
    }
  }

  function setGranularity(g: Granularity) {
    goto(`?granularity=${g}`, {
      replaceState: true,
      noScroll: true,
      keepFocus: true,
    });
  }

  let chartData = $derived<BarChartParams["data"]>({
    labels: activeBuckets.map((b) => {
      const d = new Date(b.time);
      if (granularity === "minute" || granularity === "hour")
        return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      if (granularity === "day")
        return d.toLocaleDateString([], { month: "short", day: "numeric" });
      if (granularity === "week")
        return (
          "W/o " + d.toLocaleDateString([], { month: "short", day: "numeric" })
        );
      return d.toLocaleDateString([], { month: "short", year: "numeric" });
    }),
    datasets: [
      {
        label: "Visits",
        data: activeBuckets.map((b) => b.count),
        backgroundColor: "rgba(34,197,94,0.6)",
        borderColor: "rgba(22,163,74,1)",
        borderWidth: 1,
        borderRadius: 4,
      },
    ],
  });

  onMount(() => {
    refreshInterval = setInterval(refresh, 30_000);
  });

  onDestroy(() => {
    clearInterval(refreshInterval);
  });
</script>

<svelte:head>
  <title>Tree Nation Dashboard</title>
</svelte:head>

<main class="max-w-[860px] mx-auto px-4 py-8">
  {#if fetchError}
    <div
      class="mb-6 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700"
    >
      ⚠️ {fetchError}
    </div>
  {/if}
  <header class="text-center mb-8">
    <h1 class="text-3xl m-0">🌳 Tree Nation Dashboard</h1>
    <p class="text-brand-muted mt-1 m-0">Shop visits → planted trees</p>
  </header>

  <section class="flex flex-wrap gap-4 mb-8 justify-center">
    <div
      class="bg-brand-surface border border-brand-border rounded-xl px-10 py-6 text-center flex-1 min-w-[140px] shadow-sm"
    >
      <span class="block text-5xl font-bold leading-none"
        >{totalVisitsToday}</span
      >
      <span class="block text-sm text-brand-label mt-1.5"
        >Visits (last 24h)</span
      >
    </div>
    <div
      class="bg-brand-accent border border-brand-border-strong rounded-xl px-10 py-6 text-center flex-1 min-w-[140px] shadow-sm"
    >
      <span class="block text-5xl font-bold leading-none">{totalTrees}</span>
      <span class="block text-sm text-brand-label mt-1.5">Trees Planted</span>
    </div>
  </section>

  <section
    class="bg-brand-surface border border-brand-border rounded-xl p-6 shadow-sm"
  >
    <div class="flex items-start justify-between gap-4 mb-4">
      <h2 class="m-0 text-lg">
        {chartMeta[granularity].title}
        <small class="font-normal text-brand-muted max-sm:block"
          >({chartMeta[granularity].window})</small
        >
      </h2>
      <div>
        <!-- Mobile: dropdown -->
        <select
          class="sm:hidden border border-brand-border-strong rounded-md px-2 py-1 text-xs text-brand-label bg-brand-surface cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-primary"
          value={granularity}
          onchange={(e) =>
            setGranularity(
              (e.currentTarget as HTMLSelectElement).value as Granularity,
            )}
        >
          <option value="minute">Minute</option>
          <option value="hour">Hour</option>
          <option value="day">Day</option>
          <option value="week">Week</option>
          <option value="month">Month</option>
        </select>
        <!-- Desktop: button group -->
        <div class="hidden sm:flex gap-1">
          <button
            class="border rounded-md px-3 py-1 cursor-pointer text-xs {granularity ===
            'minute'
              ? 'bg-brand-primary text-white border-brand-primary'
              : 'bg-transparent text-brand-label border-brand-border-strong hover:bg-brand-accent'}"
            onclick={() => setGranularity("minute")}>Minute</button
          >
          <button
            class="border rounded-md px-3 py-1 cursor-pointer text-xs {granularity ===
            'hour'
              ? 'bg-brand-primary text-white border-brand-primary'
              : 'bg-transparent text-brand-label border-brand-border-strong hover:bg-brand-accent'}"
            onclick={() => setGranularity("hour")}>Hour</button
          >
          <button
            class="border rounded-md px-3 py-1 cursor-pointer text-xs {granularity ===
            'day'
              ? 'bg-brand-primary text-white border-brand-primary'
              : 'bg-transparent text-brand-label border-brand-border-strong hover:bg-brand-accent'}"
            onclick={() => setGranularity("day")}>Day</button
          >
          <button
            class="border rounded-md px-3 py-1 cursor-pointer text-xs {granularity ===
            'week'
              ? 'bg-brand-primary text-white border-brand-primary'
              : 'bg-transparent text-brand-label border-brand-border-strong hover:bg-brand-accent'}"
            onclick={() => setGranularity("week")}>Week</button
          >
          <button
            class="border rounded-md px-3 py-1 cursor-pointer text-xs {granularity ===
            'month'
              ? 'bg-brand-primary text-white border-brand-primary'
              : 'bg-transparent text-brand-label border-brand-border-strong hover:bg-brand-accent'}"
            onclick={() => setGranularity("month")}>Month</button
          >
        </div>
      </div>
    </div>
    <div class="relative h-64">
      <canvas
        use:barChart={{ data: chartData, onReady: () => (chartReady = true) }}
      ></canvas>
      {#if !chartReady}
        <div class="absolute inset-0 flex items-center justify-center">
          <div
            class="w-10 h-10 border-4 border-brand-border border-t-brand-primary rounded-full animate-spin"
          ></div>
        </div>
      {/if}
    </div>
    {#if visitsPerHour.length === 0}
      <p class="text-center text-brand-subtle italic">
        No visits recorded yet. Send a visit event to get started.
      </p>
    {/if}
  </section>

  <footer
    class="mt-6 flex flex-col sm:flex-row sm:justify-between items-center gap-3 text-xs text-brand-muted"
  >
    <span class="text-center sm:text-left"
      >Auto-refreshes every 30s · Last refreshed: {lastRefreshed}</span
    >
  </footer>
</main>
