<?php
// ==========================================
// Configuración de Base de Datos
// Compatible con PHP 5.6+
// ==========================================

define('DB_HOST', 'localhost');
define('DB_NAME', 'your_db_user');
define('DB_USER', 'your_db_name');
define('DB_PASS', 'your_db_password');                  // Cambiar en el servidor

// Conexión PDO
function getDB() {
    try {
        $pdo = new PDO(
            "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4",
            DB_USER,
            DB_PASS,
            array(
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
            )
        );
        return $pdo;
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(array('error' => 'Error de conexión a la base de datos'));
        exit;
    }
}

// Headers CORS para API
function setCorsHeaders() {
    header('Content-Type: application/json; charset=utf-8');
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(200);
        exit;
    }
}

// Session helper
function requireAuth() {
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    if (!isset($_SESSION['user_id'])) {
        http_response_code(401);
        echo json_encode(array('error' => 'No autenticado'));
        exit;
    }
    return $_SESSION;
}

function requireAdmin() {
    $session = requireAuth();
    if ($session['role'] !== 'admin') {
        http_response_code(403);
        echo json_encode(array('error' => 'Acceso denegado: se requiere rol admin'));
        exit;
    }
    return $session;
}
?>
