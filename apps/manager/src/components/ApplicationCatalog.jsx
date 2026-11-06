export default function ApplicationCatalog() {
  return (
    <div className="grid grid-cols-1 gap-[18px] min-[721px]:grid-cols-2" aria-label="Catálogo de aplicaciones">
      <section className="card application-card" aria-labelledby="manual-applications-title">
        <div className="card-heading">
          <div>
            <p className="eyebrow">Instancias</p>
            <h3 id="manual-applications-title">Mis aplicaciones personalizadas</h3>
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
          <li>Instancias independientes con SQLite y volúmenes persistentes</li>
          <li>Versión, zona horaria y límites de recursos configurables desde el panel</li>
          <li>Clave de cifrado generada automáticamente y guardada como secreto Swarm</li>
        </ul>
        <p id="n8n-status" className="application-status" role="status" aria-live="polite">
          Consultando disponibilidad…
        </p>
        <div className="container-heading-actions application-actions">
          <a className="button resource-action" href="/applications/new?template=n8n">Crear instancia de n8n</a>
        </div>
        <div id="n8n-instances" className="resource-list"></div>
      </section>
    </div>
  );
}
