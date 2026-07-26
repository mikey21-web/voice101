/* ----------------------------------------------
   GLOBAL ELEMENTS
------------------------------------------------*/
const tabs = document.querySelectorAll(".tab-btn");
const googleMaps = document.getElementById('googleMaps');
const mapFilterBtn = document.getElementById('mapFilterBtn');
const mapFilter = document.getElementById('mapFilter');
const markersPanel = document.getElementById("markersPanel");
const markersCategories = document.querySelectorAll('.markers-categories li');
const features = document.getElementById('features');
const featuresList = document.querySelectorAll('.features li');
const featurePanelBtn = document.getElementById('featurePanelBtn');
const featurePanelCloseBtn = document.getElementById('featurePanelCloseBtn');
const main = document.body;
const fullScreenBtn = document.getElementById('fullScreenBtn');
const exitScreenBtn = document.getElementById('exitScreenBtn');
const screenLabel = document.getElementById("screenLabel");
const backBtn = document.getElementById("backBtn");

let markers = [];
let category = "travel";
let map;
let directionsService;
let directionsRenderer;
let markersByKey = new Map();
let singleSelectionMode = false;
const keyFor = (lat, lng) => `${lat},${lng}`;
let GOOGLE_MAP_FLAG = true;

/* ----------------------------------------------
   ⭐ NEW: RAM-ONLY CACHES
------------------------------------------------*/
let routeCache = new Map();   // Cache key: lat,lng → {distanceText, durationText, directions}
let listCache = new Map();    // Cache for sidebar distances

/* ----------------------------------------------
   TAB BEHAVIOR
------------------------------------------------*/
tabs.forEach(tab => {
    const url = tab.getAttribute("data-type");

    const resetAllTabs = () => {
        tabs.forEach(tabItem => {
            tabItem.classList.remove("px-2", "lg:px-4", "transition-all", "duration-500", "text-black", "bg-white");
            tabItem.classList.add("h-8", "w-8", "lg:h-10", "lg:w-10", "text-white", "bg-black");
            tabItem.querySelector(".tab-text").classList.add("hidden");
        });
    };

    const activeTab = (tabToActivate) => {
        tabToActivate.classList.remove("text-white", "h-8", "w-8", "lg:h-10", "lg:w-10", "bg-black");
        tabToActivate.classList.add("px-2", "lg:px-4", "transition-all", "duration-500", "text-black", "bg-white");
        tabToActivate.querySelector(".tab-text").classList.remove("hidden");
    };

    tab.addEventListener("click", () => {
        resetAllTabs();
        setTimeout(() => {
            if (url === "/contact.html") {
                window.open("https://wa.me/8247084303", "_self");
            } else {
                window.open(`${url}`, "_self");
            }
        }, 500);
        activeTab(tab);
    });
});

/* ----------------------------------------------
   PANEL TOGGLE
------------------------------------------------*/
const closeMapFilterPanel = () => {
    markersPanel.classList.toggle('hidden');
    markersPanel.classList.toggle('flex');
};
mapFilterBtn.addEventListener('click', closeMapFilterPanel);

function clearAllPOIMarkers() {
    markers.forEach(m => m.setMap(null));
    markers = [];
}

function closeAllInfoAndRoutes() {
    if (directionsRenderer) directionsRenderer.setDirections({ routes: [] });
    markersByKey.forEach(({ infoWindow }) => infoWindow && infoWindow.close());
}

/* ----------------------------------------------
   CATEGORY BUTTON STYLING
------------------------------------------------*/
const CATEGORY_ACTIVE = [
    'bg-gradient-to-b',
    'from-gray-900',
    'to-black',
    'ring-1',
    'ring-[#BE9B42]',
    'border-transparent'
];

function clearCategoryActive() {
    markersCategories.forEach(li => {
        const innerDiv = li.querySelector('div');
        li.classList.remove(...CATEGORY_ACTIVE);
        li.classList.add('border-gray-700', 'bg-gradient-to-b', 'from-black', 'to-[#1a1a1a]');
        if (innerDiv) {
            innerDiv.classList.remove('text-[#F3E299]');
            innerDiv.classList.add(
                'text-gray-400',
                'group-hover:text-transparent',
                'group-hover:bg-gradient-to-r',
                'group-hover:from-[#F3E299]',
                'group-hover:to-[#BE9B42]',
                'group-hover:bg-clip-text'
            );
        }
    });
}

function setCategoryActive(li) {
    clearCategoryActive();
    const innerDiv = li.querySelector('div');
    li.classList.remove('border-gray-700', 'bg-gradient-to-b', 'from-black', 'to-[#1a1a1a]');
    li.classList.add(...CATEGORY_ACTIVE);
    if (innerDiv) {
        innerDiv.classList.remove(
            'text-gray-400',
            'group-hover:text-transparent',
            'group-hover:bg-gradient-to-r',
            'group-hover:from-[#F3E299]',
            'group-hover:to-[#BE9B42]',
            'group-hover:bg-clip-text'
        );
        innerDiv.classList.add('text-[#F3E299]');
    }
}

/* ----------------------------------------------
   INFO WINDOW TEMPLATE
------------------------------------------------*/
function buildInfoContent(title, img, distanceText, durationText) {
    return `
    <div class='p-2 font-sans w-[200px] rounded-lg bg-[#BE9B42] border-2 border-white shadow-lg'>
      <div class='flex flex-col gap-3 w-full h-full '>
          <img src="${img}" alt="${title}" class='aspect-16/9 object-cover rounded-md border-2 border-white' />
          <h1 class='text-xs font-semibold text-center'>${title}</h1>
          <div class='flex flex-col gap-1.5 text-sm bg-[rgba(0,0,0,0.7)] text-white p-2 rounded-md'>
            <div class="flex items-center gap-2 flex-1">
              <i class="fa-solid fa-route fa-sm"></i>
              <span class="text-xs">Distance: ${distanceText}</span>  
            </div>
            <hr />
            <div class="flex items-center gap-2 flex-1">
              <i class="fa-regular fa-clock fa-sm"></i>
              <span class="text-xs">Time: ${durationText}</span>
            </div>
          </div>
      </div>
    </div>`;
}

/* ----------------------------------------------
   ⭐ NEW: ROUTE CACHE HELPER
------------------------------------------------*/
function getRoute(origin, destLat, destLng) {
    return new Promise((resolve) => {
        const k = keyFor(destLat, destLng);

        // ⭐ If cached → no API call
        if (routeCache.has(k)) {
            console.log("Route cache hit for", k);
            resolve(routeCache.get(k));
            console.log("172", routeCache.get(k));
            return;
        }

        console.log("API call for route to", k);

        const destination = new google.maps.LatLng(destLat, destLng);
        const req = { origin, destination, travelMode: google.maps.TravelMode.DRIVING };

        directionsService.route(req, (result, status) => {
            if (status === google.maps.DirectionsStatus.OK) {
                const { distance, duration } = result.routes[0].legs[0];
                const entry = {
                    distanceText: distance.text,
                    durationText: duration.text,
                    directions: result
                };
                routeCache.set(k, entry);
                resolve(entry);
            } else {
                resolve(null);
            }
        });
    });
}

/* ----------------------------------------------
   SHOW POPUP + ROUTE (with caching)
------------------------------------------------*/
async function showPopupAndRoute(marker, infoWindow, data, origin) {
    const cached = await getRoute(origin, data.lat, data.lng);
    if (!cached) return;

    infoWindow.setContent(
        buildInfoContent(data.title, data.img, cached.distanceText, cached.durationText)
    );

    closeAllInfoAndRoutes();
    infoWindow.open(map, marker);

    directionsRenderer.setDirections(cached.directions);
}

/* ----------------------------------------------
   MARKER CREATION + CACHING
------------------------------------------------*/
function ensureMarkerEntry(data, iconSize = { w: 55, h: 60 }) {
    const k = keyFor(data.lat, data.lng);
    let entry = markersByKey.get(k);
    if (entry) return entry;

    const marker = new google.maps.Marker({
        map: null,
        title: data.title,
        position: { lat: data.lat, lng: data.lng },
        icon: { url: data.icon, scaledSize: new google.maps.Size(iconSize.w, iconSize.h) }
    });
    const infoWindow = new google.maps.InfoWindow({ disableAutoPan: true });

    entry = { marker, infoWindow, data };
    markersByKey.set(k, entry);
    return entry;
}

/* ----------------------------------------------
   MAIN MAP INITIALIZATION
------------------------------------------------*/
function initMap() {
    clearAllPOIMarkers();
    routeCache.clear();
    listCache.clear();
    markersByKey = new Map();
    singleSelectionMode = false;

    console.log(routeCache);

    const mapOptions = {
        center: { lat: 11.0652, lng: 77.0493083 },
        zoom: 50,
        mapTypeId: 'satellite',
        mapTypeControl: true,
        mapTypeControlOptions: {
            style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
            position: google.maps.ControlPosition.BOTTOM_CENTER,
            mapTypeIds: ["roadmap", "satellite"],
        },
        zoomControl: true,
        zoomControlOptions: { position: google.maps.ControlPosition.LEFT_CENTER },
        scaleControl: false,
        cameraControl: false,
        fullscreenControl: false,
        streetViewControl: false
    };

    map = new google.maps.Map(document.getElementById("map"), mapOptions);

    /* ----------------------------------------------
       SITE MARKER + LAYOUT OVERLAY
    ----------------------------------------------*/
    const layoutImageBounds = {
        north: 11 + (4/60) + (1.10/3600),
        south: 11 + (3/60) + (54.34/3600),
        east: 77 + (3/60) + (0.11/3600),
        west: 77 + (2/60) + (52.66/3600),
    };

    const ground = new google.maps.GroundOverlay("./assets/Zen_Vistas_Map.png", layoutImageBounds);
    ground.setMap(map);

    const layoutMarkerPosition = { lat: 11.0652, lng: 77.0493083 };

    const layoutMarker = new google.maps.Marker({
        map,
        title: "Vezraa",
        position: layoutMarkerPosition,
        icon: { url: "./assets/markers/Vezraa_Mappin.png", scaledSize: new google.maps.Size(60, 60) },
    });

    const layoutInfoWindow = new google.maps.InfoWindow({
        content: `<div class="flex flex-col items-center gap-2.5 w-[200px]">
                    <div class="rounded-lg">
                      <img src="assets/logos/Vezraa_logo.webp" class="max-w-14 max-h-14" />
                    </div>
                    <h1 class="text-base font-bold text-center text-[#BE9B42]">Vezraa</h1>
                </div>`,
        disableAutoPan: true
    });

    layoutInfoWindow.open(map, layoutMarker);

    const initialBounds = new google.maps.LatLngBounds(
        new google.maps.LatLng(layoutImageBounds.south, layoutImageBounds.west),
        new google.maps.LatLng(layoutImageBounds.north, layoutImageBounds.east)
    );
    initialBounds.extend(layoutMarker.getPosition());
    map.fitBounds(initialBounds, 60);

    /* ----------------------------------------------
       DIRECTIONS ENGINE
    ----------------------------------------------*/
    directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer({
        map,
        suppressMarkers: true,
        polylineOptions: { strokeColor: "#ffd700", strokeWeight: 3.5, strokeOpacity: 1 },
        preserveViewport: true
    });

    const origin = new google.maps.LatLng(layoutMarkerPosition.lat, layoutMarkerPosition.lng);

    /* ----------------------------------------------
       MARKERS DATA
       ( 🔥 YOUR FULL MARKERS LIST WAS KEPT EXACTLY THE SAME )
    ----------------------------------------------*/
    const markersData = [
        {
            title: "KMCH Medical College",
            lat: 11.043596699459389,
            lng: 77.0400048855731,
            img: "./assets/map_images/kmch_medical_college.webp",
            icon: "./assets/markers/default_marker_pin.png",
            category: "education",
        },
        {
            title: "Coimbatore Institute of Technology",
            lat: 11.02860698171965,
            lng: 77.02723448238912,
            img: "./assets/map_images/coimbatore_institute_of_technology.webp",
            icon: "./assets/markers/default_marker_pin.png",
            category: "education",
        },
        {
            title: "Dr.G.R.Damodaran College of Science",
            lat: 11.035201175191103,
            lng: 77.0294203886235,
            img: "./assets/map_images/dr.g.r.damodaran_college_of_science.webp",
            icon: "./assets/markers/default_marker_pin.png",
            category: "education",
        },
        {
            title: "GRD Public School",
            lat: 11.033339103435198,
            lng: 77.03013970380728,
            img: "./assets/map_images/grd_public_school.webp",
            icon: "./assets/markers/default_marker_pin.png",
            category: "education",
        },
        {
            title: "PSG College of Arts and Science",
            lat: 11.03516826004802,
            lng: 77.03389588128596,
            img: "./assets/map_images/psg_college_of_arts_and_science.webp",
            icon: "./assets/markers/default_marker_pin.png",
            category: "education",
        },
        {
            title: "NGP Institution of Arts and Science",
            lat: 11.061422752471541,
            lng: 77.03782185717613,
            img: "./assets/map_images/nsp_institution_of_arts_and_science.webp",
            icon: "./assets/markers/default_marker_pin.png",
            category: "education",
        },
        {
            title: "Chandrakanti Public School",
            lat: 11.044371795902252,
            lng: 77.02987866160795,
            img: "./assets/map_images/chandrakanti_public_school.webp",
            icon: "./assets/markers/default_marker_pin.png",
            category: "education",
        },
        {
            title: "PSG Public School",
            lat: 11.027319407548541,
            lng: 77.00473743037293,
            img: "./assets/map_images/psg_public_school.webp",
            icon: "./assets/markers/default_marker_pin.png",
            category: "education",
        },
        {
            title: "Pallikoodam Rak",
            lat: 11.041108654516556,
            lng: 77.03270984832726,
            img: "./assets/map_images/pallikoodam_rak.webp",
            icon: "./assets/markers/default_marker_pin.png",
            category: "education",
        },
        {
            title: "Suguna PIP School",
            lat: 11.051894260351359,
            lng: 77.03179135243337,
            img: "./assets/map_images/suguna_pip_school.webp",
            icon: "./assets/markers/default_marker_pin.png",
            category: "education",
        },
        {
            title: "Sri Vivekananda Matric",
            lat: 11.055306432738409,
            lng: 77.05760798410124,
            img: "./assets/map_images/sri_vivekananda_matric.webp",
            icon: "./assets/markers/default_marker_pin.png",
            category: "education",
        },
        {
            title: "CBSE School (Reeds)",
            lat: 11.071893177116072,
            lng: 77.05536589674425,
            img: "./assets/map_images/cbse_school_(reeds).webp",
            icon: "./assets/markers/default_marker_pin.png",
            category: "education",
        },

        // 💼 WORK
        {
            title: "Tidel Park",
            lat: 11.033219120461277,
            lng: 77.01867874543267,
            img: "./assets/map_images/tidel_park.webp",
            icon: "./assets/markers/default_marker_pin.png",
            category: "work",
        },
        {
            title: "Cognizant",
            lat: 11.108298157645766,
            lng: 76.98475289383906,
            img: "./assets/map_images/cognizant.webp",
            icon: "./assets/markers/default_marker_pin.png",
            category: "work",
        },
        {
            title: "Bosch Global Software",
            lat: 11.104683905238065,
            lng: 76.98638319533312,
            img: "./assets/map_images/bosch_global_software.webp",
            icon: "./assets/markers/default_marker_pin.png",
            category: "work",
        },
        {
            title: "Kgisl Campas",
            lat: 11.086147772298323,
            lng: 76.99708097005822,
            img: "./assets/map_images/kgisl_campas.webp",
            icon: "./assets/markers/default_marker_pin.png",
            category: "work",
        },

        // 🛍️ SHOPPING
        {
            title: "FUNMALL",
            lat: 11.025364084736596,
            lng: 77.01056423943588,
            img: "./assets/map_images/funmall.webp",
            icon: "./assets/markers/default_marker_pin.png",
            category: "shopping",
        },
        {
            title: "PROZONE",
            lat: 11.05580351708007,
            lng: 76.9941651976893,
            img: "./assets/map_images/prozone.webp",
            icon: "./assets/markers/default_marker_pin.png",
            category: "shopping",
        },
        {
            title: "BROADWAY Cinemas",
            lat: 11.046542735123273,
            lng: 77.04120898869657,
            img: "./assets/map_images/broadway_cinemas.webp",
            icon: "./assets/markers/default_marker_pin.png",
            category: "shopping",
        },
        {
            title: "DMart Singanallur",
            lat: 11.011213783211693,
            lng: 77.02775232864465,
            img: "./assets/map_images/dmart_singanallur.webp",
            icon: "./assets/markers/default_marker_pin.png",
            category: "shopping",
        },
        {
            title: "DMart Chinniyampalayam",
            lat: 11.05646583897579,
            lng: 77.06682118430062,
            img: "./assets/map_images/dmart _chinniyampalayam.webp",
            icon: "./assets/markers/default_marker_pin.png",
            category: "shopping",
        },
        {
            title: "DMart Sulur",
            lat: 11.019470133241112,
            lng: 77.09551462766812,
            img: "./assets/map_images/dmart_sulur.webp",
            icon: "./assets/markers/default_marker_pin.png",
            category: "shopping",
        },

        // 🏥 HOSPITALS
        {
            title: "KMCH Medical",
            lat: 11.04606177528408,
            lng: 77.04102479837267,
            img: "./assets/map_images/kmch_medical.webp",
            icon: "./assets/markers/default_marker_pin.png",
            category: "hospital",
        },
        {
            title: "Lotus Eye Care",
            lat: 11.042270926418134,
            lng: 77.04059564495881,
            img: "./assets/map_images/lotus_eye_care.webp",
            icon: "./assets/markers/default_marker_pin.png",
            category: "hospital",
        },
        {
            title: "Yazhini Hospital",
            lat: 11.055165073297934,
            lng: 77.06151004985709,
            img: "./assets/map_images/yazhini_hospital.webp",
            icon: "./assets/markers/default_marker_pin.png",
            category: "hospital",
        },
        {
            title: "RG Hospital",
            lat: 11.054958796860584,
            lng: 77.06386863441648,
            img: "./assets/map_images/rg_hospital.webp",
            icon: "./assets/markers/default_marker_pin.png",
            category: "hospital",
        },
        {
            title: "Venkateshwara Hospital",
            lat: 11.05469916657653,
            lng: 77.06520873096923,
            img: "./assets/map_images/venkateshwara_hospital.webp",
            icon: "./assets/markers/default_marker_pin.png",
            category: "hospital",
        },
        {
            title: "Reya Care",
            lat: 11.077452737483863,
            lng: 77.02253848716614,
            img: "./assets/map_images/reya_are.webp",
            icon: "./assets/markers/default_marker_pin.png",
            category: "hospital",
        },
        {
            title: "Coimbatore International Airport", 
            lat: 11.030715642443448,
            lng: 77.03982889640378,
            img: "./assets/map_images/coimbatore_railway_junction.webp",
            icon: "./assets/markers/default_marker_pin.png",
            category: "travel",
        },
        {
            title: "Peelamedu Railway Station",
            lat: 11.033265360687812,
            lng: 76.99982699979168,
            img: "./assets/map_images/peelamedu_rail_station.webp",
            icon: "./assets/markers/default_marker_pin.png",
            category: "travel",
        },
        {
            title: "Coimbatore Central Railway Station",
            lat: 10.997529754212467,
            lng: 76.96637959012935,
            img: "./assets/map_images/coimbatore_railway_junction.webp",
            icon: "./assets/markers/default_marker_pin.png",
            category: "travel",
        },
        {
            title: "Kaniyur Toll Gate",
            lat: 11.012854857435562,
            lng: 77.07320193232057,
            img: "./assets/map_images/kaniyur_toll_gate.webp",
            icon: "./assets/markers/default_marker_pin.png",
            category: "travel",
        },
        {
            title: "Singanallur Bus Stand",
            lat: 11.000753779951932,
            lng: 77.02942398048842,
            img: "./assets/map_images/singanallur_bus_stand.webp",
            icon: "./assets/markers/default_marker_pin.png",
            category: "travel",
        },
        {
            title: "Gandhipuram Bus Stand",
            lat: 11.016771285091748,
            lng: 76.97023667973993,
            img: "./assets/map_images/gandhipuram_bus_stand.webp",
            icon: "./assets/markers/default_marker_pin.png",
            category: "travel",
        },
        {
            title: "Ooty",
            lat: 11.410589871426097, 
            lng: 76.69470878714695,
            img: "./assets/map_images/ooty.webp",
            icon: "./assets/markers/default_marker_pin.png",
            category: "destination",
        },
        {
            title: "Kotagiri",
            lat: 11.422565462698893, 
            lng: 76.86314363783951,
            img: "./assets/map_images/kotagiri.webp",
            icon: "./assets/markers/default_marker_pin.png",
            category: "destination",
        },
        {
            title: "Pollachi",
            lat: 10.66169344793183, 
            lng: 77.00626096834705,
            img: "./assets/map_images/pollachi.webp",
            icon: "./assets/markers/default_marker_pin.png",
            category: "destination",
        },
    ];

    /* ----------------------------------------------
       RENDER HELPERS
    ----------------------------------------------*/
    const filteredByCategory = (cat) => markersData.filter(m => m.category === cat);

    markersData.forEach(d => ensureMarkerEntry(d));

    /* CATEGORY MARKERS */
    function renderCategoryMarkers(list) {
        singleSelectionMode = false;
        clearAllPOIMarkers();
        closeAllInfoAndRoutes();

        list.forEach(data => {
            const entry = ensureMarkerEntry(data);
            entry.marker.setMap(map);
            markers.push(entry.marker);

            entry.marker.addListener('mouseover', () => {
                if (!singleSelectionMode) showPopupAndRoute(entry.marker, entry.infoWindow, data, origin);
            });

            entry.marker.addListener('mouseout', () => {
                if (!singleSelectionMode) {
                    directionsRenderer.setDirections({ routes: [] });
                    entry.infoWindow.close();
                }
            });

            entry.marker.addListener('click', () => {
                if (!singleSelectionMode) showPopupAndRoute(entry.marker, entry.infoWindow, data, origin);
            });
        });
    }

    /* LIST PANEL */
    function renderList(list) {
        const listEl = document.querySelector('.markers-list');
        listEl.innerHTML = "";

        list.forEach(async (data) => {
            const li = document.createElement('li');
            li.classList.add("hover:bg-white/10");
            li.dataset.key = keyFor(data.lat, data.lng);

            const row = document.createElement('div');
            row.className = 'flex justify-between gap-4 items-center cursor-pointer p-2 border-b-1 border-dashed border-white';

            const name = document.createElement('span');
            name.className = 'text-white text-xs flex-1';
            name.textContent = data.title;

            const dist = document.createElement('span');
            dist.className = 'text-white text-xs flex-1';
            dist.textContent = '…';

            row.appendChild(name);
            row.appendChild(dist);
            li.appendChild(row);
            listEl.appendChild(li);

            const k = keyFor(data.lat, data.lng);

            if (listCache.has(k)) {
                const cached = listCache.get(k);
                dist.textContent = `${cached.distanceText} (${cached.durationText})`;
            } else {

                try {
                    const route = await getRoute(origin, data.lat, data.lng);

                    if (route) {
                        dist.textContent = `${route.distanceText} (${route.durationText})`;

                        // Save list cache
                        listCache.set(k, {
                            distanceText: route.distanceText,
                            durationText: route.durationText
                        });
                    } else {
                        dist.textContent = "—";
                    };

                } catch (e) {
                    console.error("Route error:", e);
                    dist.textContent = "—";
                };

            }

            li.addEventListener('click', () => {
                singleSelectionMode = true;
                clearAllPOIMarkers();
                closeAllInfoAndRoutes();

                const entry = ensureMarkerEntry(data);
                entry.marker.setMap(map);
                markers = [entry.marker];

                showPopupAndRoute(entry.marker, entry.infoWindow, data, origin);

                const b = new google.maps.LatLngBounds();
                b.extend(layoutMarker.getPosition());
                b.extend(entry.marker.getPosition());
                map.fitBounds(b, 60);
            });
        });
    }

    function zoomToFit(list) {
        if (!list.length) return;
        const bounds = new google.maps.LatLngBounds();
        list.forEach(m => bounds.extend(new google.maps.LatLng(m.lat, m.lng)));
        bounds.extend(layoutMarker.getPosition());
        map.fitBounds(bounds, 60);
    }

    const list = filteredByCategory(category);
    renderCategoryMarkers(list);
    renderList(list);
    zoomToFit(list);

    markersCategories.forEach(markersCategory => {
        markersCategory.addEventListener('click', () => {
            category = markersCategory.getAttribute('data-type');
            setCategoryActive(markersCategory);

            const list = filteredByCategory(category);
            renderCategoryMarkers(list);
            renderList(list);
            zoomToFit(list);
        });
    });
}

/* ----------------------------------------------
   SIDE PANELS & BUTTONS
------------------------------------------------*/
featurePanelBtn.addEventListener('click', () => features.classList.toggle('translate-x-full'));
featurePanelCloseBtn.addEventListener('click', () => features.classList.add('translate-x-full'));

backBtn.addEventListener("click", () => window.history.back());

/* ----------------------------------------------
   FULLSCREEN TOGGLE
------------------------------------------------*/
const toggleFullScreen = () => {
    screenLabel.textContent = "Exit Screen";
    fullScreenBtn.classList.toggle("hidden");
    exitScreenBtn.classList.toggle("hidden");

    if (main.requestFullscreen) main.requestFullscreen();
};

const toggleExitScreen = () => {
    screenLabel.textContent = "Full Screen";
    fullScreenBtn.classList.toggle("hidden");
    exitScreenBtn.classList.toggle("hidden");

    if (document.exitFullscreen) document.exitFullscreen();
};

fullScreenBtn.addEventListener("click", toggleFullScreen);
fullScreenBtn.addEventListener("touchstart", toggleFullScreen);
exitScreenBtn.addEventListener("click", toggleExitScreen);
exitScreenBtn.addEventListener("touchstart", toggleExitScreen);

/* ----------------------------------------------
   LOAD MAP
------------------------------------------------*/
window.addEventListener("load", initMap);

/* ----------------------------------------------
   LEFT PANEL NAVIGATION
------------------------------------------------*/
const leftPanelButtons = document.querySelectorAll('.left-controls .control-btn');
leftPanelButtons.forEach((button) => {
    button.addEventListener('click', function () {
        const control = this.dataset.control;

        if (this.classList.contains('active')) return;

        if (control === 'webverse') window.location.href = 'webverse.html';
        else if (control === 'location') window.location.href = 'map.html';
        else if (control === 'exterior') window.location.href = 'exterior.html';
        else if (control === 'interior') window.location.href = 'interior-virtual-tour.html';
        else if (control === 'zoneiq') window.location.href = 'zoneiq.html';
    });
});

