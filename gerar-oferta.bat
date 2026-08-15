@echo off
chcp 65001 >nul
title Paizão dos Descontos — Gerador de Ofertas
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0gerar-oferta.ps1"
