
import React, { useState, useEffect } from 'react';
import Card from '../../components/Card';
import AppButton from '../../components/ui/AppButton';
import AppInput from '../../components/ui/AppInput';

const NotesPlugin: React.FC = () => {
    const [notes, setNotes] = useState<string[]>([]);
    const [newNote, setNewNote] = useState('');

    useEffect(() => {
        const saved = localStorage.getItem('plugin_notes_data');
        if (saved) setNotes(JSON.parse(saved));
    }, []);

    const saveNotes = (updated: string[]) => {
        setNotes(updated);
        localStorage.setItem('plugin_notes_data', JSON.stringify(updated));
    };

    const addNote = () => {
        if (!newNote.trim()) return;
        saveNotes([...notes, newNote]);
        setNewNote('');
    };

    const deleteNote = (index: number) => {
        const updated = notes.filter((_, i) => i !== index);
        saveNotes(updated);
    };

    return (
        <div className="space-y-6">
            <header>
                <h2 className="text-2xl font-black text-gray-800 dark:text-white uppercase tracking-tighter italic">Notas Rápidas</h2>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Plugin de Ejemplo</p>
            </header>

            <Card className="p-6">
                <div className="flex gap-2 mb-6">
                    <div className="flex-grow">
                        <AppInput 
                            label="Nueva Nota" 
                            value={newNote} 
                            onChange={(e) => setNewNote(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && addNote()}
                        />
                    </div>
                    <div className="pt-6">
                        <AppButton onClick={addNote}>Agregar</AppButton>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {notes.map((note, index) => (
                        <div key={index} className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-xl border border-yellow-200 dark:border-yellow-700/50 relative group">
                            <button 
                                onClick={() => deleteNote(index)}
                                className="absolute top-2 right-2 text-yellow-600 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                            <p className="text-gray-800 dark:text-yellow-100 text-sm whitespace-pre-wrap">{note}</p>
                        </div>
                    ))}
                    {notes.length === 0 && (
                        <div className="col-span-full py-12 text-center text-gray-400 italic">
                            No hay notas guardadas.
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );
};

export default NotesPlugin;
