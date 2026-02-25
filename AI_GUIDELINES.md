
# Directivas de Desarrollo y Arquitectura - Aguas Puras (v2.5)

Este documento define las reglas, estándares y lógica de negocio para el desarrollo de la aplicación.
**Toda generación de código debe adherirse estrictamente a estas pautas.**

## 🛑 LA REGLA DE ORO (PRIORIDAD 1)
**PRIMERO EL CÓDIGO, LUEGO LA EXPLICACIÓN.**
Cuando el usuario pida un cambio, **ejecutar la modificación en los archivos inmediatamente**. No describir el plan si se puede ejecutar. No prometer cambios sin entregar el bloque XML.

## 1. Stack Tecnológico (Actual v2.x)
*   **Core:** React (v18), TypeScript, Vite.
*   **Estilos:** Tailwind CSS (Soporte Dark Mode obligatorio).
*   **Estado:** `hooks/useDataStore.ts` (Persistencia en `localStorage`).
*   **Mapas:** Leaflet + OpenStreetMap (Nominatim).
*   **Gráficos:** Recharts.
*   **PDF:** jsPDF + autoTable.

## 2. Filosofía de Desarrollo & Mantenimiento
*   **KISS (Keep It Simple, Stupid):** No sobre-ingenierizar. Si el usuario pide un botón que mande un mail, usar `mailto`, no montar un servidor SMTP.
*   **Respetar el Alcance:** No agregar validaciones bloqueantes o features "fancy" que no se pidieron. La operación real es caótica; el sistema debe ser flexible (permitir stocks negativos si es necesario, permitir editar precios manualmente).
*   **Consistencia Visual:** Mantener la estética existente. Usar `bg-white dark:bg-gray-800` para contenedores.
*   **Modales:** Usar siempre `components/Modal.tsx`. **PROHIBIDO** `window.alert` o `window.confirm`.

## 3. Lógica de Negocio Crítica

### A. Mapas y Geolocalización
*   **Aislamiento:** El mapa en modo edición vive en `MapPickerModal`.
*   **Atomicidad:** Actualizar `lat`, `lng` y `direccion` juntos.
*   **Geocoding:** Usar Nominatim con moderación.

### B. Control de Stock (Planillas)
*   **Concepto:** La "Planilla Diaria" es la verdad absoluta del día.
*   **Cálculo:** Stock Teórico = Carga Inicial + Recargas - Ventas.
*   **Envases:** El sistema debe auditar tanto el líquido (llenos) como los envases (vacíos).

### C. Facturación y PDF
*   **Generación Local:** Todo sucede en el navegador (Client-side generation).
*   **Robustez:** Forzar siempre la descarga del PDF (`doc.save`) antes de intentar abrir ventanas o clientes de correo. Los navegadores bloquean popups si no son respuesta directa a un click.

## 4. Flujo de Trabajo con AI
1.  **Analizar el requerimiento.**
2.  **EJECUCIÓN INMEDIATA:** Generar código XML.
3.  Si el cambio es visualmente complejo, explicar brevemente *después* del código.
4.  No borrar datos de prueba (`mockData`) a menos que se solicite explícitamente.
