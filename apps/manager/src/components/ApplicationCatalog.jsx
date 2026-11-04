export default function ApplicationCatalog() {
  return (
    <div className="grid grid-cols-1 gap-[18px] min-[721px]:grid-cols-2" aria-label="Catálogo de aplicaciones">
      <section className="card application-card" aria-labelledby="manual-application-title">
        <div className="card-heading">
          <div>
            <p className="eyebrow">Instalación personalizada</p>
            <h3 id="manual-application-title">Agregar aplicación</h3>
          </div>
          <span className="badge roadmap-badge">Swarm por VPS</span>
        </div>
        <p className="muted">Registra y despliega una aplicación de un solo contenedor con una imagen versionada, HTTPS, variables y almacenamiento opcional.</p>
        <form id="manual-application-form" className="form-stack">
          <label htmlFor="manual-app-name">Nombre</label>
          <input id="manual-app-name" name="name" type="text" maxLength="100" required />
          <label htmlFor="manual-app-id">Identificador</label>
          <input id="manual-app-id" name="id" type="text" pattern="[a-z][a-z0-9\x2d]{0,62}" maxLength="63" required />
          <label htmlFor="manual-app-version">Versión</label>
          <input id="manual-app-version" name="version" type="text" pattern="[0-9]+\.[0-9]+\.[0-9]+(-[A-Za-z0-9.]+(-[A-Za-z0-9.]+)*)?" maxLength="100" required />
          <label htmlFor="manual-app-category">Categoría</label>
          <input id="manual-app-category" name="category" type="text" maxLength="100" required />
          <label htmlFor="manual-app-description">Descripción</label>
          <input id="manual-app-description" name="description" type="text" maxLength="500" required />
          <label htmlFor="manual-app-image">Imagen Docker (incluye tag o digest)</label>
          <input id="manual-app-image" name="image" type="text" maxLength="512" placeholder="nginx:1.28.0" required />
          <label htmlFor="manual-app-port">Puerto interno</label>
          <input id="manual-app-port" name="port" type="number" min="1" max="65535" step="1" required />
          <label htmlFor="manual-app-domain">Dominio HTTPS</label>
          <input id="manual-app-domain" name="domain" type="text" maxLength="253" placeholder="app.ejemplo.com" required />
          <label htmlFor="manual-app-server">VPS de Swarm</label>
          <select id="manual-app-server" name="serverNodeId" required>
            <option value="">Consultando VPS activos…</option>
          </select>
          <label htmlFor="manual-app-volume">Ruta persistente (opcional)</label>
          <input id="manual-app-volume" name="volumeTarget" type="text" maxLength="255" placeholder="/var/lib/app" />
          <label htmlFor="manual-app-environment">Variables no secretas (una por línea: NOMBRE=valor)</label>
          <textarea id="manual-app-environment" name="environment" rows="3" maxLength="24576"></textarea>
          <label htmlFor="manual-app-secrets">Secretos Swarm (una por línea: NOMBRE=valor)</label>
          <textarea id="manual-app-secrets" name="secrets" rows="3" maxLength="24576" autoComplete="new-password"></textarea>
          <p className="muted">Los secretos no se guardan en la base de datos. Se montan como archivos en /run/secrets/NOMBRE y se exponen como NOMBRE_FILE. La instalación crea una sola instancia en el VPS elegido; no publica puertos del host.</p>
          <p id="manual-app-status" className="application-status" role="status" aria-live="polite"></p>
          <button id="manual-app-submit" className="button" type="submit">Agregar y desplegar</button>
        </form>
      </section>
      <section className="card application-card" aria-labelledby="manual-applications-title">
        <div className="card-heading">
          <div>
            <p className="eyebrow">Catálogo e instalaciones</p>
            <h3 id="manual-applications-title">Mis aplicaciones</h3>
          </div>
        </div>
        <p id="manual-applications-status" className="muted" role="status" aria-live="polite">Consultando aplicaciones…</p>
        <div id="manual-applications-list" className="resource-list"></div>
      </section>
      <section className="card application-card" aria-labelledby="application-postgresql">
        <div className="card-heading">
          <div>
            <p className="eyebrow">Base de datos</p>
            <h3 id="application-postgresql">PostgreSQL</h3>
          </div>
          <span className="badge roadmap-badge">Aplicación opcional</span>
        </div>
        <p className="muted">Base de datos relacional privada para tus aplicaciones desplegadas en Swarm.</p>
        <ul className="roadmap-list">
          <li>Instancia única con volumen persistente administrado</li>
          <li>Acceso interno por la red Swarm en vps-manager-postgresql:5432</li>
          <li>Contraseña generada automáticamente y almacenada como secreto Swarm</li>
          <li>Sin puertos publicados en el VPS</li>
        </ul>
        <p id="postgresql-status" className="application-status" role="status" aria-live="polite">
          Consultando disponibilidad…
        </p>
        <div className="container-heading-actions application-actions">
          <button id="install-postgresql" className="button resource-action hidden" type="button">Instalar PostgreSQL</button>
          <button id="reveal-postgresql-credentials" className="button secondary resource-action hidden" type="button">
            Mostrar credenciales una vez
          </button>
        </div>
      </section>
      <section className="card application-card" aria-labelledby="application-supabase">
        <div className="card-heading">
          <div>
            <p className="eyebrow">Backend e infraestructura</p>
            <h3 id="application-supabase">Supabase</h3>
          </div>
          <span className="badge roadmap-badge">Configuración por VPS</span>
        </div>
        <p className="muted">Define una instalación self-hosted completa por servidor Swarm, con API y Studio bajo dominios HTTPS independientes.</p>
        <ul id="supabase-services" className="roadmap-list">
          <li>Consultando servicios y versiones del catálogo…</li>
        </ul>
        <details className="application-settings">
          <summary>Servicios, volúmenes y secretos</summary>
          <div id="supabase-settings-summary" className="application-settings-summary"></div>
        </details>
        <p id="supabase-status" className="application-status" role="status" aria-live="polite">
          Consultando catálogo y servidores Swarm…
        </p>
        <div id="supabase-instances" className="resource-list"></div>
        <div className="container-heading-actions application-actions">
          <button id="configure-supabase" className="button resource-action" type="button" disabled>
            Configurar Supabase por servidor
          </button>
        </div>
      </section>
      <section className="card application-card" aria-labelledby="application-n8n">
        <div className="card-heading">
          <div>
            <p className="eyebrow">Automatización</p>
            <h3 id="application-n8n">n8n</h3>
          </div>
          <span className="badge roadmap-badge">Aplicación opcional</span>
        </div>
        <p className="muted">Automatiza flujos de trabajo con una instancia privada y persistente.</p>
        <ul className="roadmap-list">
          <li>Instancia única con SQLite y volumen persistente administrado</li>
          <li>Acceso HTTPS con dominio raíz y subdominio elegidos al instalar</li>
          <li>Clave de cifrado generada automáticamente y guardada como secreto Swarm</li>
        </ul>
        <label htmlFor="n8n-domain-zone">Dominio raíz</label>
        <select id="n8n-domain-zone" name="domainZone" required>
          <option value="">Conecta primero un dominio raíz en Dominios</option>
        </select>
        <label htmlFor="n8n-subdomain">Subdominio (opcional)</label>
        <input id="n8n-subdomain" name="subdomain" type="text" placeholder="automatizacion" autoComplete="off" />
        <p className="muted">Déjalo vacío para usar el dominio raíz. Ejemplo: automatizacion.midominio.com.</p>
        <p id="n8n-status" className="application-status" role="status" aria-live="polite">
          Consultando disponibilidad…
        </p>
        <p className="application-domain">
          <a id="n8n-url" href="#" className="update-release-link hidden">Abrir n8n</a>
        </p>
        <div className="container-heading-actions application-actions">
          <button id="install-n8n" className="button resource-action hidden" type="button">Instalar n8n</button>
        </div>
      </section>
    </div>
  );
}
