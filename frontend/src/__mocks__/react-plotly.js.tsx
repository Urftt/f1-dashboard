/**
 * Mock for react-plotly.js to avoid WebGL/mapbox issues in Jest.
 */
import React from 'react';

const MockPlot: React.FC<any> = (props) => (
  <div data-testid="mock-plotly-chart" />
);

export default MockPlot;
