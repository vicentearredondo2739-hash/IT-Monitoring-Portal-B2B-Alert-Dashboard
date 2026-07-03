# IT-Monitoring-Portal-B2B-Alert-Dashboard
> Real-time infrastructure alert reporting system built for multi-tenant B2B monitoring environments.
>
# 🔍 IT Monitoring Portal

> Multi-tenant B2B alert dashboard for IT infrastructure monitoring. 
> Built for environments using Centreon as the monitoring engine.

## Screenshots
>

## Features
- Role-based login (admin / client) with math CAPTCHA
- Drag & drop TXT file parsing from Centreon exports
- Chunked upload for large files (+6MB)
- Interactive dashboard: donut chart, TOP 10 pie, severity bar chart
- Click-to-drill-down alert details per device
- Global search with highlight across all alerts
- Report history with append/overwrite merge logic
- Export to PDF and Excel (.xlsx)
- Multi-company support

## Tech Stack
`Vanilla JS` `Tailwind CSS` `Chart.js` `IndexedDB` `PHP` `MySQL` `ExcelJS` `html2pdf.js`

## Setup
1. Clone the repo
2. Copy `config.example.php` → `api/config.php` and fill in your DB credentials
3. Import the SQL schema (included in `/database/schema.sql`)
4. Deploy to any PHP host (compatible with PHP 5.6+)
