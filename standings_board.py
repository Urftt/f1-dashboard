"""
F1 TV-style standings board component for the Streamlit dashboard.

Renders a full race standings table with positions, gaps, tire info,
pit stop counts, and fastest lap indicator. Designed to reactively
update as the replay progresses lap by lap.
"""

from __future__ import annotations

import pandas as pd
import streamlit as st

# ---------------------------------------------------------------------------
# Tire compound styling
# ---------------------------------------------------------------------------

_TIRE_COLORS: dict[str, str] = {
    "SOFT": "#FF3333",
    "MEDIUM": "#FFD700",
    "HARD": "#CCCCCC",
    "INTERMEDIATE": "#39B54A",
    "WET": "#0072CE",
}

_TIRE_SHORT: dict[str, str] = {
    "SOFT": "S",
    "MEDIUM": "M",
    "HARD": "H",
    "INTERMEDIATE": "I",
    "WET": "W",
}


def _tire_badge(compound: str, age: int) -> str:
    """Return an HTML badge for the tire compound and age."""
    compound_upper = compound.upper() if compound else ""
    color = _TIRE_COLORS.get(compound_upper, "#888888")
    label = _TIRE_SHORT.get(compound_upper, compound[:1].upper() if compound else "?")
    return (
        f'<span style="display:inline-block; background:{color}; color:#fff; '
        f'font-weight:700; border-radius:4px; padding:1px 6px; font-size:0.85em; '
        f'margin-right:3px;">{label}</span>'
        f'<span style="font-size:0.8em; color:#aaa;">{age}L</span>'
    )


def _fastest_lap_icon(has_fastest: bool) -> str:
    """Return a purple dot indicator for fastest lap."""
    if not has_fastest:
        return ""
    return (
        '<span style="display:inline-block; background:#A020F0; '
        'border-radius:50%; width:10px; height:10px; margin-left:4px;" '
        'title="Fastest Lap"></span>'
    )


def _team_color_bar(team_color: str) -> str:
    """Return a small colored bar for the team."""
    hex_color = f"#{team_color}" if not team_color.startswith("#") else team_color
    return (
        f'<span style="display:inline-block; width:4px; height:18px; '
        f'background:{hex_color}; border-radius:2px; margin-right:6px; '
        f'vertical-align:middle;"></span>'
    )


# ---------------------------------------------------------------------------
# Main render function
# ---------------------------------------------------------------------------


def render_standings_board(
    standings_df: pd.DataFrame,
    current_lap: int,
    total_laps: int,
    *,
    container: st.delta_generator.DeltaGenerator | None = None,
) -> None:
    """Render the F1 TV-style standings board.

    Parameters
    ----------
    standings_df:
        DataFrame from ``FastF1Service.get_standings_at_lap()`` with columns:
        Position, Driver, DriverNumber, Team, TeamColor, GapToLeader,
        Interval, LastLapTime, TireCompound, TireAge, PitStops,
        HasFastestLap, LapNumber.
    current_lap:
        The current lap number being displayed.
    total_laps:
        Total number of laps in the session.
    container:
        Optional Streamlit container to render into. Defaults to ``st``.
    """
    target = container if container is not None else st

    if standings_df is None or standings_df.empty:
        target.info("No standings data available for this lap.")
        return

    # Header row
    target.markdown(
        f"**Lap {current_lap} / {total_laps}**",
    )

    # Build HTML table
    html = _build_standings_html(standings_df)
    target.markdown(html, unsafe_allow_html=True)


def _build_standings_html(df: pd.DataFrame) -> str:
    """Build an HTML table mimicking the F1 TV standings board."""
    # CSS styles
    styles = """
    <style>
    .standings-table {
        width: 100%;
        border-collapse: collapse;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        font-size: 0.92em;
        background: #1a1a2e;
        color: #e0e0e0;
        border-radius: 8px;
        overflow: hidden;
    }
    .standings-table th {
        background: #16213e;
        color: #8892b0;
        font-weight: 600;
        text-transform: uppercase;
        font-size: 0.75em;
        letter-spacing: 0.05em;
        padding: 8px 10px;
        text-align: left;
        border-bottom: 2px solid #0f3460;
    }
    .standings-table td {
        padding: 6px 10px;
        border-bottom: 1px solid #16213e;
        vertical-align: middle;
    }
    .standings-table tr:hover {
        background: #16213e;
    }
    .standings-table tr.fastest-lap {
        /* subtle purple left border for fastest lap holder */
    }
    .pos-cell {
        font-weight: 700;
        font-size: 1.05em;
        width: 32px;
        text-align: center;
    }
    .driver-cell {
        font-weight: 600;
        white-space: nowrap;
    }
    .driver-num {
        color: #666;
        font-size: 0.8em;
        margin-right: 4px;
    }
    .team-cell {
        color: #8892b0;
        font-size: 0.85em;
    }
    .gap-cell {
        font-variant-numeric: tabular-nums;
        font-size: 0.9em;
    }
    .interval-cell {
        font-variant-numeric: tabular-nums;
        font-size: 0.9em;
        color: #aaa;
    }
    .laptime-cell {
        font-variant-numeric: tabular-nums;
        font-size: 0.9em;
    }
    .pit-cell {
        text-align: center;
        font-size: 0.9em;
    }
    .leader-gap {
        color: #e0e0e0;
        font-weight: 600;
    }
    </style>
    """

    # Table header
    header = """
    <table class="standings-table">
    <thead>
        <tr>
            <th style="text-align:center;">P</th>
            <th></th>
            <th>Driver</th>
            <th>Team</th>
            <th>Gap</th>
            <th>Int</th>
            <th>Last Lap</th>
            <th>Tire</th>
            <th style="text-align:center;">Pit</th>
        </tr>
    </thead>
    <tbody>
    """

    rows_html: list[str] = []
    for _, row in df.iterrows():
        pos = row.get("Position", 0)
        driver = row.get("Driver", "")
        driver_num = row.get("DriverNumber", "")
        team = row.get("Team", "")
        team_color = row.get("TeamColor", "FFFFFF")
        gap = row.get("GapToLeader", "")
        interval = row.get("Interval", "")
        lap_time = row.get("LastLapTime", "")
        tire_compound = row.get("TireCompound", "")
        tire_age = row.get("TireAge", 0)
        pit_stops = row.get("PitStops", 0)
        has_fastest = row.get("HasFastestLap", False)

        # Row class
        row_class = "fastest-lap" if has_fastest else ""

        # Gap styling
        gap_class = "leader-gap" if gap == "LEADER" else ""
        gap_display = gap if gap != "LEADER" else "Leader"

        # Fastest lap icon next to lap time
        fl_icon = _fastest_lap_icon(has_fastest)

        # Lap time styling: purple if fastest
        lt_style = "color:#A020F0; font-weight:600;" if has_fastest else ""

        # Team color bar
        color_bar = _team_color_bar(team_color)

        # Tire badge
        tire_html = _tire_badge(tire_compound, tire_age) if tire_compound else ""

        row_html = f"""
        <tr class="{row_class}">
            <td class="pos-cell">{pos}</td>
            <td style="width:4px; padding:0;">{color_bar}</td>
            <td class="driver-cell">
                <span class="driver-num">{driver_num}</span>{driver}
            </td>
            <td class="team-cell">{team}</td>
            <td class="gap-cell {gap_class}">{gap_display}</td>
            <td class="interval-cell">{interval}</td>
            <td class="laptime-cell" style="{lt_style}">{lap_time}{fl_icon}</td>
            <td>{tire_html}</td>
            <td class="pit-cell">{pit_stops}</td>
        </tr>
        """
        rows_html.append(row_html)

    footer = """
    </tbody>
    </table>
    """

    return styles + header + "\n".join(rows_html) + footer
