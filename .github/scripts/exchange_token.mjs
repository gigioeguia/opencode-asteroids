// Intercambia el JWT de OIDC por un token de instalación de la OpenCode App.
// Debe ejecutarse con bun (no node): replica el mismo stack HTTP que la
// action oficial de OpenCode, que Cloudflare sí deja pasar desde las IPs de
// datacenter de GitHub Actions (urllib recibe 403 "error code: 1010").
//
// Entrada (env): OIDC_EXCHANGE_URL, OIDC_JWT.
// Salida (stdout): el token, sin salto de línea.

const url = process.env.OIDC_EXCHANGE_URL
const jwt = process.env.OIDC_JWT
if (!url || !jwt) {
  console.error("Se requieren OIDC_EXCHANGE_URL y OIDC_JWT")
  process.exit(1)
}

const response = await fetch(url, {
  method: "POST",
  headers: { Authorization: `Bearer ${jwt}` },
})
const body = await response.text()
if (!response.ok) {
  console.error(`Intercambio OIDC fallido (${response.status}): ${body.slice(0, 200)}`)
  process.exit(1)
}
process.stdout.write(JSON.parse(body).token)
