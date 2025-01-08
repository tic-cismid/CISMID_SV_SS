// module.js

// We define a global function that receives the panoramas object
// from index.html. This is called ONLY once in the browser.
window.initMarzipano = function (panoramas) {
  // ----------------------------------------------------------
  // 1) Initialize the Marzipano Viewer
  // ----------------------------------------------------------
  var panoElement = document.getElementById('pano');
  var viewerOpts = {
    controls: {
      mouseViewMode: 'drag' // drag|qtvr
    }
  };
  var viewer = new Marzipano.Viewer(panoElement, viewerOpts);

  // Compass setup
  var compassArrow = document.getElementById('compass-arrow2');

  // Create geometry
  var geometry = new Marzipano.CubeGeometry([
    { tileSize: 512, size: 4096 },
    { tileSize: 512, size: 2048 },
    { tileSize: 512, size: 1024 },
    { tileSize: 512, size: 512 }
  ]);

  // Limit field of view, etc.
  var limiter = Marzipano.RectilinearView.limit.traditional(8192, 120 * Math.PI / 180);
  var initialView = {
    yaw: -180 * Math.PI / 180,
    pitch: -20 * Math.PI / 180,
    fov: 90 * Math.PI / 180
  };

  // ----------------------------------------------------------
  // 2) Initialize the Leaflet map (only once)
  // ----------------------------------------------------------
  var map = L.map('map').setView([-12.0455, -77.0311], 17);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19
  }).addTo(map);

  var currentMarker = L.marker([-12.0455, -77.0311]).addTo(map);
  var otherPanoramaMarkers = [];

  // ----------------------------------------------------------
  // 3) Define the loadScene function
  // ----------------------------------------------------------
  function loadScene(panoramaKey) {
    console.log("Loading scene with key:", panoramaKey);
    var panorama = panoramas[panoramaKey];
    if (!panorama) {
      console.warn("No panorama data found for key:", panoramaKey);
      return;
    }
    // Create Marzipano scene
    var source = Marzipano.ImageUrlSource.fromString(panorama.url);
    var view = new Marzipano.RectilinearView(initialView, limiter);

    var scene = viewer.createScene({
      source: source,
      geometry: geometry,
      view: view,
      pinFirstLevel: true
    });

    // Add hotspots
    panorama.hotspots.forEach(function (hotspot) {
      var element = document.createElement("div");
      element.className = "hotspot";
      element.addEventListener("click", function () {
        loadScene(hotspot.target);
      });
      scene.hotspotContainer().createHotspot(element, {
        yaw: hotspot.yaw,
        pitch: hotspot.pitch
      });
    });

    // Compass handling
    function updateCompass() {
      var yaw = view.yaw();
      var rotation = -yaw * (180 / Math.PI);
      compassArrow.style.transform = "rotate(" + rotation + "deg)";
    }

    scene.switchTo();
    updateCompass();
    view.addEventListener("change", updateCompass);

    // Update the current panorama marker + map view
    if (panorama.lat && panorama.lng) {
      currentMarker.setLatLng([panorama.lat, panorama.lng]);
      map.setView([panorama.lat, panorama.lng], 17, { animate: true });
    }

    // Remove old markers
    otherPanoramaMarkers.forEach(function (marker) {
      map.removeLayer(marker);
    });
    otherPanoramaMarkers = [];

    // Add circle markers for all other panoramas
    for (var key in panoramas) {
      if (key !== panoramaKey) {
        var p = panoramas[key];
        if (p.lat && p.lng) {
          var circleMarker = L.circleMarker([p.lat, p.lng], {
            radius: 5,
            color: 'blue',
            fillColor: 'blue',
            fillOpacity: 1.0
          }).addTo(map);

          // Switch panorama when this circle marker is clicked
          circleMarker.on('click', (function(k) {
            return function() {
              console.log("Switching to panorama key:", k);
              loadScene(k);
            };
          })(key));

          otherPanoramaMarkers.push(circleMarker);
        }
      }
    }
  }

  // ----------------------------------------------------------
  // 4) Automatically load a known panorama or the first one
  // ----------------------------------------------------------
  if (panoramas["V2001528"]) {
    loadScene("V2001528");
  } else {
    var keys = Object.keys(panoramas);
    if (keys.length > 0) {
      loadScene(keys[0]);
    }
  }

  // ----------------------------------------------------------
  // 5) Map Resizing Logic
  // ----------------------------------------------------------
  var mapElement = document.getElementById('map');
  var topHandleElement = document.getElementById('map-resize-handle-top');
  var leftHandleElement = document.getElementById('map-resize-handle-left');
  var topLeftHandleElement = document.getElementById('map-resize-handle-top-left');

  var isResizingTop = false;
  var isResizingLeft = false;
  var isResizingTopLeft = false;
  var startX, startY, startWidth, startHeight;

  topHandleElement.addEventListener('mousedown', startResizeTop, false);
  leftHandleElement.addEventListener('mousedown', startResizeLeft, false);
  topLeftHandleElement.addEventListener('mousedown', startResizeTopLeft, false);

  function startResizeTop(e) {
    e.preventDefault();
    isResizingTop = true;
    startY = e.clientY;
    startHeight = parseInt(document.defaultView.getComputedStyle(mapElement).height, 10);

    document.documentElement.addEventListener('mousemove', resizeMapTop, false);
    document.documentElement.addEventListener('mouseup', stopResizingTop, false);
  }

  function resizeMapTop(e) {
    if (!isResizingTop) return;
    var dy = e.clientY - startY;
    var newHeight = Math.max(100, startHeight - dy);
    mapElement.style.height = newHeight + 'px';
    map.invalidateSize();
  }

  function stopResizingTop(e) {
    isResizingTop = false;
    document.documentElement.removeEventListener('mousemove', resizeMapTop, false);
    document.documentElement.removeEventListener('mouseup', stopResizingTop, false);
  }

  function startResizeLeft(e) {
    e.preventDefault();
    isResizingLeft = true;
    startX = e.clientX;
    startWidth = parseInt(document.defaultView.getComputedStyle(mapElement).width, 10);

    document.documentElement.addEventListener('mousemove', resizeMapLeft, false);
    document.documentElement.addEventListener('mouseup', stopResizingLeft, false);
  }

  function resizeMapLeft(e) {
    if (!isResizingLeft) return;
    var dx = e.clientX - startX;
    var newWidth = Math.max(100, startWidth - dx);
    mapElement.style.width = newWidth + 'px';
    map.invalidateSize();
  }

  function stopResizingLeft(e) {
    isResizingLeft = false;
    document.documentElement.removeEventListener('mousemove', resizeMapLeft, false);
    document.documentElement.removeEventListener('mouseup', stopResizingLeft, false);
  }

  // Top-left corner handle
  function startResizeTopLeft(e) {
    e.preventDefault();
    isResizingTopLeft = true;
    startX = e.clientX;
    startY = e.clientY;
    startWidth = parseInt(document.defaultView.getComputedStyle(mapElement).width, 10);
    startHeight = parseInt(document.defaultView.getComputedStyle(mapElement).height, 10);

    document.documentElement.addEventListener('mousemove', resizeMapTopLeft, false);
    document.documentElement.addEventListener('mouseup', stopResizingTopLeft, false);
  }

  function resizeMapTopLeft(e) {
    if (!isResizingTopLeft) return;
    var dx = e.clientX - startX;
    var dy = e.clientY - startY;

    var newWidth = Math.max(100, startWidth - dx);
    var newHeight = Math.max(100, startHeight - dy);

    mapElement.style.width = newWidth + 'px';
    mapElement.style.height = newHeight + 'px';
    map.invalidateSize();
  }

  function stopResizingTopLeft(e) {
    isResizingTopLeft = false;
    document.documentElement.removeEventListener('mousemove', resizeMapTopLeft, false);
    document.documentElement.removeEventListener('mouseup', stopResizingTopLeft, false);
  }
};