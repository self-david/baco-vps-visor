export default function ApplicationRequirementNotice({
  applicationName,
  feature,
  detail,
}) {
  return (
    <aside className="application-notice" role="status" aria-label={`Requisito de aplicación: ${applicationName}`}>
      <div>
        <strong>{applicationName} · requisito para {feature}</strong>
        <p>{detail}</p>
      </div>
      <a href="#tab-apps">Ver aplicaciones</a>
    </aside>
  );
}
