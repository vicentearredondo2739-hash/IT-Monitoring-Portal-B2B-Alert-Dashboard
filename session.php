<?php
// ==========================================
// API: Check Session Status
// GET /api/session.php
// ==========================================
require_once __DIR__ . '/config.php';
setCorsHeaders();
session_start();

if (isset($_SESSION['user_id'])) {
    echo json_encode([
        'authenticated' => true,
        'user' => [
            'client_id' => $_SESSION['client_id'],
            'company_name' => $_SESSION['company_name'],
            'email' => $_SESSION['email'],
            'role' => $_SESSION['role']
        ]
    ]);
} else {
    echo json_encode(['authenticated' => false]);
}
?>
