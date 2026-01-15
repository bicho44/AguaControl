
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Factura, Cliente, EmpresaSettings, Remito, Producto } from '../types';

export const generateInvoicePDF = async (
    factura: Factura, 
    cliente: Cliente, 
    remitos: Remito[], 
    productos: Producto[], 
    empresa: EmpresaSettings,
    mode: 'print' | 'email' = 'print'
): Promise<boolean> => {
    return new Promise((resolve) => {
        try {
            // Configuración inicial según modo
            // print: Landscape (apaisado) para doble copia A5
            // email: Portrait (vertical) para lectura en celular/PC
            const orientation = mode === 'print' ? 'landscape' : 'portrait';
            const doc = new jsPDF({ orientation, unit: 'mm', format: 'a4' });
            
            const productosMap = new Map(productos.map(p => [p.id, p]));
            const preciosEspecialesMap = new Map(cliente.preciosEspeciales?.map(p => [p.productoId, p.precio]));

            // Función para dibujar una factura en un área específica
            // offsetX: Desplazamiento horizontal (0 para original, 148.5 para duplicado)
            const drawInvoice = (offsetX: number, label: string) => {
                
                // --- Header ---
                
                // Logo
                if (empresa.logo) {
                    try {
                        doc.addImage(empresa.logo, 'JPEG', offsetX + 10, 10, 25, 25);
                    } catch (e) {
                        console.error("Error adding logo", e);
                    }
                }

                // Datos Empresa
                doc.setFontSize(12);
                doc.setFont("helvetica", "bold");
                doc.text(empresa.nombreFantasia || empresa.nombre, offsetX + 40, 15);
                
                doc.setFontSize(8);
                doc.setFont("helvetica", "normal");
                const address = empresa.direccion || 'Dirección no configurada';
                const phone = empresa.telefonos && empresa.telefonos.length > 0 ? `${empresa.telefonos[0].tipo}: ${empresa.telefonos[0].numero}` : '';
                const email = empresa.emails && empresa.emails.length > 0 ? empresa.emails[0] : '';
                
                doc.text(address, offsetX + 40, 20);
                doc.text(`${phone} | ${email}`, offsetX + 40, 24);
                doc.text(`CUIT: ${empresa.cuit || '-'} | IIBB: ${empresa.iibb || '-'}`, offsetX + 40, 28);
                doc.text(empresa.condicionIVA || '', offsetX + 40, 32);

                // Cuadro Factura (X o Presupuesto)
                doc.setDrawColor(0);
                doc.setFillColor(245, 245, 245);
                // Ancho de la mitad A4 (297/2) = 148.5. Cuadro a la derecha de esa mitad.
                // En modo email (Portrait 210mm), ajustamos
                const boxX = mode === 'print' ? offsetX + 95 : 130;
                
                doc.rect(boxX, 10, 45, 25, 'FD');
                
                doc.setFontSize(14);
                doc.setFont("helvetica", "bold");
                doc.text("PRESUPUESTO", boxX + 22.5, 18, { align: 'center' });
                doc.setFontSize(10);
                doc.text(`N° ${factura.numero}`, boxX + 22.5, 24, { align: 'center' });
                doc.setFontSize(8);
                doc.setFont("helvetica", "normal");
                doc.text(`Fecha: ${new Date(factura.fecha + 'T00:00:00').toLocaleDateString()}`, boxX + 22.5, 30, { align: 'center' });
                
                if (mode === 'print') {
                    doc.setFontSize(6);
                    doc.text(label, boxX + 42, 33, { align: 'right' }); // ORIGINAL / DUPLICADO
                }

                // --- Divider ---
                const pageWidth = mode === 'print' ? 148.5 : 210;
                doc.line(offsetX + 10, 40, offsetX + pageWidth - 10, 40);

                // --- Datos Cliente ---
                doc.setFontSize(10);
                doc.setFont("helvetica", "bold");
                doc.text("Cliente:", offsetX + 10, 48);
                doc.setFont("helvetica", "normal");
                doc.text(cliente.nombre, offsetX + 25, 48);
                
                doc.setFontSize(8);
                const clientCuit = cliente.cuit || '-';
                const clientCond = cliente.tipoFacturacion || 'Consumidor Final';
                const clientAddress = cliente.sucursales.length > 0 ? cliente.sucursales[0].direccion : '-';
                
                doc.text(`CUIT: ${clientCuit}`, offsetX + 10, 53);
                doc.text(`Condición: ${clientCond}`, offsetX + 60, 53);
                doc.text(`Dirección: ${clientAddress}`, offsetX + 10, 58);

                // --- Tabla de Items ---
                const itemsMap = new Map<string, { name: string, quantity: number, price: number, total: number }>();

                remitos.forEach(remito => {
                    remito.movimientos.forEach(mov => {
                        if (!mov.productoId || mov.entregados === 0) return;
                        const producto = productosMap.get(mov.productoId);
                        if (!producto) return;

                        const precioUnitario = preciosEspecialesMap.get(mov.productoId) ?? producto.precio;
                        const totalLinea = mov.entregados * precioUnitario;

                        if (itemsMap.has(mov.productoId)) {
                            const current = itemsMap.get(mov.productoId)!;
                            current.quantity += mov.entregados;
                            current.total += totalLinea;
                        } else {
                            itemsMap.set(mov.productoId, {
                                name: producto.nombre,
                                quantity: mov.entregados,
                                price: precioUnitario,
                                total: totalLinea
                            });
                        }
                    });
                });

                const tableBody = Array.from(itemsMap.values()).map(item => [
                    item.name,
                    item.quantity,
                    `$${item.price.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`,
                    `$${item.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
                ]);

                autoTable(doc, {
                    startY: 65,
                    head: [['Descripción', 'Cant.', 'Unitario', 'Subtotal']],
                    body: tableBody,
                    theme: 'plain',
                    styles: { fontSize: 8, cellPadding: 1 },
                    headStyles: { fillColor: [220, 220, 220], textColor: 20, fontStyle: 'bold' },
                    columnStyles: {
                        0: { cellWidth: 'auto' },
                        1: { cellWidth: 10, halign: 'center' },
                        2: { cellWidth: 20, halign: 'right' },
                        3: { cellWidth: 25, halign: 'right' },
                    },
                    margin: { left: offsetX + 10, right: mode === 'print' ? (297 - (offsetX + pageWidth - 10)) : 10 },
                    tableWidth: pageWidth - 20
                });

                const finalY = (doc as any).lastAutoTable.finalY || 80;

                // --- Totales ---
                doc.setFont("helvetica", "bold");
                doc.setFontSize(12);
                doc.text(`Total: $${factura.monto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`, offsetX + pageWidth - 10, finalY + 10, { align: 'right' });

                // --- Pie de Página (Remitos y Bancos) ---
                let footerY = finalY + 18;
                
                // Lista de Remitos
                doc.setFontSize(7);
                doc.setFont("helvetica", "normal");
                doc.setTextColor(100);
                const remitosStr = "Remitos incluidos: " + remitos.map(r => `${r.puntoVenta}-${r.numero}`).join(', ');
                // Split text to fit width
                const splitRemitos = doc.splitTextToSize(remitosStr, pageWidth - 20);
                doc.text(splitRemitos, offsetX + 10, footerY);
                footerY += (splitRemitos.length * 3) + 3;

                // Datos Bancarios
                if (empresa.cbu || empresa.alias) {
                    doc.setTextColor(0);
                    doc.setFont("helvetica", "bold");
                    doc.text("Datos Bancarios:", offsetX + 10, footerY);
                    footerY += 4;
                    
                    doc.setFont("helvetica", "normal");
                    let bankText = "";
                    if (empresa.banco) bankText += `Banco: ${empresa.banco} - `;
                    if (empresa.cbu) bankText += `CBU: ${empresa.cbu}\n`;
                    if (empresa.alias) bankText += `Alias: ${empresa.alias}`;
                    
                    doc.text(bankText, offsetX + 10, footerY);
                    footerY += 8;
                }

                // Observaciones
                if (empresa.observacionesFactura) {
                    footerY += 2;
                    doc.setFontSize(6);
                    doc.setTextColor(100);
                    const obs = doc.splitTextToSize(empresa.observacionesFactura, pageWidth - 20);
                    doc.text(obs, offsetX + 10, footerY);
                }
            };

            if (mode === 'print') {
                // Dibujar Original (Izquierda)
                drawInvoice(0, "ORIGINAL");
                
                // Línea de corte (Punteada al medio)
                doc.setDrawColor(150);
                (doc as any).setLineDash([2, 2], 0);
                doc.line(148.5, 10, 148.5, 200);
                (doc as any).setLineDash([], 0); // Reset

                // Dibujar Duplicado (Derecha)
                drawInvoice(148.5, "DUPLICADO");
            } else {
                // Modo Email (Solo una copia centrada en A4 vertical)
                drawInvoice(0, "");
            }

            // SIEMPRE guardar/descargar el archivo, incluso en modo email.
            // Esto es crucial porque el navegador NO puede adjuntar automáticamente el blob al mailto.
            const fileName = `Factura_${factura.numero}.pdf`;
            doc.save(fileName);

            // Siempre abrir pestaña extra para feedback visual (corrige problema de modo email)
            try {
                const pdfBlob = doc.output('blob');
                const pdfUrl = URL.createObjectURL(pdfBlob);
                window.open(pdfUrl, '_blank');
            } catch (e) {
                console.error("Error opening PDF tab", e);
            }

            resolve(true);
        } catch (error) {
            console.error("Error generating invoice PDF:", error);
            resolve(false);
        }
    });
};
