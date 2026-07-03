-- ==========================================
-- Migración de velocidad — ejecutar en phpMyAdmin
-- Agrega columnas para evitar parsear el JSON completo en cada request
-- ==========================================

ALTER TABLE monthly_reports
    ADD COLUMN total_monitored INT DEFAULT NULL AFTER total_devices,
    ADD COLUMN date_from VARCHAR(20) DEFAULT NULL AFTER total_monitored;
