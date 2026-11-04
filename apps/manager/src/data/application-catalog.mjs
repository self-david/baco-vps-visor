export const applicationCatalog = [
  {
    id: "postgresql",
    name: "PostgreSQL",
    category: "Base de datos",
    description: "Base de datos relacional privada para tus aplicaciones desplegadas en Swarm.",
    image: "postgres:17.11-alpine3.24",
    features: [
      "Instancia única con volumen persistente administrado",
      "Acceso interno por la red Swarm en vps-manager-postgresql:5432",
      "Contraseña generada automáticamente, almacenada como secreto Swarm y disponible una sola vez",
      "Sin puertos publicados en el VPS",
    ],
    installation: {
      status: "optional",
      enabled: true,
      statusLabel: "Aplicación opcional",
    },
  },
  {
    id: "n8n",
    name: "n8n",
    category: "Automatización",
    description: "Automatiza flujos de trabajo con una instancia privada y persistente.",
    image: "n8nio/n8n:2.46.4",
    features: [
      "Instancia única con SQLite y volumen persistente administrado",
      "Acceso HTTPS mediante un dominio registrado en Dominios",
      "Clave de cifrado generada automáticamente y almacenada como secreto Swarm",
    ],
    installation: {
      status: "optional",
      enabled: true,
      statusLabel: "Aplicación opcional",
    },
  },
];
