# AGENTS.md

Clon de Asteroids en canvas HTML5 puro. Sin package.json, sin bundler, sin dependencias, sin tests, sin lint, sin CI.

## Comandos

- Correr: abrir `index.html` en el navegador o `npx serve .` (http://localhost:3000).
- No existen comandos de build/lint/test — la verificación es manual, jugando en el navegador.

## Arquitectura

- Toda la lógica del juego está en `game.js` (un solo archivo, no usa módulos). `index.html` lo carga con `<script src>`; el código asume el DOM de esa página (canvas con id `canvas`).
- `W`/`H` en `game.js` (800×600) deben coincidir con los atributos del `<canvas>` en `index.html`.
- Estructura de `game.js`: input → utils → clases (`Bullet`, `Asteroid`, `ShootingStar`, `Ship`, `Particle`, `PowerUp`) → estado global → `update(dt)` → `draw()` → loop con `requestAnimationFrame` (dt en segundos).
- `ShootingStar` (estrella fugaz) hereda de `Asteroid` y vive en el array `asteroids` — colisiones, split y puntos son los del mediano (size 2).

## Convenciones del repo

- Identificadores en inglés, comentarios y README en español.
- Secciones separadas con divisores `// ── Nombre ──`.
- Espacio toroidal: todo movimiento de posiciones debe pasar por `wrap()` para el envolvimiento de bordes.
- Input por eventos: `keys` (estado) y `justPressed` (detección de flanco). `pressed(code)` consume el flag al leerlo — llamar solo una vez por frame.

## Comprobación de cambios

No hay verificación automática. Tras cualquier cambio, recargar la página y probar: movimiento, disparo, particionado de asteroides, vidas/game over y paso de nivel.
