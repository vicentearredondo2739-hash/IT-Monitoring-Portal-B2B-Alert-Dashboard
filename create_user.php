<?php
// ==========================================
// Utilidad: Crear usuario con password hasheada
// USO: php create_user.php "CLI-001" "Banco Industrial" "cliente@banco.com" "password123" "client"
// ==========================================
require_once __DIR__ . '/config.php';

if (php_sapi_name() !== 'cli') {
    die('Este script solo puede ejecutarse desde la línea de comandos.');
}

if ($argc < 6) {
    echo "Uso: php create_user.php <client_id> <company_name> <email> <password> <role>\n";
    echo "Ejemplo: php create_user.php CLI-001 'Banco Industrial' 'cliente@banco.com' 'password123' 'client'\n";
    exit(1);
}

$clientId = $argv[1];
$companyName = $argv[2];
$email = $argv[3];
$password = $argv[4];
$role = $argv[5];

$hash = password_hash($password, PASSWORD_DEFAULT);

$db = getDB();

try {
    $stmt = $db->prepare("
        INSERT INTO portal_users (client_id, company_name, email, password_hash, role) 
        VALUES (:cid, :name, :email, :hash, :role)
    ");
    $stmt->execute([
        'cid' => $clientId,
        'name' => $companyName,
        'email' => $email,
        'hash' => $hash,
        'role' => $role
    ]);
    
    echo "✅ Usuario creado exitosamente:\n";
    echo "   Client ID: $clientId\n";
    echo "   Empresa: $companyName\n";
    echo "   Email: $email\n";
    echo "   Rol: $role\n";
    echo "   Hash: $hash\n";
    
} catch (PDOException $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
    exit(1);
}
?>
