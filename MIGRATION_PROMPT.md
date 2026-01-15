# Prompt Maestro para Migración: Aguas Puras (React -> Laravel)

Este documento sirve como "Semilla" o "Contexto Base" para instruir a una Inteligencia Artificial (ChatGPT, Claude, Gemini) sobre cómo migrar la aplicación "Aguas Puras" de su estado actual (React + LocalStorage) a una arquitectura robusta de Backend (PHP/Laravel + SQL).

---

## 🤖 ROL DE LA IA
Actúa como un **Arquitecto de Software Senior** especializado en logística y distribución. Tu objetivo es reconstruir la aplicación existente utilizando **Laravel (PHP)** como backend y **MySQL/SQLite** como base de datos, manteniendo la lógica de negocio intacta pero profesionalizando la persistencia de datos.

---

## 1. DESCRIPCIÓN DEL NEGOCIO (Contexto)
"Aguas Puras" es un sistema ERP para distribuidoras de agua y soda.
*   **Actores:** Administradores (Gestionan todo) y Repartidores (Venden y entregan en la calle).
*   **Flujo Principal:**
    1.  **Carga (Mañana):** El camión se carga con producto (Bidones 20L, 12L, etc.). Se abre una `PlanillaDiaria`.
    2.  **Reparto:** El repartidor visita clientes, crea `Remitos` (entregas). Deja llenos, retira vacíos.
    3.  **Cierre (Tarde):** El camión vuelve. Se cuentan los productos sobrantes ("Stock Físico") y los envases vacíos recuperados. El sistema calcula diferencias (Faltantes/Sobrantes).

---

## 2. REGLAS DE ORO (Lógica Crítica)

### A. Control de Stock y Envases
*   **La Planilla es Sagrada:** Todo movimiento de stock ocurre dentro de una `PlanillaDiaria`.
*   **Fórmula de Auditoría:**
    *   *Stock Lleno Teórico* = (Carga Inicial + Recargas) - (Ventas en Remitos).
    *   *Envases Vacíos Teóricos* = (Envases Recuperados en Clientes) - (Envases Descargados en Recargas).
*   **Diferencias:** Si el Teórico != Físico, se registra la diferencia pero **no se bloquea** el cierre.

### B. Geolocalización
*   Los clientes tienen coordenadas (`lat`, `lng`).
*   Existe una lógica de "Optimización de Ruta" (Vecino más cercano) que ordena los clientes del día.
*   Al migrar, usar columnas `decimal(10, 8)` para lat/lng.

### C. Cuentas Corrientes
*   Un `Remito` puede pagarse en el momento (Contado) o quedar en Cta. Cte.
*   Una `Factura` agrupa varios `Remitos` pendientes.
*   Los `Pagos` pueden imputarse a una Factura o ser "a cuenta" (saldo a favor).

---

## 3. ESQUEMA DE BASE DE DATOS SUGERIDO (Traducción de types.ts)

Al generar las migraciones de Laravel, seguir esta estructura:

*   **users:** `id, name, email, password, role (admin/repartidor)`
*   **clients:** `id, name, address, lat, lng, phone, email, tax_id (cuit), tax_condition`
*   **products:** `id, name, type (retornable/descartable), price, liters`
*   **remitos:** `id, client_id, user_id, date, number, status, total`
*   **remito_items:** `id, remito_id, product_id, quantity_delivered, quantity_returned, price`
*   **daily_sheets (Planillas):** `id, user_id, date, status (open/closed), observations`
*   **daily_sheet_items:** `id, sheet_id, product_id, type (load_initial, reload, return), quantity`
*   **payments:** `id, client_id, amount, method, reference_type (remito/invoice), reference_id`
*   **invoices:** `id, client_id, number, total, date, status`

---

## 4. INSTRUCCIONES TÉCNICAS PARA LA MIGRACIÓN

1.  **Stack:** Laravel 10/11 + Blade (o Inertia/React si se prefiere SPA) + MySQL.
2.  **Validaciones:** Implementar `FormRequests` estrictos para evitar stocks negativos o fechas futuras incorrectas.
3.  **PDF:** Utilizar `barryvdh/laravel-dompdf` para replicar el diseño de factura (A5 Doble y A4 Simple) que ya existe en el Frontend actual.
4.  **Simplicidad:** No implementar sistemas de colas complejos ni microservicios. Mantenerlo Monolito Modular.

---

## 5. ESTILO VISUAL
Mantener la estética limpia y funcional actual (Tailwind CSS).
*   Colores: Primary Blue (`blue-600`), Danger Red (`red-600`), Success Green (`green-600`).
*   Componentes clave: Modales para cargas rápidas, Tablas densas para auditoría.

---

**Nota para la IA:** Utiliza el código fuente actual (`types.ts` y vistas) como referencia absoluta para nombres de campos y lógica de cálculo del frontend.
