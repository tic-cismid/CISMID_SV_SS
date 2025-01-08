from pymongo import MongoClient  # https://www.mongodb.com/docs/languages/python/pymongo-driver/current/
import urllib.parse
import pprint
import os
import pandas as pd
from datetime import datetime, timedelta



CISMID_MONGO_PASSWORD = os.getenv('CISMID_MONGO_PASSWORD')

username = urllib.parse.quote_plus('cismid')
password = urllib.parse.quote_plus(CISMID_MONGO_PASSWORD)
client = MongoClient('mongodb://%s:%s@127.0.0.1' % (username, password))

# # blog is the database
db = client['cismidsv']
utc_datetime = datetime.fromisoformat('2024-12-03T18:44:01Z') + timedelta(hours=5)

df = pd.read_csv('/home/logan/final_df_360_chorrillos.csv', delimiter=',')

for index, row in df.iterrows():
    tstamp, pos_lat, pos_long, d, img = row['timestamp'], row['position_lat'], row['position_long'], row['distance'], row['img']

    local_datetime = tstamp.replace(' ', 'T') + 'Z'
    utc_datetime = datetime.fromisoformat(local_datetime) + timedelta(hours=5)

    coords = [pos_long, pos_lat]  # GeoJSON format: first Longitude, then Latitude

    db.picture360.insert_one({
        "ISODate": utc_datetime,                # Date in UTC-0
        "loc": {                                # Location
            "type": "Point",                    #        GeoJSON point
            "coordinates": coords               #        Coordinates: Longitude, Latitude
                },
        "distance": d,                          # Distance to the next picture
        "img": img                              # Relative path (name) of the picture
        })