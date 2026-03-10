/**
 * Global mock for react-plotly.js — used automatically by Jest
 * when any module imports 'react-plotly.js'.
 */
import React from 'react';

const MockPlot: React.FC<any> = (props) => (
  <div data-testid="plotly-chart" data-traces={JSON.stringify(props.data)} />
);

MockPlot.displayName = 'MockPlot';

export default MockPlot;
