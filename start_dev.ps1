# Start dev environment: Mailpit, Celery worker, Celery beat
# Run this from the project root with: .\start_dev.ps1

Write-Host "Starting Mailpit..." -ForegroundColor Magenta
Start-Process powershell -ArgumentList "-NoExit", "-Command", "mailpit"
Start-Sleep -Seconds 1

Write-Host "Starting Celery worker..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD\backend'; .\venv\Scripts\Activate.ps1; celery -A core worker --pool=solo --loglevel=info"
Start-Sleep -Seconds 2

Write-Host "Starting Celery beat..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD\backend'; .\venv\Scripts\Activate.ps1; celery -A core beat --loglevel=info --scheduler django_celery_beat.schedulers:DatabaseScheduler"

Write-Host "All processes started." -ForegroundColor Cyan
Write-Host "Mailpit inbox → http://localhost:8025" -ForegroundColor Magenta
Write-Host "Remember to start Redis in WSL2 first if it isn't running." -ForegroundColor Yellow