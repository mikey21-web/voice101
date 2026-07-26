let villasData = []; // Array to hold villa data
let villasOptionsData = []; // Array to hold villa IDs

// DOM Elements
const tabs = document.querySelectorAll(".tab-btn");
const villaImage = document.getElementById("villaImage");
const villaSvg = document.getElementById("villaSvg");
const villaNumber = document.getElementById("villaNumber");
const villaOrientation = document.getElementById("villaOrientation");
const villaBhkType = document.getElementById("villaBhkType");
const plotArea = document.getElementById("plotArea");
const landUds = document.getElementById("landUds");
const superBuildupArea = document.getElementById("superBuildupArea");
const features = document.getElementById('features');
const featurePanelBtn = document.getElementById('featurePanelBtn');
const featurePanelCloseBtn = document.getElementById('featurePanelCloseBtn');
const backBtn = document.getElementById("backBtn");
const main = document.documentElement; // Standardized to documentElement for fullscreen
const fullScreenBtn = document.getElementById('fullScreenBtn');
const exitScreenBtn = document.getElementById('exitScreenBtn');
const villaDetailsPanelBtn = document.getElementById("villaDetailsPanelBtn");
const villaDetailsPanel = document.getElementById("villaDetailsPanel");
const levelItems = document.querySelectorAll(".floor-btn");
const virtualtourBtn = document.getElementById("virtualtourBtn");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
// Added villaLabelBtn for the click container
const villaLabelBtn = document.getElementById("villaLabelBtn");
const villaLabel = document.getElementById("villaLabel");
const villasInfo = document.getElementById("villasInfo");
const villasOptions = document.getElementById("villasOptions");
const tooltipText = document.getElementById("tooltipText");

const baseUrl = window.location.origin;
const urlParams = new URLSearchParams(window.location.search);
let villaId = urlParams.get('villaId');
let current_index = 0;

// --- Event Listeners ---

if (backBtn) {
    backBtn.addEventListener("click", () => window.location.href = 'webverse.html');
};

if (virtualtourBtn) {
    virtualtourBtn.addEventListener("click", () => {
        // Only navigate if the button is NOT disabled
        if (!virtualtourBtn.classList.contains('pointer-events-none')) {
            window.location.href = `virtualtour.html?villaId=${villaId}`;
        }
    });
}

if (villaDetailsPanelBtn) {
    villaDetailsPanelBtn.addEventListener("click", () => {
        // Check current state by looking for max-h-0 (Closed)
        if (villaDetailsPanel.classList.contains("max-h-0")) {
            // OPEN THE PANEL
            villaDetailsPanel.classList.remove("max-h-0", "opacity-0");
            villaDetailsPanel.classList.add("max-h-[500px]", "opacity-100");
        } else {
            // CLOSE THE PANEL
            villaDetailsPanel.classList.add("max-h-0", "opacity-0");
            villaDetailsPanel.classList.remove("max-h-[500px]", "opacity-100");
        }

        // Icon Rotation Logic
        const icon = villaDetailsPanelBtn.querySelector("svg");
        if (icon) icon.classList.toggle("rotate-180");
    });
}

levelItems.forEach(item => {
    item.addEventListener("click", () => {
        const levelId = item.getAttribute("data-type");
        window.location.href = `plan.html?villaId=${villaId}&levelId=${levelId}`;
    });
});

// Left Bottom Tabs Logic
tabs.forEach(tab => {
    const url = tab.getAttribute("data-type");

    tab.addEventListener("click", () => {
        // Simple navigation
        window.location.href = url;
    });
});

// --- Full Screen Logic ---
const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
        main.requestFullscreen().catch(err => {
            console.log(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
        });
        fullScreenBtn.classList.add("hidden");
        exitScreenBtn.classList.remove("hidden");
        if (tooltipText) tooltipText.textContent = "Exit Screen";
    } else {
        document.exitFullscreen();
        fullScreenBtn.classList.remove("hidden");
        exitScreenBtn.classList.add("hidden");
        if (tooltipText) tooltipText.textContent = "Full Screen";
    }
};

if (fullScreenBtn) fullScreenBtn.addEventListener("click", toggleFullScreen);
if (exitScreenBtn) exitScreenBtn.addEventListener("click", toggleFullScreen);

// --- Feature Panel ---
if (featurePanelBtn) {
    featurePanelBtn.addEventListener('click', () => features.classList.remove('translate-x-full'));
}
if (featurePanelCloseBtn) {
    featurePanelCloseBtn.addEventListener('click', () => features.classList.add('translate-x-full'));
}

// --- Data & Rendering Logic ---

const getVillaData = () => villasData.find(each => each.id === villaId);

const updateVillaId = () => {
    villaId = villasOptionsData[current_index];
};

const updateVillaLabel = () => {
    if (villaLabel) {
        // If ID is "Villa_1", show "Villa 1"
        const label = villaId ? villaId.replace("_", " ") : "Select Villa";
        villaLabel.textContent = label;
    }
};

const updateBrowserURL = () => {
    const newUrl = `${window.location.pathname}?villaId=${villaId}`;
    window.history.replaceState({}, "", newUrl);
};

const updateImage = (url) => {
    if (!url) return;
    villaImage.classList.remove('opacity-100');
    villaImage.classList.add('opacity-0');

    setTimeout(() => {
        villaImage.src = url;
        villaImage.onload = () => {
            villaImage.classList.remove('opacity-0');
            villaImage.classList.add('opacity-100');
        };
    }, 300);
};

const updateVillaDetails = (data) => {
    if (!data) return;
    if (villaNumber) villaNumber.textContent = data.id.split("_")[1];
    if (villaOrientation) villaOrientation.textContent = data.orientation;
    if (villaBhkType) villaBhkType.textContent = data.type.replace("_", " ");
    if (plotArea) plotArea.textContent = `${data.plotAreaInCents || data.plotArea} cents`;
    if (landUds) landUds.textContent = `${data.landUds} cents`;
    if (superBuildupArea) superBuildupArea.textContent = `${data.superBuildUpArea} sq.ft`;
};

// --- SVG Handling ---
const removeXMLDeclaration = (svgString) => svgString.replace(/<\?xml.*?\?>\s*/, '');

function highlightVillaLevel() {
    d3.select(this)
        .transition().duration(300)
        .style("cursor", "pointer")
        .style("fill", "rgba(0, 255, 255, 0.3)") // AQUA/CYAN Fill
        .style("stroke", "#00FFFF") // AQUA/CYAN Stroke
        .style("stroke-width", "2px");
}

function unhighlightVillaLevel() {
    d3.select(this)
        .transition().duration(300)
        .style("fill", "transparent")
        .style("stroke", "transparent");
}

const fetchSVGContent = async () => {
    try {
        const data = getVillaData();
        if (!data || !data.svg) {
            villaSvg.innerHTML = "";
            return;
        }

        const response = await fetch(data.svg);
        if (!response.ok) throw new Error("SVG fetch failed");

        const text = await response.text();
        villaSvg.innerHTML = removeXMLDeclaration(text);

        const svg = d3.select("#villaSvg svg");
        svg.attr("preserveAspectRatio", "xMidYMid slice")
            .attr('width', '100%')
            .attr('height', '100%');

        // Select polygons/paths from common layer IDs
        const levels = svg.selectAll("g[id*='ground'] *, g[id*='first'] *, g[id*='second'] *");

        // 1. SET INITIAL TRANSPARENCY TO REMOVE BLACK BOX
        levels.style("fill", "transparent")
            .style("stroke", "transparent")
            .style("cursor", "pointer");

        levels.on('mouseover', highlightVillaLevel)
            .on('mouseout', unhighlightVillaLevel)
            .on('touchstart', highlightVillaLevel)
            .on('touchend', unhighlightVillaLevel)
            .on("click", function () {
                // Attempt to find parent group ID for level name
                const parentId = this.parentNode.id || "";
                let levelName = "ground";
                if (parentId.toLowerCase().includes("first")) levelName = "first";
                if (parentId.toLowerCase().includes("second")) levelName = "second";

                window.location.href = `plan.html?villaId=${villaId}&levelId=${levelName}`;
            });

    } catch (e) {
        console.error("SVG Error:", e);
    }
};

// --- Villa Options Grid ---
const renderVillaOptions = (ids) => {
    if (!villasOptions) return;
    villasOptions.innerHTML = '';

    // Update total count
    const countEl = document.getElementById('totalVillasCount');
    if (countEl) countEl.textContent = ids.length;

    ids.forEach((id, index) => {
        const num = id.split('_')[1];
        const btn = document.createElement("button");
        btn.textContent = num;
        btn.setAttribute("data-type", id);

        // Base Styling
        let classes = "h-8 w-full rounded-md text-xs font-semibold flex items-center justify-center transition-all duration-200 border select-none ";

        // Active vs Inactive
        if (id === villaId) {
            // Gold Active State
            classes += "bg-gradient-to-r from-[#BE9B42] to-[#D4AF37] text-black border-[#D4AF37] shadow-md shadow-[#D4AF37]/30 transform scale-105";

            // Scroll to active element
            setTimeout(() => {
                btn.scrollIntoView({
                    behavior: 'smooth',
                    block: 'nearest',
                    inline: 'center'
                });
            }, 100);
        } else {
            // Inactive State
            classes += "bg-white/5 text-gray-400 border-white/10 hover:bg-white/20 hover:text-white hover:border-white/30";
        }

        btn.className = classes;

        btn.addEventListener("click", (e) => {
            e.stopPropagation(); // Prevent closing if handled elsewhere
            current_index = index;
            updateVillaInfo();
        });

        villasOptions.appendChild(btn);
    });
};

const updateVillaInfo = () => {
    updateVillaId();
    updateVillaLabel();
    updateBrowserURL();

    // SAVE TO LOCAL STORAGE
    if (villaId) {
        localStorage.setItem("lastVisitedVilla", villaId);
    }

    const data = getVillaData();
    if (data) {
        updateImage(data.image);
        updateVillaDetails(data);
        fetchSVGContent();

        if (data.virtualTour && data.virtualTour !== "") {
            // ENABLE BUTTON
            virtualtourBtn.classList.remove("opacity-50", "cursor-not-allowed", "pointer-events-none");
            virtualtourBtn.classList.add("hover:shadow-lg", "cursor-pointer");
        } else {
            // DISABLE BUTTON (Greyed out)
            virtualtourBtn.classList.add("opacity-50", "cursor-not-allowed", "pointer-events-none");
            virtualtourBtn.classList.remove("hover:shadow-lg", "cursor-pointer");
        }
    }

    // Re-render grid to update active styling
    renderVillaOptions(villasOptionsData);
};

// --- Next / Prev Logic ---
if (prevBtn) {
    prevBtn.addEventListener("click", () => {
        if (current_index > 0) {
            current_index--;
            updateVillaInfo();
        }
    });
}

if (nextBtn) {
    nextBtn.addEventListener("click", () => {
        if (current_index < villasOptionsData.length - 1) {
            current_index++;
            updateVillaInfo();
        }
    });
}

// --- Init ---
window.addEventListener("load", async () => {
    try {
        const response = await fetch('./js/data.json');
        const data = await response.json();
        villasData = data;

        villasOptionsData = data.map(v => v.id);

        if (villaId) {
            current_index = villasOptionsData.indexOf(villaId);

            if (current_index === -1) {
                current_index = 0;
                villaId = villasOptionsData[0];
            }
        }

        else {
            const lastSeen = localStorage.getItem("lastVisitedVilla");

            if (lastSeen && villasOptionsData.includes(lastSeen)) {

                villaId = lastSeen;
                current_index = villasOptionsData.indexOf(lastSeen);
            } else {
        
                current_index = 0;
                if (villasOptionsData.length > 0) villaId = villasOptionsData[0];
            }
        }

        updateVillaInfo();

    } catch (error) {
        console.error('Error loading JSON:', error);
    }
});

if (villaLabelBtn && villasInfo) {

    villaLabelBtn.addEventListener("click", (e) => {
        e.stopPropagation(); 
    
        villasInfo.classList.toggle("!visible");
        villasInfo.classList.toggle("!opacity-100");
        villasInfo.classList.toggle("!translate-y-0");
    });

    document.addEventListener("click", (e) => {
        if (!villasInfo.contains(e.target) && !villaLabelBtn.contains(e.target)) {
            villasInfo.classList.remove("!visible", "!opacity-100", "!translate-y-0");
        }
    });

    villasInfo.addEventListener("click", (e) => {
        e.stopPropagation();
    });
}