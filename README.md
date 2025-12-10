# Perxia Help

**Centro de Consultas Técnicas y Comerciales con IA**

Aplicación empresarial full-stack con Node.js/Express, autenticación Azure AD, DeepSeek AI y Microsoft Copilot Studio.

---

## 🏗️ Arquitectura

```
Perxia_Help/
├── server.js              # Servidor Express principal
├── package.json           # Dependencias Node.js
├── .env                   # Variables de entorno (NO subir a Git)
├── .env.example           # Plantilla de variables de entorno
├── routes/                # Rutas API del backend
│   ├── auth.js           # Autenticación Azure AD
│   ├── deepseek.js       # API DeepSeek
│   ├── storage.js        # Azure Storage
│   └── health.js         # Health checks
├── client/                # Frontend (SPA)
│   ├── index.html        # Landing page
│   ├── config.js         # Config del cliente
│   ├── pages/            
│   │   ├── menu.html     # Menú principal
│   │   ├── chatbot.html  # Consultas IA
│   │   └── casos-exito.html  # Casos de éxito
│   ├── css/              
│   │   ├── variables.css # Sistema de diseño
│   │   ├── landing.css   # Estilos landing
│   │   ├── menu.css      # Estilos menú
│   │   ├── chatbot.css   # Estilos chatbot
│   │   └── casos-exito.css # Estilos casos
│   └── js/               
│       ├── auth.js       # Servicio autenticación
│       ├── app-landing.js    # Lógica landing
│       ├── app-menu.js       # Lógica menú
│       ├── app-chatbot.js    # Lógica chatbot
│       └── app-casos-exito.js # Lógica casos
├── SETUP.md              # Guía de configuración
└── README.md             # Este archivo
```

---

## 🚀 Inicio Rápido

### 1. Instalar Dependencias

```powershell
cd c:\Users\danielgarcia\Desktop\Perxia_Help
npm install
```

### 2. Configurar Variables de Entorno

Edita `.env` con tus credenciales de Azure:

```powershell
code .env
```

Completa los valores:
- Azure AD (Tenant ID, Client ID, Client Secret)
- DeepSeek AI Foundry (Endpoint, API Key)
- Azure Storage (Connection String)

Ver **[SETUP.md](./SETUP.md)** para instrucciones detalladas.

### 3. Iniciar el Servidor

**Modo Desarrollo:**
```powershell
npm run dev
```

**Modo Producción:**
```powershell
npm start
```

El servidor estará disponible en:
- **Backend API**: http://localhost:3000/api
- **Frontend**: http://localhost:3000

---

## 📋 Requisitos Previos

### Software
- Node.js >= 18.0.0
- npm >= 9.0.0
- Cuenta de Azure con suscripción activa

### Servicios de Azure
1. **Azure App Registration** (autenticación)
2. **Azure AI Foundry** con DeepSeek
3. **Azure Storage Account** (documentos)
4. **Microsoft Copilot Studio** (opcional)

Ver **[SETUP.md](./SETUP.md)** para crear estos recursos.

---

## 🎯 Funcionalidades

### ✅ Implementado
- ✅ Servidor Express con API REST
- ✅ Variables de entorno con `.env`
- ✅ Autenticación Azure AD (MSAL)
- ✅ Integración DeepSeek V3 y R1
- ✅ Upload de documentos a Azure Storage
- ✅ Rate limiting y seguridad (Helmet)
- ✅ CORS configurado
- ✅ Logging con Morgan
- ✅ Compresión de respuestas
- ✅ Modo demo (funciona sin configuración)
- ✅ Health checks
- ✅ Frontend SPA completo

### 🔄 En Desarrollo
- Token JWT para sesiones
- Middleware de autenticación en rutas
- WebSocket para streaming de respuestas
- Procesamiento de documentos con Azure AI
- Búsqueda semántica en documentos

---

## 🔌 API Endpoints

### Health Check
```
GET /api/health
GET /api/health/detailed
```

### Authentication
```
GET  /api/auth/config          # Configuración Azure AD
POST /api/auth/login           # Login con credenciales
POST /api/auth/verify          # Verificar token
POST /api/auth/logout          # Cerrar sesión
```

### DeepSeek AI
```
POST /api/deepseek/chat        # Enviar mensaje al chatbot
GET  /api/deepseek/models      # Obtener modelos disponibles
```

### Storage
```
POST   /api/storage/upload     # Subir documento
GET    /api/storage/documents  # Listar documentos
DELETE /api/storage/documents/:filename  # Eliminar documento
```

---

## 🧪 Probar la Aplicación

### 1. Verificar Health Check
```powershell
curl http://localhost:3000/api/health
```

### 2. Probar DeepSeek
```powershell
curl -X POST http://localhost:3000/api/deepseek/chat `
  -H "Content-Type: application/json" `
  -d '{"messages":[{"role":"user","content":"Hola"}],"model":"v3"}'
```

### 3. Abrir Frontend
```
http://localhost:3000
```

---

## 📦 Desplegar en Azure

### Azure App Service

```bash
# 1. Crear Web App
az webapp create \
  --resource-group perxia-rg \
  --plan perxia-plan \
  --name perxia-help \
  --runtime "NODE|18-lts"

# 2. Configurar variables de entorno
az webapp config appsettings set \
  --resource-group perxia-rg \
  --name perxia-help \
  --settings @appsettings.json

# 3. Desplegar código
az webapp deployment source config-zip \
  --resource-group perxia-rg \
  --name perxia-help \
  --src perxia-help.zip
```

---

## 🔒 Seguridad

### Variables de Entorno
⚠️ **NUNCA** subas `.env` a Git (ya está en `.gitignore`)

### Producción
- [ ] Cambiar `JWT_SECRET` y `SESSION_SECRET`
- [ ] Usar Azure Key Vault para secretos
- [ ] Habilitar HTTPS only
- [ ] Configurar firewall en Azure Storage
- [ ] Implementar autenticación en todas las rutas API

---

## 🐛 Solución de Problemas

### Puerto en uso
```powershell
# Cambiar puerto en .env
PORT=3001
```

### Error de conexión a DeepSeek
1. Verifica `DEEPSEEK_ENDPOINT` en `.env`
2. Verifica `DEEPSEEK_API_KEY` es válida
3. Verifica que el deployment existe en Azure

---

## 📞 Soporte

- **Documentación**: [SETUP.md](./SETUP.md)
- **Email**: soporte@perxia.com

1. Comprime el proyecto en un archivo .zip
2. Crea una Azure Web App
3. Despliega usando:
   - Azure Portal (Deployment Center)
   - Azure CLI: `az webapp deploy`
   - Visual Studio Code con extensión Azure

## ⚙️ Configuración

### Azure AD Authentication (Próximamente)
```javascript
// Configurar en js/app.js
const azureConfig = {
    clientId: "TU_CLIENT_ID",
    authority: "https://login.microsoftonline.com/TU_TENANT_ID",
    redirectUri: "https://tu-dominio.azurewebsites.net"
};
```

### DeepSeek API (Próximamente)
```javascript
// Configurar endpoint y API key
const deepseekConfig = {
    endpoint: "TU_ENDPOINT_API",
    apiKey: "TU_API_KEY",
    model: "deepseek-v3" // o "deepseek-r1"
};
```

### Microsoft Copilot Studio
1. Ve a [Microsoft Copilot Studio](https://copilotstudio.microsoft.com)
2. Crea o selecciona tu bot
3. Ve a **Canales** → **Sitio web personalizado**
4. Copia la URL del iframe
5. Pégala en la aplicación cuando se solicite

## 📱 Responsive

La aplicación es completamente responsive y se adapta a:
- Escritorio (1920px y superior)
- Laptop (1200px - 1920px)
- Tablet (768px - 1200px)
- Móvil (menor a 768px)

## 🔒 Seguridad

- Headers de seguridad configurados
- X-Content-Type-Options
- X-Frame-Options
- X-XSS-Protection
- Referrer-Policy

## 📝 Próximos Pasos

1. **Implementar Azure AD B2C** para autenticación real
2. **Integrar DeepSeek API** para el chatbot
3. **Configurar Azure Blob Storage** para almacenamiento de documentos
4. **Implementar backend API** (Azure Functions o App Service)
5. **Añadir telemetría** con Application Insights
6. **Configurar CI/CD** con GitHub Actions o Azure DevOps

## 📄 Licencia

© 2025 Perxia Help. Todos los derechos reservados.

## 👥 Soporte

Para soporte técnico, contacta al equipo de desarrollo.
