-- ==========================================
-- Schema para el Portal de Informes de Alertas
-- Ejecutar en cPanel > phpMyAdmin
-- ==========================================

-- Tabla de Usuarios (Clientes y Administradores)
CREATE TABLE IF NOT EXISTS `portal_users` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `client_id` VARCHAR(50) NOT NULL UNIQUE,
    `company_name` VARCHAR(100) NOT NULL,
    `email` VARCHAR(120) NOT NULL UNIQUE,
    `password_hash` VARCHAR(255) NOT NULL,
    `role` ENUM('admin', 'client') NOT NULL DEFAULT 'client',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Insertar usuarios por defecto
-- IMPORTANTE: Cambiar las contraseñas en producción
INSERT INTO `portal_users` (`client_id`, `company_name`, `email`, `password_hash`, `role`) VALUES 
('id_client', 'your_company_name', 'your@email', 'your_hash_password', 'admin');

-- Tabla de Reportes Mensuales
CREATE TABLE IF NOT EXISTS `monthly_reports` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `client_id` VARCHAR(50) NOT NULL,
    `periodo` VARCHAR(50) NOT NULL,
    `total_alerts` INT NOT NULL DEFAULT 0,
    `total_devices` INT NOT NULL DEFAULT 0,
    `top_device` VARCHAR(100) DEFAULT NULL,
    `report_json` LONGTEXT NOT NULL,
    `uploaded_by` VARCHAR(120) DEFAULT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX `idx_client_periodo` (`client_id`, `periodo`),
    FOREIGN KEY (`client_id`) REFERENCES `portal_users`(`client_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
