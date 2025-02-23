// Set up the Leaflet map
const map = L.map('map').setView([32.0853, 34.7818], 13); // Centred on Tel Aviv
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// Define line colours
const lineColours = {
    "M1": "#0971ce", //blue
    "M2": "#fd6b0d", //orange
    "M3": "#fec524", //yellow
    "red": "red",
    "green": "green",
    "purple": "purple"
};

// Load GeoJSON data
let routes = [];
let stations = [];
let trains = [];

Promise.all([
    fetch('data/dantat_metro_lines.geojson').then(res => res.json()),
    fetch('data/dantat_metro_stations.geojson').then(res => res.json())
]).then(([linesData, stationsData]) => {
    routes = linesData.features.map(feature => ({
        coordinates: feature.geometry.type === "MultiLineString" ?
            feature.geometry.coordinates[0] :
            feature.geometry.coordinates,
        lineId: feature.properties.NAME.trim() // Ensure no extra spaces
    }));

    stations = stationsData.features.map(feature => feature.geometry.coordinates);
    console.log("Routes loaded:", routes);
    console.log("Stations loaded:", stations);
    startSimulation(); // Now that data is loaded, start the simulation
});

// Train settings
const trainSpeed = 60 * 1000 / 3600; // 60 km/h → meters per second
const dwellTime = 5; // Seconds to stop at each station
const timeScale = 60; // 1 real second = 1 simulated minute

// Train object
class Train {
    constructor(route, line) {
        this.route = route;
        this.currentDistance = 0;
        this.totalDistance = turf.length(turf.lineString(route)) * 1000; // km to meters
        this.colour = lineColours[line] || "grey"; // Default to grey if unknown

        // Extract the correct label (number for M1, M2... / letter for light rail)
        let label = line.match(/^M(\d+)$/) ? line.match(/^M(\d+)$/)[1] : line.charAt(0).toUpperCase();

        this.marker = L.marker([route[0][1], route[0][0]], {
            icon: L.divIcon({
                className: "train-marker",
                html: label,  // No extra div inside
                iconSize: [24, 24], 
                iconAnchor: [12, 12],
                popupAnchor: [0, -12]
            })
        }).addTo(map);
        this.marker.getElement().style.backgroundColor = this.colour; // Set background dynamically
        this.isPaused = false;
        this.pauseUntil = 0;
    }

    update(deltaTime) {
        if (this.isPaused) {
            if (Date.now() >= this.pauseUntil) this.isPaused = false;
            return;
        }

        this.currentDistance += trainSpeed * deltaTime * timeScale;

        if (this.currentDistance >= this.totalDistance) {
            this.currentDistance = 0; // Loop back
        }

        // Check if train should pause at a station
        for (let station of stations) {
            let stationDist = turf.pointToLineDistance(turf.point(station), turf.lineString(this.route), {
                units: "meters"
            });
            if (stationDist < 10) { // Close to a station
                this.isPaused = true;
                this.pauseUntil = Date.now() + dwellTime * 1000;
                return;
            }
        }

        // Get train's new position along route
        let newPos = turf.along(turf.lineString(this.route), this.currentDistance / 1000, {
            units: "kilometers"
        }).geometry.coordinates;
        this.marker.setLatLng([newPos[1], newPos[0]]);
    }
}


// Start simulation function
function startSimulation() {
    routes.forEach(({
        coordinates,
        lineId
    }) => {
        trains.push(new Train(coordinates, lineId));
        console.log("number of trains", trains.length);
    });

    let lastTime = Date.now();

    function animate() {
        let now = Date.now();
        let deltaTime = (now - lastTime) / 1000;
        lastTime = now;
        trains.forEach(train => train.update(deltaTime));
        requestAnimationFrame(animate);
    }
    animate();
}