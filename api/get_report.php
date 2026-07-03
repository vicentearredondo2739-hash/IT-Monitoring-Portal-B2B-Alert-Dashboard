<?php
// ==========================================
// API: Obtener Reportes — PHP 5.6+
// GET /api/get_report.php?client_id=ACSA
// ==========================================
require_once __DIR__ . '/config.php';
setCorsHeaders();
session_start();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(array('error' => 'Método no permitido'));
    exit;
}

$client_id = isset($_GET['client_id']) ? $_GET['client_id'] : '';

// If user is logged in and is a client, override client_id for security
if (isset($_SESSION['role']) && $_SESSION['role'] === 'client') {
    $client_id = $_SESSION['client_id'];
}

if (empty($client_id)) {
    http_response_code(400);
    echo json_encode(array('error' => 'client_id es requerido'));
    exit;
}

$db = getDB();

// ── Detail mode: ?client_id=X&id=Y ── returns full JSON for one report
if (isset($_GET['id']) && intval($_GET['id']) > 0) {
    $report_id = intval($_GET['id']);
    $stmt = $db->prepare("SELECT id, client_id, periodo, total_alerts, total_devices, top_device, total_monitored, date_from, report_json, uploaded_by, created_at FROM monthly_reports WHERE id = :id AND client_id = :cid LIMIT 1");
    $stmt->execute(array('id' => $report_id, 'cid' => $client_id));
    $row = $stmt->fetch();

    if (!$row) {
        http_response_code(404);
        echo json_encode(array('success' => false, 'error' => 'Reporte no encontrado'));
        exit;
    }

    if (substr($row['report_json'], 0, 3) === 'GZ:') {
        $dec = @gzdecode(base64_decode(substr($row['report_json'], 3)));
        if ($dec !== false) $row['report_json'] = $dec;
    }

    echo json_encode(array('success' => true, 'report' => $row));
    exit;
}

// ── List mode: ?client_id=X ── returns metadata only (no report_json), instant
$stmt = $db->prepare("SELECT id, client_id, periodo, total_alerts, total_devices, top_device, total_monitored, date_from, uploaded_by, created_at FROM monthly_reports WHERE client_id = :cid ORDER BY periodo DESC, created_at DESC");
$stmt->execute(array('cid' => $client_id));
$reports = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo json_encode(array(
    'success'       => true,
    'client_id'     => $client_id,
    'total_reports' => count($reports),
    'reports'       => $reports
));
?>
