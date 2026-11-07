# Tareas de VPS Manager

Especificación: [readme.md](readme.md) (sección 20). El estado se marca según el **código actual**, no según el texto de la especificación.

**No marcar una fase como hecha** solo porque exista un prototipo. Una fase está completa cuando cubre su resultado descrito en el README.

Leyenda: `[x]` hecha · `[ ]` pendiente.

---

## Fase 0 — Preparación

Estado: **parcial**

- [x] Crear repositorio principal.
- [x] Definir estructura (`installer/`, `apps/manager/`).
- [x] Mantener la API en Node `.mjs` y generar la interfaz estática con Astro.
- [x] Configurar convenciones.
- [x] Preparar entorno local.
- [x] Preparar VPS de pruebas (`VPS_MANAGER_TEST_MODE`).
- [x] Crear documentación inicial.

**Resultado:** repositorio funcional y entorno reproducible.

---

## Fase 1 — Instalador y panel inicial

Estado: **hecha**

- [x] Instalar Docker.
- [x] Inicializar Swarm.
- [x] Preparar redes.
- [x] Desplegar Traefik.
- [x] Desplegar panel mínimo con autenticación.
- [x] Restringir la consulta de Docker a endpoints de lectura.

**Resultado:** dashboard inicial de solo lectura accesible mediante HTTPS.

---

## Fase 2 — API y agente

Estado: **parcial**

- [x] Crear API (mínima, Node.js).
- [x] Crear autenticación (un administrador, cookie de sesión).
- [x] Crear base de datos (PostgreSQL).
- [x] Crear agente host aislado para reiniciar y escalar servicios Swarm etiquetados `vps-manager.managed=true`; el proxy Docker conserva solo lectura.
- [x] Implementar consulta de Docker.
- [x] Implementar reinicio y escalado autenticados y auditados de servicios administrados con confirmación y estado de resultado.
- [x] Limitar el escalado a 1–100 réplicas para servicios Swarm administrados en modo replicado; el agente aplica solo una allowlist fija y mantiene el servicio API de VPS Manager en una réplica.
- [x] Persistir reinicios de servicios administrados como tareas consultables con historial en PostgreSQL.
- [x] Añadir operaciones autenticadas por contenedor para detener una tarea Swarm y reiniciarla, con permisos limitados a servicios administrados y registro persistente.
- [x] Configurar políticas de reinicio `any` para que Swarm reponga automáticamente tareas detenidas o terminadas, incluidas las creadas por VPS Manager.
- [x] Limpiar cada 15 minutos los contenedores de tareas Swarm detenidos por más de 10 minutos en servicios administrados, sin tocar contenedores externos ni volúmenes.
- [x] Ampliar el sistema a una cola persistente con handlers registrados, leases, reintentos limitados y recuperación idempotente tras reinicios del backend; reinicios/escalados de servicios y operaciones de contenedor son handlers habilitados.

**Resultado:** backend capaz de administrar Docker.

---

## Fase 3 — Dashboard

Estado: **parcial** (MVP mayormente de lectura con operaciones controladas; migración progresiva a Astro + React + Tailwind)

- [x] Diseñar interfaz con Astro, React y Tailwind; mantener las operaciones existentes durante la migración progresiva de la interfaz.
- [x] Separar el dashboard en pestañas accesibles por categoría e incluir placeholders explícitos para módulos pendientes.
- [x] Dashboard general.
- [x] Contenedores.
- [x] Servicios.
- [x] Stacks.
- [x] Logs.
- [x] Estados.

**Resultado:** administración básica desde navegador.

---

## Fase 4 — Proyectos y fuentes

Estado: **implementada; pendiente validación integral en VPS**

- [x] Crear un flujo de proyectos propios que no depende de alojar el código fuente en el VPS.
- [x] Configurar una GitHub App cifrando la llave privada y el secreto de webhook fuera de PostgreSQL.
- [x] Instalar la GitHub App, seleccionar repositorios y ramas (con `main` como rama inicial).
- [x] Recibir webhooks Push autenticados y asociarlos a la rama de producción configurada.
- [x] Cargar archivos ZIP con límites de tamaño y extracción segura.
- [x] Configurar Dockerfile o Railpack, contexto de build y puerto HTTP interno.
- [x] Configurar variables de entorno, dominios conectados e historial por proyecto.

**Resultado:** proyectos configurables desde GitHub o ZIP con opciones de build y despliegue.

---

## Fase 5 — Builds, despliegues y rollback

Estado: **implementada; pendiente validación integral en VPS**

- [x] Integrar BuildKit mediante Docker Buildx para construir imágenes del panel y de proyectos.
- [x] Construir desde GitHub o ZIP usando Dockerfile o Railpack y publicar las imágenes en el registro privado.
- [x] Configurar el registro privado desde el navegador, con HTTPS, autenticación y almacenamiento persistente.
- [x] Desplegar proyectos como servicios Swarm administrados sin puertos publicados y enrutar HTTP por Traefik.
- [x] Aplicar al despliegue las variables y dominios configurados para el proyecto.
- [x] Registrar intentos de despliegue y permitir rollback a una imagen de un despliegue exitoso conservando la configuración actual.
- [x] Encolar de forma idempotente el build/despliegue del commit exacto cuando llega un push autenticado a la rama de producción.
- [ ] Validar extremo a extremo en un VPS: GitHub App, webhook, build, despliegue, actualización y rollback.

**Alcance actual:** los proyectos GitHub pueden desplegarse automáticamente al recibir pushes en su rama de producción; proyectos ZIP se despliegan manualmente. Docker Secrets por proyecto y el despliegue de aplicaciones multicontenedor del catálogo siguen pendientes.

**Resultado:** builds y despliegues manuales desde GitHub/ZIP y despliegue automático por push.

---

## Fase 6 — Catálogo

Estado: **parcial** (n8n, PostgreSQL y despliegue/configuración multicontenedor de Supabase implementados; hay más aplicaciones pendientes)

- [x] Definir y validar plantillas versionadas de imagen Docker y variables de entorno para aplicaciones de un contenedor; sin puertos ni volúmenes configurables.
- [x] Instalar n8n como servicio Swarm de una réplica, con volumen persistente administrado, clave de cifrado en secreto Swarm y dominio Cloudflare/HTTPS desde el panel.
- [x] Instalar PostgreSQL como servicio Swarm privado de una réplica, con volumen local administrado, contraseña generada como secreto Swarm y entrega de credenciales de un solo uso.
- [x] Posponer Redis; no se requiere en el alcance actual.
- [ ] Evaluar MinIO solo si una aplicación o los backups requieren almacenamiento de objetos.
- [x] Crear catálogo y persistencia de configuración por VPS para Supabase self-hosted, incluyendo servicios, dominios, límites y secretos declarados.
- [x] Desplegar Supabase self-hosted con configuración Compose aislada por instancia, secretos protegidos y volúmenes persistentes.
- [x] Enrutar Studio y API mediante Traefik y Cloudflare Tunnel; seleccionar el entrypoint correcto en producción y modo de prueba.
- [x] Permitir reaplicar la configuración de una instancia desde el panel sin retirar sus volúmenes.
- [ ] Implementar actualizaciones automatizadas de las versiones upstream de Supabase.

**Resultado:** el catálogo permite instalar y administrar instancias de n8n, PostgreSQL y Supabase; faltan más aplicaciones y actualizaciones upstream automáticas.

---

## Fase 7 — Monitoreo

Estado: **parcial** (métricas, históricos y alertas básicas; aún faltan otros recolectores y alertas)

- [ ] Desplegar Prometheus.
- [ ] Desplegar cAdvisor.
- [ ] Desplegar Node Exporter.
- [x] Consultar CPU y RAM actuales por contenedor, bajo demanda y con muestreo configurable.
- [x] Agrupar consumo puntual por stack/proyecto.
- [x] Guardar históricos de métricas en PostgreSQL y configurar el intervalo.
- [x] Mostrar alertas de CPU/RAM en el panel con umbrales configurables y dos muestras consecutivas.
- [x] Añadir alertas de disco, disponibilidad de servicios y reinicios.
- [x] Añadir alertas HTTP de servicios publicados en Traefik y certificados TLS próximos a expirar.
- [x] Añadir alertas de errores de despliegue y tareas fallidas recientes de Swarm.

**Resultado:** monitoreo integral.

---

## Fase 8 — Seguridad y mantenimiento

Estado: **parcial** (respaldos, auditoría operativa limitada y actualización manual de VPS Manager desde GitHub; faltan roles y recuperación)

- [x] Crear respaldos PostgreSQL cifrados, manuales y programados con retención de siete días.
- [x] Configurar intervalo automático entre 1 y 168 horas (24 horas por defecto).
- [x] Restaurar respaldos tras confirmar la acción y validar la autenticidad antes de modificar PostgreSQL.
- [x] Conservar el directorio persistente y el secreto de cifrado durante la desinstalación normal.
- [x] Registrar cambios de configuración y respaldos; mostrar los últimos 100 eventos al administrador.
- [ ] Roles.
- [ ] MFA.
- [x] Consultar releases estables de GitHub y permitir iniciar desde el panel una actualización verificada mediante un servicio host limitado; conservar alternativa manual por SSH.
- [x] Mostrar diagnóstico bajo demanda desde el panel para Docker, Swarm, servicios, redes, PostgreSQL y respaldos; conservar el comando SSH para información del host.
- [ ] Recuperación automática.

**Resultado:** plataforma preparada para producción.
