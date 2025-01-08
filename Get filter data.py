from pymongo import MongoClient
import os
import urllib.parse
import pandas as pd
from datetime import datetime, timedelta
import geopandas as gpd
from shapely.geometry import Point
import matplotlib.pyplot as plt
import contextily as ctx
from geopy.distance import geodesic

CISMID_MONGO_PASSWORD = os.getenv('CISMID_MONGO_PASSWORD')
username = urllib.parse.quote_plus('cismid')
password = urllib.parse.quote_plus(CISMID_MONGO_PASSWORD)
client = MongoClient('mongodb://%s:%s@172.20.60.94:27017' % (username, password))

db = client['cismidsv']

data = []
for doc in db.picture360.find():
    data.append(doc)

structured_data = {
    "ID": [entry['_id'] for entry in data],
    "Time": [entry['ISODate'] for entry in data],
    "coordinates Long": [entry['loc']['coordinates'][0] for entry in data],
    "coordinates Lat": [entry['loc']['coordinates'][1] for entry in data],
    "distance": [entry['distance'] for entry in data],
    "name image": [entry['img'] for entry in data],
}

df = pd.DataFrame(structured_data)
geometry = [Point(xy) for xy in zip(df["coordinates Long"], df["coordinates Lat"])]
gdf = gpd.GeoDataFrame(df, geometry=geometry)

gdf = gdf.set_crs("EPSG:4326").to_crs("EPSG:3857")
ax = gdf.plot(marker='o', color='blue', figsize=(10, 10), alpha=0.5)
ctx.add_basemap(ax, source=ctx.providers.OpenStreetMap.Mapnik)
plt.show()

df['Time'] = pd.to_datetime(df['Time'])
df = df.sort_values(by='Time').reset_index(drop=True)

def filter_points(df, radius=24):
    filtered = []
    for i, row in df.iterrows():
        current_point = (row['coordinates Lat'], row['coordinates Long'])
        if not filtered:
            filtered.append(row)
            continue
        too_close = False
        for accepted in filtered:
            accepted_point = (accepted['coordinates Lat'], accepted['coordinates Long'])
            if geodesic(current_point, accepted_point).meters < radius:
                too_close = True
                break
        if not too_close:
            filtered.append(row)
    return pd.DataFrame(filtered)

filtered_df = filter_points(df)

geometry_2 = [Point(xy) for xy in zip(filtered_df["coordinates Long"], filtered_df["coordinates Lat"])]
gdf_2 = gpd.GeoDataFrame(filtered_df, geometry=geometry_2)
gdf_2 = gdf_2.set_crs("EPSG:4326").to_crs("EPSG:3857")
ax_2 = gdf_2.plot(marker='o', color='blue', figsize=(10, 10), alpha=0.5)
ctx.add_basemap(ax_2, source=ctx.providers.OpenStreetMap.Mapnik)
plt.show()

filtered_df.to_csv("data_base_filtered.csv", index=False)