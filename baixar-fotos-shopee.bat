@echo off
chcp 65001 > nul
title Baixar Fotos HD Shopee - Paizao dos Descontos
echo ===============================================================
echo   PAIZAO DOS DESCONTOS - BAIXAR TODAS AS FOTOS DA SHOPEE
echo   Destino: D:\Users\Mauro\Pictures\PaizaoDosDescontos
echo ===============================================================
echo.
powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0baixar-fotos-shopee.ps1"
echo.
pause
