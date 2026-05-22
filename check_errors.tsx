import React from 'react';
import { renderToString } from 'react-dom/server';
import DashboardView from './views/DashboardView';

try {
  renderToString(
      <DashboardView 
        onOpenRemito={() => {}}
        onOpenVenta={() => {}}
        showAllWidgets={true}
        onWidgetToggle={() => {}}
      />
  );
  console.log("Success Render");
} catch (error) {
  console.error("Render Error:", error);
}
