<?php
// ==========================================
// API: Guardar Reporte — PHP 5.6+
// POST /api/save_report.php
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
$client_id = isset($input['client_id']) ? $input['client_id'] : '';
$periodo = isset($input['periodo']) ? $input['periodo'] : '';
$total_alerts = isset($input['total_alerts']) ? intval($input['total_alerts']) : 0;
$total_devices = isset($input['total_devices']) ? intval($input['total_devices']) : 0;
$top_device = isset($input['top_device']) ? $input['top_device'] : '';
$report_json = isset($input['report_json']) ? $input['report_json'] : '{}';

if (empty($client_id) || empty($periodo)) {
    http_response_code(400);
    echo json_encode(array('error' => 'client_id y periodo son requeridos'));
    exit;
}

$uploaded_by = isset($_SESSION['email']) ? $_SESSION['email'] : 'admin';

// Extract total_monitored and date_from from the report JSON (avoid re-parsing later)
$decoded_for_meta = json_decode($report_json, true);
$total_monitored  = isset($decoded_for_meta['totalMonitored']) ? intval($decoded_for_meta['totalMonitored']) : null;
$date_from_val    = isset($decoded_for_meta['dateFrom'])       ? $decoded_for_meta['dateFrom']               : null;

$db = getDB();

// Check if report already exists for same company+period, update if so
$stmt = $db->prepare("SELECT id FROM monthly_reports WHERE client_id = :cid AND periodo = :per LIMIT 1");
$stmt->execute(array('cid' => $client_id, 'per' => $periodo));
$existing = $stmt->fetch();

$json_to_save = $report_json;
if (strlen($report_json) > 100000 && function_exists('gzencode')) {
    $json_to_save = 'GZ:' . base64_encode(gzencode($report_json, 9));
}

if ($existing) {
    $stmt = $db->prepare("UPDATE monthly_reports SET total_alerts = :ta, total_devices = :td, top_device = :topd, report_json = :rj, uploaded_by = :ub, total_monitored = :tm, date_from = :df WHERE id = :id");
    $stmt->execute(array(
        'ta' => $total_alerts, 'td' => $total_devices, 'topd' => $top_device,
        'rj' => $json_to_save, 'ub' => $uploaded_by,
        'tm' => $total_monitored, 'df' => $date_from_val, 'id' => $existing['id']
    ));
    echo json_encode(array('success' => true, 'message' => 'Reporte actualizado', 'id' => $existing['id']));
} else {
    $stmt = $db->prepare("INSERT INTO monthly_reports (client_id, periodo, total_alerts, total_devices, top_device, report_json, uploaded_by, total_monitored, date_from) VALUES (:cid, :per, :ta, :td, :topd, :rj, :ub, :tm, :df)");
    $stmt->execute(array(
        'cid' => $client_id, 'per' => $periodo,
        'ta' => $total_alerts, 'td' => $total_devices, 'topd' => $top_device,
        'rj' => $json_to_save, 'ub' => $uploaded_by,
        'tm' => $total_monitored, 'df' => $date_from_val
    ));
    echo json_encode(array('success' => true, 'message' => 'Reporte guardado', 'id' => $db->lastInsertId()));
}
?>
