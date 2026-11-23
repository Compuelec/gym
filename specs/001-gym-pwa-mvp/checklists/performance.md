# Pulido · Accesibilidad y rendimiento (T141, T142)

Fecha: 2026-11-23 · Entorno local de pruebas (imágenes de producción), Chrome con ancho de
celular (390 px), CPU 4 veces más lenta y red «4G rápida».

## Accesibilidad (Lighthouse, pantallas con sesión iniciada)
| Pantalla | Accesibilidad | Buenas prácticas | SEO |
|---|---|---|---|
| Inicio de sesión | 100 | 100 | 100 |
| Entrenar (inicio) | 100 | 100 | 100 |
| Ejercicios | 100 | 100 | 100 |
| Nueva rutina | 100 | 100 | 100 |
| Sesión en curso (con serie registrada y descanso) | 100 | 100 | 100 |
| Progreso | 100 | 100 | 100 |
| Perfil | 100 | 100 | 100 |
| Coach | 100 (era 95) | 100 | 100 |

Corregido:
- Texto secundario sobre fondo gris con contraste 4,34 (mínimo 4,5) → se oscureció el gris del
  texto secundario en toda la app.
- El temporizador de descanso leía cada segundo en voz alta → ahora sólo anuncia «¡Descanso
  terminado!» (prueba que falla si se revierte).
- `robots.txt` no existía (la app respondía con la página) → archivo real que pide no indexar.

Sin cambios: avisos de «llms.txt» y «ARD» (sólo para buscadores de IA; no aplica a una app privada).

## Rendimiento
| Medida | Resultado | Meta |
|---|---|---|
| Apertura con la app ya instalada (LCP) | 0,65 s | < 2 s |
| Apertura en frío, sin caché (LCP) | 1,5 s | < 2 s |
| Saltos de diseño (CLS) | 0,00 | < 0,1 |
| Búsqueda en el catálogo (876 ejercicios) | 13–37 ms | < 300 ms |
| Paquete inicial (comprimido) | ≈ 99 kB | — |
| Gráficos (sólo al abrir Progreso) | ≈ 124 kB | carga diferida |

Pendiente: medir en un teléfono real de gama media una vez publicada (T145).
