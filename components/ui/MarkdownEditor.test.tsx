
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MarkdownEditor from './MarkdownEditor';
import React from 'react';

describe('MarkdownEditor', () => {
    it('should stay collapsed initially if no value', () => {
        render(<MarkdownEditor value="" onChange={() => {}} />);
        expect(screen.getByText(/\+ Agregar observaciones/i)).toBeDefined();
    });

    it('should show editor when clicked if collapsed', () => {
        render(<MarkdownEditor value="" onChange={() => {}} />);
        const button = screen.getByText(/\+ Agregar observaciones/i);
        fireEvent.click(button);
        expect(screen.getByPlaceholderText(/Escribe aquí/i)).toBeDefined();
    });

    it('should show value if provided even if initialCollapsed is true', () => {
        render(<MarkdownEditor value="Test value" onChange={() => {}} initialCollapsed={true} />);
        expect(screen.getByDisplayValue('Test value')).toBeDefined();
    });

    it('should call onChange when typing', () => {
        const onChange = vi.fn();
        render(<MarkdownEditor value="" onChange={onChange} initialCollapsed={false} />);
        const textarea = screen.getByPlaceholderText(/Escribe aquí/i);
        fireEvent.change(textarea, { target: { value: 'New text' } });
        expect(onChange).toHaveBeenCalledWith('New text');
    });

    it('should toggle preview mode', () => {
        render(<MarkdownEditor value="**Bold**" onChange={() => {}} initialCollapsed={false} />);
        const toggleButton = screen.getByText(/Vista Previa/i);
        fireEvent.click(toggleButton);
        expect(screen.getByText(/Editar/i)).toBeDefined();
        // Since react-markdown uses actual rendering, we expect to see something related to the content
        // In a real JSDOM environment we could check for <strong>Bold</strong>
    });
});
