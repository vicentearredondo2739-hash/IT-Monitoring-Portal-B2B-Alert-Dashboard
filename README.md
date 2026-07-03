# IT-Monitoring-Portal-B2B-Alert-Dashboard
> Real-time infrastructure alert reporting system built for multi-tenant B2B monitoring environments.
>
# 🔍 IT Monitoring Portal

> Multi-tenant B2B alert dashboard for IT infrastructure monitoring. 
> Built for environments using Centreon as the monitoring engine.

## Screenshots
<img width="1811" height="975" alt="image" src="https://github.com/user-attachments/assets/06f92188-3e37-4569-b4ef-55b7d575f7c8" />
<img width="1810" height="945" alt="image" src="https://github.com/user-attachments/assets/83c0bb68-9749-419e-9e42-a5e7d76cae1d" />
<img width="1693" height="973" alt="image" src="https://github.com/user-attachments/assets/8562d27f-22b0-486f-b706-322894a4dcb7" />



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
