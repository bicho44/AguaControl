
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
            const orientation = mode === 'print' ? 'landscape' : 'portrait';
            const doc = new jsPDF({ orientation, unit: 'mm', format: 'a4' });
            
            const productosMap = new Map(productos.map(p => [p.id, p]));
            const preciosEspecialesMap = new Map(cliente.preciosEspeciales?.map(p => [p.productoId, p.precio]));

            const drawInvoice = (offsetX: number, label: string) => {
                if (empresa.logo) {
                    try {
                        doc.addImage(empresa.logo, 'JPEG', offsetX + 10, 10, 25, 25);
                    } catch (e) {
                        console.error("Error adding logo", e);
                    }
                }

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

                doc.setDrawColor(0);
                doc.setFillColor(245, 245, 245);
                const boxX = mode === 'print' ? offsetX + 95 : 130;
                
                doc.rect(boxX, 10, 45, 25, 'FD');
                
                doc.setFontSize(14);
                doc.setFont("helvetica", "bold");
                doc.text("PRESUPUESTO", boxX + 22.5, 18, { align: 'center' });
                doc.setFontSize(10);
                doc.text(`N° ${factura.numero}`, boxX + 22.5, 24, { align: 'center' });
                doc.setFontSize(8);
                doc.setFont("helvetica", "normal");
                doc.text(`Fecha: ${new Date(factura.fecha + 'T00:00:00').toLocaleDateString('es-AR')}`, boxX + 22.5, 30, { align: 'center' });
                
                if (mode === 'print') {
                    doc.setFontSize(6);
                    doc.text(label, boxX + 42, 33, { align: 'right' });
                }

                const pageWidth = mode === 'print' ? 148.5 : 210;
                doc.line(offsetX + 10, 40, offsetX + pageWidth - 10, 40);

                doc.setFontSize(10);
                doc.setFont("helvetica", "bold");
                doc.text("Cliente:", offsetX + 10, 48);
                doc.setFont("helvetica", "normal");
                // Priorizar NOMBRE FISCAL sobre nombre comercial
                doc.text(cliente.nombreFiscal || cliente.nombre, offsetX + 25, 48);
                
                doc.setFontSize(8);
                const clientCuit = cliente.cuit || '-';
                const clientCond = cliente.tipoFacturacion || 'Consumidor Final';
                const clientAddress = cliente.sucursales.length > 0 ? cliente.sucursales[0].direccion : '-';
                
                doc.text(`CUIT: ${clientCuit}`, offsetX + 10, 53);
                doc.text(`Condición: ${clientCond}`, offsetX + 60, 53);
                doc.text(`Dirección: ${clientAddress}`, offsetX + 10, 58);

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

                doc.setFont("helvetica", "bold");
                doc.setFontSize(12);
                doc.text(`Total: $${factura.monto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`, offsetX + pageWidth - 10, finalY + 10, { align: 'right' });

                let footerY = finalY + 18;
                
                doc.setFontSize(7);
                doc.setFont("helvetica", "normal");
                doc.setTextColor(100);
                const remitosStr = "Remitos incluidos: " + remitos.map(r => `${r.puntoVenta}-${r.numero}`).join(', ');
                const splitRemitos = doc.splitTextToSize(remitosStr, pageWidth - 20);
                doc.text(splitRemitos, offsetX + 10, footerY);
                footerY += (splitRemitos.length * 3) + 3;

                // OBSERVACIONES DE LA FACTURA
                if (factura.observaciones) {
                    doc.setTextColor(0);
                    doc.setFont("helvetica", "bold");
                    doc.text("Observaciones:", offsetX + 10, footerY);
                    footerY += 4;
                    doc.setFont("helvetica", "normal");
                    const obsFactura = doc.splitTextToSize(factura.observaciones, pageWidth - 20);
                    doc.text(obsFactura, offsetX + 10, footerY);
                    footerY += (obsFactura.length * 3) + 4;
                }

                if (empresa.cbu || empresa.alias) {
                    doc.setTextColor(0);
                    doc.setFont("helvetica", "bold");
                    doc.text("Datos Bancarios para Transferencia:", offsetX + 10, footerY);
                    footerY += 4;
                    
                    doc.setFont("helvetica", "normal");
                    let bankText = "";
                    if (empresa.banco) bankText += `Banco: ${empresa.banco} | `;
                    if (empresa.cbu) bankText += `CBU: ${empresa.cbu} | `;
                    if (empresa.alias) bankText += `Alias: ${empresa.alias}`;
                    
                    doc.text(bankText, offsetX + 10, footerY);
                    footerY += 6;
                }

                if (empresa.observacionesFactura) {
                    footerY += 2;
                    doc.setFontSize(6);
                    doc.setTextColor(100);
                    const obs = doc.splitTextToSize(empresa.observacionesFactura, pageWidth - 20);
                    doc.text(obs, offsetX + 10, footerY);
                }
            };

            if (mode === 'print') {
                drawInvoice(0, "ORIGINAL");
                doc.setDrawColor(150);
                (doc as any).setLineDash([2, 2], 0);
                doc.line(148.5, 10, 148.5, 200);
                (doc as any).setLineDash([], 0);
                drawInvoice(148.5, "DUPLICADO");
            } else {
                drawInvoice(0, "");
            }

            const formatterName = `${factura.puntoVenta !== undefined && factura.numeroComprobante !== undefined ? `${factura.puntoVenta.toString().padStart(4, '0')}-${factura.numeroComprobante.toString().padStart(8, '0')}` : factura.numero || 'S-N'}`;
            const clientName = (cliente.nombreFiscal || cliente.nombre).replace(/[^a-zA-Z0-9_\s]/g, '');
            const fileName = `${clientName}_PRESUPUESTO_${formatterName}.pdf`.replace(/\s+/g, '_');
            doc.save(fileName);

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
