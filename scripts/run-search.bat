@echo off
REM Script batch para executar busca agendada no Windows
REM Este script pode ser usado diretamente no Task Scheduler
REM 
REM Uso no Task Scheduler:
REM   Programa/script: C:\caminho\completo\do\projeto\scripts\run-search.bat
REM   Adicionar argumentos: (deixe vazio)
REM   Iniciar em: (deixe vazio ou use o caminho do projeto)

REM Mudar para o diretório do projeto (pasta pai do scripts)
cd /d "%~dp0.."

REM Verificar se o Node.js está disponível
where node >nul 2>&1
if errorlevel 1 (
    echo ERRO: Node.js nao encontrado no PATH
    echo Configure o caminho completo do node.exe no Task Scheduler
    exit /b 1
)

REM Executar o script Node.js
node scripts/run-scheduled-search.js

REM Verificar se houve erro
if errorlevel 1 (
    echo.
    echo ERRO: Falha ao executar busca agendada
    echo Verifique os logs acima para mais detalhes
    exit /b 1
)

REM Sucesso
exit /b 0

