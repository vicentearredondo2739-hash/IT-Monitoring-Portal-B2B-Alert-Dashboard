<?php
// ==========================================
// API: Listar Clientes (Solo Admin)
// GET /api/list_clients.php
// ==========================================
require_once __DIR__ . '/config.php';
setCorsHeaders();
requireAdmin();

$db = getDB();

// Get all clients with their latest report info
$stmt = $db->query("
    SELECT 
        u.client_id, 
        u.company_name, 
        u.email,
        r.periodo AS last_periodo,
        r.total_alerts AS last_total_alerts,
        r.created_at AS last_report_date
    FROM portal_users u
    LEFT JOIN (
        SELECT client_id, periodo, total_alerts, created_at,
               ROW_NUMBER() OVER (PARTITION BY client_id ORDER BY created_at DESC) as rn
        FROM monthly_reports
    ) r ON u.client_id = r.client_id AND r.rn = 1
    WHERE u.role = 'client'
    ORDER BY u.company_name ASC
");

$clients = $stmt->fetchAll();

echo json_encode([
    'success' => true,
    'clients' => $clients
]);
?>
