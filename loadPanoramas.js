// loadPanoramas_sergio.js

// CHANGED: we now add all the code needed to compute neighbors and bearings.
const fs = require('fs');
const path = require('path');
const Papa = require('papaparse'); // Or any CSV parse library

// NEW: A small helper to compute approximate distance (in meters) between two lat/lng points.
// (Haversine formula)
function distanceInMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // radius of Earth in meters
  const rad = Math.PI / 180;
  const phi1 = lat1 * rad;
  const phi2 = lat2 * rad;
  const dPhi = (lat2 - lat1) * rad;
  const dLambda = (lon2 - lon1) * rad;

  const a = Math.sin(dPhi / 2) * Math.sin(dPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(dLambda / 2) * Math.sin(dLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // distance in meters
}

// NEW: Bearing from one lat/lng to another, in radians
// By convention: 0 = North, π/2 = East, etc. We'll adjust for Marzipano below.
function bearingToRadians(lat1, lon1, lat2, lon2) {
  const rad = Math.PI / 180;
  const phi1 = lat1 * rad;
  const phi2 = lat2 * rad;
  const lambda1 = lon1 * rad;
  const lambda2 = lon2 * rad;

  const y = Math.sin(lambda2 - lambda1) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) -
            Math.sin(phi1) * Math.cos(phi2) * Math.cos(lambda2 - lambda1);

  return Math.atan2(y, x); // Range: -π to +π
}

// NEW: computeNeighbors. Given an array of points (each has name, lat, lng), 
// returns an object like: { "V2001528": ["V2001533", "V2001536"], ... }
function computeNeighbors(points, radius = 80) {
  // radius in meters for "closeness"
  const neighborsMap = {};

  for (let i = 0; i < points.length; i++) {
    const panoA = points[i];
    neighborsMap[panoA.name] = [];

    for (let j = 0; j < points.length; j++) {
      if (i === j) continue;
      const panoB = points[j];

      const dist = distanceInMeters(panoA.lat, panoA.lng, panoB.lat, panoB.lng);
      if (dist <= radius) {
        neighborsMap[panoA.name].push(panoB.name);
      }
    }
  }
  return neighborsMap;
}

function loadPanoramas() {
  // 1) Read and parse the CSV
  const csvPath = path.join(__dirname, 'data_base_filtered.csv');
  const csvFile = fs.readFileSync(csvPath, 'utf8');
  const parsed = Papa.parse(csvFile, { header: true }).data;

  // 2) Build a points array from CSV, so each entry is { name, lat, lng }.
  //    We'll also keep a quick "infoMap" so we can store more details if needed.
  const points = [];
  const infoMap = {};  // Map from name to { lat, lng }

  parsed.forEach(row => {
    const imageName = row['name image']?.trim(); // "name image" from your CSV
    if (imageName) {
      const lat = parseFloat(row['coordinates Lat']);
      const lng = parseFloat(row['coordinates Long']);
      if (!isNaN(lat) && !isNaN(lng)) {
        points.push({ name: imageName, lat, lng });
        infoMap[imageName] = { lat, lng };
      }
    }
  });

  // 3) Scan the `assets` folder for subfolders as before
  const assetsDir = path.join(__dirname, 'assets');
  const subfolders = fs.readdirSync(assetsDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

  // NEW: compute the "neighbors" once we have our points array
  const neighborsMap = computeNeighbors(points, 30); // distance threshold, e.g. 30m

  // 4) Build up the panoramas object
  //    Instead of predefining hotspots, we'll compute them dynamically.
  const panoramas = {};

  subfolders.forEach(subfolder => {
    // If subfolder is in infoMap, we have lat/lng
    if (infoMap[subfolder]) {
      const { lat, lng } = infoMap[subfolder];

      panoramas[subfolder] = {
        url: `./assets/${subfolder}/{z}/{f}/{y}_{x}.jpg`,
        lat,
        lng,
        hotspots: []
      };
    }
  });

  // NEW: Now we generate hotspots for each subfolder 
  // by looking at neighborsMap[subfolder].
  for (const currentName of Object.keys(panoramas)) {
    // e.g. "V2001528"
    const currentLat = panoramas[currentName].lat;
    const currentLng = panoramas[currentName].lng;
    const neighborNames = neighborsMap[currentName] || [];

    neighborNames.forEach(nbName => {
      if (!panoramas[nbName]) {
        // If we don't have that subfolder in 'panoramas', skip it
        return;
      }
      const nbLat = panoramas[nbName].lat;
      const nbLng = panoramas[nbName].lng;

      // Bearing from current to neighbor
      const bearing = bearingToRadians(currentLat, currentLng, nbLat, nbLng);

      // SHIFT bearing so that 0 in Marzipano might match 'north' or your chosen heading.
      // For example, if you want 0 in Marzipano to be "south", you might do -Math.PI, etc.
      // Let's do a simple shift that sets north to yaw = -Math.PI:
      const yaw_for_marzipano = bearing - Math.PI;

      // Keep pitch at 0 if everything is flat
      const pitch_for_marzipano = 0;

      // Push a new hotspot
      panoramas[currentName].hotspots.push({
        yaw: yaw_for_marzipano,
        pitch: pitch_for_marzipano,
        target: nbName
      });
    });
  }

  return panoramas;
}

module.exports = { loadPanoramas };
