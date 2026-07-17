# ==========================================================
# RCSS Resource Booking System - Development Startup Script
# Run from project root:
#    .\start_dev.ps1
# ==========================================================

$ProjectRoot = $PSScriptRoot

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host " Starting RCSS Development Environment" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""


# ----------------------------
# Redis
# ----------------------------

Write-Host "[0/5] Starting Redis in WSL..." -ForegroundColor Cyan

wsl -d Ubuntu-24.04 sudo service redis-server start

Start-Sleep -Seconds 2


# ----------------------------
# Mailpit
# ----------------------------

Write-Host "[1/5] Starting Mailpit..." -ForegroundColor Magenta

Start-Process powershell -ArgumentList "-NoExit", "-Command", "mailpit"

Start-Sleep -Seconds 1


# ----------------------------
# Django Backend
# ----------------------------

Write-Host "[2/5] Starting Django Server..." -ForegroundColor Green

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ProjectRoot\backend'; py manage.py runserver"

Start-Sleep -Seconds 2


# ----------------------------
# Celery Worker
# ----------------------------

Write-Host "[3/5] Starting Celery Worker..." -ForegroundColor Green

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ProjectRoot\backend'; celery -A core worker --pool=solo --loglevel=info"

Start-Sleep -Seconds 2


# ----------------------------
# Celery Beat
# ----------------------------

Write-Host "[4/5] Starting Celery Beat..." -ForegroundColor Green

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ProjectRoot\backend'; celery -A core beat --loglevel=info --scheduler django_celery_beat.schedulers:DatabaseScheduler"

Start-Sleep -Seconds 2


# ----------------------------
# React Frontend
# ----------------------------

Write-Host "[5/5] Starting React Frontend..." -ForegroundColor Yellow

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ProjectRoot\frontend'; npm run dev"


Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host " RCSS Development Environment Started" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Frontend : http://localhost:5173" -ForegroundColor Yellow
Write-Host "Backend  : http://127.0.0.1:8000" -ForegroundColor Green
Write-Host "Mailpit  : http://localhost:8025" -ForegroundColor Magenta

Write-Host ""
Write-Host "Do not close the opened terminals." -ForegroundColor Yellow