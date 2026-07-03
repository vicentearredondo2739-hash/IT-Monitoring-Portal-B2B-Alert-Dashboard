// ==========================================
// Dashboard de Alertas — IT Monitoring Portal
// Carga datos desde API o localStorage
// ==========================================

let chartDonut = null;
let chartPie = null;
let chartBarSeverities = null;
let currentData = null;
let currentFilter = 'CRITICAL';

document.addEventListener('DOMContentLoaded', () => {
    loadReport();

    // Header Clock
    setInterval(() => {
        const clockEl = document.getElementById('headerClock');
        if (clockEl) {
            const now = new Date();
            const dd = String(now.getDate()).padStart(2, '0');
            const mm = String(now.getMonth() + 1).padStart(2, '0');
            const yyyy = now.getFullYear();
            const hh = String(now.getHours()).padStart(2, '0');
            const min = String(now.getMinutes()).padStart(2, '0');
            const ss = String(now.getSeconds()).padStart(2, '0');
            clockEl.innerHTML = `<span class="material-symbols-outlined text-[14px]">schedule</span> ${dd}/${mm}/${yyyy} &nbsp; ${hh}:${min}:${ss}`;
        }
    }, 1000);

    // Setup Download Buttons
    setupDownloadButtons();

    // Setup Alert Search
    setupSearchBox();
});

// ========================
// Export & Download Logic
// ========================
function setupDownloadButtons() {
    const btnPDF = document.getElementById('btnDownloadPDF');
    const btnCSV = document.getElementById('btnDownloadCSV');

    if (btnPDF) {
        btnPDF.addEventListener('click', () => {
            if (!currentData) return;

            // Reemplazamos la ventana de impresión nativa por html2pdf
            // que saca un "screenshot vectorial" del dashboard manteniendo el fondo oscuro
            const mainElement = document.querySelector('main') || document.body;

            // Opcional: Expandir áreas con scroll antes de generar el PDF para que salga completo
            const drilldownSec = document.getElementById('drilldownSection');
            const originalMaxHeight = drilldownSec ? drilldownSec.style.maxHeight : '';
            if (drilldownSec) drilldownSec.style.maxHeight = 'none';

            const opt = {
                margin:       10,
                filename:     `Dashboard_${currentData.company_id || 'Reporte'}_${(currentData.periodo || '').replace(/\s/g, '_')}.pdf`,
                image:        { type: 'jpeg', quality: 0.98 },
                html2canvas:  { scale: 2, useCORS: true, backgroundColor: '#131314' },
                jsPDF:        { unit: 'mm', format: 'a3', orientation: 'landscape' }
            };

            // Mostrar estado de carga en el botón
            const originalHTML = btnPDF.innerHTML;
            btnPDF.innerHTML = '<span class="material-symbols-outlined animate-spin text-[20px]">sync</span>';

            html2pdf().set(opt).from(mainElement).save().then(() => {
                // Restaurar interface
                if (drilldownSec) drilldownSec.style.maxHeight = originalMaxHeight;
                btnPDF.innerHTML = originalHTML;
            });
        });
    }

    if (btnCSV) {
        btnCSV.addEventListener('click', () => {
            if (!currentData || !currentData.allDevices) return;

            // Mostrar estado de carga
            const originalHTML = btnCSV.innerHTML;
            btnCSV.innerHTML = '<span class="material-symbols-outlined animate-spin text-[20px]">sync</span>';

            try {
                // 1. Inicializar Workbook de ExcelJS
                const workbook = new ExcelJS.Workbook();
                workbook.creator = 'IT Monitoring Portal';
                workbook.created = new Date();

                // 2. Crear Configuración Visual de la Hoja
                const worksheet = workbook.addWorksheet('Reporte de Alertas', {
                    properties: { tabColor: { argb: 'FF00FF00' } },
                    pageSetup: { paperSize: 9, orientation: 'landscape' }
                });

                // 3. (REMOVIDO) Gráficos no se incrustan a petición del usuario.
                let currentRowOffset = 1;

                // Escribir un título
                worksheet.getCell(`A${currentRowOffset}`).value = `INFORME DETALLADO DE ALERTAS - ${currentData.company_id} (${currentData.periodo})`;
                worksheet.getCell(`A${currentRowOffset}`).font = { size: 16, bold: true };
                currentRowOffset += 2;

                // 4. Configurar Columnas de la Tabla Principal
                const headerRow = currentRowOffset;
                worksheet.columns = [
                    { header: 'Objeto / Dispositivo', key: 'dispositivo', width: 35 },
                    { header: 'Fecha y Hora', key: 'fecha', width: 25 },
                    { header: 'Servicio Afectado', key: 'servicio', width: 40 },
                    { header: 'Estado (Acknowledge)', key: 'status', width: 20 },
                    { header: 'Información y Detalles', key: 'info', width: 100 }
                ];

                // Mover los headers a la fila correcta si iteramos offsets (trick: reasignar headers a fila offset)
                worksheet.getRow(1).values = []; // Limpiar la primera fila por defecto de columns

                const tableHeaders = ['Objeto / Dispositivo', 'Fecha y Hora', 'Servicio Afectado', 'Estado (Acknowledge)', 'Información y Detalles'];
                worksheet.getRow(headerRow).values = tableHeaders;
                worksheet.getRow(headerRow).font = { bold: true, color: { argb: 'FFFFFFFF'} };
                worksheet.getRow(headerRow).fill = { type: 'pattern', pattern:'solid', fgColor:{ argb:'FF2a2a2b'} };

                let rowIndex = headerRow + 1;

                // 5. Volcar todas las alertas según el filtro activo
                let exportData = window.lastFilteredData || currentData;
                exportData.allDevices.forEach(device => {
                    if (device.details && device.details.length > 0) {
                        device.details.forEach(alert => {
                            worksheet.getRow(rowIndex).values = {
                                dispositivo: device.name || 'N/A',
                                fecha: alert.fecha || '',
                                servicio: alert.servicio || '',
                                status: alert.acknowledge || '',
                                info: alert.data || ''
                            };
                            rowIndex++;
                        });
                    } else {
                        // Fallback por si hay un dispositivo viejo sin detalles
                        worksheet.getRow(rowIndex).values = {
                            dispositivo: device.name || 'N/A',
                            fecha: 'N/A',
                            servicio: 'Múltiples',
                            status: 'N/A',
                            info: `${device.count} alertas registradas (Resumen)`
                        };
                        rowIndex++;
                    }
                });

                // Auto-filtros
                worksheet.autoFilter = `A${headerRow}:E${rowIndex - 1}`;

                // 6. Generar Descarga del Buffer asíncronamente
                workbook.xlsx.writeBuffer().then(buffer => {
                    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `Reporte_${currentData.company_id || 'Export'}_${(currentData.periodo || '').replace(/\s/g, '_')}.xlsx`;
                    document.body.appendChild(a);
                    a.click();
                    setTimeout(() => {
                        document.body.removeChild(a);
                        window.URL.revokeObjectURL(url);
                        btnCSV.innerHTML = originalHTML;
                    }, 100);
                });

            } catch(e) {
                console.error("Error construyendo ExcelJS:", e);
                btnCSV.innerHTML = originalHTML;
                alert("Ocurrió un error al generar el Excel. Verifica que tienes conexión para cargar las librerías CDN.");
            }
        });
    }
}

// ========================
// IndexedDB Helper
// ========================
function loadFromIndexedDB(key) {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('ITMonitorDB', 1);

        request.onupgradeneeded = function(e) {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('reportsStore')) {
                db.createObjectStore('reportsStore');
            }
        };

        request.onsuccess = function(e) {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('reportsStore')) {
                db.close();
                resolve(null);
                return;
            }
            const tx = db.transaction('reportsStore', 'readonly');
            const store = tx.objectStore('reportsStore');
            const getReq = store.get(key);

            getReq.onsuccess = () => resolve(getReq.result || null);
            getReq.onerror = () => reject(getReq.error);

            tx.oncomplete = () => db.close();
        };

        request.onerror = () => reject(request.error);
    });
}

// ========================
// LOAD: Try API first, then IndexedDB
// ========================
async function loadReport() {
    const user = JSON.parse(localStorage.getItem('itm_portal_user') || '{}');
    const clientIdEl = document.getElementById('headerClientId');
    if (clientIdEl) clientIdEl.innerText = user.client_id || 'LOCAL';

    let localData = null;
    try {
        localData = await loadFromIndexedDB('itm_report_data');
    } catch(e) {
        console.error("No se pudo leer de IndexedDB", e);
    }

    // If admin opened from admin panel, use local data
    if (user.role === 'admin' && localData) {
        currentData = localData;
        renderDashboard(currentData);
        // Admin preview mode -> just show the current report
        renderReportSelector([{ periodo: currentData.periodo, total_alerts: currentData.totalAlerts, report_json: JSON.stringify(currentData) }]);
        return;
    }

    // Try API for client users (filtered by their company)
    try {
        const clientId = user.client_id || '';

        // Step 1: fetch report list only (no JSON payload) — instant
        const listResp = await fetch('api/get_report.php?client_id=' + encodeURIComponent(clientId));
        const listResult = await listResp.json();

        if (listResult.success && listResult.reports && listResult.reports.length > 0) {
            const finalReports = aggregateReportsByMonth(listResult.reports);
            renderReportSelector(finalReports, clientId);

            // Step 2: lazy load the most recent report's full JSON
            const firstReal = finalReports.find(r => r.id && !String(r.id).startsWith('cons_'));
            if (firstReal) {
                const detailResp = await fetch('api/get_report.php?client_id=' + encodeURIComponent(clientId) + '&id=' + firstReal.id);
                const detailResult = await detailResp.json();
                if (detailResult.success && detailResult.report) {
                    currentData = JSON.parse(detailResult.report.report_json);
                    setupFilters();
                    renderDashboard(currentData);
                }
            }
            return;
        }
    } catch (e) {
        console.log('API not available, trying local data');
    }

    // Fallback to local data
    if (localData) {
        currentData = localData;
        setupFilters();
        renderDashboard(currentData);
        renderReportSelector([{ periodo: currentData.periodo, total_alerts: currentData.totalAlerts, report_json: JSON.stringify(currentData) }]);
    } else {
        renderEmptyState();
    }
}

// ========================
// Aggregation & Filters
// ========================
const MESES_ES = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
function monthKeyToLabel(mKey) {
    var parts = (mKey || '').split('-');
    var mes = MESES_ES[parseInt(parts[1], 10) - 1] || mKey;
    return mes + '-' + parts[0];
}

function aggregateReportsByMonth(reports) {
    let monthlyGroups = {};
    reports.forEach(r => {
        // Group by the periodo field (e.g. "2026-05-01 → 2026-05-31") — first 7 chars = "YYYY-MM"
        let monthKey = (r.periodo || '').substring(0, 7);
        if (!monthKey || monthKey.length < 7) monthKey = (r.date_from || r.created_at || '').substring(0, 7);
        if (!monthlyGroups[monthKey]) monthlyGroups[monthKey] = [];
        monthlyGroups[monthKey].push(r);
    });

    let consolidated = [];
    Object.keys(monthlyGroups).forEach(mKey => {
        let group = monthlyGroups[mKey];
        if (group.length > 1) {
            var sumAlerts = group.reduce((s, r) => s + parseInt(r.total_alerts || 0), 0);
            consolidated.push({
                id: 'cons_' + mKey,
                _constituentIds: group.map(r => r.id),
                periodo: monthKeyToLabel(mKey),
                total_alerts: sumAlerts,
                _reportCount: group.length,
                date_from: group[0].date_from,
                report_json: null
            });
        }
    });

    consolidated.sort((a, b) => b.id.localeCompare(a.id));
    return consolidated.concat(reports);
}

function mergeReportDataClient(oldD, newD) {
    var merged = JSON.parse(JSON.stringify(oldD));
    merged.totalAlerts += newD.totalAlerts;
    merged.totalMonitored = Math.max(merged.totalMonitored || 0, newD.totalMonitored || 0);

    if (newD.categories) {
        if (!merged.categories) merged.categories = {};
        Object.keys(newD.categories).forEach(cat => {
            merged.categories[cat] = (merged.categories[cat] || 0) + newD.categories[cat];
        });
    }

    var map = {};
    if (oldD.allDevices) {
        oldD.allDevices.forEach(d => {
            map[d.name] = { count: d.count, services: d.services || {}, details: d.details || [] };
        });
    }
    if (newD.allDevices) {
        newD.allDevices.forEach(d => {
            if (!map[d.name]) map[d.name] = { count: 0, services: {}, details: [] };
            map[d.name].count += d.count;
            if (d.services) {
                Object.keys(d.services).forEach(s => {
                    map[d.name].services[s] = (map[d.name].services[s] || 0) + d.services[s];
                });
            }
            if (d.details) map[d.name].details = map[d.name].details.concat(d.details);
        });
    }

    var sorted = Object.keys(map).map(name => {
        return { name, count: map[name].count, services: map[name].services, details: map[name].details };
    }).sort((a,b) => b.count - a.count);

    merged.allDevices = sorted;
    merged.top10 = sorted.slice(0, 10);
    merged.totalDevices = sorted.length;
    merged.topDevice = sorted[0] ? sorted[0].name : '-';

    return merged;
}

function setupFilters() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            document.querySelectorAll('.filter-btn').forEach(b => {
                b.classList.remove('active', 'bg-red-400', 'text-red-900', 'bg-orange-400', 'text-orange-900', 'bg-purple-400', 'text-purple-900', 'bg-yellow-400', 'text-yellow-900', 'bg-gray-400', 'text-gray-900', 'bg-blue-400', 'text-blue-900');
                b.classList.add('bg-surface-container-highest', 'text-on-surface-variant');
            });
            this.classList.remove('bg-surface-container-highest', 'text-on-surface-variant');

            currentFilter = this.getAttribute('data-filter');
            if(currentFilter === 'CRITICAL') this.classList.add('active', 'bg-red-400', 'text-red-900');
            else if(currentFilter === 'ERROR') this.classList.add('active', 'bg-orange-400', 'text-orange-900');
            else if(currentFilter === 'DOWN') this.classList.add('active', 'bg-purple-400', 'text-purple-900');
            else if(currentFilter === 'WARNING') this.classList.add('active', 'bg-yellow-400', 'text-yellow-900');
            else if(currentFilter === 'UNKNOWN') this.classList.add('active', 'bg-gray-400', 'text-gray-900');
            else this.classList.add('active', 'bg-blue-400', 'text-blue-900');

            filterAndRenderCharts(currentData);
        });
    });
}

function getFilteredData(data, filterType) {
    if (filterType === 'ALL') return data;

    let filteredCount = 0;
    let filteredDevicesMap = {};

    (data.allDevices || []).forEach(d => {
        if (!d.details) return;
        let localCount = 0;
        let localDetails = [];

        d.details.forEach(alert => {
            let st = (alert.acknowledge || alert.severity || '-').toUpperCase();
            let keep = false;

            // Matcheo estrícto para los nuevos 5 filtros
            if (filterType === 'CRITICAL') keep = (st === 'CRITICAL');
            else if (filterType === 'ERROR') keep = (st === 'ERROR');
            else if (filterType === 'DOWN') keep = (st === 'DOWN');
            else if (filterType === 'WARNING') keep = (st === 'WARNING' || st === 'WARN');
            else if (filterType === 'UNKNOWN') keep = (st === 'UNKNOWN');

            if (keep) {
                localCount++;
                filteredCount++;
                localDetails.push(alert);
            }
        });

        if (localCount > 0) {
            filteredDevicesMap[d.name] = { name: d.name, count: localCount, details: localDetails };
        }
    });

    let sorted = Object.values(filteredDevicesMap).sort((a,b) => b.count - a.count);
    let pd = JSON.parse(JSON.stringify(data));
    pd.totalAlerts = filteredCount;
    pd.allDevices = sorted;
    pd.top10 = sorted.slice(0,10);
    pd.topDevice = pd.top10[0] ? pd.top10[0].name : '-';
    return pd;
}

// ========================
// Render Report Selector
// ========================
function renderReportSelector(reports, clientId) {
    const reportPicker = document.getElementById('reportPicker');
    if (!reportPicker) return;

    let html = '';
    reports.forEach(function(r, i) {
        let label;
        if (r._constituentIds) {
            label = r.periodo + ' (' + parseInt(r.total_alerts || 0).toLocaleString() + ' alertas)';
        } else {
            label = r.periodo + ' (' + parseInt(r.total_alerts || 0).toLocaleString() + ' alertas)';
        }
        html += '<option value="' + i + '">' + label + '</option>';
    });
    reportPicker.innerHTML = html;

    const newPicker = reportPicker.cloneNode(true);
    reportPicker.parentNode.replaceChild(newPicker, reportPicker);

    newPicker.addEventListener('change', async function(e) {
        var idx = parseInt(e.target.value);
        var selected = reports[idx];

        newPicker.disabled = true;
        newPicker.innerHTML = '<option>Cargando informe...</option>';

        try {
            if (selected._constituentIds) {
                // Consolidated monthly: fetch and merge all constituent reports
                let mergedData = null;
                for (let rid of selected._constituentIds) {
                    const res = await fetch('api/get_report.php?client_id=' + encodeURIComponent(clientId) + '&id=' + rid);
                    const result = await res.json();
                    if (result.success && result.report) {
                        let data = JSON.parse(result.report.report_json);
                        mergedData = mergedData ? mergeReportDataClient(mergedData, data) : data;
                    }
                }
                if (mergedData) {
                    mergedData.periodo = selected.periodo;
                    currentData = mergedData;
                    // Update picker label with real merged total
                    var opt = newPicker.options[idx];
                    if (opt) opt.text = selected.periodo + ' (' + mergedData.totalAlerts.toLocaleString() + ' alertas)';
                }
            } else {
                // Single report lazy load
                const res = await fetch('api/get_report.php?client_id=' + encodeURIComponent(clientId) + '&id=' + selected.id);
                const result = await res.json();
                if (result.success && result.report) {
                    currentData = JSON.parse(result.report.report_json);
                }
            }

            renderDashboard(currentData);
            setupFilters();

            // Refresh active search against new report
            var searchInput = document.getElementById('alertSearchInput');
            var searchResults = document.getElementById('searchResults');
            var clearBtn = document.getElementById('clearSearch');
            if (searchInput) {
                var q = searchInput.value.trim();
                if (q.length > 0) {
                    runSearch(q.toLowerCase());
                } else {
                    if (searchResults) searchResults.classList.add('hidden');
                    if (clearBtn) clearBtn.classList.add('hidden');
                }
            }
        } catch(err) {
            console.error('Error cargando reporte:', err);
        }

        // Restore picker
        newPicker.disabled = false;
        newPicker.innerHTML = html;
        newPicker.value = idx;
    });
}

// ========================
// Render Dashboard
// ========================
function renderDashboard(data) {
    // Company info
    const companyInfo = document.getElementById('companyInfo');
    if (companyInfo) {
        companyInfo.innerText = data.company_name || '-';
    }

    // KPI Cards
    document.getElementById('kpiTotal').innerText = data.totalAlerts.toLocaleString();
    document.getElementById('kpiDevices').innerText = data.totalDevices;
    document.getElementById('kpiTopDevice').innerText = data.topDevice || '-';

    document.getElementById('kpiMonitored').innerText = data.totalMonitored || 'N/A';

    // Period info
    const periodEl = document.getElementById('kpiPeriod');
    if (periodEl) {
        periodEl.innerText = data.periodo || '-';
    }

    // Render global stats bar chart
    renderBarChartSeverities(data);

    // Render specific charts dynamically by filter
    filterAndRenderCharts(data);
}

function filterAndRenderCharts(data) {
    let filteredData = getFilteredData(data, currentFilter);
    window.lastFilteredData = filteredData;

    document.getElementById('leftChartTitle').innerText = currentFilter === 'ALL' ? 'Todas las Alertas' : `Alertas (${currentFilter})`;
    document.getElementById('rightChartTitle').innerText = currentFilter === 'ALL' ? 'TOP 10 Dispositivos' : `TOP 10 Dispositivos (${currentFilter})`;

    let titleKpiTotal = document.getElementById('titleKpiTotal');
    if (titleKpiTotal) titleKpiTotal.innerText = currentFilter === 'ALL' ? 'Total de Alertas' : `Total Alertas (${currentFilter})`;

    document.getElementById('kpiTotal').innerText = filteredData.totalAlerts.toLocaleString();
    document.getElementById('kpiDevices').innerText = (filteredData.allDevices || []).length;
    document.getElementById('kpiTopDevice').innerText = filteredData.topDevice || '-';

    renderDonutChart(filteredData);
    renderTop10Chart(filteredData);
    renderTop10Table(filteredData);
    renderOtherDevicesTable(filteredData);
}

// ========================
// Donut Chart
// ========================
function renderDonutChart(data) {
    const ctx = document.getElementById('donutChart');
    if (!ctx) return;

    let labels = [];
    let counts = [];
    const colors = [
        '#4b8eff', '#2ff801', '#00dbe9', '#ff6b6b', '#ffc107',
        '#9c27b0', '#ff5722', '#607d8b', '#795548', '#8bc34a',
        '#414755' // Color for "Otros"
    ];

    if (data.allDevices && data.allDevices.length > 0) {
        const top10 = data.allDevices.slice(0, 10);
        labels = top10.map(function(d) { return d.name; });
        counts = top10.map(function(d) { return d.count; });

        if (data.allDevices.length > 10) {
            const othersCount = data.allDevices.slice(10).reduce(function(sum, d) { return sum + d.count; }, 0);
            labels.push('Otros Dispositivos (' + (data.allDevices.length - 10) + ')');
            counts.push(othersCount);
        }
    } else {
        const top = data.top10 || [];
        labels = top.map(function(d) { return d.name; });
        counts = top.map(function(d) { return d.count; });

        const topSum = counts.reduce(function(sum, c) { return sum + c; }, 0);
        if (data.totalAlerts > topSum) {
            labels.push('Otros Dispositivos');
            counts.push(data.totalAlerts - topSum);
        }
    }

    if (chartDonut) chartDonut.destroy();
    chartDonut = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: counts,
                backgroundColor: colors.slice(0, labels.length),
                borderWidth: 0,
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            onClick: function(e, activeElements) {
                if (activeElements.length > 0) {
                    var idx = activeElements[0].index;
                    window.showBreakdown(labels[idx]);
                }
            },
            plugins: {
                legend: { display: true, position: 'bottom', labels: { color: '#c1c6d7', font: { size: 10 }, padding: 12 } }
            },
            cutout: '60%'
        }
    });
}

// ========================
// TOP 10 Pie Chart
// ========================
function renderTop10Chart(data) {
    const ctx = document.getElementById('top10Chart');
    if (!ctx) return;

    const top = data.top10 || [];
    const labels = top.map(function(d) { return d.name; });
    const counts = top.map(function(d) { return d.count; });
    const colors = [
        '#4b8eff', '#2ff801', '#00dbe9', '#ff6b6b', '#ffc107',
        '#9c27b0', '#ff5722', '#607d8b', '#795548', '#8bc34a'
    ];

    if (chartPie) chartPie.destroy();
    chartPie = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: counts,
                backgroundColor: colors.slice(0, labels.length),
                borderWidth: 1,
                borderColor: '#131314',
                hoverOffset: 15
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            onClick: function(e, activeElements) {
                if (activeElements.length > 0) {
                    var idx = activeElements[0].index;
                    window.showBreakdown(labels[idx]);
                }
            },
            plugins: {
                legend: { display: false } // Hidden legend, handled by table
            }
        }
    });
}

// ========================
// Bar Chart Full Summary
// ========================
function renderBarChartSeverities(data) {
    const ctx = document.getElementById('barChartSeverities');
    if (!ctx) return;

    let labels = [];
    let counts = [];
    let bgColors = [];

    if (!data.categories && data.allDevices) {
        data.categories = {};
        data.allDevices.forEach(d => {
            (d.details || []).forEach(a => {
                let s = (a.acknowledge || a.severity || '-').toUpperCase();
                if (!data.categories[s]) data.categories[s] = 0;
                data.categories[s]++;
            });
        });
    }

    if (data.categories) {
        Object.keys(data.categories).forEach(cat => {
            const up = cat.toUpperCase();
            labels.push(up);
            counts.push(data.categories[cat]);

            if(up === 'CRITICAL') bgColors.push('#f87171'); // red-400
            else if(up === 'ERROR') bgColors.push('#fb923c'); // orange-400
            else if(up === 'DOWN') bgColors.push('#c084fc'); // purple-400
            else if(up === 'WARNING' || up === 'WARN') bgColors.push('#facc15'); // yellow-400
            else if(up === 'UNKNOWN') bgColors.push('#9ca3af'); // gray-400
            else if(up === 'ACKNOWLEDGE') bgColors.push('#60a5fa'); // blue-400
            else bgColors.push('#414755'); // other/outline-variant
        });
    }

    if (chartBarSeverities) chartBarSeverities.destroy();
    chartBarSeverities = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                data: counts,
                backgroundColor: bgColors,
                borderRadius: 4
            }]
        },
        options: {
            indexAxis: 'y', // horizontal bar
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: { title: () => null }
                }
            },
            scales: {
                x: { display: false, grid: { display: false } },
                y: { grid: { display: false }, ticks: { color: '#c1c6d7', font: {size: 10} } }
            }
        }
    });
}

// ========================
// TOP 10 Table
// ========================
function renderTop10Table(data) {
    const tbody = document.getElementById('top10Body');
    if (!tbody) return;

    const top = data.top10 || [];
    let topSum = 0;

    tbody.innerHTML = top.map(function(d, i) {
        topSum += d.count;
        var pct = ((d.count / data.totalAlerts) * 100).toFixed(1);
        var dotColor = ['#4b8eff','#2ff801','#00dbe9','#ff6b6b','#ffc107','#9c27b0','#ff5722','#607d8b','#795548','#8bc34a'][i];
        return '<tr class="border-t border-[#414755]/30 hover:bg-[#2a2a2b]/60">' +
            '<td class="px-4 py-3 flex items-center gap-2">' +
                '<div class="w-2.5 h-2.5 rounded-full" style="background:' + dotColor + '"></div>' +
                '<span class="text-white font-medium text-sm">' + d.name + '</span>' +
            '</td>' +
            '<td class="px-4 py-3 text-right font-headline font-bold text-white">' + d.count.toLocaleString() + '</td>' +
        '</tr>';
    }).join('');

    // Update total footer count
    const totalCountEl = document.getElementById('tableTotalCount');
    if (totalCountEl) {
        totalCountEl.innerText = topSum.toLocaleString();
    }
}

// ========================
// Drill-down Breakdown Logic
// ========================
function renderOtherDevicesTable(data) {
    // We purposefully don't auto-render the breakdown anymore until user clicks.
    // Reset the table to prompt status.
    var tbody = document.getElementById('drilldownBody');
    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-10 opacity-50"><span class="material-symbols-outlined text-4xl mb-4 block">touch_app</span>Haz clic en un gráfico para cargar los detalles</td></tr>';
    }
}

window.showBreakdown = function(deviceName) {
    const titleEl = document.getElementById('lblBreakdownTitle');
    const descEl = document.getElementById('lblBreakdownDesc');
    const tbody = document.getElementById('drilldownBody');
    const thead = document.getElementById('drilldownHeader');

    if (!tbody || !currentData) return;

    var sourceData = window.lastFilteredData || currentData;

    // Find device
    const device = (sourceData.allDevices || []).find(function(d) { return d.name === deviceName; });

    document.getElementById('drilldownSection').scrollIntoView({ behavior: 'smooth', block: 'center' });

    if (deviceName === 'Otros Dispositivos' || deviceName.indexOf('Otros Dispositivos') === 0) {
        titleEl.innerText = 'Desglose: Otros Dispositivos';
        descEl.innerText = 'Resumen consolidado de los dispositivos fuera del TOP 10 principal.';

        thead.innerHTML = '<tr><th class="px-4 py-3 rounded-tl-lg">#</th><th class="px-4 py-3">Nombre Objeto (Dispositivo)</th><th class="px-4 py-3 text-right">Cuenta (Alertas)</th><th class="px-4 py-3 text-right rounded-tr-lg">% del Total Global</th></tr>';

        tbody.innerHTML = (sourceData.allDevices || []).slice(10).map(function(d, i) {
            var pct = ((d.count / sourceData.totalAlerts) * 100).toFixed(2);
            return '<tr class="border-t border-[#414755]/30 hover:bg-[#2a2a2b]/60 cursor-pointer" onclick="window.showBreakdown(\'' + d.name + '\')">' +
                '<td class="px-4 py-3 font-bold text-outline-variant">' + (i + 11) + '</td>' +
                '<td class="px-4 py-3 text-on-surface text-primary hover:underline">' + d.name + '</td>' +
                '<td class="px-4 py-3 text-right font-headline font-bold text-white">' + d.count.toLocaleString() + '</td>' +
                '<td class="px-4 py-3 text-right text-xs text-on-surface-variant">' + pct + '%</td>' +
            '</tr>';
        }).join('');
        return;
    }

    if (!device) return;

    titleEl.innerHTML = 'Desglose Alertas: <span class="text-primary">' + deviceName + '</span>';
    descEl.innerText = 'Detalle granular de las ' + device.count + ' alertas registradas para este dispositivo.';

    // If granular details are available
    if (device.details && device.details.length > 0) {
        thead.innerHTML = '<tr><th class="px-4 py-3 rounded-tl-lg">#</th><th class="px-4 py-3">Fecha / Time</th><th class="px-4 py-3">Servicio</th><th class="px-4 py-3 w-[30%]">Información / Data</th><th class="px-4 py-3">Status</th><th class="px-4 py-3 text-right rounded-tr-lg">% del Total</th></tr>';

        tbody.innerHTML = device.details.map(function(row, i) {
            var pct = ((1 / sourceData.totalAlerts) * 100).toFixed(4);

            // Colores por Acknowledge Status
            var statusVal = (row.acknowledge || '-').toUpperCase();
            var statusColorClass = 'text-white';
            if (statusVal === 'CRITICAL' || statusVal === 'ERROR' || statusVal === 'DOWN') statusColorClass = 'text-red-400 font-bold';
            if (statusVal === 'WARNING') statusColorClass = 'text-yellow-400 font-bold';
            if (statusVal === 'ACKNOWLEDGE') statusColorClass = 'text-blue-400 font-bold';

            return '<tr class="border-t border-[#414755]/30 hover:bg-[#2a2a2b]/60">' +
                '<td class="px-4 py-3 font-bold text-outline-variant">' + (i + 1) + '</td>' +
                '<td class="px-4 py-3 text-secondary whitespace-nowrap">' + (row.fecha || '-') + '</td>' +
                '<td class="px-4 py-3 text-white font-medium">' + (row.servicio || '-') + '</td>' +
                '<td class="px-4 py-3 text-xs opacity-75 break-words max-w-sm">' + (row.data || '-') + '</td>' +
                '<td class="px-4 py-3 text-xs ' + statusColorClass + '">' + statusVal + '</td>' +
                '<td class="px-4 py-3 text-right text-[10px] text-on-surface-variant">' + pct + '%</td>' +
            '</tr>';
        }).join('');
    } else {
        // Fallback for old reports without granular details: show aggregate services
        thead.innerHTML = '<tr><th class="px-4 py-3 rounded-tl-lg">#</th><th class="px-4 py-3">Servicio</th><th class="px-4 py-3 text-right">Cuenta</th><th class="px-4 py-3 text-right rounded-tr-lg">% del Dispositivo</th></tr>';

        var services = Object.keys(device.services || {}).map(function(s) {
            return { name: s, count: device.services[s] };
        }).sort(function(a,b){ return b.count - a.count; });

        if (services.length > 0) {
            tbody.innerHTML = services.map(function(s, i) {
                var pct = ((s.count / device.count) * 100).toFixed(2);
                return '<tr class="border-t border-[#414755]/30 hover:bg-[#2a2a2b]/60">' +
                    '<td class="px-4 py-3 font-bold text-outline-variant">' + (i + 1) + '</td>' +
                    '<td class="px-4 py-3 text-white font-medium">' + s.name + '</td>' +
                    '<td class="px-4 py-3 text-right font-headline font-bold text-secondary">' + s.count + '</td>' +
                    '<td class="px-4 py-3 text-right text-xs text-on-surface-variant">' + pct + '%</td>' +
                '</tr>';
            }).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="4" class="px-4 py-8 text-center text-on-surface-variant">Sin desglose heredado disponible.</td></tr>';
        }
    }
};

// ========================
// Search Box Logic
// ========================
function setupSearchBox() {
    const input = document.getElementById('alertSearchInput');
    const clearBtn = document.getElementById('clearSearch');
    if (!input) return;

    let debounceTimer = null;

    input.addEventListener('input', function() {
        const query = this.value.trim();
        clearDebounce();
        if (query.length === 0) {
            clearBtn.classList.add('hidden');
            document.getElementById('searchResults').classList.add('hidden');
            return;
        }
        clearBtn.classList.remove('hidden');
        debounceTimer = setTimeout(function() { runSearch(query.toLowerCase()); }, 180);
    });

    clearBtn.addEventListener('click', function() {
        input.value = '';
        clearBtn.classList.add('hidden');
        document.getElementById('searchResults').classList.add('hidden');
        input.focus();
    });

    function clearDebounce() { if (debounceTimer) clearTimeout(debounceTimer); }
}

function runSearch(query) {
    if (!currentData) return;

    var results = [];
    var devices = currentData.allDevices || [];

    devices.forEach(function(device) {
        (device.details || []).forEach(function(alert) {
            var haystack = [
                device.name,
                alert.fecha || '',
                alert.servicio || '',
                alert.data || '',
                alert.acknowledge || '',
                alert.specification || ''
            ].join(' ').toLowerCase();

            if (haystack.includes(query)) {
                results.push({ device: device.name, alert: alert, totalAlerts: currentData.totalAlerts });
            }
        });
    });

    renderSearchResults(results, query);
}

function renderSearchResults(results, query) {
    var container = document.getElementById('searchResults');
    var countEl = document.getElementById('searchResultCount');
    var tbody = document.getElementById('searchResultsBody');
    var limitWarning = document.getElementById('searchLimitWarning');
    var LIMIT = 300;

    countEl.innerText = results.length.toLocaleString();
    container.classList.remove('hidden');

    if (results.length === 0) {
        limitWarning.classList.add('hidden');
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-10 opacity-50"><span class="material-symbols-outlined text-4xl mb-3 block">search_off</span>Sin resultados para esta búsqueda.</td></tr>';
        return;
    }

    if (results.length > LIMIT) {
        limitWarning.classList.remove('hidden');
    } else {
        limitWarning.classList.add('hidden');
    }

    var slice = results.slice(0, LIMIT);
    tbody.innerHTML = slice.map(function(r, i) {
        var statusVal = (r.alert.acknowledge || '-').toUpperCase();
        var statusColorClass = 'text-on-surface-variant';
        if (statusVal === 'CRITICAL') statusColorClass = 'text-red-400 font-bold';
        else if (statusVal === 'ERROR') statusColorClass = 'text-orange-400 font-bold';
        else if (statusVal === 'DOWN') statusColorClass = 'text-purple-400 font-bold';
        else if (statusVal === 'WARNING' || statusVal === 'WARN') statusColorClass = 'text-yellow-400 font-bold';
        else if (statusVal === 'ACKNOWLEDGE') statusColorClass = 'text-blue-400 font-bold';

        var escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        var highlight = function(text) {
            if (!text) return '-';
            return text.replace(new RegExp('(' + escapedQuery + ')', 'gi'), '<mark class="bg-primary/30 text-white rounded px-0.5">$1</mark>');
        };

        return '<tr class="border-t border-[#414755]/30 hover:bg-[#2a2a2b]/60">' +
            '<td class="px-4 py-3 font-bold text-outline-variant text-xs">' + (i + 1) + '</td>' +
            '<td class="px-4 py-3 text-primary font-medium text-xs max-w-[160px] truncate" title="' + r.device + '">' + highlight(r.device) + '</td>' +
            '<td class="px-4 py-3 text-secondary whitespace-nowrap text-xs">' + highlight(r.alert.fecha || '-') + '</td>' +
            '<td class="px-4 py-3 text-white text-xs">' + highlight(r.alert.servicio || '-') + '</td>' +
            '<td class="px-4 py-3 text-xs opacity-75 break-words max-w-[280px]">' + highlight(r.alert.data || '-') + '</td>' +
            '<td class="px-4 py-3 text-xs text-right ' + statusColorClass + '">' + statusVal + '</td>' +
        '</tr>';
    }).join('');
}

// ========================
// Empty State
// ========================
function renderEmptyState() {
    const main = document.querySelector('main');
    if (!main) return;
    main.innerHTML = '<div class="flex flex-col items-center justify-center min-h-[50vh] text-center">' +
        '<span class="material-symbols-outlined text-6xl text-outline-variant mb-4">info</span>' +
        '<h2 class="text-2xl font-headline font-bold text-white mb-2">Sin Reportes Disponibles</h2>' +
        '<p class="text-on-surface-variant max-w-md">No se encontraron informes para tu empresa. Contacta al administrador para solicitar la carga de tu reporte mensual.</p>' +
    '</div>';
}
