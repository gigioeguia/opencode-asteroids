#!/usr/bin/env python3
"""Formatea issues recién creados: asigna labels según keywords en español,
conserva el texto original del autor tal cual y añade secciones de contexto
para facilitar la revisión. Lo dispara .github/workflows/issue-formatter.yml.

Autenticación: intercambia el JWT de OIDC del runner (audience
"opencode-github-action") por un token de la OpenCode App en
api.opencode.ai — mismo flujo que anomalyco/opencode/github, sin usar
GITHUB_TOKEN. Requiere permissions: id-token: write y la OpenCode App
instalada en el repo. El intercambio se hace con bun (exchange_token.mjs)
porque Cloudflare bloquea a urllib desde las IPs de datacenter de GitHub.

Uso local (sin tocar GitHub):
    GITHUB_EVENT_NAME=issues GITHUB_SHA=abc1234 \
    python3 format_issue.py --dry-run event.json
"""

import json
import os
import shutil
import subprocess
import sys
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime

API_BASE = "https://api.github.com"
API_VERSION = "2022-11-28"
FORMATTED_MARKER = "<!-- issue-formatter -->"
FALLBACK_LABEL = "needs-triage"
FALLBACK_COLOR = "e99695"

# Los issues que son comandos del agente OpenCode no se formatean.
AGENT_COMMANDS = ("/oc", "/opencode")

# Intercambio OIDC -> token de la OpenCode App (mismo mecanismo que el agente).
OIDC_AUDIENCE = "opencode-github-action"
OIDC_EXCHANGE_URL = "https://api.opencode.ai/exchange_github_app_token"

# api.opencode.ai está tras Cloudflare, que bloquea el UA por defecto de
# urllib ("Python-urllib/3.x") con un 403 "error code: 1010".
USER_AGENT = "opencode-issue-formatter/1.0"

# ── Reglas de clasificación ──
# Keywords en español; la comparación ignora acentos y mayúsculas.
LABEL_RULES = {
    "bug": [
        "problema", "error", "no funciona", "se rompe", "rompe", "falla",
        "fallo", "crash", "glitch", "bug", "congela", "pantalla en negro",
        "no carga", "no arranca",
    ],
    "enhancement": [
        "necesitamos", "nueva", "nuevo", "agregar", "añadir", "mejorar",
        "mejoría", "feature", "debería", "me gustaría", "quisiera", "idea",
        "más grande", "aumentar", "duplicar", "hacer que",
    ],
    "question": [
        "cómo puedo", "cómo hago", "cómo se juega", "duda", "es posible",
        "se puede", "pregunta", "ayuda", "cuál es",
    ],
    "documentation": [
        "readme", "documentación", "docs", "agente", "agents.md",
        "instrucciones", "comentario",
    ],
    "accessibility": [
        "contraste", "tecla", "daltrónico", "tamaño de fuente",
        "accesibilidad", "fuente", "discapacidad",
    ],
}


def normalize(text):
    """Minúsculas sin acentos, para comparar keywords de forma tolerante."""
    decomposed = unicodedata.normalize("NFD", text.lower())
    return "".join(char for char in decomposed if unicodedata.category(char) != "Mn")


def classify(text):
    """Devuelve {label: [keywords halladas]} con todas las reglas que encajen."""
    haystack = normalize(text)
    matches = {}
    for label, keywords in LABEL_RULES.items():
        found = [keyword for keyword in keywords if normalize(keyword) in haystack]
        if found:
            matches[label] = found
    return matches


def is_agent_command(text):
    return text.strip().lower().startswith(AGENT_COMMANDS)


def quote_original(text):
    """Cita el texto original línea a línea sin alterar su contenido."""
    lines = text.splitlines() if text else ["(sin descripción)"]
    return "\n".join(f"> {line}" if line else ">" for line in lines)


def format_date(iso):
    return datetime.strptime(iso, "%Y-%m-%dT%H:%M:%SZ").strftime("%d/%m/%Y %H:%M UTC")


# ── Token de la OpenCode App (OIDC, sin GITHUB_TOKEN) ──

def fetch_oidc_jwt():
    """Pide el JWT de OIDC del runner; requiere permissions: id-token: write."""
    base_url = os.environ.get("ACTIONS_ID_TOKEN_REQUEST_URL")
    request_token = os.environ.get("ACTIONS_ID_TOKEN_REQUEST_TOKEN")
    if not base_url or not request_token:
        sys.exit("Faltan ACTIONS_ID_TOKEN_REQUEST_URL/TOKEN (¿id-token: write?)")
    separator = "&" if "?" in base_url else "?"
    request = urllib.request.Request(
        f"{base_url}{separator}audience={urllib.parse.quote(OIDC_AUDIENCE)}",
        headers={
            "Authorization": f"Bearer {request_token}",
            "User-Agent": USER_AGENT,
        },
    )
    with urllib.request.urlopen(request) as response:
        return json.load(response)["value"]


def fetch_app_token():
    """Intercambia el JWT por un token de instalación de la OpenCode App."""
    jwt = fetch_oidc_jwt()
    # Cloudflare bloquea urllib desde las IPs de datacenter de GitHub (1010);
    # con bun usamos el mismo stack HTTP que la action oficial de OpenCode.
    if shutil.which("bun"):
        return exchange_with_bun(jwt)
    return exchange_with_urllib(jwt)


def exchange_with_bun(jwt):
    """Intercambio vía exchange_token.mjs (ver cabecera de ese archivo)."""
    helper = os.path.join(os.path.dirname(os.path.abspath(__file__)), "exchange_token.mjs")
    result = subprocess.run(
        ["bun", helper],
        env={**os.environ, "OIDC_EXCHANGE_URL": OIDC_EXCHANGE_URL, "OIDC_JWT": jwt},
        capture_output=True,
        text=True,
        timeout=30,
    )
    if result.returncode != 0:
        detail = result.stderr.strip().splitlines()[-1] if result.stderr else "bun falló sin salida"
        sys.exit(detail)
    return result.stdout.strip()


def exchange_with_urllib(jwt):
    request = urllib.request.Request(
        OIDC_EXCHANGE_URL,
        method="POST",
        headers={
            "Authorization": f"Bearer {jwt}",
            "User-Agent": USER_AGENT,
        },
    )
    try:
        with urllib.request.urlopen(request) as response:
            return json.load(response)["token"]
    except urllib.error.HTTPError as error:
        detail = error.read().decode()[:200]
        sys.exit(f"Intercambio OIDC fallido ({error.code}): {detail}")


# ── GitHub API ──

class ApiError(RuntimeError):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status


def api(token, method, path, payload=None):
    request = urllib.request.Request(
        f"{API_BASE}{path}",
        method=method,
        data=json.dumps(payload).encode() if payload is not None else None,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": API_VERSION,
            "Content-Type": "application/json",
            "User-Agent": USER_AGENT,
        },
    )
    try:
        with urllib.request.urlopen(request) as response:
            raw = response.read().decode()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as error:
        detail = error.read().decode()[:200]
        raise ApiError(error.code, f"GitHub API {method} {path} -> {error.code}: {detail}") from error


def fetch_existing_labels(token, owner, repo):
    labels = api(token, "GET", f"/repos/{owner}/{repo}/labels?per_page=100")
    return {label["name"] for label in labels}


def ensure_fallback_label(token, owner, repo):
    """Crea needs-triage si no existe; 422 (ya existe) no es un error."""
    try:
        api(token, "POST", f"/repos/{owner}/{repo}/labels", {
            "name": FALLBACK_LABEL,
            "color": FALLBACK_COLOR,
            "description": "Clasificación pendiente de revisión manual",
        })
    except ApiError as error:
        if error.status != 422:
            raise


def revoke_app_token(token):
    """Revoca el token de instalación al terminar (higiene, como el agente)."""
    try:
        api(token, "DELETE", "/installation/token")
    except ApiError:
        pass


# ── Armado del cuerpo ──

def build_body(issue, matches, assigned, commit, full_name):
    author = issue["user"]["login"]
    title = issue["title"] or "(sin título)"

    def reason(label):
        keywords = matches.get(label)
        if not keywords:
            return "sin keywords de clasificación"
        return "keywords: " + ", ".join(f'"{keyword}"' for keyword in keywords)

    rows = "\n".join(f"| `{label}` | {reason(label)} |" for label in assigned)
    labels_line = ", ".join(f"`{label}`" for label in assigned)
    if commit:
        commit_line = f"[`{commit[:7]}`](https://github.com/{full_name}/commit/{commit})"
    else:
        commit_line = "no disponible"

    header = "\n".join([
        FORMATTED_MARKER,
        "",
        "> [!NOTE]",
        "> Issue formateado automáticamente. El texto original del autor se mantiene sin modificar.",
        "",
        f"## 📝 Reporte original — @{author} ({format_date(issue['created_at'])})",
        "",
        f"> **Título:** {title}",
        ">",
        quote_original(issue["body"]),
    ])

    return (
        f"{header}\n\n---\n\n"
        "## 🏷️ Clasificación automática\n\n"
        "| Label | Razón |\n|-------|-------|\n"
        f"{rows}\n\n"
        "## 🔍 Contexto para revisión\n\n"
        f"- **Autor:** @{author}\n"
        f"- **Commit al crear el issue:** {commit_line}\n"
        f"- **Labels asignados:** {labels_line}\n\n"
        "## ✅ Checklist del revisor\n\n"
        "- [ ] Pasos para reproducir\n"
        "- [ ] Comportamiento esperado\n"
        "- [ ] Entorno/navegador\n"
    )


# ── Flujo principal ──

def load_event(path):
    with open(path, encoding="utf-8") as file:
        return json.load(file)


def main():
    dry_run = "--dry-run" in sys.argv
    event_arg = next((arg for arg in sys.argv[1:] if not arg.startswith("--")), None)
    event_path = event_arg or os.environ.get("GITHUB_EVENT_PATH")
    if not event_path:
        sys.exit("Falta la ruta del evento (GITHUB_EVENT_PATH o argumento)")

    event = load_event(event_path)
    is_issue_opened = (
        os.environ.get("GITHUB_EVENT_NAME") == "issues"
        and event.get("action") == "opened"
    )
    if not dry_run and not is_issue_opened:
        return  # este script solo procesa issues recién creados

    issue = event["issue"]
    title = issue.get("title") or ""
    body = issue.get("body") or ""

    if is_agent_command(title) or is_agent_command(body):
        print("Issue de comando del agente (/oc o /opencode): sin formatear")
        return

    already_formatted = FORMATTED_MARKER in body
    repository = event["repository"]
    owner = repository["owner"]["login"]
    repo = repository["name"]
    commit = os.environ.get("GITHUB_SHA", "")

    token = None if dry_run else fetch_app_token()
    try:
        matches = classify(f"{title}\n{body}")
        # Solo se asignan labels que ya existen en el repo.
        existing = set(LABEL_RULES) if dry_run else fetch_existing_labels(token, owner, repo)
        assigned = [label for label in matches if label in existing]
        if not assigned:
            if not dry_run:
                ensure_fallback_label(token, owner, repo)
            assigned = [FALLBACK_LABEL]

        if dry_run:
            if not already_formatted:
                print(build_body(issue, matches, assigned, commit, repository["full_name"]))
            print(f"Labels asignados: {', '.join(assigned)}")
            return

        number = issue["number"]
        if not already_formatted:
            new_body = build_body(issue, matches, assigned, commit, repository["full_name"])
            api(token, "PATCH", f"/repos/{owner}/{repo}/issues/{number}", {"body": new_body})
        api(token, "POST", f"/repos/{owner}/{repo}/issues/{number}/labels", {"labels": assigned})
        suffix = "" if already_formatted else " + body formateado"
        print(f"Issue #{number}: labels {', '.join(assigned)}{suffix}")
    finally:
        if token:
            revoke_app_token(token)


if __name__ == "__main__":
    main()
