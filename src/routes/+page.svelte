<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { barChart, type BarChartParams } from "$lib/actions/chart.js";
  import logo from "$lib/assets/logo.png";
  import type { PageData } from "./$types.js";

  let { data }: { data: PageData } = $props();

  type Period = "minute" | "hour" | "day" | "week" | "month";
  type VisitBucket = { time: string; count: number };

  const VALID_PERIODS: readonly Period[] = [
    "minute",
    "hour",
    "day",
    "week",
    "month",
  ];
  let period = $derived.by(() => {
    const g = $page.url.searchParams.get("period");
    return (VALID_PERIODS.includes(g as Period) ? g : "hour") as Period;
  });

  const chartMeta: Record<Period, { title: string; window: string }> = {
    minute: { title: "Visits per Minute", window: "last 2h" },
    hour: { title: "Visits per Hour", window: "last 24h" },
    day: { title: "Visits per Day", window: "last 30 days" },
    week: { title: "Visits per Week", window: "last 12 weeks" },
    month: { title: "Visits per Month", window: "last 12 months" },
  };

  let visitsPerMinute = $state<VisitBucket[]>(data.visitsPerMinute);
  let visitsPerHour = $state<VisitBucket[]>(data.visitsPerHour);
  let visitsPerDay = $state<VisitBucket[]>(data.visitsPerDay);
  let visitsPerWeek = $state<VisitBucket[]>(data.visitsPerWeek);
  let visitsPerMonth = $state<VisitBucket[]>(data.visitsPerMonth);
  let totalTrees = $state(data.totalTrees);
  let activeBuckets = $derived(
    period === "minute"
      ? visitsPerMinute
      : period === "day"
        ? visitsPerDay
        : period === "week"
          ? visitsPerWeek
          : period === "month"
            ? visitsPerMonth
            : visitsPerHour,
  );
  let totalVisitsToday = $derived(
    activeBuckets.reduce((s, h) => s + h.count, 0),
  );
  let lastRefreshed = $state(new Date().toLocaleTimeString());
  let fetchError = $state<string | null>(null);

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
      visitsPerMinute = fetched.visitsPerMinute;
      visitsPerHour = fetched.visitsPerHour;
      visitsPerDay = fetched.visitsPerDay;
      visitsPerWeek = fetched.visitsPerWeek;
      visitsPerMonth = fetched.visitsPerMonth;
      totalTrees = fetched.totalTrees;
      fetchError = null;
      lastRefreshed = new Date().toLocaleTimeString();
    } catch {
      fetchError = "Could not reach the server. Check your connection.";
    }
  }

  function setPeriod(g: Period) {
    goto(`?period=${g}`, {
      replaceState: true,
      noScroll: true,
      keepFocus: true,
    });
  }

  let chartData = $derived<BarChartParams["data"]>({
    labels: activeBuckets.map((b) => {
      const d = new Date(b.time);
      if (period === "minute" || period === "hour")
        return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      if (period === "day")
        return d.toLocaleDateString([], { month: "short", day: "numeric" });
      if (period === "week")
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
    refresh();
    refreshInterval = setInterval(refresh, 30_000);
  });

  onDestroy(() => {
    clearInterval(refreshInterval);
  });
</script>

<svelte:head>
  <title>Tree Nation Dashboard</title>
</svelte:head>

<main class="max-w-215 mx-auto px-4 py-8">
  {#if fetchError}
    <div
      class="mb-6 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700"
    >
      ⚠️ {fetchError}
    </div>
  {/if}
  <header class="text-center mb-8">
    <h1
      class="text-3xl m-0 flex flex-col sm:flex-row items-center justify-center gap-3"
    >
      <img src={logo} alt="Tree Nation logo" class="h-10 w-10" />
      Tree Nation Dashboard
    </h1>
    <p class="text-brand-muted mt-1 m-0">Shop visits → planted trees</p>
  </header>

  <section class="flex flex-wrap gap-4 mb-8 justify-center">
    <div
      class="bg-brand-surface border border-brand-border rounded-xl px-10 py-6 text-center flex-1 min-w-35 shadow-sm"
    >
      <span class="block text-5xl font-bold leading-none"
        >{totalVisitsToday}</span
      >
      <span class="block text-sm text-brand-label mt-1.5"
        >Visits ({chartMeta[period].window})</span
      >
    </div>
    <div
      class="bg-brand-accent border border-brand-border-strong rounded-xl px-10 py-6 text-center flex-1 min-w-35 shadow-sm"
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
        {chartMeta[period].title}
        <small class="font-normal text-brand-muted max-sm:block"
          >({chartMeta[period].window})</small
        >
      </h2>
      <div>
        <!-- Mobile: dropdown -->
        <select
          class="sm:hidden border border-brand-border-strong rounded-md px-2 py-1 text-xs text-brand-label bg-brand-surface cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-primary"
          value={period}
          onchange={(e) =>
            setPeriod((e.currentTarget as HTMLSelectElement).value as Period)}
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
            class="border rounded-md px-3 py-1 cursor-pointer text-xs {period ===
            'minute'
              ? 'bg-brand-primary text-white border-brand-primary'
              : 'bg-transparent text-brand-label border-brand-border-strong hover:bg-brand-accent'}"
            onclick={() => setPeriod("minute")}>Minute</button
          >
          <button
            class="border rounded-md px-3 py-1 cursor-pointer text-xs {period ===
            'hour'
              ? 'bg-brand-primary text-white border-brand-primary'
              : 'bg-transparent text-brand-label border-brand-border-strong hover:bg-brand-accent'}"
            onclick={() => setPeriod("hour")}>Hour</button
          >
          <button
            class="border rounded-md px-3 py-1 cursor-pointer text-xs {period ===
            'day'
              ? 'bg-brand-primary text-white border-brand-primary'
              : 'bg-transparent text-brand-label border-brand-border-strong hover:bg-brand-accent'}"
            onclick={() => setPeriod("day")}>Day</button
          >
          <button
            class="border rounded-md px-3 py-1 cursor-pointer text-xs {period ===
            'week'
              ? 'bg-brand-primary text-white border-brand-primary'
              : 'bg-transparent text-brand-label border-brand-border-strong hover:bg-brand-accent'}"
            onclick={() => setPeriod("week")}>Week</button
          >
          <button
            class="border rounded-md px-3 py-1 cursor-pointer text-xs {period ===
            'month'
              ? 'bg-brand-primary text-white border-brand-primary'
              : 'bg-transparent text-brand-label border-brand-border-strong hover:bg-brand-accent'}"
            onclick={() => setPeriod("month")}>Month</button
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
