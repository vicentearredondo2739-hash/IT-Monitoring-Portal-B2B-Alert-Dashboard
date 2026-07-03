<?php
// ==========================================
// API: Update Report Meta — PHP 5.6+
// POST /api/update_report_meta.php
// ==========================================
require_once __DIR__ . '/config.php';
setCorsHeaders();
session_start();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(array('error' => 'Método no permitido'));
    exit;
}

$inputJSON = file_get_contents('php://input');
$input = json_decode($inputJSON, true);

$id = isset($input['id']) ? $input['id'] : null;
$totalMonitored = isset($input['totalMonitored']) ? (int)$input['totalMonitored'] : null;

if (!$id || $totalMonitored === null) {
    http_response_code(400);
    echo json_encode(array('error' => 'ID y totalMonitored requeridos'));
    exit;
}

$db = getDB();

try {
    // Update both the column (fast) and the JSON field (for consistency in dashboard)
    $stmt = $db->prepare("SELECT id, report_json FROM monthly_reports WHERE id = :id LIMIT 1");
    $stmt->execute(array('id' => $id));
    $report = $stmt->fetch();

    if (!$report) {
        echo json_encode(array('success' => false, 'error' => 'Reporte no encontrado'));
        exit;
    }

    // Update column directly (instant, no JSON parse needed)
    $colStmt = $db->prepare("UPDATE monthly_reports SET total_monitored = :tm WHERE id = :id");
    $colStmt->execute(array('tm' => $totalMonitored, 'id' => $id));

    // Also patch the JSON field so dashboard reads correct value
    $raw = $report['report_json'];
    if (substr($raw, 0, 3) === 'GZ:') {
        $decomp = @gzdecode(base64_decode(substr($raw, 3)));
        if ($decomp !== false) $raw = $decomp;
    }
    $data = json_decode($raw, true);
    if ($data && json_last_error() === JSON_ERROR_NONE) {
        $data['totalMonitored'] = $totalMonitored;
        $newJson     = json_encode($data);
        $json_to_save = (strlen($newJson) > 100000 && function_exists('gzencode'))
            ? 'GZ:' . base64_encode(gzencode($newJson, 9))
            : $newJson;
        $db->prepare("UPDATE monthly_reports SET report_json = :json WHERE id = :id")
           ->execute(array('json' => $json_to_save, 'id' => $id));
    }

    echo json_encode(array('success' => true));

} catch(PDOException $e) {
    echo json_encode(array('success' => false, 'error' => 'Error BD: ' . $e->getMessage()));
}
?>
