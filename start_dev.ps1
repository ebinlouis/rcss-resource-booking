# Start Celery worker and beat for development
# Run this from the project root with: .\start_dev.ps1

Write-Host "Starting Celery worker..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD\backend'; .\venv\Scripts\Activate.ps1; celery -A core worker --pool=solo --loglevel=info"

Start-Sleep -Seconds 2

Write-Host "Starting Celery beat..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD\backend'; .\venv\Scripts\Activate.ps1; celery -A core beat --loglevel=info --scheduler django_celery_beat.schedulers:DatabaseScheduler"

Write-Host "Both Celery processes started in separate windows." -ForegroundColor Cyan
Write-Host "Remember to start Redis in WSL2 first if it isn't running." -ForegroundColor Yellow