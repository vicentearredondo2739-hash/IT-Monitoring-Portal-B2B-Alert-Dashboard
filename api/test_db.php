<?php
// Test de conexión — BORRAR DESPUÉS DE VERIFICAR
error_reporting(E_ALL);
ini_set('display_errors', 1);
header('Content-Type: application/json');

echo json_encode([
    'php_version' => phpversion(),
    'pdo_available' => extension_loaded('pdo_mysql'),
    'step' => 'testing config load'
]);

// Try loading config
require_once __DIR__ . '/config.php';

echo "\n";
echo json_encode([
    'step' => 'config loaded',
    'db_name' => DB_NAME,
    'db_user' => DB_USER,
    'db_host' => DB_HOST
]);

// Try DB connection
try {
    $db = getDB();
    echo "\n";
    echo json_encode(['step' => 'db connected OK']);
    
    $stmt = $db->query("SELECT COUNT(*) as total FROM portal_users");
    $result = $stmt->fetch();
    echo "\n";
    echo json_encode(['step' => 'query OK', 'total_users' => $result['total']]);
} catch (Exception $e) {
    echo "\n";
    echo json_encode(['step' => 'db error', 'message' => $e->getMessage()]);
}
?>
