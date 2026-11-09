# Replaying the Grid

The COMP5339 project collects five-minute power and emissions readings from Australia's National Electricity Market, joins them to facility locations in DuckDB, and sends the results in event order through MQTT. The Streamlit dashboard subscribes to the replay and uses Folium to map the latest reading per facility.

- [Retrieval, cleaning, integration and MQTT publisher](COMP5339_Assignment2_Tasks1_to_3.ipynb)
- [Original Streamlit and Folium dashboard](COMP5339_Assignment2_Task5_Dashboard.py)
- [Portfolio case study and exported map](https://mars-1010.github.io/replaying-the-grid.html#project-map)

The published notebook reads the API key from the environment and has its saved cell outputs cleared. Obtain your own [Open Electricity API key](https://platform.openelectricity.org.au/) for retrieval. Cached data and the local DuckDB database stay in the project environment. Open Electricity data is licensed separately under [CC BY-NC 4.0](https://platform.openelectricity.org.au/license).

## Run the application

1. From this directory, install the Python dependencies with `python -m pip install -r requirements.txt`. Install Mosquitto separately.
2. To reproduce the data, set `OPENELECTRICITY_API_KEY` and run the retrieval and DuckDB sections of the notebook. If you already have a prepared run, place its `outputs/` directory and `assignment2_electricity.duckdb` here. The notebook also accepts the Assignment 1 locations under `assignment1/` when available.
3. Start the local MQTT broker with `mosquitto -p 1883`. In a second terminal run `streamlit run COMP5339_Assignment2_Task5_Dashboard.py`.
4. Open the dashboard first, then run the notebook's MQTT section and enable `RUN_REAL_MQTT_PUBLISHER`. The dashboard shows the actual subscriber count, facility markers, filters, popups and latest values.

The full application requires a Python host, an MQTT broker and access to the prepared data. The portfolio embeds a single timestamp exported with the original Folium renderer.
