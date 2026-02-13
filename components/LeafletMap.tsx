
import React, { useEffect, useRef } from 'react';
import * as L from 'leaflet';

interface LeafletMapProps {
    initialLat?: number;
    initialLng?: number;
    onPositionChange?: (lat: number, lng: number) => void;
    height?: string;
    markers?: { lat: number, lng: number, title: string }[]; // Para modo solo lectura (Dashboard)
    editMode?: boolean;
    route?: { lat: number, lng: number }[]; // Nueva prop para dibujar la línea de ruta
}

// Fix default icon issue
const DefaultIcon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

const LeafletMap: React.FC<LeafletMapProps> = ({ 
    initialLat, 
    initialLng, 
    onPositionChange, 
    height = "300px",
    markers = [],
    editMode = false,
    route = []
}) => {
    const mapRef = useRef<L.Map | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const mainMarkerRef = useRef<L.Marker | null>(null);
    const markersRef = useRef<L.Marker[]>([]);
    const polylineRef = useRef<L.Polyline | null>(null);

    // Inicialización ÚNICA del mapa
    useEffect(() => {
        if (!containerRef.current || mapRef.current) return;

        // 1. Configurar centro inicial
        const startLat = initialLat || -34.6037; // Buenos Aires default
        const startLng = initialLng || -58.3816;
        const startZoom = initialLat ? 15 : 12;

        const map = L.map(containerRef.current, {
            doubleClickZoom: false
        }).setView([startLat, startLng], startZoom);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map);

        mapRef.current = map;

        // 2. Modo Edición (Listener de clicks en mapa)
        if (editMode) {
            const updateMarker = (lat: number, lng: number) => {
                if (mainMarkerRef.current) {
                    mainMarkerRef.current.setLatLng([lat, lng]);
                } else {
                    mainMarkerRef.current = L.marker([lat, lng], { draggable: true }).addTo(map);
                    mainMarkerRef.current.on('dragend', (e) => {
                        const { lat, lng } = e.target.getLatLng();
                        if (onPositionChange) onPositionChange(lat, lng);
                    });
                }
                if (onPositionChange) onPositionChange(lat, lng);
            };

            // Listener global de clicks en el mapa para mover el pin
            map.on('click', (e) => updateMarker(e.latlng.lat, e.latlng.lng));
        }

        setTimeout(() => map.invalidateSize(), 100);

        return () => {
            map.remove();
            mapRef.current = null;
        };
    }, []); // Solo al montar el componente

    // NUEVO EFECTO: Reaccionar a cambios externos de posición (Buscador)
    useEffect(() => {
        if (!mapRef.current || !initialLat || !initialLng) return;

        const currentMarkerPos = mainMarkerRef.current?.getLatLng();
        
        // Evitar bucle si la posición es la misma (ej: generada por el propio drag del marker)
        // Usamos una pequeña tolerancia por precisión flotante
        const isSamePosition = currentMarkerPos && 
            Math.abs(currentMarkerPos.lat - initialLat) < 0.00001 && 
            Math.abs(currentMarkerPos.lng - initialLng) < 0.00001;

        if (isSamePosition) return;

        // Mover el mapa suavemente
        mapRef.current.flyTo([initialLat, initialLng], 16);

        // Actualizar o Crear Marcador
        if (mainMarkerRef.current) {
            mainMarkerRef.current.setLatLng([initialLat, initialLng]);
        } else if (editMode) {
            mainMarkerRef.current = L.marker([initialLat, initialLng], { draggable: true }).addTo(mapRef.current);
            mainMarkerRef.current.on('dragend', (e) => {
                const { lat, lng } = e.target.getLatLng();
                if (onPositionChange) onPositionChange(lat, lng);
            });
        }
    }, [initialLat, initialLng, editMode, onPositionChange]);


    // Efecto para actualizar marcadores y ruta en modo visualización (Dashboard)
    useEffect(() => {
        if (!mapRef.current || editMode) return;

        // Limpiar marcadores anteriores
        markersRef.current.forEach(m => m.remove());
        markersRef.current = [];
        
        // Limpiar ruta anterior
        if (polylineRef.current) {
            polylineRef.current.remove();
            polylineRef.current = null;
        }

        const bounds = L.latLngBounds([]);

        // Agregar nuevos marcadores
        markers.forEach((m, index) => {
            // Crear icono con número si hay ruta optimizada
            let customIcon = DefaultIcon;
            if (route.length > 0) {
                 customIcon = L.divIcon({
                    className: 'custom-div-icon',
                    html: `<div style="background-color: #2563eb; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-weight: bold; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">${index + 1}</div>`,
                    iconSize: [24, 24],
                    iconAnchor: [12, 12]
                });
            }

            const marker = L.marker([m.lat, m.lng], { icon: customIcon })
                .addTo(mapRef.current!)
                .bindPopup(`<b>${index + 1}. ${m.title}</b>`);
            
            markersRef.current.push(marker);
            bounds.extend([m.lat, m.lng]);
        });

        // Dibujar ruta si existe
        if (route.length > 1) {
            const latlngs = route.map(p => [p.lat, p.lng] as L.LatLngExpression);
            polylineRef.current = L.polyline(latlngs, { color: 'blue', weight: 3, opacity: 0.7, dashArray: '10, 10' }).addTo(mapRef.current!);
        }

        // Ajustar zoom
        if (bounds.isValid()) {
            mapRef.current.fitBounds(bounds, { padding: [50, 50] });
        }

    }, [markers, route, editMode]);

    return <div ref={containerRef} style={{ height, width: '100%', borderRadius: '0.5rem', zIndex: 1 }} />;
};

export default LeafletMap;
