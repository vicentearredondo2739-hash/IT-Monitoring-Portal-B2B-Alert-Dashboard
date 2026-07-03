<?php
// get_all_reports.php
require_once __DIR__ . '/config.php';
setCorsHeaders();
session_start();

if (!isset($_SESSION['role']) || $_SESSION['role'] !== 'admin') {
    http_response_code(403);
    echo json_encode(array('success' => false, 'error' => 'Acceso denegado'));
    exit;
}

try {
    $db = getDB();
    // Select only metadata columns — never decompress report_json here
    $stmt = $db->query("SELECT id, client_id, periodo, total_alerts, total_devices, top_device, total_monitored, date_from, uploaded_by, created_at FROM monthly_reports ORDER BY periodo DESC, created_at DESC");
    $reports = $stmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($reports as &$r) {
        // Expose totalMonitored directly from column (no JSON parsing)
        $r['totalMonitored'] = ($r['total_monitored'] !== null) ? $r['total_monitored'] : 'N/A';
    }

    echo json_encode(array('success' => true, 'reports' => $reports));
} catch(Exception $e) {
    echo json_encode(array('success' => false, 'message' => 'Error DB: ' . $e->getMessage()));
}
?>
