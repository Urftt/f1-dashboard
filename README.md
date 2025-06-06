# F1 Interval Dashboard 🏎️

A real-time dashboard for tracking intervals between F1 drivers during races. Built with Streamlit and the OpenF1 API.

## Features

- **Live Tracking**: Monitor real-time intervals between any two drivers during races
- **Historical Analysis**: Analyze past races to understand gap evolution
- **Session Recording**: Record live sessions for later playback and analysis
- **Visual Analytics**: Interactive plots showing gap trends, closing rates, and race events
- **Event Detection**: Automatic detection of pit stops and other race events

## Installation

### Using uv (Recommended)

```bash
# Clone the repository
git clone <your-repo-url>
cd f1-interval-dashboard

# Create virtual environment with uv
uv venv

# Activate the environment
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
uv pip install -r requirements.txt
```

### Using pip

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

## Usage

### Running the Dashboard

```bash
streamlit run app.py
```

The dashboard will open in your browser at `http://localhost:8501`.

### Testing Without a Live Race

1. **Historical Mode**: 
   - Select "Historical Session" in the sidebar
   - Click "Refresh Sessions" to load recent races
   - Select a race and click "Load Session"
   - Choose two drivers and click "Start"

2. **Recording Mode**:
   - During any practice/qualifying/race session, use "Live Session" mode
   - Track intervals and click "Save Recording"
   - Later, use "Recorded Session" mode to replay

### During a Live Race

1. Select "Live Session" in the sidebar
2. Click "Check Live Session" to find the current session
3. Click "Connect to Live Session"
4. Select two drivers to compare
5. Click "Start" to begin tracking

## Project Structure

```
f1-interval-dashboard/
├── app.py                 # Main Streamlit application
├── data_fetcher.py       # OpenF1 API interface
├── data_processor.py     # Interval calculations and analysis
├── config.py            # Configuration settings
├── requirements.txt     # Python dependencies
├── pyproject.toml       # Project metadata (for uv)
├── README.md            # This file
├── .gitignore          # Git ignore file
├── .env                # Environment variables (create this)
└── recorded_sessions/   # Stored session recordings
```

## Configuration

Edit `config.py` to customize:
- Update intervals
- Plot appearance
- API settings
- Driver colors

## Development

### VS Code Setup

1. Install Python extension
2. Select the virtual environment interpreter
3. Install recommended extensions:
   - Python
   - Pylance
   - GitLens

### Running Tests

```bash
# Run with debug mode
DEBUG=true streamlit run app.py
```

## API Reference

The project uses the [OpenF1 API](https://openf1.org/):
- Free to use
- No authentication required
- Real-time data during sessions
- Historical data available

## Troubleshooting

### No Live Data
- Check if there's an active F1 session
- OpenF1 only provides data during race weekends
- Use historical or recorded sessions for testing

### Connection Errors
- Check internet connection
- Verify OpenF1 API is accessible
- Check for any firewall restrictions

### Performance Issues
- Reduce update interval in config.py
- Limit the amount of historical data loaded
- Close other Streamlit tabs

## Future Enhancements

- [ ] Multiple driver comparisons
- [ ] Lap time analysis
- [ ] Tire strategy visualization
- [ ] Team radio integration
- [ ] Race prediction models
- [ ] Export functionality

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - feel free to use and modify!

## Acknowledgments

- OpenF1 for providing the API
- Streamlit for the amazing framework
- The F1 community for inspiration

---

Made with ❤️ by an F1 fan who wanted better race insights!