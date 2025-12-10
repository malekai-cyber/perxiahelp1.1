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
