
# Aguas Puras - Sistema de Gestión de Reparto

Aplicación web progresiva (PWA) desarrollada para la gestión integral de una distribuidora de agua y soda. 
El sistema permite administrar clientes, rutas de reparto, stock móvil (camiones), facturación y cuentas corrientes.

**Tecnología:** React + Vite + TypeScript + Tailwind CSS + Leaflet (Mapas).
**Almacenamiento:** LocalStorage (Persistencia en navegador).

---

## 📜 Historial de Versiones (Version Log)

### v2.6 - Pulido Visual y Estabilidad (Actual)
*   **UX de Modales:** Ajuste de seguridad (`pr-12`) en todos los encabezados de modales para evitar solapamientos con el botón de cierre.
*   **Consistencia Visual:** Revisión de márgenes y paddings en formularios críticos (Caja, Remitos, Clientes, Planillas).
*   **QA & Estabilidad:** Implementación de script de validación de tipos (`lint`) y limpieza de código para asegurar un build libre de errores.

### v2.5 - Consolidación y UX
*   **Facturación Avanzada:** Generación de PDF en formato A5 Doble (Impresión) y A4 (Digital).
*   **Envío de Emails:** Integración con cliente de correo local (`mailto`) adjuntando PDF. Plantillas personalizables con variables dinámicas.
*   **Detalle de Remitos:** Desglose ítem por ítem en los correos de facturación.
*   **Estado de Envíos:** Indicador visual de facturas enviadas para evitar duplicados.

### v2.2 - Módulo de Reportes PDF
*   Implementación de `jspdf` y `autotable`.
*   Diseño de facturas "X" / Presupuestos con logo y datos fiscales configurables.

### v2.1 - Control de Stock Móvil (La Planilla)
*   **Flujo de Carga:** Apertura de planilla diaria por repartidor (Carga Inicial).
*   **Recargas:** Registro de paso por fábrica (Entrada de llenos / Salida de vacíos).
*   **Auditoría:** Pantalla de cierre con cálculo automático de "Teórico vs Físico" y semáforos de diferencias.
*   **Control de Envases:** Lógica específica para balancear envases retornables recuperados.

### v2.0 - Geolocalización y Rutas
*   **Mapas Interactivos:** Integración de OpenStreetMap + Leaflet.
*   **Geocoding:** Búsqueda de direcciones y coordenadas (Nominatim).
*   **Optimización de Ruta:** Algoritmo "Vecino más cercano" (Circular) para ordenar el reparto del día.
*   **Importación/Exportación:** Respaldo completo de datos en CSV.

### v1.3 - Contratos y Servicios
*   Gestión de comodatos de dispenseras.
*   Servicios de abono fijo y alquileres.

### v1.2 - Caja y Gastos
*   Registro de ingresos y egresos varios.
*   Balance de caja por método de pago.

### v1.1 - Cuentas Corrientes
*   Gestión de deuda de clientes.
*   Facturación global de remitos pendientes.
*   Pagos parciales a cuenta.

### v1.0 - Core (MVP)
*   ABM de Clientes, Productos y Repartidores.
*   Creación de Remitos.
*   Dashboard con estadísticas básicas.

---

## 🚀 Próximos Pasos (Roadmap)
*   Migración a Backend PHP/Laravel + MySQL (v3.0).
*   Facturación Electrónica AFIP (Webservice).
*   App móvil dedicada para choferes.
