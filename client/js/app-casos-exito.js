// ============================================
// PERXIA HELP - CASOS DE ÉXITO PAGE LOGIC
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('📄 Inicializando Casos de Éxito...');

        // Esperar a que MSAL termine de inicializar
        await authService.initPromise;

        // Verificar autenticación
        const isAuthenticated = await authService.isAuthenticated();

        if (!isAuthenticated) {
            console.log('❌ Usuario no autenticado, redirigiendo a landing...');
            window.location.href = '/';
            return;
        }

        // Obtener información del usuario
        const account = authService.getAccount();

        if (account) {
            // Actualizar avatar con iniciales
            const userAvatarElement = document.getElementById('userAvatar');
            if (userAvatarElement && account.name) {
                const initials = account.name
                    .split(' ')
                    .map(word => word[0])
                    .join('')
                    .toUpperCase()
                    .substring(0, 2);
                userAvatarElement.textContent = initials;
            }

            console.log('✅ Usuario autenticado:', account.username);
        }

        // ===== ELEMENTOS DEL DOM =====
        const backBtn = document.getElementById('backBtn');
        const refreshBtn = document.getElementById('refreshBtn');
        const copilotFrame = document.getElementById('copilotFrame');
        const frameLoading = document.getElementById('frameLoading');
        const questionChips = document.querySelectorAll('.question-chip');

        // ===== BOTÓN DE REGRESO =====
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                window.location.href = '/pages/menu.html';
            });
        }

        // ===== IFRAME LOAD HANDLING =====
        if (copilotFrame && frameLoading) {
            copilotFrame.addEventListener('load', () => {
                console.log('✅ Copilot Studio iframe cargado');
                frameLoading.classList.add('hidden');
            });

            copilotFrame.addEventListener('error', (e) => {
                console.error('❌ Error cargando Copilot Studio iframe:', e);
                frameLoading.innerHTML = `
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 32px; height: 32px; color: #ff6b6b;">
                        <circle cx="12" cy="12" r="10"/>
                        <path d="M12 8v4M12 16h.01"/>
                    </svg>
                    <span>Error al cargar el asistente</span>
                    <button onclick="location.reload()" style="padding: 0.5rem 1rem; background: rgba(0,200,150,0.2); border: 1px solid rgba(0,200,150,0.3); border-radius: 8px; color: #00C896; cursor: pointer;">
                        Reintentar
                    </button>
                `;
            });
        }

        // ===== BOTÓN REFRESH =====
        if (refreshBtn && copilotFrame) {
            refreshBtn.addEventListener('click', () => {
                frameLoading.classList.remove('hidden');
                copilotFrame.src = copilotFrame.src;
            });
        }

        // ===== QUESTION CHIPS =====
        questionChips.forEach(chip => {
            chip.addEventListener('click', () => {
                const question = chip.dataset.question;
                if (question) {
                    // Intentar enviar la pregunta al iframe (si el bot lo soporta)
                    console.log('📝 Pregunta sugerida:', question);
                    // Copiar al portapapeles como alternativa
                    navigator.clipboard.writeText(question).then(() => {
                        chip.textContent = '¡Copiado!';
                        chip.style.background = 'rgba(0, 200, 150, 0.2)';
                        chip.style.borderColor = 'rgba(0, 200, 150, 0.4)';
                        setTimeout(() => {
                            chip.textContent = chip.dataset.question.length > 20 
                                ? chip.dataset.question.substring(0, 17) + '...'
                                : chip.dataset.question;
                            chip.style.background = '';
                            chip.style.borderColor = '';
                        }, 1500);
                    });
                }
            });
        });

        console.log('✅ Casos de Éxito listo');

    } catch (error) {
        console.error('❌ Error fatal en Casos de Éxito:', error);
        // Redirigir a landing en caso de error
        window.location.href = '/';
    }
});
