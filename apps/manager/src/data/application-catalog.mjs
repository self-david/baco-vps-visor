export const applicationCatalog = [
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
  {
    id: "gitea",
    name: "Gitea",
    category: "Control de versiones",
    description: "Servidor Git privado para alojar repositorios y conectar proyectos.",
    features: [
      "Repositorios y ramas Git",
      "Acceso web mediante HTTPS en git.<dominio>",
      "Conexiones Git SSH por el puerto 2222",
      "Creación de repositorios privados desde VPS Manager",
      "Integración futura con proyectos y webhooks",
    ],
    installation: {
      status: "optional",
      enabled: true,
      statusLabel: "Aplicación opcional",
    },
  },
];
