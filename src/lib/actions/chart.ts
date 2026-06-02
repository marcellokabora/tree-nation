import type { ChartData } from "chart.js";

export type BarChartParams = {
    data: ChartData<"bar">;
    onReady?: () => void;
};

export function barChart(canvas: HTMLCanvasElement, params: BarChartParams) {
    let chart: import("chart.js").Chart | null = null;
    let latestParams = params;

    import("chart.js/auto").then(({ default: Chart }) => {
        chart = new Chart(canvas, {
            type: "bar",
            data: latestParams.data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, ticks: { stepSize: 1 } },
                },
            },
        });
        latestParams.onReady?.();
    });

    return {
        update(newParams: BarChartParams) {
            latestParams = newParams;
            if (!chart) return;
            chart.data = newParams.data;
            chart.update();
        },
        destroy() {
            chart?.destroy();
        },
    };
}
