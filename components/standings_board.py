"""
StandingsBoard component — F1 TV-style race standings table.

Renders a styled standings board showing position, driver name, team,
gap to leader, interval to car ahead, and last lap time for all drivers.
Styled to match the dark F1 TV broadcast aesthetic.
"""

from __future__ import annotations

from typing import Optional

import pandas as pd
import streamlit as st

from fastf1_service import DriverInfo

# ---------------------------------------------------------------------------
# F1 TV colour palette
# ---------------------------------------------------------------------------
_BG_DARK = "#15151E"        # Main background
_BG_ROW_EVEN = "#1E1E2E"   # Even row
_BG_ROW_ODD = "#15151E"    # Odd row
_BG_HEADER = "#E10600"     # F1 red header
_TEXT_PRIMARY = "#FFFFFF"
_TEXT_SECONDARY = "#A0A0A0"
_TEXT_LEADER = "#FFFFFF"
_BORDER_COLOR = "#2D2D3D"
_POSITION_BG = "#2D2D3D"   # Position number background
_FASTEST_LAP = "#A855F7"   # Purple for fastest lap


def _team_color_css(hex_color: str) -> str:
    """Return a CSS colour string from a hex code (with or without '#')."""
    hex_color = hex_color.strip().lstrip("#")
    if len(hex_color) != 6:
        hex_color = "FFFFFF"
    return f"#{hex_color}"


def _format_position(pos: int) -> str:
    """Format position with leading zero styling."""
    return str(pos)


def render_standings_board(
    standings_df: pd.DataFrame,
    drivers: dict[str, DriverInfo] | None = None,
    *,
    current_lap: int = 0,
    total_laps: int = 0,
    fastest_lap_driver: str | None = None,
    title: str = "RACE STANDINGS",
    compact: bool = False,
) -> None:
    """Render an F1 TV-style standings board inside the current Streamlit container.

    Parameters
    ----------
    standings_df:
        DataFrame with columns: Position, Driver, Team, GapToLeader,
        Interval, LastLapTime, LapNumber.  Usually obtained from
        ``FastF1Service.get_standings_at_lap()``.
    drivers:
        Mapping of driver abbreviation → DriverInfo for team colour bars.
    current_lap:
        Current lap number (for header display).
    total_laps:
        Total race laps (for header display).
    fastest_lap_driver:
        Abbreviation of the driver with the fastest lap (shown in purple).
    title:
        Header title string.
    compact:
        If True, hide some columns to save space.
    """
    if standings_df is None or standings_df.empty:
        st.info("No standings data available.")
        return

    # --- Inject scoped CSS ---------------------------------------------------
    _inject_styles()

    # --- Header bar ----------------------------------------------------------
    lap_display = ""
    if total_laps > 0:
        lap_display = f"LAP {current_lap}/{total_laps}"
    elif current_lap > 0:
        lap_display = f"LAP {current_lap}"

    header_html = f"""
    <div class="f1-standings-header">
        <span class="f1-standings-title">{title}</span>
        <span class="f1-standings-lap">{lap_display}</span>
    </div>
    """

    # --- Table rows ----------------------------------------------------------
    rows_html = ""
    for idx, row in standings_df.iterrows():
        pos = int(row.get("Position", idx + 1)) if pd.notna(row.get("Position")) else idx + 1
        driver_abbr = str(row.get("Driver", "---"))
        team = str(row.get("Team", ""))
        gap = str(row.get("GapToLeader", ""))
        interval = str(row.get("Interval", ""))
        last_lap = str(row.get("LastLapTime", ""))

        # Team colour bar
        team_color = "#FFFFFF"
        driver_full_name = driver_abbr
        if drivers and driver_abbr in drivers:
            info = drivers[driver_abbr]
            team_color = _team_color_css(info.team_color)
            driver_full_name = info.full_name or driver_abbr

        # Row background
        row_bg = _BG_ROW_EVEN if pos % 2 == 0 else _BG_ROW_ODD

        # Fastest lap highlight
        is_fastest = fastest_lap_driver and driver_abbr == fastest_lap_driver
        lap_time_class = "f1-fastest-lap" if is_fastest else "f1-lap-time"

        # Leader row gets special styling
        gap_display = gap if gap else ""
        interval_display = interval if interval else ""
        is_leader = gap == "LEADER"

        if compact:
            rows_html += f"""
            <div class="f1-standings-row" style="background-color: {row_bg};">
                <div class="f1-pos">{_format_position(pos)}</div>
                <div class="f1-team-bar" style="background-color: {team_color};"></div>
                <div class="f1-driver-name">{driver_abbr}</div>
                <div class="f1-interval {'f1-leader' if is_leader else ''}">{gap_display}</div>
            </div>
            """
        else:
            rows_html += f"""
            <div class="f1-standings-row" style="background-color: {row_bg};">
                <div class="f1-pos">{_format_position(pos)}</div>
                <div class="f1-team-bar" style="background-color: {team_color};"></div>
                <div class="f1-driver-name" title="{driver_full_name}">{driver_abbr}</div>
                <div class="f1-team-name">{team}</div>
                <div class="f1-interval {'f1-leader' if is_leader else ''}">{interval_display}</div>
                <div class="f1-gap">{gap_display}</div>
                <div class="{lap_time_class}">{last_lap}</div>
            </div>
            """

    # --- Assemble & render ---------------------------------------------------
    full_html = f"""
    <div class="f1-standings-board">
        {header_html}
        <div class="f1-standings-body">
            {rows_html}
        </div>
    </div>
    """
    st.html(full_html)


# ---------------------------------------------------------------------------
# Internal: CSS injection (called once per render)
# ---------------------------------------------------------------------------

def _inject_styles() -> None:
    """Inject the F1 TV-themed CSS styles."""
    css = f"""
    <style>
    /* ---- F1 Standings Board ---- */
    .f1-standings-board {{
        font-family: 'Formula1', 'Titillium Web', 'Arial Narrow', Arial, sans-serif;
        background-color: {_BG_DARK};
        border-radius: 8px;
        overflow: hidden;
        border: 1px solid {_BORDER_COLOR};
        max-width: 720px;
    }}

    .f1-standings-header {{
        background-color: {_BG_HEADER};
        padding: 10px 16px;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }}

    .f1-standings-title {{
        color: {_TEXT_PRIMARY};
        font-size: 14px;
        font-weight: 700;
        letter-spacing: 1.5px;
        text-transform: uppercase;
    }}

    .f1-standings-lap {{
        color: {_TEXT_PRIMARY};
        font-size: 13px;
        font-weight: 600;
        letter-spacing: 0.5px;
    }}

    .f1-standings-body {{
        padding: 0;
    }}

    .f1-standings-row {{
        display: flex;
        align-items: center;
        padding: 6px 12px;
        border-bottom: 1px solid {_BORDER_COLOR};
        transition: background-color 0.15s ease;
        min-height: 36px;
    }}

    .f1-standings-row:hover {{
        background-color: #2A2A3A !important;
    }}

    .f1-pos {{
        color: {_TEXT_PRIMARY};
        font-size: 15px;
        font-weight: 700;
        width: 28px;
        text-align: center;
        flex-shrink: 0;
    }}

    .f1-team-bar {{
        width: 4px;
        height: 22px;
        border-radius: 2px;
        margin: 0 10px;
        flex-shrink: 0;
    }}

    .f1-driver-name {{
        color: {_TEXT_PRIMARY};
        font-size: 14px;
        font-weight: 600;
        width: 52px;
        flex-shrink: 0;
        letter-spacing: 0.5px;
    }}

    .f1-team-name {{
        color: {_TEXT_SECONDARY};
        font-size: 12px;
        width: 120px;
        flex-shrink: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }}

    .f1-interval {{
        color: {_TEXT_SECONDARY};
        font-size: 13px;
        font-weight: 500;
        width: 90px;
        text-align: right;
        flex-shrink: 0;
        font-variant-numeric: tabular-nums;
    }}

    .f1-gap {{
        color: {_TEXT_SECONDARY};
        font-size: 12px;
        width: 100px;
        text-align: right;
        flex-shrink: 0;
        font-variant-numeric: tabular-nums;
    }}

    .f1-leader {{
        color: {_TEXT_LEADER};
        font-weight: 700;
    }}

    .f1-lap-time {{
        color: {_TEXT_SECONDARY};
        font-size: 12px;
        width: 90px;
        text-align: right;
        flex-shrink: 0;
        font-variant-numeric: tabular-nums;
        margin-left: auto;
    }}

    .f1-fastest-lap {{
        color: {_FASTEST_LAP};
        font-size: 12px;
        font-weight: 700;
        width: 90px;
        text-align: right;
        flex-shrink: 0;
        font-variant-numeric: tabular-nums;
        margin-left: auto;
    }}
    </style>
    """
    st.html(css)
