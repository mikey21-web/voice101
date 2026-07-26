// --- Global Variables ---
let villasData = [];
let currentVillaId = null;
let currentLevel = "ground"; // ground, first, second
let currentView = "isometric"; // 2d, isometric
let compareViewMode = "2d"; // For comparison modal
let scale = 1;
let isDragging = false;
let startX = 0, startY = 0, translateX = 0, translateY = 0;

// Comparison State
let compareSlots = [null, null];

// --- DOM Elements ---
const floorPlanImg = document.getElementById("floorPlan");

// Stats Elements
const villaNumberEl = document.getElementById("villaNumber");
const bhkTypeEl = document.getElementById("villaBhkType");
const areaEl = document.getElementById("villaArea");
const facingEl = document.getElementById("villaOrientation");

// Sidebar Collapse
const detailsBtn = document.getElementById('detailsHeader');
const detailsPanel = document.getElementById('villaDetailsContent');
const detailsIcon = document.getElementById('detailsIcon');

// Control Buttons
const viewToggleBtns = document.querySelectorAll(".view-toggle-btn");
const frontViewBtn = document.getElementById("frontViewBtn");
const floorBtns = document.querySelectorAll(".floor-btn");
const virtualTourBtn = document.getElementById("virtualTourBtn");
const openSpecsBtn = document.getElementById("openSpecsBtn");

// Specs Panel
const specsPanel = document.getElementById("specificationsPanel");
const specsList = document.getElementById("specificationsList");
const closeSpecsBtn = document.getElementById("closeSpecsBtn");
const specVillaId = document.getElementById("specVillaId");
const specOrientation = document.getElementById("specOrientation");
const specFloor = document.getElementById("specFloor");

// Comparison Elements
const openComparePopupBtn = document.getElementById("openComparePopupBtn");
const compareSelectionModal = document.getElementById("compareSelectionModal");
const closeCompareSelectionBtn = document.getElementById("closeCompareSelectionBtn");
const compareSlot1 = document.getElementById("compareSlot1");
const compareSlot2 = document.getElementById("compareSlot2");
const addCurrentToCompareBtn = document.getElementById("addCurrentToCompare");
const compareNowBtn = document.getElementById("compareNowBtn");
const compareDropdown = document.getElementById("compareDropdown");
const compareWrapper = document.getElementById("villaComparisionWrapper");
const comparisonContent = document.getElementById("comparisonContent");
const compareCloseBtn = document.getElementById("compareCloseBtn");
const compareViewBtns = document.querySelectorAll(".compare-view-btn");

// Navigation & Menus (Bottom Nav)
const prevBtn = document.getElementById("PreviousBtn");
const nextBtn = document.getElementById("NextBtn");
const navLabel = document.getElementById("galleryItemLabel");
const villasInfo = document.getElementById("villasInfo");
const villasOptions = document.getElementById("villasOptions");

// Features
const featuresMenu = document.getElementById('features');
const featurePanelBtn = document.getElementById('featurePanelBtn');
const featurePanelCloseBtn = document.getElementById('featurePanelCloseBtn');
const fullScreenBtn = document.getElementById("fullScreenBtn");
const exitScreenBtn = document.getElementById("exitScreenBtn");
const backBtn = document.getElementById("backBtn");

// Bottom Left Tabs
const tabBtns = document.querySelectorAll(".tab-btn");


// --- Initialization ---

window.addEventListener("load", async () => {
    try {
        const response = await fetch('./js/data.json');
        villasData = await response.json();

        // Parse URL Params
        const urlParams = new URLSearchParams(window.location.search);
        // Default to first villa if none provided
        currentVillaId = urlParams.get('villaId') || (villasData.length > 0 ? villasData[0].id : null);
        
        const levelParam = urlParams.get('levelId');
        if (levelParam) currentLevel = levelParam;

        if (currentVillaId) {
            loadVilla(currentVillaId);
            // Open Specs on Load
            toggleSpecsPanel(true);
        }

        updateCompareCount();
        updateCompareUI();

    } catch (error) {
        console.error("Error initializing app:", error);
    }
});


// --- Core Logic ---

function loadVilla(id) {
    const villa = villasData.find(v => v.id === id);
    if (!villa) return;

    currentVillaId = id;

    // Update Details Text
    const vId = villa.id.replace("Villa_", "");
    if(villaNumberEl) villaNumberEl.textContent = "Villa " + vId;
    if(bhkTypeEl) bhkTypeEl.textContent = villa.type || villa.bhkType; 
    if(areaEl) areaEl.textContent = `${villa.superBuildUpArea} ${villa.units || 'SFT'}`;
    if(facingEl) facingEl.textContent = villa.orientation;
    
    // Update Specs Header
    if(specVillaId) specVillaId.textContent = vId;
    if(specOrientation) specOrientation.textContent = villa.orientation;
    if(specFloor) specFloor.textContent = currentLevel;

    // Update Bottom Label
    if(navLabel) navLabel.textContent = "Villa " + vId;

    // Update Front View Button Link
    if(frontViewBtn) {
        frontViewBtn.onclick = () => {
            window.location.href = `villa.html?villaId=${currentVillaId}`;
        };
    }

    updateActiveButtons();
    updateFloorPlanDisplay(villa);
    
    // Re-render navigation grid to update the Gold/Active state
    renderVillaNavigation();
    
    updateCompareUI();

    // Update Browser URL without reloading
    const newUrl = `${window.location.pathname}?villaId=${id}&levelId=${currentLevel}`;
    window.history.replaceState({}, '', newUrl);
}

function updateFloorPlanDisplay(villa) {
    let imgSrc = "";
    
    // Safety check for plans
    if (villa.plans) {
        const levelData = villa.plans.find(p => p.level.toLowerCase() === currentLevel.toLowerCase());

        if (levelData) {
            imgSrc = currentView === "isometric" ? levelData.isometricImg : levelData["2dImg"];
            
            renderSpecifications(levelData);

            // Virtual Tour Button Logic
            if (levelData.virtualTour) {
                virtualTourBtn.classList.remove("opacity-50", "pointer-events-none", "cursor-not-allowed");
                virtualTourBtn.onclick = () => {
                    window.location.href = `virtualtour.html?villaId=${villa.id}&levelId=${currentLevel}`;
                };
            } else {
                virtualTourBtn.classList.add("opacity-50", "pointer-events-none", "cursor-not-allowed");
                virtualTourBtn.onclick = null;
            }
        } else {
            // Handle missing level data
            renderSpecifications(null);
        }
    }

    // Image Transition
    floorPlanImg.style.opacity = 0;
    setTimeout(() => {
        if(imgSrc) {
            floorPlanImg.src = imgSrc;
            floorPlanImg.onload = () => {
                floorPlanImg.style.opacity = 1;
                resetZoom(); 
            };
        }
    }, 200);
}

// --- Specification Logic ---

function renderSpecifications(levelData) {
    if (!specsList) return;
    specsList.innerHTML = "";

    // Update Header floor
    if(specFloor) specFloor.textContent = currentLevel;

    if (!levelData || !levelData.specifications || levelData.specifications.length === 0) {
        specsList.innerHTML = "<li class='text-gray-500 text-xs p-4 text-center'>No specifications available for this level.</li>";
        return;
    }

    levelData.specifications.forEach(spec => {
        const li = document.createElement("li");
        li.className = "flex justify-between items-center py-2.5 px-4 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors group";
        li.innerHTML = `
            <span class="text-xs text-gray-300 font-medium group-hover:text-white transition-colors">${spec.name}</span>
            <span class="text-xs text-[#BE9B42] font-mono font-bold">${spec.dimensions}</span>
        `;
        specsList.appendChild(li);
    });
}

function toggleSpecsPanel(show) {
    if (!specsPanel) return;
    if (show) {
        specsPanel.classList.remove("translate-x-[150%]", "opacity-0");
    } else {
        specsPanel.classList.add("translate-x-[150%]", "opacity-0");
    }
}

// ---------------------------------------------------------

function updateActiveButtons() {
    // View Buttons Active State
    viewToggleBtns.forEach(btn => {
        const viewType = btn.getAttribute("data-view");
        if (viewType === currentView) {
            btn.className = "view-toggle-btn py-1.5 rounded text-[10px] font-bold bg-white text-black shadow-sm transition-all";
        } else {
            btn.className = "view-toggle-btn py-1.5 rounded text-[10px] font-medium text-gray-400 hover:text-white hover:bg-white/10 transition-all";
        }
    });

    // Floor Buttons Active State
    floorBtns.forEach(btn => {
        const floorType = btn.getAttribute("data-floor").toLowerCase();
        if (currentLevel.toLowerCase().includes(floorType)) {
            // CHANGED: White background with Black text (same as view buttons)
            btn.className = "floor-btn flex-1 py-1.5 rounded text-[10px] font-bold bg-white text-black shadow-md transition-all text-center";
        } else {
            btn.className = "floor-btn flex-1 py-1.5 rounded text-[10px] font-medium text-gray-400 hover:text-white hover:bg-white/10 transition-all text-center";
        }
    });
}

// Event Listeners for Buttons
viewToggleBtns.forEach(btn => {
    btn.addEventListener("click", () => {
        currentView = btn.getAttribute("data-view");
        loadVilla(currentVillaId);
    });
});

floorBtns.forEach(btn => {
    btn.addEventListener("click", () => {
        const rawFloor = btn.getAttribute("data-floor").toLowerCase();
        if(rawFloor.includes("ground")) currentLevel = "ground";
        else if(rawFloor.includes("first")) currentLevel = "first";
        else if(rawFloor.includes("second")) currentLevel = "second";
        loadVilla(currentVillaId);
    });
});


// --- Sidebar Collapse ---
if(detailsBtn && detailsPanel) {
    detailsPanel.style.maxHeight = '1000px'; 
    detailsPanel.style.opacity = '1';

    detailsBtn.addEventListener('click', () => {
        const isOpen = detailsPanel.style.maxHeight !== '0px';
        if(isOpen) {
            detailsPanel.style.maxHeight = '0px';
            detailsPanel.style.opacity = '0';
            detailsIcon.style.transform = 'rotate(0deg)';
            detailsBtn.classList.remove('border-b');
        } else {
            detailsPanel.style.maxHeight = '1000px';
            detailsPanel.style.opacity = '1';
            detailsIcon.style.transform = 'rotate(180deg)';
            detailsBtn.classList.add('border-b');
        }
    });
}


// --- Comparison Logic (Popups) ---

if(openComparePopupBtn) {
    openComparePopupBtn.addEventListener("click", () => {
        compareSelectionModal.classList.remove("hidden");
    });
}

if(closeCompareSelectionBtn) {
    closeCompareSelectionBtn.addEventListener("click", () => {
        compareSelectionModal.classList.add("hidden");
    });
}

function updateCompareUI() {
    const slot1Text = compareSlot1.querySelector("span");
    const slot2Text = compareSlot2.querySelector("span");
    const clear1 = compareSlot1.nextElementSibling;
    const clear2 = compareSlot2.nextElementSibling;

    // Slot 1
    if(compareSlots[0]) {
        slot1Text.textContent = compareSlots[0].replace("Villa_", "Villa ");
        slot1Text.classList.add("text-[#BE9B42]", "font-bold");
        clear1.classList.remove("hidden");
    } else {
        slot1Text.textContent = "Select";
        slot1Text.classList.remove("text-[#BE9B42]", "font-bold");
        clear1.classList.add("hidden");
    }

    // Slot 2
    if(compareSlots[1]) {
        slot2Text.textContent = compareSlots[1].replace("Villa_", "Villa ");
        slot2Text.classList.add("text-[#BE9B42]", "font-bold");
        clear2.classList.remove("hidden");
    } else {
        slot2Text.textContent = "Select";
        slot2Text.classList.remove("text-[#BE9B42]", "font-bold");
        clear2.classList.add("hidden");
    }

    // Compare Button
    if(compareSlots[0] && compareSlots[1]) {
        compareNowBtn.classList.remove("opacity-50", "cursor-not-allowed");
        compareNowBtn.classList.add("hover:bg-[#BE9B42]", "hover:text-white");
        compareNowBtn.disabled = false;
    } else {
        compareNowBtn.classList.add("opacity-50", "cursor-not-allowed");
        compareNowBtn.classList.remove("hover:bg-[#BE9B42]", "hover:text-white");
        compareNowBtn.disabled = true;
    }

    // Add Current Button
    const isAdded = compareSlots.includes(currentVillaId);
    const isFull = compareSlots[0] && compareSlots[1];

    if(isAdded) {
        addCurrentToCompareBtn.innerHTML = '<i class="fa-solid fa-check"></i> Current Villa Added';
        addCurrentToCompareBtn.disabled = true;
        addCurrentToCompareBtn.classList.add("opacity-50");
    } else if (isFull) {
        addCurrentToCompareBtn.innerHTML = 'Slots Full';
        addCurrentToCompareBtn.disabled = true;
        addCurrentToCompareBtn.classList.add("opacity-50");
    } else {
        addCurrentToCompareBtn.innerHTML = '+ Add Current Villa';
        addCurrentToCompareBtn.disabled = false;
        addCurrentToCompareBtn.classList.remove("opacity-50");
    }
}

addCurrentToCompareBtn.addEventListener("click", () => {
    if(!compareSlots[0]) compareSlots[0] = currentVillaId;
    else if(!compareSlots[1]) compareSlots[1] = currentVillaId;
    updateCompareUI();
});

window.clearSlot = (index) => {
    compareSlots[index] = null;
    updateCompareUI();
};

const showDropdown = (slotIndex, anchorElement) => {
    compareDropdown.innerHTML = "";
    compareDropdown.classList.remove("hidden");
    
    // Position fixed to viewport, not parent
    const rect = anchorElement.getBoundingClientRect();
    compareDropdown.style.top = `${rect.bottom + 5}px`;
    compareDropdown.style.left = `${rect.left}px`;

    villasData.forEach(v => {
        if(compareSlots.includes(v.id)) return;

        const item = document.createElement("div");
        item.className = "px-3 py-2 text-[10px] text-white hover:bg-[#BE9B42] hover:text-black cursor-pointer border-b border-white/10 last:border-0";
        item.textContent = v.id.replace("Villa_", "Villa ");
        item.onclick = (e) => {
            e.stopPropagation();
            compareSlots[slotIndex] = v.id;
            compareDropdown.classList.add("hidden");
            updateCompareUI();
        };
        compareDropdown.appendChild(item);
    });

    const closeDrop = (e) => {
        if(!compareDropdown.contains(e.target) && !anchorElement.contains(e.target)) {
            compareDropdown.classList.add("hidden");
            document.removeEventListener("click", closeDrop);
        }
    };
    setTimeout(() => document.addEventListener("click", closeDrop), 10);
};

compareSlot1.addEventListener("click", () => showDropdown(0, compareSlot1));
compareSlot2.addEventListener("click", () => showDropdown(1, compareSlot2));

compareNowBtn.addEventListener("click", () => {
    if(!compareSlots[0] || !compareSlots[1]) return;
    const v1 = villasData.find(v => v.id === compareSlots[0]);
    const v2 = villasData.find(v => v.id === compareSlots[1]);
    
    if(v1 && v2) {
        compareSelectionModal.classList.add("hidden");
        renderComparisonContent(v1, v2);
        compareWrapper.classList.remove("hidden");
    }
});

compareCloseBtn.addEventListener("click", () => compareWrapper.classList.add("hidden"));

// Compare View Toggles
compareViewBtns.forEach(btn => {
    btn.addEventListener("click", () => {
        compareViewMode = btn.getAttribute("data-mode");
        
        compareViewBtns.forEach(b => {
            if(b.getAttribute("data-mode") === compareViewMode) {
                b.className = "compare-view-btn px-4 py-1.5 rounded-full text-xs font-bold bg-[#BE9B42] text-black shadow-md";
            } else {
                b.className = "compare-view-btn px-4 py-1.5 rounded-full text-xs font-medium text-gray-400 hover:text-white bg-white/5";
            }
        });

        const v1 = villasData.find(v => v.id === compareSlots[0]);
        const v2 = villasData.find(v => v.id === compareSlots[1]);
        if(v1 && v2) renderComparisonContent(v1, v2);
    });
});

function renderComparisonContent(v1, v2) {
    comparisonContent.innerHTML = "";
    
    [v1, v2].forEach(v => {
        const col = document.createElement("div");
        col.className = "w-full md:w-1/2 max-w-[500px] flex flex-col gap-4 bg-[#181818] p-4 rounded-xl border border-white/5 shadow-lg mx-auto md:mx-0";
        
        let contentHTML = `
            <div class="bg-black/40 p-4 rounded-xl border border-white/10 text-center shadow-inner relative overflow-hidden group">
                <div class="absolute inset-0 opacity-20 bg-cover bg-center z-0" style="background-image: url('${v.image}');"></div>
                
                <div class="relative z-10">
                    <h3 class="text-[#BE9B42] font-bold text-xl mb-3 drop-shadow-md">${v.id.replace("Villa_", "Villa ")}</h3>
                    
                    <div class="relative h-48 w-full rounded-lg overflow-hidden mb-4 border border-white/10 group-hover:border-[#BE9B42]/50 transition-colors">
                        <img src="${v.image}" class="absolute inset-0 w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700">
                    </div>

                    <div class="text-xs text-gray-300 grid grid-cols-2 gap-y-3 gap-x-4 text-left bg-black/60 p-3 rounded-lg backdrop-blur-sm">
                        
                        <div class="flex flex-col">
                            <span class="text-gray-500 font-medium text-[10px] uppercase">BHK</span>
                            <span class="font-bold uppercase text-white">${v.bhkType || '--'}</span>
                        </div>

                        <div class="flex flex-col">
                            <span class="text-gray-500 font-medium text-[10px] uppercase">Type</span>
                            <span class="font-bold uppercase text-white">${v.type || '--'}</span>
                        </div>

                        <div class="flex flex-col">
                            <span class="text-gray-500 font-medium text-[10px] uppercase">Area</span>
                            <span class="font-bold text-white">${v.superBuildUpArea}</span>
                        </div>

                        <div class="flex flex-col">
                            <span class="text-gray-500 font-medium text-[10px] uppercase">Facing</span>
                            <span class="font-bold text-white">${v.orientation}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        ["ground", "first", "second"].forEach(floor => {
            const levelData = v.plans.find(p => p.level.toLowerCase() === floor);
            const planImg = levelData ? (compareViewMode === "isometric" ? levelData.isometricImg : levelData["2dImg"]) : null;
            
            let specsHTML = "";
            if (levelData && levelData.specifications && levelData.specifications.length > 0) {
                specsHTML = `<ul class="mt-3 text-[11px] space-y-2 border-t border-white/5 pt-2">`;
                levelData.specifications.forEach(s => {
                    specsHTML += `
                        <li class="flex justify-between items-center text-gray-400 bg-white/5 px-2 py-1 rounded">
                            <span>${s.name}</span>
                            <span class="text-[#BE9B42] font-mono font-bold">${s.dimensions}</span>
                        </li>`;
                });
                specsHTML += `</ul>`;
            } else {
                specsHTML = `<p class="text-[10px] text-gray-600 mt-2 text-center italic py-2">No specs available</p>`;
            }

            contentHTML += `
                <div class="bg-black/20 rounded-xl border border-white/5 overflow-hidden mt-2">
                    <div class="bg-white/5 px-4 py-2 border-b border-white/5 flex justify-between items-center">
                        <span class="text-xs font-bold text-white uppercase tracking-wider">${floor} Floor</span>
                        <span class="text-[9px] text-gray-500 uppercase tracking-widest border border-gray-700 px-1.5 rounded">${compareViewMode}</span>
                    </div>

                    <div class="p-3">
                        <div class="h-56 w-full bg-[#0a0a0a] rounded-lg flex items-center justify-center overflow-hidden border border-white/5 mb-2 relative group">
                            ${planImg 
                                ? `<img src="${planImg}" class="w-full h-full object-contain p-2 transition-transform duration-300 group-hover:scale-110">` 
                                : '<div class="flex flex-col items-center gap-2 text-gray-600"><i class="fa-regular fa-image text-2xl"></i><span class="text-xs">No Plan Image</span></div>'
                            }
                        </div>
                        
                        <div class="bg-black/40 rounded p-2">
                            ${specsHTML}
                        </div>
                    </div>
                </div>
            `;
        });

        col.innerHTML = contentHTML;
        comparisonContent.appendChild(col);
    });
}

// --- Bottom Navigation (Popup Grid) ---

function renderVillaNavigation() {
    if(!villasOptions) return;
    villasOptions.innerHTML = "";
    
    const totalEl = document.getElementById("totalVillasCount");
    if(totalEl) totalEl.textContent = villasData.length;

    villasData.forEach(v => {
        const btn = document.createElement("button");
        const num = v.id.replace("Villa_", "");
        const isCurrent = v.id === currentVillaId;
        
        let classes = "h-8 w-full rounded text-xs font-bold flex items-center justify-center transition-all duration-200 border select-none ";
        
        if (isCurrent) {
            classes += "bg-gradient-to-r from-[#BE9B42] to-[#D4AF37] text-black border-[#D4AF37] shadow-lg shadow-[#D4AF37]/20 scale-105";
            setTimeout(() => {
                btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }, 100);
        } else {
            classes += "bg-white/5 text-gray-400 border-white/5 hover:bg-white/10 hover:text-white hover:border-white/20";
        }
        
        btn.className = classes;
        btn.textContent = num;
        
        btn.onclick = (e) => {
            e.stopPropagation();
            loadVilla(v.id);
        };
        
        villasOptions.appendChild(btn);
    });
}

// Next/Prev Buttons Logic
if(nextBtn) {
    nextBtn.addEventListener("click", () => {
        const idx = villasData.findIndex(v => v.id === currentVillaId);
        if (idx !== -1 && idx < villasData.length - 1) {
            loadVilla(villasData[idx + 1].id);
        } else if (idx === villasData.length - 1) {
            loadVilla(villasData[0].id); // Loop back
        }
    });
}

if(prevBtn) {
    prevBtn.addEventListener("click", () => {
        const idx = villasData.findIndex(v => v.id === currentVillaId);
        if (idx > 0) {
            loadVilla(villasData[idx - 1].id);
        } else if (idx === 0) {
            loadVilla(villasData[villasData.length - 1].id); // Loop to end
        }
    });
}


// --- Zoom & Pan ---
function resetZoom() {
    scale = 1;
    translateX = 0;
    translateY = 0;
    floorPlanImg.style.transform = `scale(${scale}) translate(${translateX}px, ${translateY}px)`;
}

document.body.addEventListener('wheel', (e) => {
    if(e.target.closest('#leftSidebar') || e.target.closest('#features') || e.target.closest('#specificationsPanel') || e.target.closest('.overflow-y-auto')) return;
    
    e.preventDefault();
    const zoomSpeed = 0.1;
    const newScale = e.deltaY > 0 ? scale - zoomSpeed : scale + zoomSpeed;
    scale = Math.min(Math.max(1, newScale), 5);
    if (scale === 1) { translateX = 0; translateY = 0; }
    floorPlanImg.style.transform = `scale(${scale}) translate(${translateX}px, ${translateY}px)`;
}, { passive: false });

floorPlanImg.addEventListener('mousedown', (e) => {
    isDragging = true;
    startX = e.clientX - translateX * scale;
    startY = e.clientY - translateY * scale;
    floorPlanImg.style.cursor = "grabbing";
});

window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    e.preventDefault();
    translateX = (e.clientX - startX) / scale;
    translateY = (e.clientY - startY) / scale;
    floorPlanImg.style.transform = `scale(${scale}) translate(${translateX}px, ${translateY}px)`;
});

window.addEventListener('mouseup', () => {
    isDragging = false;
    floorPlanImg.style.cursor = "grab";
});


// --- Misc Menus ---
function updateCompareCount() {} 

if(openSpecsBtn) openSpecsBtn.addEventListener("click", () => toggleSpecsPanel(true));
if(closeSpecsBtn) closeSpecsBtn.addEventListener("click", () => toggleSpecsPanel(false));

if(featurePanelBtn) featurePanelBtn.addEventListener('click', () => featuresMenu.classList.remove('translate-x-full'));
if(featurePanelCloseBtn) featurePanelCloseBtn.addEventListener('click', () => featuresMenu.classList.add('translate-x-full'));

if(fullScreenBtn) fullScreenBtn.addEventListener("click", () => { 
    if(document.documentElement.requestFullscreen) { 
        document.documentElement.requestFullscreen(); 
        fullScreenBtn.classList.add("hidden"); 
        exitScreenBtn.classList.remove("hidden"); 
    }
});

if(exitScreenBtn) exitScreenBtn.addEventListener("click", () => { 
    if(document.exitFullscreen) { 
        document.exitFullscreen(); 
        exitScreenBtn.classList.add("hidden"); 
        fullScreenBtn.classList.remove("hidden"); 
    }
});

// Left Tabs Navigation
tabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
        const url = btn.getAttribute("data-type");
        if(url) window.location.href = url;
    });
});

if (backBtn) {
    backBtn.addEventListener("click", () => window.location.href = 'villa.html');
};

const villaLabelBtn = document.getElementById("villaLabelBtn");

if (villaLabelBtn && villasInfo) {
    // Toggle Logic for Mobile/Tablet Click
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