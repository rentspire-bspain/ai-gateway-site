/* i18n — honest, partial UI localization foundation.
   Locales: en (complete, source language), es (PARTIAL: sidebar nav, composer, landing hero,
   Settings headers/nav + Language row). Everything not in the dictionary stays English;
   model answers are never translated by this module. Exposes window.I18N.
   Preference order: ?lang=xx  >  localStorage ai_lang  >  navigator.languages  >  en. */
(function () {
  "use strict";
  var SUPPORTED = { en: "English", es: "Español" };
  var COVERAGE = { en: "complete", es: "partial" };
  var KEY = "ai_lang";

  /* selector -> [attr|"text"|"html", key]. Static chrome only; user content is never touched. */
  var TARGETS = [
    ["#newThreadBtn", "textnode", "New Thread"],
    ["#navProjects span", "text", "Projects"], ["#navLibrary span", "text", "Library"],
    ["#navSkills span", "text", "Skills"], ["#navDocs span", "text", "Docs"],
    ["#navTasks span", "text", "Tasks"], ["#navHubs span", "text", "Hubs"],
    ["#navFleet span", "text", "Fleet"], ["#navPlugins span", "text", "Plugins"],
    ["#navDiscover span", "text", "Discover"],
    ["#threadSearch", "placeholder", "Search threads..."],
    ["#recentLabel", "text", "Recent"],
    ["#newThreadIcon", "title", "New thread"],
    ["#collapseSidebar", "aria-label", "Collapse sidebar"],
    ["#landingInput", "placeholder", "Ask anything..."],
    ["#landingInput", "aria-label", "Ask anything"],
    ["#landingSubmit", "aria-label", "Submit question"],
    [".landing-subtitle", "text", "Ask anything. Powered by open-weight models."],
    [".landing-title", "html", "Where knowledge <em>begins</em>"],
    [".stg-overlay h2", "text", "Settings"],
    [".stg-nav-btn span", "text", null], [".stg-pane-title", "text", null],
    [".stg-pane-sub", "text", null], [".stg-label", "text", null],
    [".cp-input", "placeholder", "Search actions and threads, or type a query…"], [".cp-input", "aria-label", "Command palette input"]
  ];

  var ES = {
    "New Thread": "Nuevo hilo", "New thread": "Nuevo hilo",
    "Projects": "Proyectos", "Library": "Biblioteca", "Skills": "Habilidades", "Docs": "Documentos",
    "Tasks": "Tareas", "Hubs": "Centros", "Fleet": "Flota", "Plugins": "Complementos", "Discover": "Descubrir",
    "Search threads...": "Buscar hilos...", "Recent": "Recientes", "Collapse sidebar": "Contraer barra lateral",
    "Ask anything...": "Pregunta lo que quieras...", "Ask anything": "Pregunta lo que quieras",
    "Submit question": "Enviar pregunta",
    "Ask anything. Powered by open-weight models.": "Pregunta lo que quieras. Con modelos de pesos abiertos.",
    "Where knowledge <em>begins</em>": "Donde el conocimiento <em>comienza</em>",
    "Settings": "Configuración", "Preferences": "Preferencias", "Personalize": "Personalizar",
    "Memory": "Memoria", "Site instructions": "Instrucciones del sitio", "Notifications": "Notificaciones",
    "Connectors": "Conectores", "Teammates": "Compañeros", "Enterprise": "Empresa", "Usage": "Uso",
    "Data controls": "Control de datos", "About": "Acerca de",
    "Appearance and behavior defaults.": "Apariencia y comportamiento predeterminados.",
    "Help the assistant tailor answers to you.": "Ayuda al asistente a adaptar las respuestas a ti.",
    "Facts the assistant remembers and applies to every answer.": "Datos que el asistente recuerda y aplica en cada respuesta.",
    "Custom instructions applied to every answer.": "Instrucciones personalizadas aplicadas a cada respuesta.",
    "Choose how you hear about activity.": "Elige cómo recibir avisos de actividad.",
    "Theme": "Tema", "Language": "Idioma", "Interface and answer language.": "Idioma de la interfaz.",
    "Default answer width": "Ancho de respuesta predeterminado",
    "Read answers aloud": "Leer respuestas en voz alta", "Read-aloud speed": "Velocidad de lectura"
  };

  /* v2 additions: thread actions, dialogs, doc panel, onboarding tour + checklist, settings bodies, errors. */
  var ES2 = {
    "Rename": "Renombrar", "Share": "Compartir", "Delete": "Eliminar", "Rename thread": "Renombrar hilo",
    "Delete this thread?": "¿Eliminar este hilo?", "Cancel": "Cancelar", "Save": "Guardar", "Copy": "Copiar",
    "Copied": "Copiado", "Close": "Cerrar", "Retry": "Reintentar", "Loading…": "Cargando…", "Something went wrong": "Algo salió mal",
    "New space": "Nuevo espacio", "Spaces": "Espacios", "Sign in": "Iniciar sesión", "Sign out": "Cerrar sesión", "Install app": "Instalar app",
    "Import Perplexity history": "Importar historial de Perplexity",
    "Sign out of every device, including this one?": "¿Cerrar sesión en todos los dispositivos, incluido este?",
    "Really delete your account and all data forever?": "¿Seguro que quieres eliminar tu cuenta y todos tus datos para siempre?",
    "Enter a current 6-digit code to turn off 2FA": "Introduce un código actual de 6 dígitos para desactivar la verificación en dos pasos",
    /* errors */
    "Sign in to manage this.": "Inicia sesión para administrar esto.", "Sign in to continue.": "Inicia sesión para continuar.",
    "Sign in to ask a question.": "Inicia sesión para hacer una pregunta.", "Sign in first.": "Primero inicia sesión.",
    "Sign in required": "Se requiere iniciar sesión", "Sign in to start searching": "Inicia sesión para empezar a buscar",
    "Sign in to manage your account.": "Inicia sesión para administrar tu cuenta.",
    "Sign in to view billing": "Inicia sesión para ver la facturación", "Sign in to view your Neurons": "Inicia sesión para ver tus Neurons",
    "Sign in to manage the team.": "Inicia sesión para administrar el equipo.", "Sign in to manage MCP servers": "Inicia sesión para administrar servidores MCP",
    "Sign in to manage training consent.": "Inicia sesión para administrar el consentimiento de entrenamiento.",
    "Sign in to open artifacts.": "Inicia sesión para abrir artefactos.", "Sign in to view your generated artifacts.": "Inicia sesión para ver tus artefactos generados.",
    "Could not load artifacts.": "No se pudieron cargar los artefactos.", "Could not send the reset email — try again.": "No se pudo enviar el correo de restablecimiento — inténtalo de nuevo.",
    /* doc panel */
    "Open in new tab": "Abrir en una pestaña nueva", "Download": "Descargar", "Download ▾": "Descargar ▾",
    "Close document panel": "Cerrar panel de documentos", "Markdown": "Markdown", "Text": "Texto", "Spreadsheet": "Hoja de cálculo",
    "Word document": "Documento de Word", "Web app": "Aplicación web",
    /* tour */
    "Next": "Siguiente", "Back": "Atrás", "Skip": "Omitir", "Get started": "Comenzar",
    "Skip onboarding tour": "Omitir el recorrido inicial", "Skip tour (Esc)": "Omitir recorrido (Esc)", "Getting started": "Primeros pasos",
    "Ask anything — live web research with citations": "Pregunta lo que quieras — investigación web en vivo con citas",
    "Every question searches live web sources, synthesizes answers with inline citations, and surfaces one-tap follow-up chips. Press / to focus the search box or type @ to reference connectors, projects, and past threads.":
      "Cada pregunta busca en fuentes web en vivo, sintetiza respuestas con citas en línea y muestra sugerencias de seguimiento con un toque. Pulsa / para ir al cuadro de búsqueda o escribe @ para referirte a conectores, proyectos y hilos anteriores.",
    "Live citations": "Citas en vivo", "@-mentions": "Menciones con @", "One-tap follow-ups": "Seguimientos con un toque",
    "Attach files and generate docs/tables": "Adjunta archivos y genera documentos y tablas",
    "Drop or attach CSVs, Markdown, JSON, PDFs, or screenshots into the composer. Ask for structured underwriting memos, rent-comp tables, or downloadable Markdown, Word, and spreadsheet files in the Docs & Artifacts panel.":
      "Suelta o adjunta CSV, Markdown, JSON, PDF o capturas de pantalla en el compositor. Pide memorandos de suscripción estructurados, tablas de comparables de renta o archivos descargables de Markdown, Word y hojas de cálculo en el panel de Documentos y Artefactos.",
    "Drag & drop files": "Arrastrar y soltar archivos", "Docs side-panel": "Panel lateral de documentos", "Artifact library": "Biblioteca de artefactos",
    "Model picker — pick the lane that fits the task": "Selector de modelo — elige el carril adecuado para la tarea",
    "Deep Research": "Investigación profunda", "Model Council": "Consejo de modelos",
    "Settings — connectors, fleet, tasks, automations": "Configuración — conectores, flota, tareas, automatizaciones",
    "Turn 20 minutes of inbox, calendar, or folder digging into one cited question. Link OAuth sources in Settings → Connectors, schedule recurring jobs in Tasks & Automations, and monitor runs in Fleet.":
      "Convierte 20 minutos de buscar en tu bandeja, calendario o carpetas en una sola pregunta con citas. Vincula fuentes OAuth en Configuración → Conectores, programa tareas recurrentes en Tareas y Automatizaciones y supervisa las ejecuciones en Flota.",
    "OAuth Connectors": "Conectores OAuth", "Tasks & Automations": "Tareas y automatizaciones", "Fleet & QA": "Flota y control de calidad",
    "Your data stays yours": "Tus datos siguen siendo tuyos",
    "Row-level security (RLS) isolates every token per user — disconnect and delete anytime.": "La seguridad a nivel de fila (RLS) aísla cada token por usuario — desconecta y elimina cuando quieras.",
    "Answers cite your real emails & files": "Las respuestas citan tus correos y archivos reales",
    "Inline citations point back to the exact message, calendar invite, or document.": "Las citas en línea apuntan al mensaje, invitación de calendario o documento exacto.",
    "History-aware across devices": "Historial sincronizado entre dispositivos",
    "Threads and connected context stay synced wherever you sign in.": "Los hilos y el contexto conectado se mantienen sincronizados donde inicies sesión.",
    "Incognito available": "Modo incógnito disponible",
    "Switch on Incognito anytime for off-the-record questions with zero saved history.": "Activa el modo incógnito cuando quieras para preguntas sin registro y sin historial guardado.",
    "Ask your first question": "Haz tu primera pregunta", "Any query — live web research with citations.": "Cualquier consulta — investigación web en vivo con citas.",
    "Connect a data source": "Conecta una fuente de datos", "Slack, Dropbox, Google Drive, or Comptrove in Settings → Connectors.": "Slack, Dropbox, Google Drive o Comptrove en Configuración → Conectores.",
    "Create a doc, table, or file": "Crea un documento, tabla o archivo", "Ask for a memo, rent-comp table, or Word/Excel/PDF export.": "Pide un memorando, una tabla de comparables de renta o una exportación a Word/Excel/PDF.",
    "Save a custom skill": "Guarda una habilidad personalizada", "Settings → Skills — reusable prompt + tool recipes.": "Configuración → Habilidades — recetas reutilizables de prompts y herramientas.",
    "Try a model or Research mode": "Prueba un modelo o el modo Investigación", "Auto for everyday, R1/Kimi Pro for hard reasoning, Research for depth.": "Auto para el día a día, R1/Kimi Pro para razonamiento difícil, Investigación para profundidad.",
    "Set up an automation or fleet task": "Configura una automatización o tarea de flota", "Schedule recurring jobs in Tasks & Automations, or dispatch the fleet.": "Programa trabajos recurrentes en Tareas y Automatizaciones o despacha la flota.",
    /* settings pane bodies */
    "About you": "Sobre ti", "Free-form context applied to your conversations.": "Contexto libre aplicado a tus conversaciones.",
    "Tone": "Tono", "How detailed and direct the answers should be.": "Qué tan detalladas y directas deben ser las respuestas.",
    "Direct": "Directo", "Balanced": "Equilibrado", "Detailed": "Detallado",
    "Remember across sessions": "Recordar entre sesiones", "When on, memory entries below are included as context in every conversation.": "Si está activado, las entradas de memoria de abajo se incluyen como contexto en cada conversación.",
    "No memories yet — add one below.": "Aún no hay recuerdos — agrega uno abajo.", "Memory entries": "Entradas de memoria",
    "Stored in your account (synced across devices); this browser keeps a working copy.": "Se guardan en tu cuenta (sincronizadas entre dispositivos); este navegador conserva una copia de trabajo.",
    "Edit memory": "Editar recuerdo", "Delete memory": "Eliminar recuerdo", "Save memory": "Guardar recuerdo", "New memory": "Nuevo recuerdo",
    "Add a memory — e.g., I prefer concise answers with tables": "Agrega un recuerdo — p. ej., prefiero respuestas concisas con tablas",
    "Custom instructions": "Instrucciones personalizadas", "Applied on top of any space-level instructions.": "Se aplican además de las instrucciones a nivel de espacio.",
    "E.g., Always answer with tables. Keep answers under 300 words. Use metric units.": "P. ej.: Responde siempre con tablas. Mantén las respuestas por debajo de 300 palabras. Usa unidades métricas.",
    "In-app inbox": "Bandeja en la app", "Show in-app notifications for finished research and updates.": "Muestra notificaciones en la app para investigaciones terminadas y novedades.",
    "Native notifications": "Notificaciones nativas", "Native desktop notifications": "Notificaciones nativas de escritorio",
    "Raise an OS notification when a response finishes while the tab is in the background.": "Lanza una notificación del sistema cuando termina una respuesta con la pestaña en segundo plano.",
    "Granted": "Concedido", "Blocked in the browser": "Bloqueado en el navegador", "Permission asked on first enable": "El permiso se solicita al activarlo por primera vez",
    "Email digest": "Resumen por correo", "Coming soon": "Próximamente", "A periodic summary of your threads and activity.": "Un resumen periódico de tus hilos y actividad.",
    "Interface language. Spanish is a partial translation; untranslated areas and model answers stay in English.": "Idioma de la interfaz. El español es una traducción parcial; las áreas sin traducir y las respuestas del modelo permanecen en inglés.",
    "Read-only — drag the answer column edge or use the fit/full control in the main view to change it.": "Solo lectura — arrastra el borde de la columna de respuestas o usa el control ajustar/completo en la vista principal para cambiarlo.",
    "Default for the voice button — answers are spoken automatically when enabled.": "Valor predeterminado del botón de voz — las respuestas se leen automáticamente cuando está activado.",
    "How fast answers are spoken (a sample plays when you change it).": "Qué tan rápido se leen las respuestas (suena una muestra al cambiarlo).",
    "Light": "Claro", "Dark": "Oscuro", "System": "Sistema",
    "System follows your device’s light/dark setting and updates automatically.": "Sistema sigue el ajuste claro/oscuro de tu dispositivo y se actualiza automáticamente."
  };
  /* v3 additions: Connectors/Usage/Billing/Security/Org pane bodies, credentials/devices, common toasts + buttons. */
  var ES3 = {
    "Billing": "Facturación", "Usage": "Uso", "Security": "Seguridad", "Team": "Equipo",
    "Devices": "Dispositivos", "Credentials": "Credenciales", "Two-factor": "Verificación en dos pasos",
    "Devices & sessions": "Dispositivos y sesiones", "Devices that have signed in to this app.": "Dispositivos que han iniciado sesión en esta aplicación.",
    "Loading devices…": "Cargando dispositivos…", "No devices registered yet.": "Aún no hay dispositivos registrados.",
    "Remove device from list": "Quitar dispositivo de la lista", "Click again to delete": "Haz clic de nuevo para eliminar",
    "Click again to sign out ALL devices": "Haz clic de nuevo para cerrar sesión en TODOS los dispositivos",
    "Secrets for tools and connectors, encrypted at rest.": "Secretos para herramientas y conectores, cifrados en reposo.",
    "No credentials saved yet — add one below.": "Aún no hay credenciales guardadas — añade una abajo.",
    "Credential name": "Nombre de la credencial", "Secret value": "Valor del secreto",
    "Save secret": "Guardar secreto", "Delete credential": "Eliminar credencial",
    "Overwrite value": "Sobrescribir valor", "Overwrite secret": "Sobrescribir secreto",
    "New value (overwrites)": "Nuevo valor (sobrescribe)", "Set up authenticator": "Configurar autenticador",
    "Authenticator": "Autenticador", "Last active": "Última actividad",
    "MCP servers": "Servidores MCP",
    "Billing is rolling out: ": "La facturación se está implementando: ",
    "Starting checkout…": "Iniciando el pago…", "Checkout unavailable: ": "Pago no disponible: ",
    "Checkout error: ": "Error de pago: ", "Claiming…": "Reclamando…",
    "Invite link copied: ": "Enlace de invitación copiado: ", "Enter a code first.": "Introduce un código primero.",
    "Error: ": "Error: ", "Please sign in first.": "Primero inicia sesión.",
    "Connected": "Conectado", "Not connected": "No conectado", "Disconnect": "Desconectar",
    "Connect": "Conectar", "Add": "Añadir", "Remove": "Quitar", "Edit": "Editar", "Open": "Abrir",
    "Done": "Listo", "Back": "Atrás", "Continue": "Continuar", "Confirm": "Confirmar",
    "Loading…": "Cargando…", "None": "Ninguno", "Default": "Predeterminado", "Enabled": "Activado",
    "Disabled": "Desactivado", "Active": "Activo", "Expired": "Expirado", "Never": "Nunca",
    "Today": "Hoy", "Yesterday": "Ayer", "Search": "Buscar", "Filter": "Filtrar", "All": "Todos",
    "None yet": "Nada todavía", "No results": "Sin resultados", "No results found.": "No se encontraron resultados.",
    "Your plan": "Tu plan", "Current balance": "Saldo actual", "This month": "Este mes",
    "Manage": "Administrar", "Manage connectors": "Administrar conectores",
    "Connected sources power cited answers about your own email, files, and calendar.": "Las fuentes conectadas permiten respuestas con citas sobre tu correo, archivos y calendario.",
    "Registration pending": "Registro pendiente",
    "Updated": "Actualizado", "Just now": "Ahora mismo"
  };
  Object.keys(ES3).forEach(function (k) { ES[k] = ES3[k]; });
  /* v4 additions: library/skills/tasks overlays. */
  var ES4 = {
    "Library": "Biblioteca", "Close library": "Cerrar biblioteca", "Clear search and filters": "Limpiar búsqueda y filtros",
    "All files": "Todos los archivos", "Search threads and messages": "Buscar hilos y mensajes",
    "Search artifacts by filename": "Buscar artefactos por nombre de archivo",
    "Archived": "Archivado", "Archived results": "Resultados archivados", "Archive": "Archivar", "Unarchive": "Desarchivar",
    "Previous 7 days": "7 días previos", "Previous 30 days": "30 días previos",
    "Collection name": "Nombre de la colección", "Add to collection": "Añadir a la colección",
    "Rename collection": "Renombrar colección", "Delete this collection? Threads are kept.": "¿Eliminar esta colección? Los hilos se conservan.",
    "Untitled": "Sin título", "Untitled thread": "Hilo sin título", "Unknown date": "Fecha desconocida",
    "Version history": "Historial de versiones", "Document": "Documento", "Results": "Resultados",
    "Use in chat": "Usar en el chat", "Start a new thread": "Iniciar un hilo nuevo",
    "Act as analyst": "Actuar como analista", "Summarize": "Resumir", "Explain simply": "Explicar de forma sencilla",
    "Turn Deep Research on": "Activar Deep Research", "Deep Research": "Deep Research",
    "Create task": "Crear tarea", "Edit task": "Editar tarea", "Scheduled task": "Tarea programada",
    "Run now": "Ejecutar ahora", "Running…": "Ejecutando…", "Schedule": "Programación", "Scheduled": "Programado",
    "Time zone": "Zona horaria", "Deliver to": "Entregar a", "Custom (cron)": "Personalizado (cron)",
    "Weekdays (Mon–Fri)": "Días laborables (lun–vie)", "Daily at ": "Cada día a ", "Weekly on ": "Cada semana el ",
    "Edit skill": "Editar habilidad", "Enable ": "Activar ", "Save changes": "Guardar cambios",
    "Saving…": "Guardando…", "Deleting…": "Eliminando…", "Refresh": "Actualizar", "Refreshing…": "Actualizando…",
    "Monday": "Lunes", "Tuesday": "Martes", "Wednesday": "Miércoles", "Thursday": "Jueves", "Friday": "Viernes",
    "Saturday": "Sábado", "Sunday": "Domingo",
    "Create a Gmail draft (preview + approval)": "Crear un borrador de Gmail (vista previa + aprobación)",
    "Create calendar event (preview + approval)": "Crear evento de calendario (vista previa + aprobación)",
    "Draft or send email (preview + approval)": "Redactar o enviar correo (vista previa + aprobación)",
    "Thread + email": "Hilo + correo"
  };
  Object.keys(ES4).forEach(function (k) { ES[k] = ES4[k]; });
  /* v5 additions: command palette (modules/command-palette.js) + remaining Settings pane subtitles. */
  var ES5 = {
    "Command palette": "Paleta de comandos", "Command palette input": "Entrada de la paleta de comandos",
    "Search actions and threads, or type a query…": "Busca acciones y hilos, o escribe una consulta…",
    "No matches. Try a thread title or an action like \"settings\".": "Sin coincidencias. Prueba con el título de un hilo o una acción como \"configuración\".",
    "Results": "Resultados", "Actions": "Acciones", "Threads": "Hilos", "Research": "Investigación",
    "navigate ·": "navegar ·", "run ·": "ejecutar ·", "close": "cerrar", "toggle": "alternar",
    "Search threads": "Buscar hilos", "Open Settings": "Abrir Configuración",
    "Open Settings → Connectors": "Abrir Configuración → Conectores",
    "Open Settings → Automations": "Abrir Configuración → Automatizaciones",
    "Open Settings → Skills": "Abrir Configuración → Habilidades",
    "Open Settings → Artifacts": "Abrir Configuración → Artefactos",
    "Open Library": "Abrir Biblioteca", "Open Fleet": "Abrir Flota", "Toggle theme": "Cambiar tema",
    "Research: competitive landscape of AI gateways": "Investigación: panorama competitivo de pasarelas de IA",
    "Research: latest AI model releases": "Investigación: últimos lanzamientos de modelos de IA",
    "Research: best practices for RAG pipelines": "Investigación: mejores prácticas para pipelines RAG",
    "Your profile and sign-in credentials for ai.spaincos.com.": "Tu perfil y credenciales de acceso para ai.spaincos.com.",
    "Changing your email sends a confirmation to both the old and new address. The change applies once you confirm.": "Al cambiar tu correo se envía una confirmación a la dirección anterior y a la nueva. El cambio se aplica cuando confirmes.",
    "Pick a strong password you don't use anywhere else.": "Elige una contraseña segura que no uses en ningún otro sitio.",
    "Permanently delete your account and all data. This cannot be undone.": "Elimina de forma permanente tu cuenta y todos tus datos. No se puede deshacer.",
    "Every lane in the composer, grouped by what it is best at. Free lanes cost nothing; the rest draw on your plan.": "Cada carril del compositor, agrupado según su mejor uso. Los carriles gratuitos no cuestan nada; el resto consume tu plan.",
    "Members, roles, and the sign-in allowlist for this site.": "Miembros, roles y la lista de acceso permitido de este sitio.",
    "Invite teammates and manage roles. Only owners/admins can make changes — the server enforces it.": "Invita a compañeros y administra roles. Solo propietarios y administradores pueden hacer cambios — el servidor lo impone.",
    "What your plan includes on ai.spaincos.com — and what Pro adds.": "Lo que incluye tu plan en ai.spaincos.com — y lo que añade Pro.",
    "Answers to the most common issues. Search or browse.": "Respuestas a los problemas más comunes. Busca o explora.",
    "Data sources the assistant can reference in your answers.": "Fuentes de datos que el asistente puede citar en tus respuestas.",
    "Activity on this device, from your local thread library.": "Actividad en este dispositivo, desde tu biblioteca local de hilos.",
    "Export or delete the data stored on this device.": "Exporta o elimina los datos almacenados en este dispositivo.",
    "ai.spaincos.com — a Perplexity-style gateway to open-weight models.": "ai.spaincos.com — una pasarela estilo Perplexity hacia modelos de pesos abiertos.",
    "Everyone with access to this workspace (read-only — roles are managed in Settings > Organization).": "Todas las personas con acceso a este espacio de trabajo (solo lectura — los roles se administran en Configuración > Organización).",
    "Your gateway activity, from your synced threads.": "Tu actividad en la pasarela, a partir de tus hilos sincronizados.",
    "Threads per week, last 4 weeks.": "Hilos por semana, últimas 4 semanas.",
    "Read-only workspace overview for owners and admins. Opening this pane does not grant access to additional records.": "Resumen de solo lectura del espacio de trabajo para propietarios y administradores. Abrir este panel no concede acceso a más registros.",
    "Name": "Nombre"
  };
  Object.keys(ES5).forEach(function (k) { ES[k] = ES5[k]; });
  Object.keys(ES2).forEach(function (k) { ES[k] = ES2[k]; });

  /* Elements whose text is user/document content and must never be translated. */
  var SKIP_SEL = ".dp-md,.dp-code,.dp-tw,.dp-title,.dc-t,.dp-fname,textarea,input,[data-i18n-skip]";
  var WALK_ROOTS = [".stg-overlay", ".dp-panel", ".dp-row", "#tour", ".ob-tour-backdrop", ".ob-persuade-wrap",
    ".ob-empty-head", ".ob-example-grid", ".thread-actions", ".sidebar-footer", ".account-menu", ".account-item", ".cp-overlay", ".side-nav", ".spaces-head", "#moduleRoot"];
  var ATTRS = ["title", "aria-label", "placeholder"];

  function walkRoot(root) {
    var w = document.createTreeWalker(root, 4, null), n, list = [];
    while ((n = w.nextNode())) list.push(n);
    list.forEach(function (n) {
      var par = n.parentNode; if (!par || (par.closest && par.closest(SKIP_SEL))) return;
      var cur = n.nodeValue, tr = cur.trim(); if (!tr) return;
      var base = n.__en !== undefined ? n.__en : tr;
      if (lang === "en") { if (n.__en !== undefined) { n.nodeValue = cur.replace(tr, n.__en); delete n.__en; } return; }
      if (n.__en !== undefined && tr !== t(n.__en) && tr !== n.__en) { delete n.__en; base = tr; } // content changed under us
      var out = t(base);
      if (out !== base) { n.__en = base; n.nodeValue = cur.replace(tr, out); }
    });
    var els = root.querySelectorAll ? root.querySelectorAll("[title],[aria-label],[placeholder]") : [];
    var all = [root].concat([].slice.call(els));
    all.forEach(function (e) {
      if (!e.getAttribute || (e.closest && e.closest(SKIP_SEL))) return;
      ATTRS.forEach(function (a) {
        if (!e.hasAttribute(a)) return;
        e.__enA = e.__enA || {};
        var v = e.getAttribute(a);
        if (lang === "en") { if (e.__enA[a] !== undefined) { e.setAttribute(a, e.__enA[a]); delete e.__enA[a]; } return; }
        var base = e.__enA[a] !== undefined && (v === t(e.__enA[a]) || v === e.__enA[a]) ? e.__enA[a] : v;
        var out = t(base);
        if (out !== base) { e.__enA[a] = base; e.setAttribute(a, out); }
      });
    });
  }
  function walkAll() {
    WALK_ROOTS.forEach(function (sel) {
      var rs; try { rs = document.querySelectorAll(sel); } catch (e) { return; }
      for (var i = 0; i < rs.length; i++) walkRoot(rs[i]);
    });
  }

  /* Native dialogs: translate known fixed messages only. */
  ["alert", "confirm", "prompt"].forEach(function (fn) {
    var orig0 = window[fn]; if (typeof orig0 !== "function") return;
    window[fn] = function (msg) { var a = [].slice.call(arguments); if (typeof a[0] === "string") a[0] = t(a[0]); return orig0.apply(window, a); };
  });

  /* Locale-aware formatting (Intl). Falls back to the browser locale on any error. */
  var LOCALE = { en: "en-US", es: "es" };
  function loc() { return LOCALE[lang] || undefined; }
  function fmtDate(d, o) { try { return new Date(d).toLocaleDateString(loc(), o || { month: "short", day: "numeric", year: "numeric" }); } catch (e) { return String(d); } }
  function fmtTime(d, o) { try { return new Date(d).toLocaleTimeString(loc(), o); } catch (e) { return String(d); } }
  function fmtNumber(n, o) { try { return new Intl.NumberFormat(loc(), o).format(n); } catch (e) { return String(n); } }
  function fmtRelative(ms) {
    try {
      var rtf = new Intl.RelativeTimeFormat(loc(), { numeric: "auto" }), s = Math.round(ms / 1000), a = Math.abs(s);
      if (a < 60) return rtf.format(s, "second"); if (a < 3600) return rtf.format(Math.round(s / 60), "minute");
      if (a < 86400) return rtf.format(Math.round(s / 3600), "hour"); return rtf.format(Math.round(s / 86400), "day");
    } catch (e) { return ""; }
  }

  var DICT = { es: ES };

  var lang = "en";
  var orig = new WeakMap();   // node/attr key -> original English
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) {} return null; }
  function norm(l) { l = String(l || "").toLowerCase().split(/[-_]/)[0]; return SUPPORTED[l] ? l : null; }

  function detect() {
    var q = null;
    try { q = norm(new URLSearchParams(location.search).get("lang")); } catch (e) {}
    if (q) { ls(KEY, q); return q; }
    var s = norm(ls(KEY)); if (s) return s;
    var nl = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language]);
    for (var i = 0; i < nl.length; i++) { var n = norm(nl[i]); if (n) return n; }
    return "en";
  }

  var PATTERNS = { es: [[/^(·\s*)?(\d+) of (\d+)$/, function (m) { return (m[1] || "") + m[2] + " de " + m[3]; }]] };
  function t(en) {
    var ps = PATTERNS[lang];
    if (ps && typeof en === "string") for (var i = 0; i < ps.length; i++) { var m = ps[i][0].exec(en); if (m) return ps[i][1](m); }
    var d = DICT[lang]; return (d && Object.prototype.hasOwnProperty.call(d, en) && d[en]) || en; }

  function setVal(node, mode, key, en) {
    if (mode === "text") {
      if (lang === "en") { if (node.dataset.i18nEn) { node.textContent = node.dataset.i18nEn; delete node.dataset.i18nEn; } return; }
      var base = node.dataset.i18nEn || node.textContent.trim();
      if (en && base !== en) return;
      var tr = t(base);
      if (tr !== base || node.dataset.i18nEn) { node.dataset.i18nEn = base; node.textContent = tr; }
    } else if (mode === "html") {
      if (!node.dataset.i18nEn) node.dataset.i18nEn = node.innerHTML;
      node.innerHTML = lang === "en" ? node.dataset.i18nEn : t(en);
    } else if (mode === "textnode") {
      for (var c = node.firstChild; c; c = c.nextSibling) {
        if (c.nodeType === 3 && (c.nodeValue.trim() === en || (c.__en && c.__en === en))) {
          c.__en = en; c.nodeValue = c.nodeValue.replace(/\S[\s\S]*\S|\S/, lang === "en" ? en : t(en)); break;
        }
      }
    } else if (mode !== "skip") {
      var a = "i18nEn" + mode.replace(/[^a-z]/g, "");
      if (node.dataset[a] === undefined) node.dataset[a] = node.getAttribute(mode) || "";
      var b = node.dataset[a];
      if (en && b !== en) return;
      node.setAttribute(mode, lang === "en" ? b : t(b));
    }
  }

  var busy = false;
  function apply(root) {
    busy = true;
    try {
      document.documentElement.lang = lang;
      TARGETS.forEach(function (T) {
        var nodes; try { nodes = (root || document).querySelectorAll(T[0]); } catch (e) { return; }
        for (var i = 0; i < nodes.length; i++) setVal(nodes[i], T[1], T[0], T[2]);
      });
      walkAll();
    } finally { busy = false; }
  }
  var pending = false;
  function schedule() {
    if (pending) return; pending = true;
    (window.requestAnimationFrame || setTimeout)(function () { pending = false; apply(); });
  }

  function set(l) {
    l = norm(l); if (!l) return false;
    lang = l; ls(KEY, l); apply();
    try { document.dispatchEvent(new CustomEvent("i18n:change", { detail: { lang: l, coverage: COVERAGE[l] } })); } catch (e) {}
    return true;
  }

  lang = detect();
  window.I18N = {
    get lang() { return lang; }, locale: loc, fmtDate: fmtDate, fmtTime: fmtTime, fmtNumber: fmtNumber, fmtRelative: fmtRelative, supported: SUPPORTED, coverage: COVERAGE, t: t, set: set, apply: apply,
    note: function () {
      return COVERAGE[lang] === "complete" ? "" :
        lang === "es" ? "Traducción parcial: barra lateral, compositor, Configuración (paneles principales), acciones de hilos, panel de documentos y recorrido inicial están en español; el resto sigue en inglés."
                      : "Partial translation.";
    }
  };

  function start() {
    apply();
    if (window.MutationObserver) {
      new MutationObserver(function () { if (!busy && lang !== "en") schedule(); })
        .observe(document.body, { childList: true, subtree: true });
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
