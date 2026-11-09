---
description: Crea un worktree en .worktrees/ con nombre derivado de la tarea dada.
---

Crea un worktree de git a partir de esta tarea del usuario:

$ARGUMENTS

Instrucciones:

1. La tarea puede ser una frase libre, con o sin espacios: analízala y
   extrae su concepto central.
2. Deriva el nombre del worktree:
   - Lista los worktrees existentes en .worktrees/ y continúa su
     numeración NN_ (01_, 02_, 03_, ...).
   - Completa con una palabra corta en snake_case (minúsculas, sin
     acentos ni espacios) que refleje el concepto central de la tarea.
3. Ejecuta únicamente: git worktree add .worktrees/<nombre>
4. Si no recibiste tarea, pregúnta al usuario qué va a desarrollar
   antes de continuar.

No hagas nada más: no cambies de directorio, no hagas commits, no edites
archivos, no ejecutes ningún otro comando.
