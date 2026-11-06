export default function ApplicationCatalog() {
  return (
    <div className="application-workspace">
      <aside className="card application-library" aria-labelledby="application-library-title">
        <h3 id="application-library-title">Catálogo</h3>
        <p className="muted">Elige una aplicación para instalarla como instancia independiente.</p>
        <div className="application-library-list">
          <article className="application-library-item">
            <div>
              <h4>n8n</h4>
              <p>Automatización de flujos con almacenamiento persistente.</p>
            </div>
            <a className="button resource-action" href="/applications/new?template=n8n">Instalar</a>
          </article>
          <article className="application-library-item">
            <div>
              <h4>Supabase</h4>
              <p>Base de datos, API, autenticación y almacenamiento.</p>
            </div>
            <button id="configure-supabase" className="button resource-action" type="button" disabled>
              Instalar
            </button>
          </article>
          <article className="application-library-item">
            <div>
              <h4>PostgreSQL</h4>
              <p>Base de datos privada para servicios del Swarm.</p>
            </div>
            <button id="install-postgresql" className="button resource-action hidden" type="button">
              Instalar
            </button>
          </article>
          <article className="application-library-item">
            <div>
              <h4>Aplicación personalizada</h4>
              <p>Despliega una imagen Docker con su propio dominio y recursos.</p>
            </div>
            <a className="button secondary resource-action" href="/applications/new?template=custom">
              Configurar
            </a>
          </article>
        </div>
        <p className="application-library-upcoming">Próximamente: Nextcloud y más aplicaciones multicontenedor.</p>
      </aside>

      <section className="application-installed" aria-labelledby="installed-applications-title">
        <header className="application-installed-heading">
          <div>
            <h3 id="installed-applications-title">Instaladas</h3>
            <p className="muted">Estado y acceso de las aplicaciones en tus nodos Swarm.</p>
          </div>
          <button id="refresh-supabase-state" className="button secondary resource-action" type="button" disabled>
            Actualizar estado
          </button>
        </header>

        <div className="application-installed-grid">
          <section className="card application-card" aria-labelledby="manual-applications-title">
            <h4 id="manual-applications-title">Aplicaciones personalizadas</h4>
            <p id="manual-applications-status" className="muted" data-state="pending" role="status" aria-live="polite">
              Consultando aplicaciones…
            </p>
            <div id="manual-applications-list" className="resource-list"></div>
          </section>

          <section className="card application-card" aria-labelledby="application-n8n">
            <h4 id="application-n8n">n8n</h4>
            <p id="n8n-status" className="application-status" data-state="pending" role="status" aria-live="polite">
              Consultando disponibilidad…
            </p>
            <div id="n8n-legacy-actions" className="application-instance-actions" hidden></div>
            <div id="n8n-instances" className="resource-list"></div>
          </section>

          <section className="card application-card" aria-labelledby="application-supabase">
            <h4 id="application-supabase">Supabase</h4>
            <p className="muted">Cada instancia incluye sus propios dominios, servicios y límites.</p>
            <p id="supabase-status" className="application-status" data-state="pending" role="status" aria-live="polite">
              Consultando catálogo y servidores Swarm…
            </p>
            <div id="supabase-instances" className="resource-list"></div>
          </section>

          <section className="card application-card" aria-labelledby="application-postgresql">
            <h4 id="application-postgresql">PostgreSQL</h4>
            <p className="muted">No ofrece una página web. Conecta tus servicios dentro de Swarm usando estos datos:</p>
            <p id="postgresql-connection" className="application-instance-meta">Consultando conexión privada…</p>
            <p id="postgresql-status" className="application-status" data-state="pending" role="status" aria-live="polite">
              Consultando disponibilidad…
            </p>
            <div className="container-heading-actions application-actions">
              <button id="reveal-postgresql-credentials" className="button secondary resource-action hidden" type="button">
                Mostrar credenciales una vez
              </button>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
