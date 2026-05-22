import { useState, useEffect, useCallback } from 'react';
import { db } from '../../firebase/config';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, writeBatch } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { Preforma, Molde, ProduccionSoplado, EntregaSoplado, SopladoDashboardSettings } from './types';
import { format } from 'date-fns';

const addSorteableProperties = (obj: any, id: string) => ({ id, ...obj });
const cleanUndefineds = (obj: any) => JSON.parse(JSON.stringify(obj));

export const useSopladoStore = () => {
    const { user } = useAuth();
    
    const [preformas, setPreformas] = useState<Preforma[]>([]);
    const [moldes, setMoldes] = useState<Molde[]>([]);
    const [produccion, setProduccion] = useState<ProduccionSoplado[]>([]);
    const [entregas, setEntregas] = useState<EntregaSoplado[]>([]);

    useEffect(() => {
        if (!user) return;

        const unsubs = [
            onSnapshot(collection(db, 'preformas'), (s) => setPreformas(s.docs.map(d => addSorteableProperties(d.data(), d.id) as Preforma))),
            onSnapshot(collection(db, 'moldes'), (s) => setMoldes(s.docs.map(d => addSorteableProperties(d.data(), d.id) as Molde))),
            onSnapshot(collection(db, 'produccion_soplado'), (s) => setProduccion(s.docs.map(d => addSorteableProperties(d.data(), d.id) as ProduccionSoplado))),
            onSnapshot(collection(db, 'entregas_soplado'), (s) => setEntregas(s.docs.map(d => addSorteableProperties(d.data(), d.id) as EntregaSoplado))),
        ];

        return () => unsubs.forEach(unsub => unsub());
    }, [user]);

    const addProduccion = useCallback(async (data: Omit<ProduccionSoplado, 'id'>) => {
        // We do a batch update to update preforma and molde stocks
        const batch = writeBatch(db);
        const prodRef = doc(collection(db, 'produccion_soplado'));
        batch.set(prodRef, cleanUndefineds(data));
        
        const molde = moldes.find(m => m.id === data.moldeId);
        if (molde) {
            batch.update(doc(db, 'moldes', molde.id), { stockActual: Number(molde.stockActual) + Number(data.cantidadProducida) });
            const preforma = preformas.find(p => p.id === molde.preformaId);
            if (preforma) {
                const consumido = Number(data.cantidadProducida) + Number(data.merma);
                batch.update(doc(db, 'preformas', preforma.id), { stockActual: Number(preforma.stockActual) - consumido });
            }
        }
        await batch.commit();
    }, [moldes, preformas]);

    const addEntrega = useCallback(async (data: Omit<EntregaSoplado, 'id'>) => {
        const batch = writeBatch(db);
        const ref = doc(collection(db, 'entregas_soplado'));
        batch.set(ref, cleanUndefineds(data));

        const molde = moldes.find(m => m.id === data.moldeId);
        if (molde) {
            batch.update(doc(db, 'moldes', molde.id), { stockActual: Number(molde.stockActual) - Number(data.cantidad) });
        }
        // In full app we might update 'productos' or 'insumos' inside root store, but here we can just update Soplado-local state.
        
        await batch.commit();
    }, [moldes]);

    return {
        preformas,
        moldes,
        produccion,
        entregas,
        addProduccion,
        addEntrega
    };
};
