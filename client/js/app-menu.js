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
            // Actualizar nombre del usuario
            const userNameElement = document.getElementById('userName');
            if (userNameElement && account.name) {
                userNameElement.textContent = account.name;
            }

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

        // Configurar botón de logout
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                try {
                    console.log('👋 Cerrando sesión...');
                    logoutBtn.disabled = true;
                    logoutBtn.textContent = 'Cerrando...';
                    
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
