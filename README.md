# Asteroids

Clon del clásico arcade **Asteroids** implementado en canvas HTML5 puro, sin dependencias ni bundler.

## Descripción

Nave espacial en un campo de asteroides con envolvimiento de bordes (el espacio es toroidal). Destruye asteroides para sumar puntos: los grandes se parten en medianos, los medianos en pequeños. Incluye power-ups especiales y tipos de asteroides únicos como la estrella fugaz.

## Tecnologías

- **HTML5 Canvas** — renderizado 2D
- **JavaScript (ES6+)** — lógica del juego en un solo archivo `game.js`
- Sin frameworks, sin bundler, sin dependencias

## Cómo correr

Abre `index.html` directamente en el navegador (doble clic), o usa un servidor local:

```bash
npx serve .
```

Luego visita `http://localhost:3000`.

## Controles

| Tecla     | Acción     |
| --------- | ---------- |
| `←` `→`   | Rotar nave |
| `↑`       | Propulsar  |
| `Espacio` | Disparar   |
| `C`       | Cambiar skin de la nave |

## Puntuación

| Elemento          | Puntos |
| ----------------- | ------ |
| Asteroide grande  | 20     |
| Asteroide mediano | 50     |
| Asteroide pequeño | 100    |
| OVNI              | 200    |

Con la nave **TITÁN** todos los puntos se duplican (x2).

## Características

- 3 vidas con invencibilidad temporal al reaparecer (parpadeo)
- Asteroides se parten en fragmentos más pequeños al ser destruidos
- Partículas de explosión al destruir asteroides
- Power-up de triple disparo: tres balas en abanico durante 5 s
- Sistema de skins: cambia la apariencia de la nave con `C` (se recuerda entre sesiones)
- Nave TITÁN (skin morado): el doble de grande —hitbox incluida— a cambio del doble de puntos; el escudo también crece con ella
- Power-up de escudo (contorno cian): burbuja que destruye balas enemigas, asteroides y OVNI al contacto durante 5 s
- OVNI enemigo que aparece periódicamente, zigzaguea y dispara proyectiles contra la nave


## Link
https://github.com/gigioeguia/opencode-asteroids/issues/1#issuecomment-6732249839