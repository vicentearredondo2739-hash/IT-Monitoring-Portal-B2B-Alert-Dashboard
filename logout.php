<?php
// ==========================================
// API: Logout
// POST /api/logout.php
// ==========================================
require_once __DIR__ . '/config.php';
setCorsHeaders();
session_start();
session_destroy();
echo json_encode(['success' => true]);
?>
