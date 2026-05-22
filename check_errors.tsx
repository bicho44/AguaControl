import React from 'react';
import { renderToString } from 'react-dom/server';
import RutasView from './views/RutasView';

try {
  renderToString(
      <RutasView 
        clientes={[]}
        usuarios={[]}
        updateRutasMasivo={async () => {}}
        updateCliente={async () => {}}
      />
  );
  console.log("Success Render");
} catch (error) {
  console.error("Render Error:", error);
}
