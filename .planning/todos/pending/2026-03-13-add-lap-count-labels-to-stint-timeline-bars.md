---
created: 2026-03-13T23:25:32.459Z
title: Add lap count labels to stint timeline bars
area: ui
files:
  - frontend/src/components/StintTimeline/StintTimeline.tsx
  - frontend/src/components/StintTimeline/useStintData.ts
---

## Problem

The stint timeline chart currently shows compound letter labels (S/M/H) on each bar, but there's no indication of how many laps each stint lasted. Users need to see stint duration at a glance to quickly assess strategy without hovering over individual bars.

## Solution

Add lap count numbering to each stint bar in the StintTimeline visualization. Could display as a small number alongside or below the compound letter (e.g. "M 12" or "S\n8"), or as a secondary label. Should be readable without interaction — the goal is at-a-glance stint length comparison across drivers.
