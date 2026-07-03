<?php
// ==========================================
// API: Login / Autenticación
// Compatible con PHP 5.6+
// POST /api/login.php
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
$email = isset($input['email']) ? $input['email'] : '';
$password = isset($input['password']) ? $input['password'] : '';

if (empty($email) || empty($password)) {
    http_response_code(400);
    echo json_encode(array('error' => 'Email y contraseña son requeridos'));
    exit;
}

$db = getDB();
$stmt = $db->prepare("SELECT * FROM portal_users WHERE email = :email LIMIT 1");
$stmt->execute(array('email' => $email));
$user = $stmt->fetch();

if (!$user) {
    http_response_code(401);
    echo json_encode(array('error' => 'Credenciales incorrectas'));
    exit;
}

// Verificar contraseña: soporta bcrypt hash Y texto plano
$passwordValid = false;
$storedHash = $user['password_hash'];

if (strpos($storedHash, '$2y$') === 0 || strpos($storedHash, '$2a$') === 0) {
    $passwordValid = password_verify($password, $storedHash);
} else {
    $passwordValid = ($password === $storedHash);
}

if (!$passwordValid) {
    http_response_code(401);
    echo json_encode(array('error' => 'Credenciales incorrectas'));
    exit;
}

// Set session
$_SESSION['user_id'] = $user['id'];
$_SESSION['client_id'] = $user['client_id'];
$_SESSION['company_name'] = $user['company_name'];
$_SESSION['email'] = $user['email'];
$_SESSION['role'] = $user['role'];

echo json_encode(array(
    'success' => true,
    'user' => array(
        'client_id' => $user['client_id'],
        'company_name' => $user['company_name'],
        'email' => $user['email'],
        'role' => $user['role']
    )
));
?>
