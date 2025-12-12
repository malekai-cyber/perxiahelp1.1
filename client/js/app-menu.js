// ============================================
// PERXIA HELP - MENU PAGE LOGIC
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('📄 Inicializando Menú...');

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
            const { name } = account;

            // Actualizar nombre del usuario en el header
            const userNameElement = document.getElementById('userName');
            if (userNameElement && name) {
                userNameElement.textContent = name;
            }

            // Saludo personalizado en el hero
            const heroUserNameElement = document.getElementById('heroUserName');
            if (heroUserNameElement && name) {
                heroUserNameElement.textContent = name.split(' ')[0];
            }

            // Actualizar avatar con iniciales
            const userAvatarElement = document.getElementById('userAvatar');
            if (userAvatarElement && name) {
                const initials = name
                    .split(' ')
                    .filter(Boolean)
                    .map(word => word[0])
                    .join('')
                    .toUpperCase()
                    .substring(0, 2);
                userAvatarElement.textContent = initials;
            }

            console.log('✅ Usuario autenticado:', account.username);
        }

        // Configurar navegación de botones principales
        const routeButtons = document.querySelectorAll('[data-route]');
        routeButtons.forEach(button => {
            button.addEventListener('click', () => {
                const targetRoute = button.getAttribute('data-route');
                if (targetRoute) {
                    window.location.href = targetRoute;
                }
            });
        });

        // Configurar quick access cards (navegan al chatbot con contexto)
        const quickCards = document.querySelectorAll('.quick-card[data-action]');
        quickCards.forEach(card => {
            card.addEventListener('click', () => {
                const action = card.getAttribute('data-action');
                if (action) {
                    // Navegar al chatbot con el prompt preconfigurado
                    const prompts = {
                        'casos': '¿Cuáles son los casos de éxito más relevantes?',
                        'pocs': '¿Qué PoCs tenemos disponibles?',
                        'docs': '¿Cómo puedo analizar mis documentos?'
                    };
                    const prompt = prompts[action] || '';
                    if (prompt) {
                        sessionStorage.setItem('pendingPrompt', prompt);
                    }
                    window.location.href = '/pages/chatbot.html';
                }
            });
        });

        // Configurar tip items (sugerencias rápidas)
        const tipItems = document.querySelectorAll('.tip-item[data-prompt]');
        tipItems.forEach(item => {
            item.addEventListener('click', () => {
                const prompt = item.getAttribute('data-prompt');
                if (prompt) {
                    sessionStorage.setItem('pendingPrompt', prompt);
                    window.location.href = '/pages/chatbot.html';
                }
            });
        });

        // Cargar contadores desde el Hub (si está disponible)
        loadHubStats();

        // Configurar botón de logout
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                try {
                    console.log('👋 Cerrando sesión...');
                    logoutBtn.disabled = true;
                    logoutBtn.style.opacity = '0.5';
                    
                    await authService.logout();
                    
                } catch (error) {
                    console.error('❌ Error en logout:', error);
                    // Forzar limpieza y redirect en caso de error
                    window.location.href = '/';
                }
            });
        }

        console.log('✅ Menú listo');

    } catch (error) {
        console.error('❌ Error fatal en Menú:', error);
        // Redirigir a landing en caso de error
        window.location.href = '/';
    }
});

// Cargar estadísticas del Hub
async function loadHubStats() {
    console.log('📊 Cargando stats del Hub...');
    
    const casosEl = document.getElementById('casosCount');
    const pocsEl = document.getElementById('pocsCount');
    const docsEl = document.getElementById('docsCount');
    
    // Mostrar valores mientras carga
    if (casosEl) casosEl.innerHTML = '<span class="value-loader"></span>';
    if (pocsEl) pocsEl.innerHTML = '<span class="value-loader"></span>';
    if (docsEl) docsEl.innerHTML = '<span class="value-loader"></span>';
    
    try {
        // Intentar sin token primero (el endpoint puede ser público)
        let response = await fetch('/api/hub/stats', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        // Si falla, intentar con token
        if (!response.ok) {
            const token = await authService.getAccessToken();
            if (token) {
                response = await fetch('/api/hub/stats', {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });
            }
        }

        if (response.ok) {
            const data = await response.json();
            console.log('📊 Stats recibidos:', data);
            
            if (data.success && data.stats) {
                const { casos, pocs, tools, otros, total, topTags } = data.stats;
                
                // Actualizar contadores con animación
                animateValue(casosEl, casos || 0);
                animateValue(pocsEl, pocs || 0);
                animateValue(docsEl, total || 0);
                
                // Actualizar gráfico de distribución
                updateDistributionChart(casos || 0, pocs || 0, tools || 0, otros || 0, total || 0, topTags || {});
                return;
            } else if (data.stats) {
                // Formato alternativo sin success wrapper
                const { casos, pocs, tools, otros, total, topTags } = data.stats;
                animateValue(casosEl, casos || 0);
                animateValue(pocsEl, pocs || 0);
                animateValue(docsEl, total || 0);
                updateDistributionChart(casos || 0, pocs || 0, tools || 0, otros || 0, total || 0, topTags || {});
                return;
            }
        }
        
        console.log('⚠️ Respuesta no OK o sin datos');
        setDefaultStats();
    } catch (error) {
        console.log('ℹ️ Stats del Hub no disponibles:', error.message);
        setDefaultStats();
    }
    
    function setDefaultStats() {
        if (casosEl) casosEl.textContent = '--';
        if (pocsEl) pocsEl.textContent = '--';
        if (docsEl) docsEl.textContent = '--';
        updateDistributionChart(0, 0, 0, 0, 0, {});
    }
}

// Actualizar gráfico de distribución
function updateDistributionChart(casos, pocs, tools, otros, total, topTags) {
    const totalEl = document.getElementById('totalItems');
    const barCasos = document.getElementById('barCasos');
    const barPocs = document.getElementById('barPocs');
    const barTools = document.getElementById('barTools');
    const barOtros = document.getElementById('barOtros');
    const barCasosValue = document.getElementById('barCasosValue');
    const barPocsValue = document.getElementById('barPocsValue');
    const barToolsValue = document.getElementById('barToolsValue');
    const barOtrosValue = document.getElementById('barOtrosValue');
    const topTagsEl = document.getElementById('topTags');
    
    if (total === 0) {
        if (totalEl) totalEl.textContent = 'Sin datos';
        return;
    }
    
    // Total
    if (totalEl) totalEl.textContent = `${total} documentos indexados`;
    
    // Calcular porcentajes (máx 100%)
    const maxVal = Math.max(casos, pocs, tools, otros, 1);
    const scale = 60; // max width %
    
    // Animar barras con delay
    setTimeout(() => {
        if (barCasos) barCasos.style.setProperty('--percent', `${(casos / maxVal) * scale}%`);
        if (barCasosValue) barCasosValue.textContent = casos;
    }, 100);
    
    setTimeout(() => {
        if (barPocs) barPocs.style.setProperty('--percent', `${(pocs / maxVal) * scale}%`);
        if (barPocsValue) barPocsValue.textContent = pocs;
    }, 200);
    
    setTimeout(() => {
        if (barTools) barTools.style.setProperty('--percent', `${(tools / maxVal) * scale}%`);
        if (barToolsValue) barToolsValue.textContent = tools;
    }, 300);
    
    setTimeout(() => {
        if (barOtros) barOtros.style.setProperty('--percent', `${(otros / maxVal) * scale}%`);
        if (barOtrosValue) barOtrosValue.textContent = otros;
    }, 400);
    
    // Top tags
    if (topTagsEl && topTags && Object.keys(topTags).length > 0) {
        const tagsHtml = Object.keys(topTags).slice(0, 6).map(tag => 
            `<span class="tag-chip">${tag}</span>`
        ).join('');
        topTagsEl.innerHTML = `<span class="tags-label">Tags populares:</span>${tagsHtml}`;
    }
}

// Animación de contador
function animateValue(el, endValue) {
    if (!el) return;
    const duration = 800;
    const startTime = performance.now();
    const startValue = 0;
    
    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeProgress = 1 - Math.pow(1 - progress, 3);
        const currentValue = Math.floor(startValue + (endValue - startValue) * easeProgress);
        el.textContent = currentValue;
        
        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            el.textContent = endValue;
        }
    }
    requestAnimationFrame(update);
}
