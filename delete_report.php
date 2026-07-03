<?php
// delete_report.php
require_once __DIR__ . '/config.php';
setCorsHeaders();
session_start();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit;
}

if (!isset($_SESSION['role']) || $_SESSION['role'] !== 'admin') {
    http_response_code(403);
    echo json_encode(array('success' => false, 'error' => 'Acceso denegado'));
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$id = isset($input['id']) ? intval($input['id']) : 0;

if (!$id) {
    http_response_code(400);
    echo json_encode(array('success' => false, 'error' => 'ID requerido'));
    exit;
}

try {
    $db = getDB();
    $stmt = $db->prepare("DELETE FROM monthly_reports WHERE id = ?");
    $stmt->execute(array($id));

    echo json_encode(array('success' => true));
} catch(Exception $e) {
    echo json_encode(array('success' => false, 'message' => 'Error DB: ' . $e->getMessage()));
}
?>
