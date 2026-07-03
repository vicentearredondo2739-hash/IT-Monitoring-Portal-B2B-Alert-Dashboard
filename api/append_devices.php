<?php
// ==========================================
// API: Anexar bloque de dispositivos a un informe existente
// Usado por el upload chunked para archivos > 6 MB
// POST /api/append_devices.php
// ==========================================
require_once __DIR__ . '/config.php';
setCorsHeaders();
session_start();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(array('error' => 'Método no permitido'));
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
if (!$input) {
    http_response_code(400);
    echo json_encode(array('error' => 'Payload JSON inválido'));
    exit;
}

$report_id   = isset($input['report_id'])          ? intval($input['report_id'])          : 0;
$new_devices = isset($input['devices'])             ? $input['devices']                    : array();
$is_last     = isset($input['is_last_chunk'])       ? (bool)$input['is_last_chunk']        : false;
$true_alerts = isset($input['true_total_alerts'])   ? intval($input['true_total_alerts'])  : null;
$true_devs   = isset($input['true_total_devices'])  ? intval($input['true_total_devices']) : null;

if (!$report_id || empty($new_devices)) {
    http_response_code(400);
    echo json_encode(array('error' => 'report_id y devices son requeridos'));
    exit;
}

$db = getDB();

// Leer reporte existente
$stmt = $db->prepare("SELECT report_json FROM monthly_reports WHERE id = :id LIMIT 1");
$stmt->execute(array('id' => $report_id));
$row = $stmt->fetch();

if (!$row) {
    http_response_code(404);
    echo json_encode(array('error' => 'Reporte no encontrado con id=' . $report_id));
    exit;
}

// Descomprimir si está en formato GZ:
$jsonStr = $row['report_json'];
if (strncmp($jsonStr, 'GZ:', 3) === 0) {
    $decoded      = base64_decode(substr($jsonStr, 3));
    $decompressed = @gzdecode($decoded);
    if ($decompressed !== false) {
        $jsonStr = $decompressed;
    }
}

$existingData = json_decode($jsonStr, true);
if (!$existingData) {
    http_response_code(500);
    echo json_encode(array('error' => 'No se pudo decodificar el reporte existente'));
    exit;
}

// Construir mapa de dispositivos existentes
$deviceMap = array();
$existing_devices = isset($existingData['allDevices']) ? $existingData['allDevices'] : array();
foreach ($existing_devices as $d) {
    $name = $d['name'];
    $deviceMap[$name] = array(
        'name'     => $name,
        'count'    => intval($d['count']),
        'services' => isset($d['services']) ? $d['services'] : array(),
        'details'  => isset($d['details'])  ? $d['details']  : array()
    );
}

// Fusionar nuevos dispositivos en el mapa
foreach ($new_devices as $d) {
    $name = $d['name'];
    if (!isset($deviceMap[$name])) {
        $deviceMap[$name] = array('name' => $name, 'count' => 0, 'services' => array(), 'details' => array());
    }
    $deviceMap[$name]['count'] += intval($d['count']);

    if (!empty($d['details'])) {
        $deviceMap[$name]['details'] = array_merge($deviceMap[$name]['details'], $d['details']);
    }
    if (!empty($d['services'])) {
        foreach ($d['services'] as $svc => $cnt) {
            $cur = isset($deviceMap[$name]['services'][$svc]) ? $deviceMap[$name]['services'][$svc] : 0;
            $deviceMap[$name]['services'][$svc] = $cur + intval($cnt);
        }
    }
}

// Ordenar por count descendente
$sorted = array_values($deviceMap);
usort($sorted, function($a, $b) { return $b['count'] - $a['count']; });

// Actualizar estructura del reporte
$existingData['allDevices']   = $sorted;
$existingData['top10']        = array_slice($sorted, 0, 10);
$existingData['totalDevices'] = count($sorted);
$existingData['topDevice']    = !empty($sorted) ? $sorted[0]['name'] : '-';

// En el último bloque, usar los totales reales enviados por el cliente
if ($is_last && $true_alerts !== null) {
    $existingData['totalAlerts'] = $true_alerts;
    $finalAlerts  = $true_alerts;
    $finalDevices = $true_devs !== null ? $true_devs : count($sorted);
} else {
    $calcTotal = array_sum(array_column($sorted, 'count'));
    $existingData['totalAlerts'] = $calcTotal;
    $finalAlerts  = $calcTotal;
    $finalDevices = count($sorted);
}

// Serializar y comprimir si supera 100 KB
$newJson    = json_encode($existingData, JSON_UNESCAPED_UNICODE);
$jsonToSave = $newJson;
if (strlen($newJson) > 100000 && function_exists('gzencode')) {
    $jsonToSave = 'GZ:' . base64_encode(gzencode($newJson, 9));
}

$topDevice = !empty($sorted) ? $sorted[0]['name'] : '-';

$totalMonitored = isset($existingData['totalMonitored']) ? intval($existingData['totalMonitored']) : null;
$dateFromVal    = isset($existingData['dateFrom'])       ? $existingData['dateFrom']               : null;

$stmt = $db->prepare(
    "UPDATE monthly_reports
     SET report_json = :rj, total_alerts = :ta, total_devices = :td, top_device = :topd,
         total_monitored = :tm, date_from = :df
     WHERE id = :id"
);
$stmt->execute(array(
    'rj'   => $jsonToSave,
    'ta'   => $finalAlerts,
    'td'   => $finalDevices,
    'topd' => $topDevice,
    'tm'   => $totalMonitored,
    'df'   => $dateFromVal,
    'id'   => $report_id
));

echo json_encode(array(
    'success'       => true,
    'message'       => 'Bloque guardado correctamente',
    'total_devices' => count($sorted),
    'total_alerts'  => $finalAlerts
));
?>
