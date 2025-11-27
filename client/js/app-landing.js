// ============================================
// PERXIA HELP - LANDING PAGE LOGIC
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('📄 Inicializando Landing Page...');

        // Esperar a que MSAL termine de inicializar
        await authService.initPromise;

        console.log('🔍 Verificando estado de autenticación...');

        // Verificar si ya está autenticado (después de que MSAL procese el redirect)
        const isAuthenticated = await authService.isAuthenticated();

        if (isAuthenticated) {
            console.log('✅ Usuario autenticado detectado, redirigiendo a menú...');
            
            // Limpiar el hash de la URL antes de redirigir
            if (window.location.hash) {
                console.log('🧹 Limpiando hash de la URL...');
            }
            
            // Redirigir inmediatamente
            window.location.replace('/pages/menu.html');
            return;
        }

        console.log('👤 Usuario no autenticado, mostrando landing page...');

        // Si no está autenticado, configurar botón de login
        const loginBtn = document.getElementById('loginBtn');
        
        if (loginBtn) {
            loginBtn.addEventListener('click', async () => {
                try {
                    console.log('🔐 Usuario presionó botón de login');
                    
                    // Deshabilitar botón para prevenir doble-clic
                    loginBtn.disabled = true;
                    loginBtn.textContent = 'Redirigiendo...';

                    // Iniciar proceso de login
                    await authService.loginWithAzureAD();

                } catch (error) {
                    console.error('❌ Error en login:', error);
                    
                    // Re-habilitar botón en caso de error
                    loginBtn.disabled = false;
                    loginBtn.innerHTML = `
                        <svg class="microsoft-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <rect x="1" y="1" width="10" height="10" fill="currentColor"/>
                            <rect x="13" y="1" width="10" height="10" fill="currentColor"/>
                            <rect x="1" y="13" width="10" height="10" fill="currentColor"/>
                            <rect x="13" y="13" width="10" height="10" fill="currentColor"/>
                        </svg>
                        Acceder con Microsoft
                    `;

                    alert('Error al iniciar sesión. Por favor, intenta de nuevo.');
                }
            });
        }

        console.log('✅ Landing Page lista');

    } catch (error) {
        console.error('❌ Error fatal en Landing Page:', error);
        alert('Error al inicializar la aplicación. Por favor, recarga la página.');
    }
});
