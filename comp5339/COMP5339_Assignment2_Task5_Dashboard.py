"""
COMP5339 Assignment 2 - Part B
Streamlit dashboard that subscribes to MQTT and shows a live facility map.

Run with:
    streamlit run COMP5339_Assignment2_Task5_Dashboard.py

If your broker/topic is different:
    streamlit run COMP5339_Assignment2_Task5_Dashboard.py -- --broker localhost --topic COMP5339/assignment2/power_emissions
"""

import argparse
import difflib
import hashlib
import json
import math
import re
import threading
import time
from pathlib import Path

import pandas as pd
import streamlit as st


BASE_DIR = Path(__file__).resolve().parent
PROCESSED_DIR = BASE_DIR / "outputs" / "processed"
CACHE_DIR = BASE_DIR / "outputs" / "cache"
FACILITY_CSV = PROCESSED_DIR / "consolidated_facility_power_emissions.csv"
ASSIGNMENT1_CSV = BASE_DIR / "assignment1" / "cer_augmented.csv"
DB_PATH = BASE_DIR / "assignment2_electricity.duckdb"
OE_FACILITIES_CACHE = CACHE_DIR / "openelectricity_facilities_nem.json"

DEFAULT_BROKER = "localhost"
DEFAULT_PORT = 1883
DEFAULT_TOPIC = "COMP5339/assignment2/power_emissions"


REGION_FALLBACK = {
    "NSW1": (-32.2, 147.0),
    "QLD1": (-22.5, 144.5),
    "VIC1": (-36.8, 144.6),
    "SA1": (-31.9, 136.6),
    "TAS1": (-42.0, 146.6),
}


class MessageStore:
    """Small thread-safe store for the latest MQTT message per facility."""

    def __init__(self):
        self.lock = threading.Lock()
        self.latest = {}
        self.message_count = 0
        self.last_market = {}

    def add_message(self, message):
        code = str(message.get("facility_code", "")).strip()
        if not code:
            return

        with self.lock:
            self.latest[code] = message
            self.message_count += 1
            if message.get("price_aud_per_mwh") is not None or message.get("demand_mw") is not None:
                self.last_market = {
                    "timestamp": message.get("timestamp"),
                    "price_aud_per_mwh": message.get("price_aud_per_mwh"),
                    "demand_mw": message.get("demand_mw"),
                }

    def clear(self):
        with self.lock:
            self.latest = {}
            self.message_count = 0
            self.last_market = {}

    def snapshot(self):
        with self.lock:
            rows = list(self.latest.values())
            message_count = self.message_count
            last_market = dict(self.last_market)
        return rows, message_count, last_market


@st.cache_resource
def get_store():
    return MessageStore()


def normalise_name(value):
    """Make names easier to match between Assignment 1 and OpenElectricity."""
    text = str(value).lower()
    text = re.sub(r"[^a-z0-9]+", " ", text)
    stop_words = {
        "power",
        "station",
        "farm",
        "solar",
        "wind",
        "battery",
        "pty",
        "ltd",
        "the",
        "and",
        "w",
        "sgu",
    }
    return " ".join(word for word in text.split() if word not in stop_words)


def fallback_location(region, facility_code):
    """Give a stable approximate point when Assignment 1 has no direct match."""
    lat, lon = REGION_FALLBACK.get(str(region), (-25.5, 134.0))

    # Spread facilities around the region centre so markers are not all stacked.
    digest = hashlib.md5(str(facility_code).encode("utf-8")).hexdigest()
    angle = int(digest[:4], 16) / 65535 * 2 * math.pi
    radius = 0.35 + (int(digest[4:8], 16) / 65535) * 1.2
    return lat + math.sin(angle) * radius, lon + math.cos(angle) * radius


def load_openelectricity_locations():
    """Read official facility coordinates from the cached OpenElectricity metadata."""
    columns = ["facility_code", "oe_facility_name", "oe_latitude", "oe_longitude"]
    if not OE_FACILITIES_CACHE.exists():
        return pd.DataFrame(columns=columns)

    try:
        payload = json.loads(OE_FACILITIES_CACHE.read_text(encoding="utf-8"))
    except Exception:
        return pd.DataFrame(columns=columns)

    facilities = payload.get("data", []) if isinstance(payload, dict) else payload
    rows = []
    for item in facilities:
        if not isinstance(item, dict):
            continue
        location = item.get("location") or {}
        lat = location.get("lat", location.get("latitude"))
        lon = location.get("lng", location.get("lon", location.get("longitude")))
        if lat is None or lon is None:
            continue
        rows.append(
            {
                "facility_code": str(item.get("code", "")).strip(),
                "oe_facility_name": str(item.get("name", "")).strip(),
                "oe_latitude": float(lat),
                "oe_longitude": float(lon),
            }
        )

    result = pd.DataFrame(rows, columns=columns)
    if not result.empty:
        result = result.drop_duplicates("facility_code")
    return result


@st.cache_data(show_spinner=False)
def load_location_table(facility_csv_path, assignment1_csv_path):
    """
    Build a facility location table.

    First choice: use the DuckDB table created in Task 4.
    Backup choice: rebuild the table from CSV files.
    """
    if DB_PATH.exists():
        try:
            import duckdb

            con = duckdb.connect(str(DB_PATH), read_only=True)
            locations = con.execute("SELECT * FROM facility_locations").fetchdf()
            con.close()
            return locations
        except Exception:
            pass

    facility_csv_path = Path(facility_csv_path)
    assignment1_csv_path = Path(assignment1_csv_path)

    facilities = pd.read_csv(
        facility_csv_path,
        usecols=["facility_code", "facility_name", "network_region", "fueltech"],
    ).drop_duplicates("facility_code")

    facilities["latitude"] = pd.NA
    facilities["longitude"] = pd.NA
    facilities["location_source"] = "region_fallback"
    facilities["assignment1_match_name"] = ""

    a1 = pd.DataFrame()
    if assignment1_csv_path.exists():
        a1 = pd.read_csv(
            assignment1_csv_path,
            usecols=["facility_name", "latitude", "longitude", "state", "fuel_source"],
        )
        a1 = a1.dropna(subset=["facility_name", "latitude", "longitude"])
        a1["match_key"] = a1["facility_name"].map(normalise_name)

    if not a1.empty:
        key_to_row = {}
        for _, row in a1.iterrows():
            key = row["match_key"]
            if key and key not in key_to_row:
                key_to_row[key] = row

        keys = list(key_to_row.keys())

        for idx, row in facilities.iterrows():
            key = normalise_name(row["facility_name"])
            match_row = None
            match_type = ""

            if key in key_to_row:
                match_row = key_to_row[key]
                match_type = "assignment1_exact"
            else:
                for a1_key in keys:
                    if len(key) >= 4 and len(a1_key) >= 4 and (key in a1_key or a1_key in key):
                        match_row = key_to_row[a1_key]
                        match_type = "assignment1_contains"
                        break

            if match_row is None and key:
                close = difflib.get_close_matches(key, keys, n=1, cutoff=0.82)
                if close:
                    match_row = key_to_row[close[0]]
                    match_type = "assignment1_fuzzy"

            if match_row is not None:
                facilities.loc[idx, "latitude"] = float(match_row["latitude"])
                facilities.loc[idx, "longitude"] = float(match_row["longitude"])
                facilities.loc[idx, "location_source"] = match_type
                facilities.loc[idx, "assignment1_match_name"] = str(match_row["facility_name"])

    # Staff Q&A allows OpenElectricity locations to enrich missing Assignment 1 locations.
    oe_locations = load_openelectricity_locations()
    if not oe_locations.empty:
        oe_by_code = oe_locations.set_index("facility_code").to_dict("index")
        for idx, row in facilities.iterrows():
            if pd.notna(row["latitude"]) and pd.notna(row["longitude"]):
                continue
            oe_row = oe_by_code.get(str(row["facility_code"]))
            if oe_row is None:
                continue
            facilities.loc[idx, "latitude"] = oe_row["oe_latitude"]
            facilities.loc[idx, "longitude"] = oe_row["oe_longitude"]
            facilities.loc[idx, "location_source"] = "openelectricity_metadata"
            facilities.loc[idx, "assignment1_match_name"] = oe_row["oe_facility_name"]

    for idx, row in facilities.iterrows():
        if pd.isna(row["latitude"]) or pd.isna(row["longitude"]):
            lat, lon = fallback_location(row["network_region"], row["facility_code"])
            facilities.loc[idx, "latitude"] = lat
            facilities.loc[idx, "longitude"] = lon

    facilities["latitude"] = pd.to_numeric(facilities["latitude"], errors="coerce")
    facilities["longitude"] = pd.to_numeric(facilities["longitude"], errors="coerce")
    return facilities


def parse_args():
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("--broker", default=DEFAULT_BROKER)
    parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    parser.add_argument("--topic", default=DEFAULT_TOPIC)
    parser.add_argument("--username", default=None)
    parser.add_argument("--password", default=None)
    parser.add_argument("--client-id", default="comp5339_assignment2_dashboard")
    args, _ = parser.parse_known_args()
    return args


def stop_client():
    client = st.session_state.get("mqtt_client")
    if client is not None:
        try:
            client.loop_stop()
            client.disconnect()
        except Exception:
            pass
    st.session_state["mqtt_client"] = None
    st.session_state["mqtt_key"] = None


def start_client_if_needed(store, broker, port, topic, username, password, client_id):
    """Start one background MQTT subscriber for the current Streamlit session."""
    mqtt_key = (broker, port, topic, username, client_id)
    if st.session_state.get("mqtt_key") == mqtt_key and st.session_state.get("mqtt_client") is not None:
        return

    stop_client()

    try:
        import paho.mqtt.client as mqtt
    except ModuleNotFoundError:
        st.error("Missing package: paho-mqtt. Install requirements.txt first.")
        st.stop()

    def on_connect(client, userdata, connect_flags, reason_code, properties):
        client.subscribe(topic, qos=1)

    def on_message(client, userdata, msg):
        try:
            decoded = msg.payload.decode("utf-8")
            message = json.loads(decoded)
            store.add_message(message)
        except Exception as exc:
            print("Bad MQTT message:", exc)

    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=client_id)
    if username:
        client.username_pw_set(username, password)

    client.on_connect = on_connect
    client.on_message = on_message
    try:
        # Async connect keeps the dashboard usable even if the broker is offline.
        client.connect_async(broker, port, keepalive=60)
        client.loop_start()
    except Exception as exc:
        st.warning(f"MQTT connection could not start: {exc}")
        return

    st.session_state["mqtt_client"] = client
    st.session_state["mqtt_key"] = mqtt_key


def add_demo_messages(store, max_rows=356):
    """Optional helper for checking the map without a running MQTT broker."""
    df = pd.read_csv(FACILITY_CSV)
    first_time = df["timestamp"].min()
    demo_df = df[df["timestamp"] == first_time].head(max_rows)
    locations = load_location_table(str(FACILITY_CSV), str(ASSIGNMENT1_CSV))
    location_cols = [
        "facility_code",
        "latitude",
        "longitude",
        "assignment1_match_name",
        "location_source",
    ]
    demo_df = demo_df.merge(locations[location_cols], on="facility_code", how="left")

    for i, row in demo_df.iterrows():
        store.add_message(
            {
                "timestamp": row["timestamp"],
                "facility_code": row["facility_code"],
                "facility_name": row["facility_name"],
                "network_region": row["network_region"],
                "fueltech": row["fueltech"],
                "power_mw": float(row["power_mw"]),
                "emissions_tonnes": float(row["emissions_tonnes"]),
                "latitude": row.get("latitude"),
                "longitude": row.get("longitude"),
                "assignment1_match_name": row.get("assignment1_match_name", ""),
                "location_source": row.get("location_source", ""),
                "price_aud_per_mwh": None,
                "demand_mw": None,
                "event_number": int(i),
            }
        )


def popup_html(row):
    price = row.get("price_aud_per_mwh")
    demand = row.get("demand_mw")

    market_html = ""
    if price is not None and not pd.isna(price):
        market_html += f"<br>Price: {float(price):.2f} AUD/MWh"
    if demand is not None and not pd.isna(demand):
        market_html += f"<br>Demand: {float(demand):.2f} MW"

    return f"""
    <b>{row['facility_name']}</b><br>
    Code: {row['facility_code']}<br>
    Type: {row['fueltech']}<br>
    Region: {row['network_region']}<br>
    Time: {row['timestamp']}<br>
    Power: {row['power_mw']:.3f} MW<br>
    Emissions: {row['emissions_tonnes']:.3f} tonnes<br>
    Location: {row['location_source']}{market_html}
    """


def make_map(folium, location):
    """Use the bundled Natural Earth states instead of requesting map tiles."""
    m = folium.Map(location=location, zoom_start=4, tiles=None, zoom_snap=0.5)
    m.get_root().header.add_child(folium.Element(
        f"<style>#{m.get_name()} {{ background: #dfe8e7; }}</style>"
    ))
    boundaries = json.loads((BASE_DIR / "australia-states.geojson").read_text(encoding="utf-8"))
    folium.GeoJson(
        boundaries,
        name="Natural Earth",
        interactive=False,
        style_function=lambda _: {
            "fillColor": "#f7f6ed",
            "fillOpacity": 1,
            "color": "#8b9c94",
            "weight": 1,
        },
    ).add_to(m)

    state_labels = {
        "WA": (-26.2, 121.0),
        "NT": (-20.1, 133.4),
        "SA": (-29.6, 135.8),
        "QLD": (-22.5, 143.4),
        "NSW": (-32.0, 145.3),
        "VIC": (-37.5, 142.9),
        "TAS": (-42.0, 146.2),
    }
    for label, point in state_labels.items():
        folium.Marker(
            point,
            icon=folium.DivIcon(
                icon_size=(30, 16),
                icon_anchor=(15, 8),
                html=f'<span style="font:600 11px sans-serif;letter-spacing:.08em;color:#52635b">{label}</span>',
            ),
            interactive=False,
            keyboard=False,
        ).add_to(m)
    return m


def draw_map(df, metric_col):
    try:
        import folium
        from streamlit_folium import st_folium
    except ModuleNotFoundError:
        st.error("Missing package: folium or streamlit-folium. Install requirements.txt first.")
        st.stop()

    if df.empty:
        m = make_map(folium, [-27.0, 135.0])
        st_folium(m, height=650, use_container_width=True, returned_objects=[])
        return

    centre_lat = df["latitude"].mean()
    centre_lon = df["longitude"].mean()
    m = make_map(folium, [centre_lat, centre_lon])

    max_metric = max(df[metric_col].abs().max(), 1)
    colour = "#1f77b4" if metric_col == "power_mw" else "#d62728"

    for _, row in df.iterrows():
        metric_value = abs(float(row[metric_col]))
        radius = 3 + min(metric_value / max_metric, 1) * 11

        folium.CircleMarker(
            location=[row["latitude"], row["longitude"]],
            radius=radius,
            color=colour,
            fill=True,
            fill_color=colour,
            fill_opacity=0.75,
            popup=folium.Popup(popup_html(row), max_width=350),
            tooltip=f"{row['facility_name']}: {row[metric_col]:.2f}",
        ).add_to(m)

    st_folium(m, height=650, use_container_width=True, returned_objects=[])


def main():
    args = parse_args()
    st.set_page_config(page_title="COMP5339 A2 Live Electricity Map", layout="wide")

    store = get_store()
    locations = load_location_table(str(FACILITY_CSV), str(ASSIGNMENT1_CSV))

    st.title("COMP5339 Assignment 2 Live Electricity Map")

    with st.sidebar:
        st.header("MQTT")
        broker = st.text_input("Broker", value=args.broker)
        port = st.number_input("Port", min_value=1, max_value=65535, value=args.port)
        topic = st.text_input("Topic", value=args.topic)
        username = st.text_input("Username", value=args.username or "")
        password = st.text_input("Password", value=args.password or "", type="password")
        connect_mqtt = st.checkbox("Connect to MQTT", value=True)
        refresh_seconds = st.slider("Refresh seconds", 1, 10, 2)
        auto_refresh = st.checkbox("Live refresh", value=True)

        if st.button("Clear current messages"):
            store.clear()

        if st.button("Load CSV demo snapshot"):
            add_demo_messages(store)

    if connect_mqtt:
        start_client_if_needed(
            store,
            broker,
            int(port),
            topic,
            username or None,
            password or None,
            args.client_id,
        )
    else:
        stop_client()

    rows, message_count, last_market = store.snapshot()
    live_df = pd.DataFrame(rows)

    if live_df.empty:
        merged = pd.DataFrame()
    else:
        for col in ["power_mw", "emissions_tonnes"]:
            live_df[col] = pd.to_numeric(live_df[col], errors="coerce").fillna(0)

        # Option 1 means MQTT messages should already include locations.
        # If an old/demo message has no coordinates, fill them from the Task 4 table.
        for col in ["latitude", "longitude"]:
            if col not in live_df.columns:
                live_df[col] = pd.NA
            live_df[col] = pd.to_numeric(live_df[col], errors="coerce")

        for col in ["assignment1_match_name", "location_source"]:
            if col not in live_df.columns:
                live_df[col] = ""
            live_df[col] = live_df[col].fillna("").astype(str)

        fallback_locations = locations[
            ["facility_code", "latitude", "longitude", "assignment1_match_name", "location_source"]
        ].rename(
            columns={
                "latitude": "fallback_latitude",
                "longitude": "fallback_longitude",
                "assignment1_match_name": "fallback_assignment1_match_name",
                "location_source": "fallback_location_source",
            }
        )

        merged = live_df.merge(fallback_locations, on="facility_code", how="left")
        merged["latitude"] = merged["latitude"].combine_first(merged["fallback_latitude"])
        merged["longitude"] = merged["longitude"].combine_first(merged["fallback_longitude"])
        merged["assignment1_match_name"] = merged["assignment1_match_name"].where(
            merged["assignment1_match_name"].astype(str).str.len() > 0,
            merged["fallback_assignment1_match_name"],
        )
        merged["location_source"] = merged["location_source"].where(
            merged["location_source"].astype(str).str.len() > 0,
            merged["fallback_location_source"],
        )
        merged = merged.drop(
            columns=[
                "fallback_latitude",
                "fallback_longitude",
                "fallback_assignment1_match_name",
                "fallback_location_source",
            ]
        )
        merged = merged.dropna(subset=["latitude", "longitude"])

    c1, c2, c3, c4 = st.columns(4)
    c1.metric("MQTT messages received", f"{message_count:,}")
    c2.metric("Facilities on map", f"{len(merged):,}")
    c3.metric("Current price", "-" if not last_market else last_market.get("price_aud_per_mwh"))
    c4.metric("Current demand MW", "-" if not last_market else last_market.get("demand_mw"))

    with st.sidebar:
        st.header("Map")
        metric_label = st.radio("Marker metric", ["Power output (MW)", "Emissions (tonnes)"])
        metric_col = "power_mw" if metric_label.startswith("Power") else "emissions_tonnes"

        if not merged.empty:
            regions = sorted(merged["network_region"].dropna().unique())
            selected_regions = st.multiselect("Network region", regions, default=regions)

            merged["fuel_label"] = merged["fueltech"].fillna("unknown").str.split(",").str[0].str.strip()
            fuel_labels = sorted(merged["fuel_label"].dropna().unique())
            selected_fuels = st.multiselect("Fuel technology", fuel_labels, default=fuel_labels)

            merged = merged[
                merged["network_region"].isin(selected_regions)
                & merged["fuel_label"].isin(selected_fuels)
            ]

    if merged.empty:
        st.info("Waiting for MQTT messages. Start the publisher, or click 'Load CSV demo snapshot' for a quick check.")
    else:
        latest_time = merged["timestamp"].max()
        st.caption(f"Latest event time shown: {latest_time}")

    draw_map(merged, metric_col if not merged.empty else "power_mw")

    if not merged.empty:
        st.subheader("Latest Facility Values")
        table_cols = [
            "timestamp",
            "facility_code",
            "facility_name",
            "network_region",
            "fueltech",
            "power_mw",
            "emissions_tonnes",
            "location_source",
        ]
        st.dataframe(
            merged[table_cols].sort_values("timestamp", ascending=False),
            use_container_width=True,
            hide_index=True,
        )

    if auto_refresh:
        time.sleep(refresh_seconds)
        st.rerun()


if __name__ == "__main__":
    main()
