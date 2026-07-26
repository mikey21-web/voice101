let villasData = []; // Villas Data from JSON
const selectedFacings = new Set(); // Selected Facings
const selectedTypes = new Set(); // Selected Types
const selectedUnits = new Set(); // Selected Units

// DOM Elements
const webverseFilterBtn = document.getElementById('webverseFilterBtn');
const resetFiltersBtn = document.getElementById('resetFiltersBtn');
const webversFilterCloseBtn = document.getElementById('webversFilterCloseBtn');
const webverseFilters = document.getElementById('webverseFilters');
const tabs = document.querySelectorAll(".tab-btn");
const unitsWrapperEls = document.querySelectorAll(".unitsWrapper");
const orientationsEl = document.querySelector(".orientations");
const floorsEl = document.querySelector(".floors");
const typesEl = document.querySelector(".types");
const unitsEl = document.querySelector(".units");
const backBtn = document.getElementById("backBtn");
const orientations = document.querySelectorAll('.orientations li');
const types = document.querySelectorAll('.types li');
const units = document.querySelectorAll('.units li');
const villaInfoModel = document.getElementById('villaInfoModel');
const villaInfoCloseBtn = document.getElementById('villaInfoCloseBtn');
const villaId = document.getElementById('villaId');
const villaArea = document.getElementById('villaArea');
const villaType = document.getElementById('villaType');
const villaOrientation = document.getElementById('villaOrientation');
const villaImage = document.getElementById('villaImage');
const exploreMoreBtn = document.getElementById('exploreMoreBtn');
const features = document.getElementById('features');
const featuresList = document.querySelectorAll('.features li');
const featurePanelBtn = document.getElementById('featurePanelBtn');
const featurePanelCloseBtn = document.getElementById('featurePanelCloseBtn');
const main = document.body;
const fullScreenBtn = document.getElementById('fullScreenBtn');
const exitScreenBtn = document.getElementById('exitScreenBtn');
const screenLabel = document.getElementById("screenLabel");
const layoutImage = document.getElementById("layoutImage");
const layoutVideo = document.getElementById("layoutVideo");
const leftPanel = document.getElementById("leftPanel");
const videoWrapper = document.getElementById("videoWrapper");
const videoWrapperCloseBtn = document.getElementById("videoWrapperCloseBtn");
const zoomContainer = document.getElementById('zoomContainer');

// Global Variables
// window.location.origin alone drops the current directory (e.g. /vezraa-villas)
// when this site is deployed under a subpath instead of a domain root.
const baseUrl = window.location.origin + window.location.pathname.replace(/\/[^/]*$/, '');
let villaID;
let fileName = "vezraa_layout";
let timeOfDay = "night";
let ext = "webp";
let selectedVillaId;

// Zoom & Pan Variables
let scale = 1;
const container = zoomContainer.parentElement;
const containerRect = container.getBoundingClientRect();
const imageWidth = zoomContainer.offsetWidth * scale;
const imageHeight = zoomContainer.offsetHeight * scale;

// Calculate boundaries
const maxTranslateX = (imageWidth - containerRect.width) / 2 / scale;
const minTranslateX = -maxTranslateX;
const maxTranslateY = (imageHeight - containerRect.height) / 2 / scale;
const minTranslateY = -maxTranslateY;

const minScale = 1;
const maxScale = 5;
const scaleStep = 0.1;
let isDragging = false;
let startX = 0;
let startY = 0;
let translateX = 0;
let translateY = 0;
let initialPinchDistance = null;

// Initialize translation within bounds
translateX = Math.min(maxTranslateX, Math.max(minTranslateX, translateX));
translateY = Math.min(maxTranslateY, Math.max(minTranslateY, translateY));

// Orientation highlight colors
const orientationColors = {
    north: "rgba(14, 165, 233, 0.35)",
    south: "rgba(234, 179, 8, 0.35)"
};

// Unit to Type Mapping Configuration
const unitTypeConfig = {
    'type1': [ '5.11', '5.31', '5.61', '5.73', '5.74', '5.85', '5.87', '5.97', '6.07',  '6.15', '6.17', '6.27', '6.36'],
    'type2': ['7.03', '7.09', '7.34'],
    'type3': ['9.28', '11.01', '11.48', '14.61']
};

// Update Zoom Container Transform
const updateTransform = () => {
    zoomContainer.style.transform = `scale(${scale}) translate(${translateX}px, ${translateY}px)`;
    zoomContainer.style.transformOrigin = 'center center';
};

// Prevent default pinch zoom behavior on document
document.addEventListener('touchstart', (e) => {
    if (e.touches.length > 1) {
        e.preventDefault();
    }
}, { passive: false });

// Mouse Wheel Zoom Handler
zoomContainer.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -scaleStep : scaleStep;
    const newScale = Math.min(maxScale, Math.max(minScale, scale + delta));

    if (newScale === minScale) {
        translateX = 0;
        translateY = 0;
    };

    scale = newScale;
    updateTransform();
});

// Mouse Drag Start
zoomContainer.addEventListener('mousedown', (e) => {
    e.preventDefault();
    isDragging = true;
    startX = e.clientX - translateX * scale;
    startY = e.clientY - translateY * scale;
    zoomContainer.classList.add('dragging');
});

// Mouse Drag Move
zoomContainer.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    let newTranslateX = (e.clientX - startX) / scale;
    let newTranslateY = (e.clientY - startY) / scale;

    const containerRect = zoomContainer.parentElement.getBoundingClientRect();
    const imageWidth = zoomContainer.offsetWidth * scale;
    const imageHeight = zoomContainer.offsetHeight * scale;

    const maxTranslateX = (imageWidth - containerRect.width) / 2 / scale;
    const minTranslateX = -maxTranslateX;
    const maxTranslateY = (imageHeight - containerRect.height) / 2 / scale;
    const minTranslateY = -maxTranslateY;

    translateX = Math.min(maxTranslateX, Math.max(minTranslateX, newTranslateX));
    translateY = Math.min(maxTranslateY, Math.max(minTranslateY, newTranslateY));

    updateTransform();
});

// Stop Dragging Handler
const stopDragging = () => {
    isDragging = false;
    zoomContainer.classList.remove('dragging');
};

zoomContainer.addEventListener('mouseup', stopDragging);
zoomContainer.addEventListener('mouseleave', stopDragging);

// Touch Drag/Zoom Start
zoomContainer.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (e.touches.length === 1) {
        isDragging = true;
        const touch = e.touches[0];
        startX = touch.clientX - translateX * scale;
        startY = touch.clientY - translateY * scale;
        zoomContainer.classList.add('dragging');
    } else if (e.touches.length === 2) {
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        initialPinchDistance = Math.hypot(
            touch1.clientX - touch2.clientX,
            touch1.clientY - touch2.clientY
        );
    }
});

// Touch Drag Move
zoomContainer.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (e.touches.length === 1 && isDragging) {
        const touch = e.touches[0];
        let newTranslateX = (touch.clientX - startX) / scale;
        let newTranslateY = (touch.clientY - startY) / scale;

        const containerRect = zoomContainer.parentElement.getBoundingClientRect();
        const imageWidth = zoomContainer.offsetWidth * scale;
        const imageHeight = zoomContainer.offsetHeight * scale;

        const maxTranslateX = (imageWidth - containerRect.width) / 2 / scale;
        const minTranslateX = -maxTranslateX;
        const maxTranslateY = (imageHeight - containerRect.height) / 2 / scale;
        const minTranslateY = -maxTranslateY;

        translateX = Math.min(maxTranslateX, Math.max(minTranslateX, newTranslateX));
        translateY = Math.min(maxTranslateY, Math.max(minTranslateY, newTranslateY));

        updateTransform();
    } else if (e.touches.length === 2) {
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const currentPinchDistance = Math.hypot(
            touch1.clientX - touch2.clientX,
            touch1.clientY - touch2.clientY
        );

        if (initialPinchDistance) {
            const pinchScale = currentPinchDistance / initialPinchDistance;
            let newScale = scale * pinchScale;
            newScale = Math.min(maxScale, Math.max(minScale, newScale));

            if (newScale === minScale) {
                translateX = 0;
                translateY = 0;
            }

            scale = newScale;
            initialPinchDistance = currentPinchDistance;
            updateTransform();
        }
    }
});

// Touch End/Cancel
zoomContainer.addEventListener('touchend', () => {
    isDragging = false;
    initialPinchDistance = null;
    zoomContainer.classList.remove('dragging');
});

zoomContainer.addEventListener('touchcancel', () => {
    isDragging = false;
    initialPinchDistance = null;
    zoomContainer.classList.remove('dragging');
});

// Feature Panel Toggles
featurePanelBtn.addEventListener('click', () => {
    features.classList.toggle('translate-x-full');
});

featurePanelCloseBtn.addEventListener('click', () => {
    features.classList.add('translate-x-full');
});

videoWrapperCloseBtn.addEventListener("click", () => {
    videoWrapper.classList.add("hidden")
});

if (backBtn) {
    backBtn.addEventListener("click", () => window.location.href = 'index.html');
};

// Theme Toggle (Day/Night)
const updateLayoutImage = () => {
    layoutImage.src = `./assets/${fileName}_${timeOfDay}.${ext}`;
}

const updateLayoutVideo = () => {
    layoutVideo.src = `assets/Vezraa_${timeOfDay}_video.mp4`;
}



// Full Screen Logic
const toggleFullScreen = () => {
    screenLabel.textContent = "Exit Screen";
    fullScreenBtn.classList.toggle("hidden");
    exitScreenBtn.classList.toggle("hidden");
    if (main.requestFullscreen) {
        main.requestFullscreen();
    } else if (main.mozRequestFullScreen) {
        main.mozRequestFullScreen();
    } else if (main.webkitRequestFullscreen) {
        main.webkitRequestFullscreen();
    } else if (main.msRequestFullscreen) {
        main.msRequestFullscreen();
    };
};

const toggleExitScreen = () => {
    screenLabel.textContent = "Full Screen";
    fullScreenBtn.classList.toggle("hidden");
    exitScreenBtn.classList.toggle("hidden");
    if (document.exitFullscreen) {
        document.exitFullscreen();
    } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
    } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
    };
};

fullScreenBtn.addEventListener("click", toggleFullScreen);
fullScreenBtn.addEventListener("touchstart", toggleFullScreen);
exitScreenBtn.addEventListener("click", toggleExitScreen);
exitScreenBtn.addEventListener("touchstart", toggleExitScreen);

// Navigation to Villa Detail Page
exploreMoreBtn.addEventListener("click", () => {
    window.open(`${baseUrl}/villa.html?villaId=${villaID}`, '_self');
});

// D3 SVG Initialization
const layoutSVG = d3.select("#layoutSvg svg");

layoutSVG.attr('preserveAspectRatio', 'xMidYMid slice')
    .attr('width', '100%')
    .attr('height', '100%');

layoutSVG.selectAll('rect, circle, polygon, polyline, path')
    .attr('stroke-width', '1px')
    .attr('stroke', 'rgba(255,255,255,1)')
    .attr("fill", "transparent");

// Filter Panel Toggles
const toggleWebverseFilters = () => {
    webverseFilters.classList.toggle('-translate-x-full');
};

// Reset SVG Styles
const resetSVGFill = () => {
    layoutSVG.selectAll("rect, path, polygon, circle, polyline")
        .style("fill", "transparent")
        .style("cursor", "default")
        .style("stroke", "none")
        .on("click", null)
        .on("mouseover", null)
        .on("mouseout", null)
        .on("touchstart", null)
        .on("touchend", null);
};

// --- STYLING FUNCTIONS (FIXED) ---

// Reset Filter Button Styles
const resetElementStyles = (element) => {
    const innerDiv = element.querySelector("div");
    const textSpans = element.querySelectorAll("span");
    const isUnitBtn = element.classList.contains("unit-btn");

    // Reset container:
    // Remove Gold border/gradient, restore white border
    element.classList.remove('bg-gradient-to-b', 'from-[#F3E299]', 'to-[#BE9B42]', 'border-[#F3E299]');
    element.classList.add('bg-black/30', 'border-2', 'border-white/20');

    // Restore hover effect for unit buttons if it was removed
    if (isUnitBtn) {
        element.classList.add('hover:bg-[#2a3040]');
    }

    // Reset inner div
    if (innerDiv) {
        innerDiv.classList.remove("bg-gradient-to-b", "from-gray-900", "to-black");
        // Remove structural classes added during selection to reset cleanly
        innerDiv.classList.remove("w-full", "h-full", "rounded-md"); 
        innerDiv.classList.add("bg-black/30");
        
        // Units don't need bg-black/30 on inner div normally (based on HTML), 
        // but if it was added, we leave it or remove it based on original state.
        // For consistency with other buttons, we can leave it or just remove the gradient.
    }

    // Reset text to white/gray
    textSpans.forEach(span => {
        span.classList.remove(
            "bg-gradient-to-b", "from-[#F3E299]", "to-[#BE9B42]",
            "bg-clip-text", "text-transparent", "font-bold", "text-black"
        );
        if (span.classList.contains("text-[9px]") || span.classList.contains("text-[10px]")) {
            span.classList.add("text-gray-400");
        } else {
            span.classList.add("text-white");
        }
    });
};

// Apply Selected Filter Button Styles (FIXED: Units Styling)
const applySelectedStyles = (element) => {
    const innerDiv = element.querySelector("div");
    const textSpans = element.querySelectorAll("span");
    const isUnitBtn = element.classList.contains("unit-btn");

    // Container: 
    // Remove White Border, Add Gold Border. 
    // KEY FIX: Maintain 'border-2' so the element size doesn't shrink/cut off.
    element.classList.remove('bg-black/30', 'border-white/20');
    
    // For units, remove the specific hover background so it doesn't clash with selection
    if (isUnitBtn) {
        element.classList.remove('hover:bg-[#2a3040]');
    }

    element.classList.add('bg-gradient-to-b', 'from-[#F3E299]', 'to-[#BE9B42]', 'border-2', 'border-[#F3E299]');

    // Inner div dark gradient
    if (innerDiv) {
        innerDiv.classList.remove("bg-black/30");
        // FIX: Add rounded-md and w-full/h-full to ensure inner background fills correctly and respects corners
        innerDiv.classList.add("bg-gradient-to-b", "from-gray-900", "to-black", "w-full", "h-full", "rounded-md");
    }

    // Text becomes gold
    textSpans.forEach(span => {
        span.classList.remove("text-white", "text-gray-400");
        span.classList.add(
            "bg-gradient-to-b", "from-[#F3E299]", "to-[#BE9B42]",
            "bg-clip-text", "text-transparent", "font-bold"
        );
    });
};

// --- FILTERING FUNCTIONS ---

// Filter Available Units based on Selected Types
const filterUnitsByType = () => {
    // If no types selected, show all
    if (selectedTypes.size === 0) {
        units.forEach(btn => btn.classList.remove('hidden'));
        return;
    }

    units.forEach(btn => {
        const rawUnit = btn.getAttribute('data-type'); // e.g. "5.1_3480"
        const unitPrefix = rawUnit.split('_')[0]; // e.g. "5.1"
        
        let shouldShow = false;

        // Check if unit prefix exists in any of the selected types configuration
        selectedTypes.forEach(typeKey => {
            const allowedUnits = unitTypeConfig[typeKey];
            if (allowedUnits && allowedUnits.includes(unitPrefix)) {
                shouldShow = true;
            }
        });

        if (shouldShow) {
            btn.classList.remove('hidden');
        } else {
            btn.classList.add('hidden');
        }
    });
};

// Main Reset Function
function reset() {
    closeVillaInfo();
    
    // Clear Sets
    selectedFacings.clear();
    selectedTypes.clear();
    selectedUnits.clear();

    // Reset Styles
    orientations.forEach(el => resetElementStyles(el));
    types.forEach(el => resetElementStyles(el));
    units.forEach(el => resetElementStyles(el));

    // Show all units
    units.forEach(btn => btn.classList.remove('hidden'));

    // Reset Map state
    resetSVGFill();
    if (selectedFacings.size === 0 && selectedTypes.size === 0 && selectedUnits.size === 0) {
        initializeVillaInteraction("Villa_");
    }
};

resetFiltersBtn.addEventListener('click', reset);

// Toggle Logic for Filter Buttons
const toggleSelection = (elements, selectedSet, castToNumber = false) => {
    elements.forEach(element => {
        element.addEventListener('click', () => {
            const rawValue = element.getAttribute('data-type');
            const value = castToNumber ? +rawValue : rawValue;

            if (selectedSet.has(value)) {
                // Deselect
                resetElementStyles(element);
                selectedSet.delete(value);
            } else {
                // Select
                applySelectedStyles(element);
                selectedSet.add(value);
            }

            // If Type buttons were clicked, filter the units list
            if (element.classList.contains('type-btn') || element.closest('.types')) {
                filterUnitsByType();
            }

            // Update Map visualization
            if (selectedFacings.size > 0 || selectedTypes.size > 0 || selectedUnits.size > 0) {
                updateFilteredData();
            } else {
                resetSVGFill();
            }

            if (selectedFacings.size === 0 && selectedTypes.size === 0 && selectedUnits.size === 0) {
                initializeVillaInteraction("Villa_");
            };
        });
    });
};

// Open/Close Webverse Filters
webverseFilterBtn.addEventListener('click', () => {
    leftPanel.classList.add("left-[286px]", "lg:left-[336px]");
    leftPanel.classList.remove("left-2", "lg:left-4");
    toggleWebverseFilters();
});

webversFilterCloseBtn.addEventListener('click', () => {
    leftPanel.classList.remove("left-[286px]", "lg:left-[336px]");
    leftPanel.classList.add("left-2", "lg:left-4");
    toggleWebverseFilters();
});

// Data Filters Helpers
const getVillaData = (villaId) => villasData.find(each => each.id === villaId);
const getFilteredUnitsByFacings = (data, facings) => data.filter(each => facings.has(each.orientation));

// FIXED: Use config to map selected Type Keys (type1) to actual Unit Data (5.1, 5.2)
const getFilteredUnitsByTypes = (data, typesSet) => {
    const allowedPrefixes = [];
    typesSet.forEach(typeKey => {
        if (unitTypeConfig[typeKey]) {
            allowedPrefixes.push(...unitTypeConfig[typeKey]);
        }
    });

    // Check if villa's area in cents matches allowed prefixes
    return data.filter(villa => allowedPrefixes.includes(String(villa.plotAreaInCents)));
};

const getFilteredUnitsByUnitSize = (data, units) => data.filter(each => units.has(`${each.plotAreaInCents}_${each.superBuildUpArea}`));

// Main Filter Logic
const filteredData = () => {
    let data = [...villasData];

    if (data.length > 0 && selectedFacings.size > 0) {
        data = getFilteredUnitsByFacings(data, selectedFacings);
    };

    if (data.length > 0 && selectedTypes.size > 0) {
        data = getFilteredUnitsByTypes(data, selectedTypes);
    };

    if (data.length > 0 && selectedUnits.size > 0) {
        data = getFilteredUnitsByUnitSize(data, selectedUnits);
    };

    return data;
};

// Populate Villa Info Modal
const updateVillaInfoDetails = (villaData) => {
    villaId.textContent = villaData?.id.replace('Villa_', '');
    villaArea.textContent = `${villaData?.superBuildUpArea} sq.ft`;
    villaType.textContent = villaData?.bhkType;
    villaOrientation.textContent = villaData?.orientation;
    villaImage.src = villaData?.image;
};

const showVillaInfo = (villaId) => {
    const villaData = getVillaData(villaId);
    updateVillaInfoDetails(villaData);
    villaInfoModel.classList.remove('hidden');
    villaInfoModel.classList.add('flex');
};

const closeVillaInfo = () => {
    villaInfoModel.classList.remove('flex');
    villaInfoModel.classList.add('hidden');
};

villaInfoCloseBtn.addEventListener('click', closeVillaInfo);

const svgElementsSelection = (name) => {
    return layoutSVG.selectAll(`g[id^='${name}'] rect, g[id^='${name}'] path, g[id^='${name}'] polygon, g[id^='${name}'] circle`);
};

// Initialize interactive villas on load
const initializeVillaInteraction = (villaPrefix) => {
    resetSVGFill();

    const villas = svgElementsSelection(villaPrefix);

    function callback() {
        // Reset all before highlighting new selection
        layoutSVG.selectAll("rect, path, polygon, circle, polyline")
            .style("fill", "transparent")
            .style("cursor", "default")
            .style("stroke", "none")
            .style("filter", "none");

        const villaId = d3.select(this.parentNode).attr("id");

        selectedVillaId = villaId;
        villaID = villaId;
        showVillaInfo(selectedVillaId);

        d3.select(this)
            .transition()
            .duration(200)
            .style("cursor", "pointer")
            .style("fill", "rgba(16, 185, 129, 0.6)")
            .style("stroke", "#ffffff")
            .style("stroke-width", "10px")
            .style("stroke-linejoin", "round")
            .style("stroke-linecap", "round")
            .style("filter", "drop-shadow(0px 0px 5px rgba(0,0,0,0.5))");
    };

    function highlightVilla() {
        const villaData = getVillaData(d3.select(this.parentNode).attr("id"));
        updateVillaInfoDetails(villaData);

        d3.select(this)
            .transition()
            .duration(200)
            .style("cursor", "pointer")
            .style("fill", "rgba(16, 185, 129, 0.45)")
            .style("stroke", "#ffffff")
            .style("stroke-width", "5px")
            .style("stroke-linejoin", "round")
            .style("filter", "drop-shadow(0px 0px 4px rgba(0,0,0,0.3))");
    };

    function unhighlightVilla() {
        if (d3.select(this.parentNode).attr("id") !== selectedVillaId) {
            d3.select(this)
                .transition()
                .duration(200)
                .style("fill", "transparent")
                .style("stroke", "transparent")
                .style("stroke-width", "0px")
                .style("filter", "none");
        }

        if (selectedVillaId) {
            const villaData = getVillaData(selectedVillaId);
            updateVillaInfoDetails(villaData);
        }
    };

    villas.on("touchstart", callback);
    villas.on("click", callback);
    villas.on('mouseover', highlightVilla);
    villas.on('mouseout', unhighlightVilla);
};

// Update SVG based on selected filters
const updateFilteredData = () => {
    const filteredVillas = filteredData();
    resetSVGFill();

    filteredVillas.forEach(each => {
        const id = `#${each.id} rect, #${each.id} circle, #${each.id} path, #${each.id} polyline, #${each.id} polygon`;
        const villas = layoutSVG.selectAll(id);

        function handleVillaClick() {
            villaID = d3.select(this.parentNode).attr("id");
            showVillaInfo(villaID);

            d3.select(this).style("fill", "rgba(16, 185, 129, 0.8)");
        };

        villas.on("click", handleVillaClick);
        villas.on("touchstart", handleVillaClick);

        villas.style("cursor", "pointer")
            .transition()
            .duration(500)
            .style("stroke", '#ffffff')
            .style("stroke-width", "8px")
            .style("stroke-linejoin", "round")
            .style("fill", () => orientationColors[each.orientation] || "rgba(0,0,0,0.6)")
            .style("filter", "drop-shadow(0px 2px 4px rgba(0,0,0,0.5))");
    });
};

if (selectedFacings.size === 0 && selectedTypes.size === 0 && selectedUnits.size === 0) {
    initializeVillaInteraction("Villa_")
};

// Tab Navigation
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

// Initialize Toggles with style/filtering logic
toggleSelection(units, selectedUnits);
toggleSelection(orientations, selectedFacings);
toggleSelection(types, selectedTypes);

// Load Data
window.addEventListener("load", async () => {
    try {
        const response = await fetch('./js/data.json');
        const data = await response.json();
        villasData = data;
        console.log('Villas Data:', villasData);
    } catch (error) {
        console.error('Error loading JSON:', error);
    };
});

const themeSwitch = document.getElementById("themeSwitch");
const themeText = document.getElementById("themeText");

let isNight = true;

function updateThemeUI() {
    if (isNight) {
        timeOfDay = "night";
        themeSwitch.classList.add("night-mode");
        themeSwitch.classList.remove("day-mode");
        themeText.innerText = "NIGHT";
    } else {
        timeOfDay = "day";
        themeSwitch.classList.add("day-mode");
        themeSwitch.classList.remove("night-mode");
        themeText.innerText = "DAY";
    }

    updateLayoutVideo();
}

themeSwitch.addEventListener("click", () => {
    isNight = !isNight;
    updateThemeUI();
});

updateThemeUI();