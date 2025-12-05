// File: wwwroot/js/charts.js
// Minimal Chart.js helpers used across dashboards & reports

(function () {
    // Create a simple line chart (single series)
    function mkLineChart(ctx, labels, series, label, color = 'rgba(59,130,246,0.9)') {
        return new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label,
                    data: series,
                    borderColor: color,
                    backgroundColor: 'transparent',
                    fill: false,
                    tension: 0.25,
                    pointRadius: 0
                }]
            },
            options: baseOptions()
        });
    }

    // Create a comparison line chart (two series)
    function mkCompareChart(ctx, labels, a, b, labelA = 'Period A', labelB = 'Period B') {
        return new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [
                    {
                        label: labelA,
                        data: a,
                        borderColor: 'rgba(59,130,246,0.9)',
                        backgroundColor: 'transparent',
                        fill: false,
                        tension: 0.25,
                        pointRadius: 0
                    },
                    {
                        label: labelB,
                        data: b,
                        borderColor: 'rgba(34,197,94,0.9)',
                        backgroundColor: 'transparent',
                        fill: false,
                        tension: 0.25,
                        pointRadius: 0
                    }
                ]
            },
            options: baseOptions()
        });
    }

    // Base dark-friendly options
    function baseOptions() {
        return {
            responsive: true,
            maintainAspectRatio: true,
            animation: false,
            plugins: {
                legend: {
                    labels: { color: '#e8e9ee', boxWidth: 12 }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            },
            interaction: { mode: 'index', intersect: false },
            scales: {
                x: {
                    grid: { color: 'rgba(255,255,255,0.06)' },
                    ticks: { color: '#cbd5e1', maxRotation: 0 }
                },
                y: {
                    grid: { color: 'rgba(255,255,255,0.06)' },
                    ticks: { color: '#cbd5e1' }
                }
            }
        };
    }

    // Expose
    window.Charts = { mkLineChart, mkCompareChart };
})();
