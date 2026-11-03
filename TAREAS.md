# Tareas de VPS Manager

Especificación: [readme.md](readme.md) (sección 20). El estado se marca según el **código actual**, no según el texto de la especificación.

**No marcar una fase como hecha** solo porque exista un prototipo. Una fase está completa cuando cubre su resultado descrito en el README.

Leyenda: `[x]` hecha · `[ ]` pendiente.

---

## Fase 0 — Preparación

Estado: **parcial**

- [x] Crear repositorio principal.
- [x] Definir estructura (`installer/`, `apps/manager/`).
- [x] Mantener Node `.mjs` y HTML/JS estático, sin paso de compilación.
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
- [x] Crear agente host aislado para reiniciar servicios Swarm etiquetados `vps-manager.managed=true`; el proxy Docker conserva solo lectura.
- [x] Implementar consulta de Docker.
- [x] Implementar reinicio autenticado y auditado de servicios administrados con confirmación y estado de resultado.
- [ ] Implementar otras operaciones permitidas de escritura mediante una lista explícita.
- [x] Persistir reinicios de servicios administrados como tareas consultables con historial en PostgreSQL.
- [x] Ampliar el sistema a una cola persistente con handlers registrados, leases, reintentos limitados y recuperación idempotente tras reinicios del backend; el reinicio de servicios es el único handler habilitado actualmente.

**Resultado:** backend capaz de administrar Docker.

---

## Fase 3 — Dashboard

Estado: **parcial** (MVP mayormente de lectura con reinicio controlado de servicios propios; no es Astro + React + Tailwind)

- [ ] Diseñar interfaz (Astro + React + Tailwind).
- [x] Separar el dashboard en pestañas accesibles por categoría e incluir placeholders explícitos para módulos pendientes.
- [x] Dashboard general.
- [x] Contenedores.
- [x] Servicios.
- [x] Stacks.
- [x] Logs.
- [x] Estados.

**Resultado:** administración básica desde navegador.

---

## Fase 4 — Gitea

Estado: **pendiente**

- [ ] Desplegar Gitea.
- [ ] Configurar SSH.
- [ ] Crear repositorios.
- [ ] Administrar ramas.
- [ ] Configurar webhooks.
- [ ] Integrar repositorios con proyectos.

**Resultado:** servidor Git privado.

---

## Fase 5 — Deploy automático

Estado: **pendiente**

- [ ] Integrar BuildKit.
- [ ] Construir imágenes.
- [ ] Configurar registro privado.
- [ ] Implementar despliegue Swarm.
- [ ] Configurar variables.
- [ ] Configurar dominios.
- [ ] Implementar rollback.

**Resultado:** `git push` despliega proyectos.

---

## Fase 6 — Catálogo

Estado: **pendiente**

- [ ] Crear formato de plantillas.
- [ ] Instalar n8n.
- [ ] Instalar PostgreSQL.
- [ ] Instalar Redis.
- [ ] Evaluar MinIO solo si una aplicación o los backups requieren almacenamiento de objetos.
- [ ] Implementar Supabase.
- [ ] Implementar actualizaciones.

**Resultado:** catálogo de aplicaciones.

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
