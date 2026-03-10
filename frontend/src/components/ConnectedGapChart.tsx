/**
 * ConnectedGapChart — Context-connected gap chart.
 *
 * Consumes replay state (currentLap) and dashboard data (gap chart data)
 * from the ReplayContext. When the replay timer advances to a new lap,
 * the context emits the updated currentLap which triggers this component
 * to re-render with the new visibleLap, filtering the gap chart to show
 * only data up to the current replay position.
 *
 * This component bridges the ReplayContext with the presentational
 * GapChart component, keeping the presentation layer pure and testable.
 */

import React from 'react';
import { useReplayContext } from '../contexts/ReplayContext';
import GapChart from './GapChart';

interface ConnectedGapChartProps {
  /** Total laps (used for chart x-axis range). */
  totalLaps: number;
}

/**
 * Reads gapData and currentLap from the ReplayContext and passes them
 * to the presentational GapChart. Re-renders whenever the context emits
 * a new currentLap, causing the chart to reveal the next lap's data point.
 */
const ConnectedGapChart: React.FC<ConnectedGapChartProps> = ({ totalLaps }) => {
  const { replayState, dashboard } = useReplayContext();
  const { gapData } = dashboard;

  if (!gapData) return null;

  return (
    <GapChart
      data={gapData}
      visibleLap={replayState.currentLap > 0 ? replayState.currentLap : undefined}
      totalLaps={totalLaps}
    />
  );
};

export default ConnectedGapChart;
