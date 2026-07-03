// ==========================================
// Admin Panel — IT Monitoring Portal
// Procesamiento TXT + Multi-Empresa
// Compatible con PHP 5.6+
// ==========================================

const COMPANIES = [
    { id: 'ACME', name: 'Acme Corp', color: '#4b8eff' },
    { id: 'GLOBEX', name: 'Globex Industries', color: '#2ff801' },
    { id: 'INITECH', name: 'Initech Solutions', color: '#00dbe9' },
    { id: 'UMBRELLA', name: 'Umbrella Group', color: '#ff6b6b' },
    { id: 'STARK', name: 'Stark Logistics', color: '#ffc107' }
];

let parsedReportData = null;
let allReportsData = [];
let existingReportMeta = null;

const UPLOAD_CHUNK_LIMIT = 1 * 1024 * 1024; // 1 MB per chunk (safe for typical shared hosting limits)

// ========================
// INIT
document.addEventListener('DOMContentLoaded', () => {
    renderCompanyList();
    setupDragDrop();
    setupButtons();
    setDefaultDates();
    loadAllReports();

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
});

// ========================
// Set default dates (current month)
// ========================
function setDefaultDates() {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    document.getElementById('dateFrom').value = firstDay.toISOString().split('T')[0];
    document.getElementById('dateTo').value = lastDay.toISOString().split('T')[0];
}

// ========================
// Render company list panel
// ========================
function renderCompanyList() {
    const container = document.getElementById('companyList');
    container.innerHTML = COMPANIES.map(c => {
        const initials = c.name.substring(0, 2).toUpperCase();
        return '<div class="flex items-center gap-4 bg-surface-container-highest/50 border border-outline-variant/20 p-4 rounded-xl hover:border-primary/30 transition-all">' +
            '<div class="w-10 h-10 rounded-lg flex items-center justify-center text-xs font-black text-white" style="background:' + c.color + '20; color:' + c.color + '">' + initials + '</div>' +
            '<div class="flex-1">' +
                '<p class="text-white font-bold text-sm">' + c.name + '</p>' +
                '<p class="text-on-surface-variant text-[10px] uppercase tracking-widest">ID: ' + c.id + '</p>' +
            '</div>' +
            '<span class="material-symbols-outlined text-outline-variant text-sm">check_circle</span>' +
        '</div>';
    }).join('');
}

// ========================
// Drag & Drop / File Select
// ========================
function setupDragDrop() {
    const dragZone = document.getElementById('dragZone');
    const fileInput = document.getElementById('fileInput');

    dragZone.addEventListener('click', () => fileInput.click());
    dragZone.addEventListener('dragover', (e) => { e.preventDefault(); dragZone.classList.add('dragover'); });
    dragZone.addEventListener('dragleave', () => dragZone.classList.remove('dragover'));
    dragZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dragZone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) processFile(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) processFile(e.target.files[0]);
    });
}

// ========================
// Validate config before processing
// ========================
function validateConfig() {
    const company = document.getElementById('companySelect').value;
    const dateFrom = document.getElementById('dateFrom').value;
    const dateTo = document.getElementById('dateTo').value;
    const totalMonitoredDevices = document.getElementById('totalMonitoredDevices').value;

    if (!company) {
        showError('Debes seleccionar una empresa destinataria antes de subir el archivo.');
        return null;
    }
    if (!dateFrom || !dateTo) {
        showError('Debes seleccionar el rango de fechas del informe.');
        return null;
    }
    if (!totalMonitoredDevices || isNaN(totalMonitoredDevices) || totalMonitoredDevices < 0) {
        showError('Debes ingresar el total real de dispositivos que se están monitorizando.');
        return null;
    }
    return {
        company: company,
        dateFrom: dateFrom,
        dateTo: dateTo,
        totalMonitoredDevices: parseInt(totalMonitoredDevices, 10)
    };
}

// ========================
// Process TXT File
// ========================
function processFile(file) {
    const config = validateConfig();
    if (!config) return;

    showProcessing('Leyendo archivo: ' + file.name);

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const text = e.target.result;
            const lines = text.split('\n');

            // Parse header to find column indices
            const header = lines[0].split('\t');
            const colMap = {};
            header.forEach(function(col, i) { colMap[col.trim().replace(/;/g, '')] = i; });

            const objectNameIdx = colMap['Object Name'] !== undefined ? colMap['Object Name'] : 1;
            const servicioIdx = colMap['Servicio'] !== undefined ? colMap['Servicio'] : 2;
            let severityIdx = colMap['Severity'] !== undefined ? colMap['Severity'] : 3;

            let fechaIdx = -1;
            let infoIdx = -1;
            let specIdx = -1;
            let ackIdx = -1;

            Object.keys(colMap).forEach(function(col) {
                const lower = col.toLowerCase();
                if (lower.includes('fecha') || lower.includes('time') || lower === 'date') fechaIdx = colMap[col];
                if (lower === 'data' || lower.includes('inform') || lower.includes('output')) infoIdx = colMap[col];
                if (lower.includes('spec') || lower.includes('especif')) specIdx = colMap[col];
                if (lower.includes('ack') || lower === 'acknowledge') ackIdx = colMap[col];
            });

            if (ackIdx > -1) {
                severityIdx = ackIdx;
            }

            // Group by device
            var deviceMap = {};
            var categories = {};
            var totalAlerts = 0;

            for (var i = 1; i < lines.length; i++) {
                var line = lines[i].trim();
                if (!line) continue;
                var cols = line.split('\t');
                if (cols.length < 4) continue;

                var objectName = (cols[objectNameIdx] || '').replace(/;/g, '').trim();
                var service = (cols[servicioIdx] || '').replace(/;/g, '').trim();
                var severity = (cols[severityIdx] || '').replace(/;/g, '').trim();
                var fechaStr = fechaIdx > -1 ? (cols[fechaIdx] || '').replace(/;/g, '').trim() : '-';
                var infoStr = infoIdx > -1 ? (cols[infoIdx] || '').replace(/;/g, '').trim() : '-';
                var specStr = specIdx > -1 ? (cols[specIdx] || '').replace(/;/g, '').trim() : '-';
                var ackStr = ackIdx > -1 ? (cols[ackIdx] || '').replace(/;/g, '').trim() : severity;

                if (!objectName) continue;

                totalAlerts++;

                if (!deviceMap[objectName]) {
                    deviceMap[objectName] = { count: 0, services: {}, details: [] };
                }
                deviceMap[objectName].count++;

                deviceMap[objectName].details.push({
                    fecha: fechaStr,
                    servicio: service,
                    data: infoStr,
                    specification: specStr,
                    acknowledge: ackStr
                });

                if (service) {
                    if (!deviceMap[objectName].services[service]) {
                        deviceMap[objectName].services[service] = 0;
                    }
                    deviceMap[objectName].services[service]++;
                }

                if (severity) {
                    if (!categories[severity]) categories[severity] = 0;
                    categories[severity]++;
                }
            }

            // Sort devices by count desc
            var sortedDevices = Object.keys(deviceMap).map(function(name) {
                return { name: name, count: deviceMap[name].count, services: deviceMap[name].services, details: deviceMap[name].details };
            }).sort(function(a, b) { return b.count - a.count; });

            var top10 = sortedDevices.slice(0, 10);
            var companyObj = COMPANIES.find(function(c) { return c.id === config.company; });
            var periodo = config.dateFrom + ' → ' + config.dateTo;

            parsedReportData = {
                company_id: config.company,
                company_name: companyObj ? companyObj.name : config.company,
                dateFrom: config.dateFrom,
                dateTo: config.dateTo,
                periodo: periodo,
                totalAlerts: totalAlerts,
                totalDevices: Object.keys(deviceMap).length,
                totalMonitored: config.totalMonitoredDevices, // Added
                topDevice: top10[0] ? top10[0].name : '-',
                top10: top10,
                allDevices: sortedDevices,
                categories: categories,
                fileName: file.name,
                generatedAt: new Date().toISOString()
            };

            // Store in IndexedDB for dashboard preview
            saveToIndexedDB('itm_report_data', parsedReportData)
                .then(function() {
                    // Show summary
                    renderSummary(parsedReportData);
                    hideProcessing();
                })
                .catch(function(errDB) {
                    showError('Error base de datos local: ' + errDB.message);
                });

        } catch (err) {
            showError('Error al procesar: ' + err.message);
        }
    };
    reader.readAsText(file);
}

// ========================
// Safe Storage Helper (IndexedDB)
// ========================
function saveToIndexedDB(key, data) {
    return new Promise(function(resolve, reject) {
        var request = indexedDB.open('ITMonitorDB', 1);

        request.onupgradeneeded = function(e) {
            var db = e.target.result;
            if (!db.objectStoreNames.contains('reportsStore')) {
                db.createObjectStore('reportsStore');
            }
        };

        request.onsuccess = function(e) {
            var db = e.target.result;
            var tx = db.transaction('reportsStore', 'readwrite');
            var store = tx.objectStore('reportsStore');
            var putReq = store.put(data, key);

            putReq.onsuccess = function() { resolve(); };
            putReq.onerror = function() { reject(putReq.error); };

            tx.oncomplete = function() { db.close(); };
        };

        request.onerror = function() { reject(request.error); };
    });
}


// ========================
// Show/Hide Processing
// ========================
function showProcessing(msg) {
    var el = document.getElementById('uploadStatus');
    el.classList.remove('hidden');
    document.getElementById('uploadText').innerText = msg;
    document.getElementById('errorStatus').classList.add('hidden');
}

function hideProcessing() {
    document.getElementById('uploadStatus').classList.add('hidden');
}

function showError(msg) {
    var el = document.getElementById('errorStatus');
    el.classList.remove('hidden');
    document.getElementById('errorText').innerText = msg;
    document.getElementById('uploadStatus').classList.add('hidden');
}

// ========================
// Render Summary Preview
// ========================
function renderSummary(data) {
    document.getElementById('summarySection').classList.remove('hidden');
    document.getElementById('sumCompany').innerText = data.company_name;
    document.getElementById('sumDateRange').innerText = data.periodo;
    document.getElementById('sumTotal').innerText = data.totalAlerts.toLocaleString();
    document.getElementById('sumDevices').innerText = data.totalDevices;
    document.getElementById('sumPeriod').innerText = data.periodo;
    document.getElementById('sumTopDevice').innerText = data.topDevice;

    // TOP 10 table
    var tbody = document.getElementById('previewTableBody');
    tbody.innerHTML = data.top10.map(function(d, i) {
        var pct = ((d.count / data.totalAlerts) * 100).toFixed(1);
        var barColor = i < 3 ? '#4b8eff' : (i < 6 ? '#00dbe9' : '#414755');
        return '<tr class="hover:bg-surface-container-highest/50">' +
            '<td class="px-4 py-3 font-bold text-primary">' + (i + 1) + '</td>' +
            '<td class="px-4 py-3 text-white font-medium">' + d.name + '</td>' +
            '<td class="px-4 py-3 text-right font-headline font-bold text-white">' + d.count.toLocaleString() + '</td>' +
            '<td class="px-4 py-3 text-right">' +
                '<div class="flex items-center justify-end gap-2">' +
                    '<div class="w-20 bg-surface-container-lowest rounded-full h-1.5 overflow-hidden">' +
                        '<div class="h-1.5 rounded-full" style="width:' + pct + '%;background:' + barColor + '"></div>' +
                    '</div>' +
                    '<span class="text-xs text-on-surface-variant w-12 text-right">' + pct + '%</span>' +
                '</div>' +
            '</td>' +
        '</tr>';
    }).join('');

    // Scroll to summary
    document.getElementById('summarySection').scrollIntoView({ behavior: 'smooth' });
}

// ========================
// Action Buttons
// ========================
function setupButtons() {
    // Generate Report & Open Dashboard
    document.getElementById('btnGenerateReport').addEventListener('click', function() {
        if (!parsedReportData) return;
        saveToIndexedDB('itm_report_data', parsedReportData)
            .then(function() { window.open('alertas-dashboard.html', '_blank'); })
            .catch(function(err) { alert('Error IndexedDB Local: ' + err.message); });
    });

    // Save to Server (PHP API)
    document.getElementById('btnSaveToServer').addEventListener('click', function() {
        if (!parsedReportData) return;
        saveReportToServer();
    });

    // Download JSON
    document.getElementById('btnDownloadJSON').addEventListener('click', function() {
        if (!parsedReportData) return;
        var blob = new Blob([JSON.stringify(parsedReportData, null, 2)], { type: 'application/json' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'informe_' + parsedReportData.company_id + '_' + parsedReportData.dateFrom + '.json';
        a.click();
    });

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', function() {
        localStorage.removeItem('itm_portal_user');
        localStorage.removeItem('itm_report_data');
        indexedDB.deleteDatabase('ITMonitorDB');
        window.location.href = 'login.html';
    });

    // Modal Events
    document.getElementById('btnCancelModal').addEventListener('click', function() {
        closeModal();
        document.getElementById('btnSaveToServer').disabled = false;
        document.getElementById('btnSaveToServer').innerHTML = '<span class="material-symbols-outlined">cloud_done</span> Guardar en Servidor';
    });

    document.getElementById('btnOverwrite').addEventListener('click', function() {
        closeModal();
        executeSave(parsedReportData);
    });

    document.getElementById('btnAppend').addEventListener('click', function() {
        closeModal();
        appendAndSave();
    });

    // Save Edited Monitored Devices
    document.getElementById('btnSaveEditDevices').addEventListener('click', function() {
        var newTotal = document.getElementById('editTotalMonitored').value;
        var rId = document.getElementById('editReportId').value;
        if (!newTotal || isNaN(newTotal) || newTotal < 0) {
            alert("Valor inválido.");
            return;
        }
        var btn = this;
        btn.innerHTML = '<span class="material-symbols-outlined animate-spin text-sm">sync</span> Guardando...';
        btn.disabled = true;

        fetch('api/update_report_meta.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: rId, totalMonitored: parseInt(newTotal, 10) })
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                document.getElementById('modalEditDevices').classList.add('hidden');
                document.getElementById('modalEditDevices').classList.remove('flex');
                loadAllReports();
            } else {
                alert('Error al actualizar: ' + data.error);
            }
        })
        .catch(err => alert('Error: ' + err))
        .finally(() => {
            btn.disabled = false;
            btn.innerHTML = '<span class="material-symbols-outlined text-sm">save</span> Guardar Cambios';
        });
    });
}

function closeModal() {
    document.getElementById('modalOverwrite').classList.add('hidden');
    document.getElementById('modalOverwrite').classList.remove('flex');
}

// ========================
// Save Report to PHP Backend
// ========================
function saveReportToServer() {
    var btn = document.getElementById('btnSaveToServer');
    btn.innerHTML = '<span class="material-symbols-outlined animate-spin">progress_activity</span> Guardando...';
    btn.disabled = true;

    // Check if report exists
    var exists = allReportsData.find(function(r) { return r.client_id === parsedReportData.company_id && r.periodo === parsedReportData.periodo; });

    if (exists) {
        existingReportMeta = exists;
        document.getElementById('modalOverwrite').classList.remove('hidden');
        document.getElementById('modalOverwrite').classList.add('flex');
    } else {
        executeSave(parsedReportData);
    }
}

function executeSave(dataObj) {
    var btn = document.getElementById('btnSaveToServer');
    btn.innerHTML = '<span class="material-symbols-outlined animate-spin">progress_activity</span> Procesando Nube...';

    // Route to chunked upload if the JSON exceeds the server limit
    var reportJsonStr = JSON.stringify(dataObj);
    if (reportJsonStr.length > UPLOAD_CHUNK_LIMIT) {
        executeSaveChunked(dataObj, btn, reportJsonStr);
        return;
    }

    var payload = {
        client_id: dataObj.company_id,
        periodo: dataObj.periodo,
        total_alerts: dataObj.totalAlerts,
        total_devices: dataObj.totalDevices,
        top_device: dataObj.topDevice,
        report_json: reportJsonStr || JSON.stringify(dataObj)
    };

    fetch('api/save_report.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
    .then(function(res) {
        if (!res.ok) {
            return res.text().then(function(text) {
                throw new Error("HTTP " + res.status);
            });
        }
        return res.json();
    })
    .then(function(data) {
        if (data.success) {
            btn.innerHTML = '<span class="material-symbols-outlined">check_circle</span> Guardado Exitosamente';
            btn.classList.remove('text-secondary', 'border-secondary/30', 'bg-secondary/20');
            btn.classList.add('text-green-400', 'border-green-500/30', 'bg-green-900/20');
            loadAllReports(); // refresh history table
        } else {
            btn.innerHTML = '<span class="material-symbols-outlined">error</span> Error PHP: ' + (data.error || 'Desconocido');
            btn.classList.add('text-red-400', 'border-red-500/30');
        }
    })
    .catch(function(err) {
        btn.innerHTML = '<span class="material-symbols-outlined text-[14px]">error</span> Falla Servidor: ' + (err.message || 'Desconocida');
        btn.classList.add('text-red-400');
        console.error("Fetch debug:", err);
    })
    .finally(function() {
        btn.disabled = false;
        setTimeout(function() {
            btn.innerHTML = '<span class="material-symbols-outlined">cloud_done</span> Guardar en Servidor';
            btn.className = 'bg-secondary/20 border border-secondary/30 text-secondary px-6 py-4 rounded-xl text-sm font-bold hover:bg-secondary/30 transition-all flex items-center justify-center gap-3';
        }, 3000);
    });
}

// ========================
// Chunked Upload (archivos grandes > 6 MB)
// ========================
// Aplana todos los detalles de allDevices en una lista de alertas planas ordenadas por fecha
function flattenAlertsByDate(allDevices) {
    var flat = [];
    allDevices.forEach(function(device) {
        (device.details || []).forEach(function(alert) {
            flat.push({
                deviceName: device.name,
                deviceServices: device.services || {},
                alert: alert,
                dateStr: alert.fecha || ''
            });
        });
    });
    flat.sort(function(a, b) { return a.dateStr.localeCompare(b.dateStr); });
    return flat;
}

// Divide la lista plana en chunks por tamaño de JSON (respetando el límite por request)
function splitAlertsBySize(flatAlerts, limitBytes) {
    var chunks = [];
    var current = [];
    var currentSize = 2;

    for (var i = 0; i < flatAlerts.length; i++) {
        var itemStr = JSON.stringify(flatAlerts[i]);
        var addSize = itemStr.length + (current.length > 0 ? 1 : 0);
        if (currentSize + addSize > limitBytes && current.length > 0) {
            chunks.push(current);
            current = [];
            currentSize = 2;
        }
        current.push(flatAlerts[i]);
        currentSize += addSize;
    }
    if (current.length > 0) chunks.push(current);
    if (chunks.length === 0) chunks.push([]);
    return chunks;
}

// Convierte un chunk de alertas planas en un array de dispositivos agrupados
function buildDeviceArrayFromAlerts(flatChunk) {
    var map = {};
    flatChunk.forEach(function(item) {
        var name = item.deviceName;
        if (!map[name]) {
            map[name] = { name: name, count: 0, services: {}, details: [] };
        }
        map[name].count++;
        map[name].details.push(item.alert);
        var svc = item.alert.servicio;
        if (svc) {
            map[name].services[svc] = (map[name].services[svc] || 0) + 1;
        }
    });
    return Object.values(map);
}

function executeSaveChunked(dataObj, btn, reportJsonStr) {
    // Split flat alerts by date → regroup per chunk → each chunk = date slice with full device data
    var flatAlerts = flattenAlertsByDate(dataObj.allDevices || []);
    var alertChunks = splitAlertsBySize(flatAlerts, UPLOAD_CHUNK_LIMIT);
    var deviceChunks = alertChunks.map(buildDeviceArrayFromAlerts);
    var totalChunks = deviceChunks.length;

    btn.innerHTML = '<span class="material-symbols-outlined animate-spin">progress_activity</span> Preparando ' + totalChunks + ' bloques...';

    // Step 1: Upload skeleton only (no device details — always < 50 KB)
    var skeleton = {
        company_id:     dataObj.company_id,
        company_name:   dataObj.company_name,
        dateFrom:       dataObj.dateFrom,
        dateTo:         dataObj.dateTo,
        periodo:        dataObj.periodo,
        totalAlerts:    dataObj.totalAlerts,
        totalDevices:   dataObj.totalDevices,
        totalMonitored: dataObj.totalMonitored,
        topDevice:      dataObj.topDevice,
        categories:     dataObj.categories,
        fileName:       dataObj.fileName,
        generatedAt:    dataObj.generatedAt,
        top10: (dataObj.top10 || []).map(function(d) {
            return { name: d.name, count: d.count, services: d.services };
        }),
        allDevices: []   // devices arrive via append chunks
    };

    var firstPayload = {
        client_id:     dataObj.company_id,
        periodo:       dataObj.periodo,
        total_alerts:  dataObj.totalAlerts,
        total_devices: dataObj.totalDevices,
        top_device:    dataObj.topDevice,
        report_json:   JSON.stringify(skeleton)
    };

    fetch('api/save_report.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(firstPayload)
    })
    .then(function(res) {
        if (!res.ok) throw new Error('HTTP ' + res.status + ' al crear esqueleto');
        return res.json();
    })
    .then(function(data) {
        if (!data.success) throw new Error(data.error || 'Error al crear esqueleto');
        var reportId = parseInt(data.id, 10);
        // Step 2: Upload all date-based device chunks via append_devices.php
        return uploadNextChunk(reportId, deviceChunks, 0, totalChunks, dataObj, btn);
    })
    .catch(function(err) {
        btn.disabled = false;
        btn.innerHTML = '<span class="material-symbols-outlined text-[14px]">error</span> Falla: ' + (err.message || 'Desconocida');
        btn.classList.add('text-red-400');
        setTimeout(function() {
            btn.innerHTML = '<span class="material-symbols-outlined">cloud_done</span> Guardar en Servidor';
            btn.className = 'bg-secondary/20 border border-secondary/30 text-secondary px-6 py-4 rounded-xl text-sm font-bold hover:bg-secondary/30 transition-all flex items-center justify-center gap-3';
        }, 4000);
    });
}

function uploadNextChunk(reportId, chunks, index, total, dataObj, btn) {
    btn.innerHTML = '<span class="material-symbols-outlined animate-spin">progress_activity</span> Bloque ' + (index + 1) + '/' + total + ' — Subiendo...';

    var isLast = (index === chunks.length - 1);
    var payload = {
        report_id:          reportId,
        devices:            chunks[index],
        is_last_chunk:      isLast,
        true_total_alerts:  dataObj.totalAlerts,
        true_total_devices: dataObj.totalDevices
    };

    return fetch('api/append_devices.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
    .then(function(res) {
        if (!res.ok) throw new Error('HTTP ' + res.status + ' en bloque ' + (index + 1));
        return res.json();
    })
    .then(function(data) {
        if (!data.success) throw new Error(data.error || 'Error en bloque ' + (index + 1));
        if (index + 1 < chunks.length) {
            return uploadNextChunk(reportId, chunks, index + 1, total, dataObj, btn);
        }
        chunkSaveSuccess(btn);
        loadAllReports();
    });
}

function chunkSaveSuccess(btn) {
    btn.disabled = false;
    btn.innerHTML = '<span class="material-symbols-outlined">check_circle</span> Guardado Exitosamente';
    btn.classList.remove('text-secondary', 'border-secondary/30', 'bg-secondary/20');
    btn.classList.add('text-green-400', 'border-green-500/30', 'bg-green-900/20');
    setTimeout(function() {
        btn.innerHTML = '<span class="material-symbols-outlined">cloud_done</span> Guardar en Servidor';
        btn.className = 'bg-secondary/20 border border-secondary/30 text-secondary px-6 py-4 rounded-xl text-sm font-bold hover:bg-secondary/30 transition-all flex items-center justify-center gap-3';
    }, 3000);
}

// ========================
// Append & Merge Logic
// ========================
function appendAndSave() {
    var btn = document.getElementById('btnSaveToServer');
    btn.innerHTML = '<span class="material-symbols-outlined animate-spin">progress_activity</span> Fusionando Datos...';

    // 1. Fetch existing full report from DB
    fetch('api/get_report.php?client_id=' + encodeURIComponent(parsedReportData.company_id))
    .then(function(res) { return res.json(); })
    .then(function(result) {
        if (result.success && result.reports && result.reports.length > 0) {
            // Find the exact period
            var existing = result.reports.find(function(r) { return r.periodo === parsedReportData.periodo; });
            if (existing) {
                var oldData = JSON.parse(existing.report_json);
                var mergedData = mergeReportData(oldData, parsedReportData);
                executeSave(mergedData);
                return;
            }
        }
        alert('No se pudo obtener el informe original para anexar. Abortando.');
        btn.disabled = false;
        btn.innerHTML = '<span class="material-symbols-outlined">cloud_done</span> Guardar en Servidor';
    })
    .catch(function(err) {
        alert('Error conectando con la BD para anexar.');
        btn.disabled = false;
        btn.innerHTML = '<span class="material-symbols-outlined">cloud_done</span> Guardar en Servidor';
    });
}

function mergeReportData(oldD, newD) {
    var merged = JSON.parse(JSON.stringify(oldD)); // Deep clone
    merged.totalAlerts += newD.totalAlerts;
    merged.totalMonitored = newD.totalMonitored; // Replace with latest monitored count

    // Merge categories
    if (newD.categories) {
        Object.keys(newD.categories).forEach(function(cat) {
            if (!merged.categories[cat]) merged.categories[cat] = 0;
            merged.categories[cat] += newD.categories[cat];
        });
    }

    // Merge Devices
    var map = {};
    if (oldD.allDevices) {
        oldD.allDevices.forEach(function(d) {
            map[d.name] = { count: d.count, services: d.services || {} };
        });
    }
    if (newD.allDevices) {
        newD.allDevices.forEach(function(d) {
            if (!map[d.name]) map[d.name] = { count: 0, services: {} };
            map[d.name].count += d.count;
            if (d.services) {
                Object.keys(d.services).forEach(function(s) {
                    map[d.name].services[s] = (map[d.name].services[s] || 0) + d.services[s];
                });
            }
        });
    }

    var sorted = Object.keys(map).map(function(name) {
        return { name: name, count: map[name].count, services: map[name].services };
    }).sort(function(a, b) { return b.count - a.count; });

    merged.allDevices = sorted;
    merged.top10 = sorted.slice(0, 10);
    merged.totalDevices = sorted.length;
    merged.topDevice = sorted[0] ? sorted[0].name : '-';
    merged.generatedAt = new Date().toISOString();

    return merged;
}

// ========================
// History & Delete APIs
// ========================
function loadAllReports() {
    fetch('api/get_all_reports.php')
    .then(function(res) { return res.json(); })
    .then(function(data) {
        var tbody = document.getElementById('reportsHistoryBody');
        if (data.success && data.reports && data.reports.length > 0) {
            allReportsData = data.reports;
            tbody.innerHTML = data.reports.map(function(r) {
                var dMon = r.totalMonitored !== undefined ? r.totalMonitored : 'N/A';
                return '<tr class="border-t border-[#414755]/30 hover:bg-[#2a2a2b]/60">' +
                    '<td class="px-4 py-3">' + r.created_at + '</td>' +
                    '<td class="px-4 py-3 font-bold text-white">' + r.client_id + '</td>' +
                    '<td class="px-4 py-3 text-secondary">' + r.periodo + '</td>' +
                    '<td class="px-4 py-3 text-primary font-bold">' + parseInt(r.total_alerts).toLocaleString() + '</td>' +
                    '<td class="px-4 py-3 text-center text-tertiary font-bold">' + dMon + '</td>' +
                    '<td class="px-4 py-3 text-right">' + r.uploaded_by + '</td>' +
                    '<td class="px-4 py-3 text-center flex items-center justify-center gap-2">' +
                        '<button onclick="openEditMonitored(' + r.id + ')" class="text-on-surface-variant hover:text-primary p-2 rounded-full hover:bg-primary/10 transition-colors" title="Editar Disp. Monitorizados">' +
                            '<span class="material-symbols-outlined text-sm">edit</span>' +
                        '</button>' +
                        '<button onclick="deleteReport(' + r.id + ')" class="text-on-surface-variant hover:text-red-400 p-2 rounded-full hover:bg-red-400/10 transition-colors" title="Eliminar Informe">' +
                            '<span class="material-symbols-outlined text-sm">delete</span>' +
                        '</button>' +
                    '</td>' +
                '</tr>';
            }).join('');
        } else if (!data.success) {
            allReportsData = [];
            var errMsg = data.error || data.message || 'Error desconocido del servidor.';
            tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 font-bold text-red-400">Error: ' + errMsg + '</td></tr>';
        } else {
            allReportsData = [];
            tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-on-surface-variant">No hay informes guardados en el servidor.</td></tr>';
        }
    }).catch(function(e) {
        console.error("Error loading reports", e);
    });
}

window.deleteReport = function(id) {
    if (!confirm('¿Estás seguro que deseas eliminar este informe permanentemente del servidor?')) return;

    fetch('api/delete_report.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: id })
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
        if (data.success) {
            loadAllReports();
        } else {
            alert('Error eliminando: ' + data.error);
        }
    });
};

window.openEditMonitored = function(id) {
    var report = allReportsData.find(r => parseInt(r.id) === parseInt(id));
    if (!report) return;
    try {
        var val = (report.totalMonitored === 'N/A' || report.totalMonitored === null) ? '' : report.totalMonitored;
        document.getElementById('editTotalMonitored').value = val;
        document.getElementById('editReportId').value = id;
        document.getElementById('modalEditDevices').classList.remove('hidden');
        document.getElementById('modalEditDevices').classList.add('flex');
    } catch(e) {
        alert("Error decodificando reporte.");
    }
};
