# Perxia Help

**Centro de Consultas Técnicas y Comerciales con IA y RAG**

Aplicación empresarial full-stack con Node.js/Express, autenticación Azure AD, Azure AI Foundry (DeepSeek), Azure Document Intelligence, Azure AI Search y Azure Storage.

---

## 🏗️ Arquitectura

```
Perxia_Help/
├── server.js                  # Servidor Express principal
├── package.json               # Dependencias Node.js
├── .env                       # Variables de entorno (NO subir a Git)
├── .env.example               # Plantilla de variables de entorno
├── routes/                    # Rutas API del backend
│   ├── auth.js                # Autenticación Azure AD
│   ├── documents.js           # Gestión de documentos (upload, search, delete)
│   ├── perxia-copilot.js      # Chat con DeepSeek V3 + RAG
│   ├── perxia-copilot-pro.js  # Chat con DeepSeek R1 + RAG
│   ├── storage.js             # Azure Storage directo
│   └── health.js              # Health checks
├── services/                  # Servicios de Azure
│   ├── document-intelligence.js  # Azure Document Intelligence (PDF/Word)
│   ├── embedding-service.js      # Azure OpenAI Embeddings
│   ├── search-service.js         # Azure AI Search (Vector + Semantic)
│   └── chunking-service.js       # División de documentos en chunks
├── client/                    # Frontend (SPA)
│   ├── index.html             # Landing page
│   ├── config.js              # Configuración del cliente
│   ├── pages/            
│   │   ├── menu.html          # Menú principal
│   │   ├── chatbot.html       # Consultas IA con documentos
│   │   └── casos-exito.html   # Casos de éxito
│   ├── css/              
│   │   ├── variables.css      # Sistema de diseño (verde Perxia)
│   │   ├── landing.css        # Estilos landing
│   │   ├── menu.css           # Estilos menú
│   │   ├── chatbot.css        # Estilos chatbot + panel docs
│   │   └── casos-exito.css    # Estilos casos
│   └── js/               
│       ├── auth.js            # Servicio autenticación MSAL
│       ├── app-landing.js     # Lógica landing
│       ├── app-menu.js        # Lógica menú
│       ├── app-chatbot.js     # Lógica chatbot + gestión docs
│       └── app-casos-exito.js # Lógica casos
├── SETUP.md                   # Guía de configuración Azure
└── README.md                  # Este archivo
```

---

## 🎯 Funcionalidades

### ✅ Implementado
- ✅ **Autenticación Azure AD** con MSAL.js 2.38.1
- ✅ **Chat IA con DeepSeek** (V3 estándar y R1 Pro)
- ✅ **Sistema RAG completo**:
  - Upload de documentos (PDF, Word)
  - Extracción de texto con Azure Document Intelligence
  - Generación de embeddings con Azure OpenAI
  - Indexación en Azure AI Search (vector + semantic)
  - Búsqueda híbrida para contexto relevante
- ✅ **Gestión de documentos** (subir, listar, eliminar)
- ✅ **Azure Storage** para persistencia de archivos
- ✅ **Seguridad**: Helmet, Rate Limiting, CORS
- ✅ **Logging** con Morgan
- ✅ **Diseño responsive** con branding verde Perxia

---

## 🚀 Inicio Rápido

### 1. Requisitos Previos

- **Node.js** >= 18.0.0
- **npm** >= 9.0.0
- **Cuenta de Azure** con los siguientes servicios:
  - Azure App Registration (Azure AD)
  - Azure AI Foundry (DeepSeek + Embeddings)
  - Azure AI Search
  - Azure Document Intelligence
  - Azure Storage Account

### 2. Instalar Dependencias

```powershell
cd c:\Users\danielgarcia\Desktop\Perxia_Help
npm install
```

### 3. Configurar Variables de Entorno

Copia `.env.example` a `.env` y completa los valores:

```powershell
Copy-Item .env.example .env
code .env
```

Ver **[SETUP.md](./SETUP.md)** para instrucciones detalladas de configuración en Azure.

### 4. Inicializar el Índice de Búsqueda

```powershell
# Inicia el servidor
npm run dev

# En otra terminal, inicializa el índice
curl -X POST http://localhost:3000/api/documents/init-index
```

### 5. Acceder a la Aplicación

- **Backend API**: http://localhost:3000/api
- **Frontend**: http://localhost:3000

---

## 🔌 API Endpoints

### Health Check
```
GET /api/health              # Estado básico
GET /api/health/detailed     # Estado detallado con servicios
```

### Authentication
```
GET  /api/auth/config        # Configuración Azure AD para MSAL
POST /api/auth/login         # Login con credenciales
POST /api/auth/verify        # Verificar token
POST /api/auth/logout        # Cerrar sesión
```

### Chat IA (con RAG)
```
POST /api/perxia-copilot     # Chat con DeepSeek V3 + RAG
POST /api/perxia-copilot-pro # Chat con DeepSeek R1 + RAG
```

**Body:**
```json
{
  "message": "¿De qué trata el documento?",
  "conversationId": "uuid",
  "context": []
}
```

### Documentos
```
POST   /api/documents/upload      # Subir documento (PDF/Word)
GET    /api/documents             # Listar documentos
DELETE /api/documents/:documentId # Eliminar documento
POST   /api/documents/search      # Buscar en documentos
POST   /api/documents/init-index  # Crear/recrear índice
```

**Upload - multipart/form-data:**
- Campo: `document`
- Tipos soportados: `.pdf`, `.docx`
- Tamaño máximo: 50 MB

### Storage Directo
```
POST   /api/storage/upload                # Subir archivo
GET    /api/storage/documents             # Listar archivos
DELETE /api/storage/documents/:filename   # Eliminar archivo
```

---

## 🧪 Probar la Aplicación

### 1. Health Check
```powershell
Invoke-RestMethod http://localhost:3000/api/health
```

### 2. Chat con DeepSeek
```powershell
$body = @{
    message = "Hola, ¿cómo puedes ayudarme?"
    conversationId = [guid]::NewGuid().ToString()
    context = @()
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/perxia-copilot" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body
```

### 3. Subir Documento
```powershell
$form = @{
    document = Get-Item "C:\ruta\documento.pdf"
}
Invoke-RestMethod -Uri "http://localhost:3000/api/documents/upload" `
    -Method POST `
    -Form $form
```

---

## 📦 Servicios de Azure Utilizados

| Servicio | Propósito | Recurso |
|----------|-----------|---------|
| **Azure AD** | Autenticación | App Registration |
| **Azure AI Foundry** | Chat IA + Embeddings | DeepSeek V3, R1, text-embedding-3-small |
| **Azure AI Search** | Búsqueda vectorial/semántica | Index: perxia-documents |
| **Azure Document Intelligence** | Extracción de texto PDF/Word | Modelo prebuilt-read |
| **Azure Storage** | Almacenamiento de documentos | Blob container: documents |

---

## 🔒 Seguridad

### Variables de Entorno
⚠️ **NUNCA** subas `.env` a Git (ya está en `.gitignore`)

### Checklist de Producción
- [ ] Cambiar `JWT_SECRET` y `SESSION_SECRET` a valores seguros
- [ ] Usar Azure Key Vault para secretos
- [ ] Habilitar HTTPS only
- [ ] Configurar firewall en Azure Storage
- [ ] Revisar CORS origins permitidos
- [ ] Configurar rate limiting apropiado

### Headers de Seguridad (Helmet)
- X-Content-Type-Options
- X-Frame-Options  
- X-XSS-Protection
- Referrer-Policy
- Content-Security-Policy

---

## 📱 Responsive Design

La aplicación es completamente responsive:
- **Escritorio**: 1920px y superior
- **Laptop**: 1200px - 1920px
- **Tablet**: 768px - 1200px
- **Móvil**: menor a 768px

---

## 🐛 Solución de Problemas

### Puerto en uso
```powershell
# Cambiar puerto en .env
$env:PORT = 3001
npm run dev
```

### Error de conexión a DeepSeek
1. Verifica `AZURE_OPENAI_ENDPOINT` en `.env`
2. Verifica `AZURE_OPENAI_API_KEY` es válida
3. Verifica que los deployments existen en Azure AI Foundry

### Error en Document Intelligence
1. Verifica `AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT`
2. Verifica `AZURE_DOCUMENT_INTELLIGENCE_KEY`
3. El documento no debe exceder 500 MB o 2000 páginas

### Error en Azure AI Search
1. Verifica `AZURE_SEARCH_ENDPOINT`
2. Verifica `AZURE_SEARCH_API_KEY`
3. Ejecuta `POST /api/documents/init-index` para recrear el índice

### Out of Memory
```powershell
# El proyecto ya usa cross-env para limitar memoria
# Si persiste, aumentar en package.json:
# "dev": "cross-env NODE_OPTIONS=--max-old-space-size=4096 nodemon server.js"
```

---

## 📄 Licencia

© 2025 Perxia Help. Todos los derechos reservados.

---

## 📞 Soporte

- **Documentación técnica**: [SETUP.md](./SETUP.md)
- **Email**: soporte@perxia.com
