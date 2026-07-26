import panzoom from 'https://cdn.jsdelivr.net/npm/@panzoom/panzoom/+esm';

// Browser Params
const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);
let unitId = urlParams.get('unitId');

let currentSection = "home";                                          
let sectionHistory = [];   

const tooltip = document.querySelector(".tooltip");

const spimLogo = document.getElementById("spimLogo");

const liveBtnWrapper = document.getElementById("liveBtnWrapper");
const bgAudioWrapper = document.getElementById("bgAudioWrapper");

const tabs = document.querySelectorAll("#leftPanel .tab-btn");
const leftPanel = document.getElementById("leftPanel"); 

const clubhousesDropdown = document.getElementById("clubhousesDropdown");
const dropdownToggle = document.getElementById('dropdownToggle');
const arrowIcon = document.getElementById("arrowIcon");
const dropdownMenu = document.getElementById('dropdownMenu');
const dropdownMenuItems = document.querySelectorAll('#dropdownMenu li');
const dropdownToggleLabel = dropdownToggle.querySelector('span');

let data;
let clubhouseType = "all";
let filteredAmenities;

const toggleDropdown = () => {
    dropdownMenu.classList.toggle("hidden");
    arrowIcon.classList.toggle("rotate-180");
};

dropdownToggle.addEventListener('click', toggleDropdown);

dropdownMenuItems.forEach(item => {
    item.addEventListener("click", () => {
        clubhouseType = item.getAttribute("data-type");
        console.log("club type", clubhouseType)
        document.getElementById("dropdownLabel").textContent = `${clubhouseType.replace("_", " ")}`;

        if (clubhouseType === "all") {
            filteredAmenities = [...data?.amenities]   
            console.log("43 filtered amenities", filteredAmenities)
        } else {
            filteredAmenities = [...data?.amenities].filter(item => item.clubhouse === clubhouseType);
            console.log("46 filtered amenities", filteredAmenities)
        };
        
        renderAmenities(filteredAmenities)

        console.log("filtered amenities", filteredAmenities)
        toggleDropdown();
    });
});

// LOADER WRAPPER
const loaderWrapper = document.getElementById('loaderWrapper');
const loaderText = document.getElementById("loaderText");

const detailsIcon = document.getElementById("detailsIcon");
const unitPlansDetailsWrapper = document.getElementById("unitPlansDetailsWrapper");

// -------------------- COMMON BUTTONS --------------------
const homeBtn = document.getElementById('homeBtn'); // Home Button
const backBtn = document.getElementById('backBtn'); // Back Button
const unitPlansHomeBtn = document.getElementById('unitPlansHomeBtn'); // Unit Plans Home Button
const unitPlansBackBtn = document.getElementById('unitPlansBackBtn'); // Unit Plans Back Button
const shareBrochureBtn = document.getElementById('shareBrochureBtn'); // Share Button
const bgAudioBtn = document.getElementById('bgAudioBtn'); // Background Audio Button
const bgAudioIcon = document.getElementById('bgAudioIcon'); // Background Audio Icon
const bgAudio = document.getElementById('bgAudio'); //  Background Audio 
const bgAudioSource = document.querySelector('#bgAudio source'); // Layout Video Source
const themeToggleContainer = document.getElementById('themeToggleContainer'); // Theme Toggle Container
const themeToggleInput = document.getElementById('themeToggleInput'); // Theme Toggle Input

// -------------------- FULL & EXIT SCREEN --------------------
const main = document.body; // Main
const fullScreenBtn = document.getElementById('fullScreenBtn'); // Full Screen Button
const exitScreenBtn = document.getElementById('exitScreenBtn'); // Exit Screen Button
const screenLabel  = document.getElementById("screenLabel");

// -------------------- Logo Wrapper --------------------
const logoWrapper = document.getElementById('logoWrapper'); // Logo Wrapper

// -------------------- Common Buttons Wrapper --------------------
const commonBtnsWrapper = document.getElementById('commonBtnsWrapper'); // Common Buttons Wrapper

// -------------------- Virtual Tour --------------------
const virtualTour = document.getElementById('virtualTour'); // Virtual Tour 
const virtualTourLink = document.getElementById('virtualTourLink'); // Virtual Tour Link

const home = document.getElementById("home");

// -------------------- MAIN lAYOUT --------------------
const webverse = document.getElementById("webverse"); // Main Layout
const layoutVideo = document.getElementById('layoutVideo'); // Layout Video 
const layoutVideoSource = document.querySelector('#layoutVideo source'); // Layout Video Source
const layoutImage = document.getElementById('layoutImage'); // Layout Image
const layoutSvg = document.getElementById('layoutSvg'); // Layout SVG
const layoutControls = document.getElementById('layoutControls'); // Layout Controls Section
const layoutPrevBtn = document.getElementById('layoutPrevBtn'); // Webverse Previous Button
const layoutNextBtn = document.getElementById('layoutNextBtn'); // Webverse Next Button

// -------------------- WEBVERSE --------------------
const webverseBlock = document.getElementById('webverseBlock'); // Webverse
const blockVideo = document.getElementById('blockVideo'); // Layout Video 
const blockVideoSource = document.querySelector('#blockVideo source'); // Layout Video Source
const blockImage = document.getElementById('blockImage'); // Layout Image
const blockSvg = document.getElementById('blockSvg'); // Layout SVG
const webverseControls = document.getElementById('webverseControls'); // Webverse Controls Section
const webversePrevBtn = document.getElementById('webversePrevBtn'); // Webverse Previous Button
const webverseNextBtn = document.getElementById('webverseNextBtn'); // Webverse Next Button
const svgTypes = document.getElementById('svgTypes'); // SVG Types Section
const svgTypesList = document.querySelectorAll('.svgTypes li'); // SVG Types List
const viewTypesList = document.querySelectorAll('.viewTypes li'); // View Types List
const hideOverlay = document.getElementById('hideOverlay'); // Hide Overaly Section
const toggleSwitch = document.getElementById('toggleSwitch'); // Toggle Switch
const webverseFilterBtn = document.getElementById('webverseFilterBtn'); // Webverse Filter Button
const webverseFilters = document.getElementById('webverseFilters'); // Webverse Filters
const webversFilterCloseBtn = document.getElementById('webversFilterCloseBtn'); // Webverse Filter Close Button
const orientationEl = document.getElementById("orientation");
const typeEl = document.getElementById("type");
const unitEl = document.getElementById("unit");
const noteEl = document.getElementById("note");
const reraCopyBtn = document.getElementById('reraCopyBtn'); // RERA Copy Button
const applyFiltersBtn = document.getElementById('applyFiltersBtn'); // Apply Filters Button
const resetFiltersBtn = document.getElementById('resetFiltersBtn'); // Reset Filter Button
let isBlockEventListenersAdded = false; // Is Event Listener Added
let isLayoutEventListenersAdded = false; // Is Event Listener Added
const webverseTowerLabel = document.getElementById('webverseTowerLabel'); // Webverse Tower Label

// -------------------- INTERIOR --------------------
const interior = document.getElementById('interior'); // Interior
const virtualTourList = document.getElementById("virtualTourList");
const normalInteriorsList = document.getElementById("normalInteriorsList");
const interiorImageWrapper = document.getElementById('interiorImageWrapper'); // Interior Image Wrapper
const interiorImage = document.getElementById('interiorImage'); // Interior Image

const clubhouseFloorPlans = document.getElementById('clubhouseFloorPlans'); // Clubhouse Floor Plans
const clubhouseFloorPlanImg = document.getElementById('clubhouseFloorPlanImg'); // Clubhouse Floor Plan Image
const clubhouseFloorPrevBtn = document.getElementById('clubhouseFloorPrevBtn'); // Clubhouse Floor Previous Button
const clubhouseFloorNextBtn = document.getElementById('clubhouseFloorNextBtn'); // Clubhouse Floor Next Button
const clubhouseFloorNumberLabel = document.getElementById('clubhouseFloorNumberLabel'); // Clubhouse Floor Number Label

// -------------------- FLOOR PLANS --------------------
const floorPlans = document.getElementById('floorPlans'); // Floor Plans
const floorPlanImg = document.getElementById('floorPlanImg'); // Floor Plan Image
const floorPrevBtn = document.getElementById('floorPrevBtn'); // Floor Previous Button
const floorNextBtn = document.getElementById('floorNextBtn'); // Floor Next Button
const floorNumberLabel = document.getElementById('floorNumberLabel'); // Floor Number Label
const floorSvg = document.getElementById('floorSvg'); // Floor SVG
const floorsOptions = document.getElementById("floorsOptions");
const floorBackBtn = document.getElementById("floorBackBtn");

// -------------------- UNIT PLANS --------------------
const unitPlans = document.getElementById('unitPlans'); // Floor Plans
const unitPlanImg = document.getElementById("unitPlanImg"); // Unit Plan Image
const unitPrevBtn = document.getElementById('unitPrevBtn'); // Floor Previous Button
const unitNextBtn = document.getElementById('unitNextBtn'); // Floor Next Button
const unitPlanVirtualTourLink = document.getElementById("unitPlanVirtualTourLink"); // Unit Plan Virtual Tour Link
const unitPlanBtnsWrapper = document.getElementById("unitPlanBtnsWrapper"); // Unit Plan Buttons Wrapper
const unitPlanBtnsList = document.querySelectorAll(".unitPlanBtnsList li");
const unitPlanTowerNumberLabel = document.getElementById("unitPlanTowerNumberLabel");
const unitPlanFloorNumberLabel = document.getElementById("unitPlanFloorNumberLabel");
const unitPlanFlatNumberLabel = document.getElementById("unitPlanFlatNumberLabel");
const unitPlanFlatOrientLabel = document.getElementById("unitPlanFlatOrientLabel");
const unitPlanFlatSizeLabel = document.getElementById("unitPlanFlatSizeLabel");

// -------------------- AMENITIES --------------------
const specificationsPanelOpenBtn = document.getElementById('specificationsPanelOpenBtn');
const specificationsPanel = document.getElementById('specificationsPanel');
const specificationsPanelCloseBtn = document.getElementById('specificationsPanelCloseBtn');
const specificationsList = document.getElementById('specificationsList');

// -------------------- AMENITIES --------------------
const amenities = document.getElementById('amenities'); // Amenities

// -------------------- ABOUT --------------------
const about = document.getElementById('about'); // About

// -------------------- ABOUT --------------------
const clubhouseEl = document.getElementById('clubhouse'); // Clubhouse
const clubhouseImage = document.getElementById('clubhouseImage'); // Clubhouse Image
const clubhouseSvg = document.getElementById('clubhouseSvg'); // Clubhouse SVG
const clubhouseVirtualTour = document.getElementById('clubhouseVirtualTour');

// -------------------- 360 EXTERIOR --------------------
const exterior = document.getElementById('exterior'); // Exterior

// -------------------- GOOGLE MAPS --------------------
let map;
let mapInitialized = false;
let projectMarkerRef = null;
// GALLERY
const gallery = document.getElementById('gallery'); // Gallery
const galleryItemLabel = document.getElementById('galleryItemLabel'); // Gallery Label
const galleryImage = document.getElementById('galleryImage'); // Gallery Image
const galleryPrevBtn = document.getElementById('galleryPrevBtn'); // Gallery Previous Button
const galleryNextBtn = document.getElementById('galleryNextBtn'); // Gallery Next Button
const galleryItemsListWrapper = document.getElementById('galleryItemsListWrapper'); // Gallery Items List Wrapper
const galleryItemsList = document.getElementById('galleryItemsList'); // Gallery Items List
const galleryExpand = document.getElementById('galleryExpand'); // Gallery Expand Button
const galleryCollapse = document.getElementById('galleryCollapse'); // Gallery Collapse Button

let CURRENT_INDEX = 0; // Gallery Current Index

// -------------------- BROCHURE --------------------
const brochure = document.getElementById('brochure'); // Brochure

// -------------------- CONTACT -------------------- 
const contact = document.getElementById('contact'); // Contact

// -------------------- FEATURES --------------------
const features =  document.getElementById('features'); // Features
const featuresList = document.querySelectorAll('.features li'); // Features List
const featurePanelBtn = document.getElementById('featurePanelBtn'); // Features Panel Button
const featurePanelCloseBtn = document.getElementById('featurePanelCloseBtn'); // Features Panel Close Button

const featuresPanelList = document.querySelectorAll('.featuresPanel li');

const clubhouseFloorPlansData = [
    {
        id: "Floor_Third",
        name: "Third",
        image: "../assets/Clubhouse_Floor_Plans/Third_floor.webp"
    },
    {
        id: "Floor_Fourth",
        name: "Fourth",
        image: "../assets/Clubhouse_Floor_Plans/Fourth_floor.webp"
    },
    {
        id: "Floor_Fifth",
        name: "Fifth",
        image: "../assets/Clubhouse_Floor_Plans/Fifth_floor.webp"
    },
    {
        id: "Floor_Sixth",
        name: "Sixth",
        image: "../assets/Clubhouse_Floor_Plans/Sixth_floor.webp"
    },
    {
        id: "Floor_Seventh",
        name: "Seventh",
        image: "../assets/Clubhouse_Floor_Plans/Seventh_floor.webp"
    },
    {
        id: "Floor_Terrace",
        name: "Terrace",
        image: "../assets/Clubhouse_Floor_Plans/Terrace_floor.webp"
    }
];

detailsIcon.addEventListener('click', () => {
    unitPlansDetailsWrapper.classList.toggle("hidden");
}); // Details Icon Event Listener

let clubhouseFloorPlan = 0;

const updateClubhouseFloorPlanImg = () => {
    clubhouseFloorPlanImg.src = clubhouseFloorPlansData[clubhouseFloorPlan].image;
};

const updateClubhouseFloorPlanLabel = () => {
    clubhouseFloorNumberLabel.textContent = `Floor: ${clubhouseFloorPlansData[clubhouseFloorPlan].name}`;
};

clubhouseFloorPrevBtn.addEventListener('click', () => {
    if (clubhouseFloorPlan > 0) {
        clubhouseFloorPlan--;
        updateClubhouseFloorPlanImg();
        updateClubhouseFloorPlanLabel(`Floor: ${clubhouseFloorPlan}`);
    };
}); // Floor Plan Previous Button Event Listener

clubhouseFloorNextBtn.addEventListener('click', () => {
    if (clubhouseFloorPlan < clubhouseFloorPlansData.length - 1) {
        clubhouseFloorPlan++;
        updateClubhouseFloorPlanImg();
        updateClubhouseFloorPlanLabel(`Floor: ${clubhouseFloorPlan}`);
    };
}); // Floor Plan Next Button Event Listener

const backBtnCallback = () => {
    console.log("Back Button Clicked", sectionHistory.length);

    if (sectionHistory.length > 1) {
        console.log("sectionHistory:", sectionHistory);
        const lastSection = sectionHistory[sectionHistory.length - 2];
        console.log("257:", lastSection);
        
        featuresCondition(lastSection);
        sectionHistory.pop();
        console.log("sectionHistory:", sectionHistory);
    } else if (sectionHistory.length === 1) {
        sectionHistory.pop();
        featuresCondition("home");
    };
}

unitPlansBackBtn.addEventListener('click', backBtnCallback); // Unit Plans Back Button Event Listener
backBtn.addEventListener('click', backBtnCallback); // Back Button Event Listener

let tourInstance = null;

function createTour(steps) {
  if (tourInstance) {   
    tourInstance.cancel();
    tourInstance = null;
  }

  tourInstance = new Shepherd.Tour({
    defaultStepOptions: {
      scrollTo: { behavior: 'smooth', block: 'center' },
      cancelIcon: { enabled: true },
      classes: '!w-fit',
    }
  });

  steps.forEach(step => tourInstance.addStep(step));
  tourInstance.start();
}

function destroyTour() {
  if (tourInstance) {
    tourInstance.cancel();
    tourInstance = null;
  }
}

const layoutSteps = [
  {
    id: 'layout-1',
    title: 'Project Header',
    text: 'Builder logo, project name, and location.',
    attachTo: { element: '#logoWrapper', on: 'bottom' },
    classes: 'ring-2 ring-blue-500 backdrop-blur-lg',
    buttons: [
      {
        text: 'Next',
        action: () => tourInstance.next(), // ✅ FIXED
        classes: '!cursor-pointer !px-4 !py-0.5 !bg-black !text-white !rounded-full',
      }
    ]
  },
  {
    id: 'layout-2',
    title: 'Day/Night Toggle',
    text: 'Switch between day and night views.',
    attachTo: { element: '#themeToggleContainer', on: 'bottom' },
    classes: 'ring-2 ring-blue-500 backdrop-blur-lg',
    buttons: [
      {
        text: 'Back',
        action: () => tourInstance.back(), // 
        classes: '!cursor-pointer !px-4 !py-0.5 !bg-black !text-white !rounded-full',
      },
      {
        text: 'Next',
        action: () => tourInstance.next(), // 
        classes: '!cursor-pointer !px-4 !py-0.5 !bg-black !text-white !rounded-full',
      }
    ]
  },
  {
    id: 'layout-3',
    title: 'Home Button',
    text: 'Return to the Layout/Home page.',
    attachTo: { element: '#homeBtn', on: 'bottom' },
    classes: 'ring-2 ring-blue-500 backdrop-blur-lg',
    buttons: [
      {
        text: 'Back',
        action: () => tourInstance.back(), // 
        classes: '!cursor-pointer !px-4 !py-0.5 !bg-black !text-white !rounded-full',
      },
      {
        text: 'Next',
        action: () => tourInstance.next(), //
        classes: '!cursor-pointer !px-4 !py-0.5 !bg-black !text-white !rounded-full',
      }
    ]
  },
  {
    id: 'layout-4',
    title: 'Audio',
    text: 'Toggle project info sound on/off.',
    attachTo: { element: '#bgAudioBtn', on: 'bottom' },
    classes: 'ring-2 ring-blue-500 backdrop-blur-lg',
    buttons: [
      {
        text: 'Back',
        action: () => tourInstance.back(), // 
        classes: '!cursor-pointer !px-4 !py-0.5 !bg-black !text-white !rounded-full',
      },
      {
        text: 'Next',
        action: () => tourInstance.next(), // 
        classes: '!cursor-pointer !px-4 !py-0.5 !bg-black !text-white !rounded-full',
      }
    ]
  },
  {
    id: 'layout-5',
    title: 'Fullscreen',
    text: 'Click for Fullscreen.',
    attachTo: { element: '#fullScreenBtn', on: 'bottom' }, // changed to bottom
    classes: 'ring-2 ring-blue-500 backdrop-blur-lg',
    buttons: [
      {
        text: 'Back',
        action: () => tourInstance.back(), // 
        classes: '!cursor-pointer !px-4 !py-0.5 !bg-black !text-white !rounded-full',
      },
      {
        text: 'Next',
        action: () => tourInstance.next(), // 
        classes: '!cursor-pointer !px-4 !py-0.5 !bg-black !text-white !rounded-full',
      }
    ]
  },
  {
    id: 'layout-6',
    title: 'Menu',
    text: 'Open for more options and quick links.',
    attachTo: { element: '#featurePanelBtn', on: 'bottom' }, // changed to bottom
    classes: 'ring-2 ring-blue-500 backdrop-blur-lg',
    buttons: [
      {
        text: 'Back',
        action: () => tourInstance.back(), // 
        classes: '!cursor-pointer !px-4 !py-0.5 !bg-black !text-white !rounded-full',
      },
      {
        text: 'Next',
        action: () => tourInstance.next(), // 
        classes: '!cursor-pointer !px-4 !py-0.5 !bg-black !text-white !rounded-full',
      }
    ]
  },
  {
    id: 'layout-7',
    title: 'Live 360°',
    text: 'Experience the project in real 360° view.',
    attachTo: { element: '#commonBtnsWrapper a[href^="https://lumalabs.ai/embed"]', on: 'bottom' }, // changed to bottom
    classes: 'ring-2 ring-blue-500 backdrop-blur-lg',
    buttons: [
      {
        text: 'Back',
        action: () => tourInstance.back(), // 
        classes: '!cursor-pointer !px-4 !py-0.5 !bg-black !text-white !rounded-full',
      },
      {
        text: 'Next',
        action: () => tourInstance.next(), // 
        classes: '!cursor-pointer !px-4 !py-0.5 !bg-black !text-white !rounded-full',
      }
    ]
  },
  {
    id: 'layout-8',
    title: 'SPIM Logo',
    text: 'Powered by SPIM.',
    attachTo: { element: 'a[href="https://www.spimproject.com/"]', on: 'right' },
    classes: 'ring-2 ring-blue-500 backdrop-blur-lg',
    buttons: [
      {
        text: 'Back',
        action: () => tourInstance.back(), // 
        classes: '!cursor-pointer !px-4 !py-0.5 !bg-black !text-white !rounded-full',
      },
      {
        text: 'Next',
        action: () => tourInstance.next(), // 
        classes: '!cursor-pointer !px-4 !py-0.5 !bg-black !text-white !rounded-full',
      }
    ]
  },
  {
    id: 'layout-9',
    title: '360 Controls',
    text: 'Rotate with arrows to view the project from all angles.',
    attachTo: { element: '#layoutControls', on: 'top' },
    classes: 'ring-2 ring-blue-500 backdrop-blur-lg',
    buttons: [
      {
        text: 'Back',
        action: () => tourInstance.back(), // 
        classes: '!cursor-pointer !px-4 !py-0.5 !bg-black !text-white !rounded-full',
      },
      {
        text: 'Done',
        action: () => tourInstance.complete(), // 
        classes: '!cursor-pointer !px-4 !py-0.5 !bg-green-700 !text-white !rounded-full',
      }
    ]
  }
];

const webverseSteps = [
  {
    id: 'webverse-1',
    title: 'Project Header',
    text: 'Logo, project name, and address.',
    attachTo: { element: '#logoWrapper', on: 'right' },
    classes: 'ring-2 ring-blue-500 backdrop-blur-lg',
    buttons: [
      {
        text: 'Next',
        action: () => tourInstance.next(), 
        classes: '!cursor-pointer !px-4 !py-0.5 !bg-black !text-white !rounded-full',
      }
    ]
  },
  {
    id: 'webverse-2',
    title: 'Filters',
    text: 'Filter by orientation, floor, type, and unit.',
    attachTo: { element: '#webverseFilterBtn', on: 'right' }, 
    classes: 'ring-2 ring-blue-500 backdrop-blur-lg',
    buttons: [
      {
        text: 'Back',
        action: () => tourInstance.back(), 
        classes: '!cursor-pointer !px-4 !py-0.5 !bg-black !text-white !rounded-full',
      },
      {
        text: 'Next',
        action: () => tourInstance.next(), 
        classes: '!cursor-pointer !px-4 !py-0.5 !bg-black !text-white !rounded-full',
      }
    ]
  },
  {
    id: 'webverse-3',
    title: 'Day/Night Toggle',
    text: 'Switch between day and night views.',
    attachTo: { element: '#themeToggleContainer', on: 'bottom' }, 
    classes: 'ring-2 ring-blue-500 backdrop-blur-lg',
    buttons: [
      {
        text: 'Back',
        action: () => tourInstance.back(),
        classes: '!cursor-pointer !px-4 !py-0.5 !bg-black !text-white !rounded-full',
      },
      {
        text: 'Next',
        action: () => tourInstance.next(),
        classes: '!cursor-pointer !px-4 !py-0.5 !bg-black !text-white !rounded-full',
      }
    ]
  },
  {
    id: 'webverse-4',
    title: 'Home Button',
    text: 'Go back to the layout page.',
    attachTo: { element: '#homeBtn', on: 'bottom' }, 
    classes: 'ring-2 ring-blue-500 backdrop-blur-lg',
    buttons: [
      {
        text: 'Back',
        action: () => tourInstance.back(),
        classes: '!cursor-pointer !px-4 !py-0.5 !bg-black !text-white !rounded-full',
      },
      {
        text: 'Next',
        action: () => tourInstance.next(), 
        classes: '!cursor-pointer !px-4 !py-0.5 !bg-black !text-white !rounded-full',
      }
    ]
  },
  {
    id: 'webverse-5',
    title: 'Audio',
    text: 'Mute or unmute audio.',
    attachTo: { element: '#bgAudioBtn', on: 'bottom' }, 
    classes: 'ring-2 ring-blue-500 backdrop-blur-lg',
    buttons: [
      {
        text: 'Back',
        action: () => tourInstance.back(), 
        classes: '!cursor-pointer !px-4 !py-0.5 !bg-black !text-white !rounded-full',
      },
      {
        text: 'Next',
        action: () => tourInstance.next(),
        classes: '!cursor-pointer !px-4 !py-0.5 !bg-black !text-white !rounded-full',
      }
    ]
  },
  {
    id: 'webverse-6',
    title: 'Fullscreen',
    text: 'Maximize to fullscreen.',
    attachTo: { element: '#fullScreenBtn', on: 'bottom' },
    classes: 'ring-2 ring-blue-500 backdrop-blur-lg',
    buttons: [
      {
        text: 'Back',
        action: () => tourInstance.back(),
        classes: '!cursor-pointer !px-4 !py-0.5 !bg-black !text-white !rounded-full',
      },
      {
        text: 'Next',
        action: () => tourInstance.next(),
        classes: '!cursor-pointer !px-4 !py-0.5 !bg-black !text-white !rounded-full',
      }
    ]
  },
  {
    id: 'webverse-7',
    title: 'Menu',
    text: 'Open options list like Interiors and Floor Plans and more.',
    attachTo: { element: '#featurePanelBtn', on: 'bottom' }, 
    classes: 'ring-2 ring-blue-500 backdrop-blur-lg',
    buttons: [
      {
        text: 'Back',
        action: () => tourInstance.back(),
        classes: '!cursor-pointer !px-4 !py-0.5 !bg-black !text-white !rounded-full',
      },
      {
        text: 'Next',
        action: () => tourInstance.next(), 
        classes: '!cursor-pointer !px-4 !py-0.5 !bg-black !text-white !rounded-full',
      }
    ]
  },
  {
    id: 'webverse-8',
    title: 'Live 360°',
    text: 'Experice the project in real 360View.',
    attachTo: { element: '#commonBtnsWrapper a[href^="https://lumalabs.ai/embed"]', on: 'bottom' },
    classes: 'ring-2 ring-blue-500 backdrop-blur-lg',
    buttons: [
      {
        text: 'Back',
        action: () => tourInstance.back(), 
        classes: '!cursor-pointer !px-4 !py-0.5 !bg-black !text-white !rounded-full',
      },
      {
        text: 'Next',
        action: () => tourInstance.next(), 
        classes: '!cursor-pointer !px-4 !py-0.5 !bg-black !text-white !rounded-full',
      }
    ]
  },
  {
    id: 'webverse-9',
    title: '360 Controls',
    text: 'Rotate the project right or left.',
    attachTo: { element: '#webverseControls', on: 'top' }, 
    classes: 'ring-2 ring-blue-500 backdrop-blur-lg',
    buttons: [
      {
        text: 'Back',
        action: () => tourInstance.back(), 
        classes: '!cursor-pointer !px-4 !py-0.5 !bg-black !text-white !rounded-full',
      },
      {
        text: 'Next',
        action: () => tourInstance.next(), 
        classes: '!cursor-pointer !px-4 !py-0.5 !bg-black !text-white !rounded-full',
      }
    ]
  },
  {
    id: 'webverse-10',
    title: 'Views',
    text: 'Switch between Top and Spin views.',
    attachTo: { element: '.viewTypes', on: 'left' }, 
    classes: 'ring-2 ring-blue-500 backdrop-blur-lg',
    buttons: [
      {
        text: 'Back',
        action: () => tourInstance.back(),
        classes: '!cursor-pointer !px-4 !py-0.5 !bg-black !text-white !rounded-full',
      },
      {
        text: 'Done',
        action: () => tourInstance.complete(),
        classes: '!cursor-pointer !px-4 !py-0.5 !bg-green-700 !text-white !rounded-full',
      }
    ]
  }
];

const floorPlansSteps = [
  {
    id: 'floor-1',
    title: 'Project Header',
    text: 'Logo, project name, and address.',
    attachTo: { element: '#logoWrapper', on: 'right' },
    classes: 'ring-2 ring-blue-500 backdrop-blur-lg',
    buttons: [
      { text: 'Next', action: () => tourInstance.next(),
        classes: '!cursor-pointer !px-4 !py-0.5 !bg-black !text-white !rounded-full' }
    ]
  },
  {
    id: 'floor-2',
    title: 'Home',
    text: 'Return to the main layout.',
    attachTo: { element: '#homeBtn', on: 'bottom' },
    classes: 'ring-2 ring-blue-500 backdrop-blur-lg',
    buttons: [
      { text: 'Back', action: () => tourInstance.back(),
        classes: '!cursor-pointer !px-4 !py-0.5 !bg-black !text-white !rounded-full' },
      { text: 'Next', action: () => tourInstance.next(),
        classes: '!cursor-pointer !px-4 !py-0.5 !bg-black !text-white !rounded-full' }
    ]
  },
  {
    id: 'floor-3',
    title: 'Fullscreen',
    text: 'Enter / exit fullscreen.',
    attachTo: { element: '#fullScreenBtn', on: 'bottom' },
    classes: 'ring-2 ring-blue-500 backdrop-blur-lg',
    buttons: [
      { text: 'Back', action: () => tourInstance.back(),
        classes: '!cursor-pointer !px-4 !py-0.5 !bg-black !text-white !rounded-full' },
      { text: 'Next', action: () => tourInstance.next(),
        classes: '!cursor-pointer !px-4 !py-0.5 !bg-black !text-white !rounded-full' }
    ]
  },
  {
    id: 'floor-4',
    title: 'Menu',
    text: 'Open features like Webverse, Interiors, etc.',
    attachTo: { element: '#featurePanelBtn', on: 'bottom' },
    classes: 'ring-2 ring-blue-500 backdrop-blur-lg',
    buttons: [
      { text: 'Back', action: () => tourInstance.back(),
        classes: '!cursor-pointer !px-4 !py-0.5 !bg-black !text-white !rounded-full' },
      { text: 'Next', action: () => tourInstance.next(),
        classes: '!cursor-pointer !px-4 !py-0.5 !bg-black !text-white !rounded-full' }
    ]
  },
  {
    id: 'floor-5',
    title: 'Live 360°',
    text: 'Open a live 360° exterior preview.',
    attachTo: { element: '#commonBtnsWrapper a[href^="https://lumalabs.ai/embed"]', on: 'bottom' },
    classes: 'ring-2 ring-blue-500 backdrop-blur-lg',
    buttons: [
      { text: 'Back', action: () => tourInstance.back(),
        classes: '!cursor-pointer !px-4 !py-0.5 !bg-black !text-white !rounded-full' },
      { text: 'Next', action: () => tourInstance.next(),
        classes: '!cursor-pointer !px-4 !py-0.5 !bg-black !text-white !rounded-full' }
    ]
  },
  {
    id: 'floor-6',
    title: 'SPIM',
    text: 'Powered by SPIM.',
    attachTo: { element: 'a[href="https://www.spimproject.com/"]', on: 'top' },
    classes: 'ring-2 ring-blue-500 backdrop-blur-lg',
    buttons: [
      { text: 'Back', action: () => tourInstance.back(),
        classes: '!cursor-pointer !px-4 !py-0.5 !bg-black !text-white !rounded-full' },
      { text: 'Next', action: () => tourInstance.next(),
        classes: '!cursor-pointer !px-4 !py-0.5 !bg-black !text-white !rounded-full' }
    ]
  },
  {
    id: 'floor-7',
    title: 'Units & Sizes',
    text: 'Tap labels to view flat details. Use pinch/scroll to zoom the plan.',
    attachTo: { element: '#floorSvg', on: 'top' },
    classes: 'ring-2 ring-blue-500 backdrop-blur-lg',
    buttons: [
      { text: 'Back', action: () => tourInstance.back(),
        classes: '!cursor-pointer !px-4 !py-0.5 !bg-black !text-white !rounded-full' },
      { text: 'Next', action: () => tourInstance.next(),
        classes: '!cursor-pointer !px-4 !py-0.5 !bg-black !text-white !rounded-full' }
    ]
  },
  {
    id: 'floor-8',
    title: 'Floor Navigator',
    text: 'Use these controls to switch tower/floor and move between views.',
    attachTo: { element: '#floorPrevBtn', on: 'top' },
    classes: 'ring-2 ring-blue-500 backdrop-blur-lg',
    buttons: [
      { text: 'Back', action: () => tourInstance.back(),
        classes: '!cursor-pointer !px-4 !py-0.5 !bg-black !text-white !rounded-full' },
      { text: 'Done', action: () => tourInstance.complete(),
        classes: '!cursor-pointer !px-4 !py-0.5 !bg-green-700 !text-white !rounded-full' }
    ]
  }
];

const clubhouseFloorPlansSteps = [
  {
    id: 'floor-1',
    title: 'Project Header',
    text: 'Logo, project name, and address.',
    attachTo: { element: '#logoWrapper', on: 'right' },
    classes: 'ring-2 ring-blue-500 backdrop-blur-lg',
    buttons: [
      { text: 'Next', action: () => tourInstance.next(),
        classes: '!cursor-pointer !px-4 !py-0.5 !bg-black !text-white !rounded-full' }
    ]
  },
  {
    id: 'floor-2',
    title: 'Home',
    text: 'Return to the main layout.',
    attachTo: { element: '#homeBtn', on: 'bottom' },
    classes: 'ring-2 ring-blue-500 backdrop-blur-lg',
    buttons: [
      { text: 'Back', action: () => tourInstance.back(),
        classes: '!cursor-pointer !px-4 !py-0.5 !bg-black !text-white !rounded-full' },
      { text: 'Next', action: () => tourInstance.next(),
        classes: '!cursor-pointer !px-4 !py-0.5 !bg-black !text-white !rounded-full' }
    ]
  },
  {
    id: 'floor-3',
    title: 'Fullscreen',
    text: 'Enter / exit fullscreen.',
    attachTo: { element: '#fullScreenBtn', on: 'bottom' },
    classes: 'ring-2 ring-blue-500 backdrop-blur-lg',
    buttons: [
      { text: 'Back', action: () => tourInstance.back(),
        classes: '!cursor-pointer !px-4 !py-0.5 !bg-black !text-white !rounded-full' },
      { text: 'Next', action: () => tourInstance.next(),
        classes: '!cursor-pointer !px-4 !py-0.5 !bg-black !text-white !rounded-full' }
    ]
  },
  {
    id: 'floor-4',
    title: 'Menu',
    text: 'Open features like Webverse, Interiors, etc.',
    attachTo: { element: '#featurePanelBtn', on: 'bottom' },
    classes: 'ring-2 ring-blue-500 backdrop-blur-lg',
    buttons: [
      { text: 'Back', action: () => tourInstance.back(),
        classes: '!cursor-pointer !px-4 !py-0.5 !bg-black !text-white !rounded-full' },
      { text: 'Next', action: () => tourInstance.next(),
        classes: '!cursor-pointer !px-4 !py-0.5 !bg-black !text-white !rounded-full' }
    ]
  },
  {
    id: 'floor-5',
    title: 'Live 360°',
    text: 'Open a live 360° exterior preview.',
    attachTo: { element: '#commonBtnsWrapper a[href^="https://lumalabs.ai/embed"]', on: 'bottom' },
    classes: 'ring-2 ring-blue-500 backdrop-blur-lg',
    buttons: [
      { text: 'Back', action: () => tourInstance.back(),
        classes: '!cursor-pointer !px-4 !py-0.5 !bg-black !text-white !rounded-full' },
      { text: 'Next', action: () => tourInstance.next(),
        classes: '!cursor-pointer !px-4 !py-0.5 !bg-black !text-white !rounded-full' }
    ]
  },
  {
    id: 'floor-6',
    title: 'SPIM',
    text: 'Powered by SPIM.',
    attachTo: { element: 'a[href="https://www.spimproject.com/"]', on: 'top' },
    classes: 'ring-2 ring-blue-500 backdrop-blur-lg',
    buttons: [
      { text: 'Back', action: () => tourInstance.back(),
        classes: '!cursor-pointer !px-4 !py-0.5 !bg-black !text-white !rounded-full' },
      { text: 'Next', action: () => tourInstance.next(),
        classes: '!cursor-pointer !px-4 !py-0.5 !bg-black !text-white !rounded-full' }
    ]
  },
  {
    id: 'floor-7',
    title: 'Units & Sizes',
    text: 'Tap labels to view flat details. Use pinch/scroll to zoom the plan.',
    attachTo: { element: '#floorSvg', on: 'top' },
    classes: 'ring-2 ring-blue-500 backdrop-blur-lg',
    buttons: [
      { text: 'Back', action: () => tourInstance.back(),
        classes: '!cursor-pointer !px-4 !py-0.5 !bg-black !text-white !rounded-full' },
      { text: 'Next', action: () => tourInstance.next(),
        classes: '!cursor-pointer !px-4 !py-0.5 !bg-black !text-white !rounded-full' }
    ]
  },
  {
    id: 'floor-8',
    title: 'Floor Navigator',
    text: 'Use these controls to switch tower/floor and move between views.',
    attachTo: { element: '#floorPrevBtn', on: 'top' },
    classes: 'ring-2 ring-blue-500 backdrop-blur-lg',
    buttons: [
      { text: 'Back', action: () => tourInstance.back(),
        classes: '!cursor-pointer !px-4 !py-0.5 !bg-black !text-white !rounded-full' },
      { text: 'Done', action: () => tourInstance.complete(),
        classes: '!cursor-pointer !px-4 !py-0.5 !bg-green-700 !text-white !rounded-full' }
    ]
  }
];

const interiorSteps = [
  {
    id: 'interior-1',
    title: 'Project Header',
    text: 'Logo, project name, and address.',
    attachTo: { element: '#logoWrapper', on: 'right' },
    classes: 'ring-2 ring-blue-500 backdrop-blur-lg',
    buttons: [
      { text: 'Next', action: () => tourInstance.next(), classes: '!cursor-pointer !px-4 !py-0.5 !bg-black !text-white !rounded-full' }
    ]
  },
  {
    id: 'interior-2',
    title: 'Home',
    text: 'Return to the main layout.',
    attachTo: { element: '#homeBtn', on: 'bottom' },
    classes: 'ring-2 ring-blue-500 backdrop-blur-lg',
    buttons: [
      { text: 'Back', action: () => tourInstance.back(), classes: '!cursor-pointer !px-4 !py-0.5 !bg-black !text-white !rounded-full' },
      { text: 'Next', action: () => tourInstance.next(), classes: '!cursor-pointer !px-4 !py-0.5 !bg-black !text-white !rounded-full' }
    ]
  },
  {
    id: 'interior-3',
    title: 'Fullscreen',
    text: 'Enter or exit fullscreen.',
    attachTo: { element: '#fullScreenBtn', on: 'bottom' },
    classes: 'ring-2 ring-blue-500 backdrop-blur-lg',
    buttons: [
      { text: 'Back', action: () => tourInstance.back(), classes: '!cursor-pointer !px-4 !py-0.5 !bg-black !text-white !rounded-full' },
      { text: 'Next', action: () => tourInstance.next(), classes: '!cursor-pointer !px-4 !py-0.5 !bg-black !text-white !rounded-full' }
    ]
  },
  {
    id: 'interior-4',
    title: 'Menu',
    text: 'Open features like Webverse, Floor Plans, etc.',
    attachTo: { element: '#featurePanelBtn', on: 'bottom' },
    classes: 'ring-2 ring-blue-500 backdrop-blur-lg',
    buttons: [
      { text: 'Back', action: () => tourInstance.back(), classes: '!cursor-pointer !px-4 !py-0.5 !bg-black !text-white !rounded-full' },
      { text: 'Next', action: () => tourInstance.next(), classes: '!cursor-pointer !px-4 !py-0.5 !bg-black !text-white !rounded-full' }
    ]
  },
  {
    id: 'interior-5',
    title: 'Live 360°',
    text: 'Open a 360° preview of project.',
    attachTo: { element: '#commonBtnsWrapper a[href^="https://lumalabs.ai/embed"]', on: 'bottom' },
    classes: 'ring-2 ring-blue-500 backdrop-blur-lg',
    buttons: [
      { text: 'Back', action: () => tourInstance.back(), classes: '!cursor-pointer !px-4 !py-0.5 !bg-black !text-white !rounded-full' },
      { text: 'Next', action: () => tourInstance.next(), classes: '!cursor-pointer !px-4 !py-0.5 !bg-black !text-white !rounded-full' }
    ]
  },
  {
    id: 'interior-6',
    title: 'SPIM',
    text: 'Powered by SPIM.',
    attachTo: { element: 'a[href="https://www.spimproject.com/"]', on: 'top' },
    classes: 'ring-2 ring-blue-500 backdrop-blur-lg',
    buttons: [
      { text: 'Back', action: () => tourInstance.back(), classes: '!cursor-pointer !px-4 !py-0.5 !bg-black !text-white !rounded-full' },
      { text: 'Next', action: () => tourInstance.next(), classes: '!cursor-pointer !px-4 !py-0.5 !bg-black !text-white !rounded-full' }
    ]
  },
  {
    id: 'interior-7',
    title: 'Interiors',
    text: 'Browse interior plans by size, tower and facing.',
    attachTo: { element: '#interior #interiorsList', on: 'top' },
    classes: 'ring-2 ring-blue-500 backdrop-blur-lg',
    buttons: [
      { text: 'Back', action: () => tourInstance.back(), classes: '!cursor-pointer !px-4 !py-0.5 !bg-black !text-white !rounded-full' },
      { text: 'Done', action: () => tourInstance.complete(), classes: '!cursor-pointer !px-4 !py-0.5 !bg-green-700 !text-white !rounded-full' }
    ]
  }
];

const mapsSteps = [
  {
    id: 'maps-1',
    title: 'Project Header',
    text: 'Logo, project name, and address.',
    attachTo: { element: '#logoWrapper', on: 'right' },
    classes: 'ring-2 ring-blue-500 backdrop-blur-lg',
    buttons: [
      {
        text: 'Next',
        action: () => tourInstance.next(),
        classes: '!cursor-pointer !px-4 !py-0.5 !bg-black !text-white !rounded-full'
      }
    ]
  },
  {
    id: 'maps-2',
    title: 'Home',
    text: 'Go back to the main layout.',
    attachTo: { element: '#homeBtn', on: 'bottom' },
    classes: 'ring-2 ring-blue-500 backdrop-blur-lg',
    buttons: [
      {
        text: 'Back',
        action: () => tourInstance.back(),
        classes: '!cursor-pointer !px-4 !py-0.5 !bg-black !text-white !rounded-full'
      },
      {
        text: 'Next',
        action: () => tourInstance.next(),
        classes: '!cursor-pointer !px-4 !py-0.5 !bg-black !text-white !rounded-full'
      }
    ]
  },
  {
    id: 'maps-3',
    title: 'Menu',
    text: 'Open features like Interiors, Floor Plans, Gallery, and more.',
    attachTo: { element: '#featurePanelBtn', on: 'bottom' },
    classes: 'ring-2 ring-blue-500 backdrop-blur-lg',
    buttons: [
      {
        text: 'Back',
        action: () => tourInstance.back(),
        classes: '!cursor-pointer !px-4 !py-0.5 !bg-black !text-white !rounded-full'
      },
      {
        text: 'Next',
        action: () => tourInstance.next(),
        classes: '!cursor-pointer !px-4 !py-0.5 !bg-black !text-white !rounded-full'
      }
    ]
  },
  {
    id: 'maps-4',
    title: 'Live 360°',
    text: 'Open the live 360 view in a new tab.',
    attachTo: { element: '#commonBtnsWrapper a[href^="https://lumalabs.ai/embed"]', on: 'bottom' },
    classes: 'ring-2 ring-blue-500 backdrop-blur-lg',
    buttons: [
      {
        text: 'Back',
        action: () => tourInstance.back(),
        classes: '!cursor-pointer !px-4 !py-0.5 !bg-black !text-white !rounded-full'
      },
      {
        text: 'Next',
        action: () => tourInstance.next(),
        classes: '!cursor-pointer !px-4 !py-0.5 !bg-black !text-white !rounded-full'
      }
    ]
  },
//   {
//     id: 'maps-5',
//     title: 'Filters',
//     text: 'Select a category (Transport, Education, Hospital, Workplace, Hangout). The list shows places with distance & time; pick any to see the route.',
//     attachTo: { element: '#mapFilterBtn', on: 'left' },
//     classes: 'ring-2 ring-blue-500 backdrop-blur-lg',
//     buttons: [
//       {
//         text: 'Back',
//         action: () => tourInstance.back(),
//         classes: '!cursor-pointer !px-4 !py-0.5 !bg-black !text-white !rounded-full'
//       },
//       {
//         text: 'Done',
//         action: () => tourInstance.complete(),
//         classes: '!cursor-pointer !px-4 !py-0.5 !bg-green-700 !text-white !rounded-full'
//       }
//     ]
//   }
];

//createTour(layoutSteps);

// -------------------- FLOOR PLANS SECTION --------------------
let floorPlan = 0;  
let MAX_FLOORS; 

// -------------------- LAYOUT SECTION --------------------
let LAYOUT_TOTAL_FRAMES; // Layout Total Frames
let LAYOUT_CURRENT_FRAME; // Layout Current Frame
let LAYOUT_DEGREE; // Layout Degree
let LAYOUT_DEGREE_INTERVALS = []; // Layout Degree Intervals
const LAYOUT_FRAME_UPDATE_INTERVAL = 36; // Frame Update Interval Time

// -------------------- WEBVERSE SECTION --------------------
let towerId;
let towerData = [];
let unitsData = []; // Units Data

let BLOCK_TOTAL_FRAMES = 120; // Block Total Frames
let BLOCK_CURRENT_FRAME = 1; // Block Current Frame
let BLOCK_DEGREE = 360 / BLOCK_TOTAL_FRAMES; // Block Degree
let BLOCK_DEGREE_INTERVALS = []; // Block Degree Intervals
const BLOCK_FRAME_UPDATE_INTERVAL = 36; // Block Frame   Update Interval Time

// let BASE_FILE_NAME = "opus_blues"; 
// const IMAGE_EXTENTION = "jpg";  
// const VIDEO_EXTENTION = 'mp4';

let SVG_TYPE = 'apartments'; // Frame SVG Type
let timeOfDay = "night";  // Time of day
let VIEW_TYPE = 'spin view';

const block = new Set(); // Selected Block/Tower
const selectedFacings = new Set(); // Selected Facings
const selectedFloors = new Set(); // Selected Floors
const selectedTypes = new Set(); // Selected Types
const selectedUnits = new Set(); // Selected Units

let loadedImages = []; // Loaded Images
let loadedCount = 0;  // Loaded Count
let IS_DRAGGING = false;  // Is Dragging
let startX = 0; 
let IS_SET_INTERVAL_RUNNING = false; 

const layoutSvgSelection = d3.select("#layoutSvg svg"); // Layout SVG Selection

layoutSvgSelection.attr('preserveAspectRatio', 'xMidYMid slice')
    .attr('width', '100%')
    .attr('height', '100%');

layoutSvgSelection.selectAll('rect, circle, polygon, polyline, path')
    .attr('stroke-width', '1px')
    .attr('stroke', 'rgba(255,255,255,1)')
    .attr("fill", "transparent");

const getFilteredUnitsByFacings = (data, facings) => data.filter(each => facings.has(each.orientation)); // Filter by Selected Facings 
const getFilteredUnitsByFloors = (data, floors) => data.filter(each => floors.has(each.floorId)); // Filter by Selected Floors
const getFilteredUnitsByTypes = (data, types) => data.filter(each => types.has(each.bhk)); // Filter by Selected Types
const getFilteredUnitsByUnitSize = (data, units) => data.filter(each => units.has(each.size)); // Filter by Selected Units

const filteredData = () => {
    let data = [...unitsData];

    if (data.length > 0 && selectedFacings.size > 0) {
        data = getFilteredUnitsByFacings(data, selectedFacings);
    };

    if (data.length > 0 && selectedFloors.size > 0) {
        data = getFilteredUnitsByFloors(data, selectedFloors);
    };

    if (data.length > 0 && selectedTypes.size > 0) {
        data = getFilteredUnitsByTypes(data, selectedTypes);
    };

    if (data.length > 0 && selectedUnits.size > 0) {
        data = getFilteredUnitsByUnitSize(data, selectedUnits);
    };

    // console.log("205",data)
    
    return data;
}; // Filtered by Selected Facings, Floors, Types & Unit Size

const resetToggleSelection = (elements) => {
    elements.forEach(element => {
        element.classList.remove('bg-[#7A2E43]', 'border-white');
        element.classList.add('border', 'border-2', 'border-[rgba(255,255,255,0.2)]', 'bg-[rgba(255,255,255,0.1)]');
    });
}; // Reset Toggle Selection

const toggleSelection = (elements, selectedSet, castToNumber = false) => {
    elements.forEach(element => {
        element.addEventListener('click', () => {
            const rawValue = element.getAttribute('data-type');
            const value = castToNumber ? +rawValue : rawValue;
            // console.log(rawValue)

            if (selectedSet.has(value)) {
                element.classList.remove('bg-[#7A2E43]', 'border-white');
                element.classList.add('border-[rgba(255,255,255,0.2)]', 'bg-[rgba(255,255,255,0.1)]');
                selectedSet.delete(value);
            } else {
                element.classList.add('bg-[#7A2E43]', 'border-white');
                element.classList.remove('border-[rgba(255,255,255,0.2)]', 'bg-[rgba(255,255,255,0.1)]');
                selectedSet.add(value);
            };

            if (selectedFacings.size > 0 || selectedFloors.size > 0 || selectedTypes.size > 0 || selectedUnits.size > 0 )  {
                updateFilteredData(blockSVG);
            } else {
                resetSVGFill(blockSVG);
            };

            // console.log(selectedSet);
        });
    });
}; // Toggle Selection

const toggleWebverseFilters = () => {
    webverseFilters.classList.toggle('-translate-x-full');
};

webverseFilterBtn.addEventListener('click', toggleWebverseFilters); // Webverse Filter Button Event Listener
webversFilterCloseBtn.addEventListener('click', toggleWebverseFilters);  // Webverse Filter Close Button Event Listener

viewTypesList.forEach(view => {
    view.addEventListener('click', () => {
        VIEW_TYPE = view.getAttribute('data-type');
        
        switch (VIEW_TYPE) {
            case 'spin view':
                features.classList.add('translate-x-full');
                webverseFilters.classList.add("block");
                webverseFilters.classList.remove("hidden");
                blockSvg.classList.add('block');
                blockSvg.classList.remove('hidden');
                webverseControls.classList.add('block');
                webverseControls.classList.remove('hidden');
                webverseFilterBtn.classList.add('inline-flex');
                webverseFilterBtn.classList.remove('hidden');
                themeToggleContainer.classList.add('inline-flex');
                themeToggleContainer.classList.remove('hidden');
                // hideOverlay.classList.remove('block');
                // hideOverlay.classList.add('hidden');
                svgTypes.classList.add('block');
                svgTypes.classList.remove('hidden');
                updateBlockImage();
                break;
            case 'top view':
                features.classList.add('translate-x-full');
                webverseFilters.classList.remove("block");
                webverseFilters.classList.add("hidden");
                blockVideo.classList.remove('block');
                blockVideo.classList.add('hidden');
                blockSvg.classList.add('hidden');
                blockSvg.classList.remove('block');
                webverseControls.classList.add('hidden');
                webverseControls.classList.remove('block');
                webverseFilterBtn.classList.remove('inline-flex');
                webverseFilterBtn.classList.add('hidden');
                themeToggleContainer.classList.remove('inline-flex');
                themeToggleContainer.classList.add('hidden');
                // hideOverlay.classList.add('hidden');
                // hideOverlay.classList.remove('block');
                svgTypes.classList.add('hidden');
                svgTypes.classList.remove('block');
                blockImage.src = towerData?.topViewImage;
                break;
            default:
                return null;
        };

        viewTypesList.forEach(item => {
            item.classList.remove('!bg-[#DC0073]');
        });

        view.classList.add('!bg-[#DC0073]', 'transition-colors',  'duration-700', 'ease-in-out', 'delay-100');

    });
}); // Toggling Top and Spin Views

svgTypesList.forEach(type => {
    type.addEventListener('click', () => {
        SVG_TYPE = type.getAttribute('data-type');
        updateBlockSVG();

        switch (SVG_TYPE) {
            case 'floors':
                webverseFilters.classList.remove('-translate-x-full');
                features.classList.add('translate-x-full');
                orientationEl.classList.remove('flex');
                orientationEl.classList.add('hidden');
                typeEl.classList.remove('flex');
                typeEl.classList.add('hidden');
                unitEl.classList.remove('flex');
                unitEl.classList.add('hidden');
                noteEl.classList.add('hidden');
                noteEl.classList.remove('block');
                break;
            case 'apartments':
                webverseFilters.classList.remove('-translate-x-full');
                features.classList.add('translate-x-full');
                orientationEl.classList.remove('hidden');
                orientationEl.classList.add('flex');
                typeEl.classList.remove('hidden');
                typeEl.classList.add('flex');
                unitEl.classList.remove('hidden');
                unitEl.classList.add('flex');
                noteEl.classList.remove('hidden');
                noteEl.classList.add('block');
                break;
        };

        svgTypesList.forEach(item => {
            item.classList.remove('!bg-[#DC0073]');
        });

        type.classList.add('!bg-[#DC0073]', 'transition-colors',  'duration-700', 'ease-in-out', 'delay-100');
    });
}); // Toggling Apartment and Floor SVGs

toggleSwitch.addEventListener('click', () => {
    toggleSwitch.classList.toggle('on');
    toggleSwitch.classList.contains('on') ? blockSvg.classList.add('hidden') : blockSvg.classList.remove('hidden');
});

const resetSVGFill = (svg) => {
    svg.selectAll("rect, path, polygon, circle, polyline")
       .style("fill", "transparent")
       .style("cursor", "default")
       .style('stroke-width', '0')
       .style('stroke', 'transparent')
       .on("click", null)
       .on("mouseover", null)
       .on("mouseout", null)
       .on("touchstart", null)
       .on("touchend", null);
}; // Reset SVG Fill function

const updateBlockImage = () => {

    blockSvg.style.opacity = "0";

    blockImage.onload = () => {
        blockSvg.style.opacity = "1";
    };

    blockImage.src = loadedImages[BLOCK_CURRENT_FRAME - 1][timeOfDay].src;

};

const updateLayoutImage = () => {

    // hide SVG while image loads
    layoutSvg.style.opacity = "0";

    layoutImage.onload = () => {
        layoutSvg.style.opacity = "1";
    };

    layoutImage.src = loadedImages[LAYOUT_CURRENT_FRAME - 1][timeOfDay].src;

};

const updateBlockSVG = () => {
    removeBlockSVG();
    if (BLOCK_DEGREE_INTERVALS.includes(BLOCK_CURRENT_FRAME*BLOCK_DEGREE)) {
        const index = BLOCK_CURRENT_FRAME * BLOCK_DEGREE;
        const url = SVG_TYPE === 'apartments' ? towerData?.flatWiseSvgs[index] : towerData?.floorWiseSvgs[index];
        fetchBlockSVGContent(url);
    };
}; // Update Frame SVG Function

const updateLayoutSVG = () => {
    removeLayoutSVG();
    fetchLayoutSVGContent(data?.layout?.svgs[LAYOUT_CURRENT_FRAME * LAYOUT_DEGREE]);
};

const onImageLoaded = (TOTAL_FRAMES) => {
    loadedCount++;

    const totalImages = TOTAL_FRAMES * 2;
    const loadingPercentage = Math.round((loadedCount / totalImages) * 100);
    loaderText.textContent = `${loadingPercentage}%`;

    if (loadedCount === TOTAL_FRAMES * 2) {
        loaderWrapper.classList.remove('block');
        loaderWrapper.classList.add('hidden');
        updateLayoutImage();
        updateBlockImage();
    };
};

function preloadImages(TOTAL_FRAMES, DAY_FRAMES, NIGHT_FRAMES) {
    loadedCount = 0;
    loaderText.textContent = loadedCount;
    loadedImages = [];

    for (let i = 0; i < TOTAL_FRAMES; i++) {
        const dayImage = new Image();
        const nightImage = new Image();

        dayImage.src = DAY_FRAMES[i];
        dayImage.onload = () => onImageLoaded(TOTAL_FRAMES);

        nightImage.src = NIGHT_FRAMES[i];
        nightImage.onload = () => onImageLoaded(TOTAL_FRAMES);

        loadedImages.push({ day: dayImage, night: nightImage });
    };
};

const removeXMLDeclaration = (svgString) => {
    return svgString.replace(/<\?xml.*?\?>\s*/, '');
}; // Remove XML Declaration from SVG

let blockSVG;

const resetBrowserUrl = () => window.history.replaceState({}, "", `${window.location.pathname}`);

document.getElementById("closeBtn").addEventListener("click", () => {
    interiorImageWrapper.classList.remove("block");
    interiorImageWrapper.classList.add("hidden");
});



const renderInteriorsList = (data) => {

    
    // Clear virtual tour list
    while (virtualTourList.firstChild) {
        virtualTourList.removeChild(virtualTourList.firstChild);
    }

    // Clear normal interiors list
    while (normalInteriorsList.firstChild) {
        normalInteriorsList.removeChild(normalInteriorsList.firstChild);
    }

    // Separate cards
    const virtualTourCards = data.filter(each => each.virtualTour !== "");
    const normalCards = data.filter(each => each.virtualTour === "");

    // Render Card Function
    const createCard = (each) => {

        const interiorListItem = document.createElement("li");
        interiorListItem.classList.add(
            "select-none",
            "border",
            "border-[#D4A373]/80",
            "hover:border-[#D4A373]",
            "rounded-2xl",
            "shadow-md",
            "overflow-hidden",
            "hover:shadow-lg",
            "transition-all",
            "duration-300",
            "group"
        );

        const interiorListItemImgWrapper = document.createElement("div");
        interiorListItemImgWrapper.classList.add("relative", "overflow-hidden");

        const interiorListItemImg = document.createElement("img");
        interiorListItemImg.id = "interiorUnitPlanImg";
        interiorListItemImg.src = `${each["2dImage"]}`;
        interiorListItemImg.alt = each.bhk;

        interiorListItemImg.classList.add(
            "w-full",
            "h-60",
            "object-cover",
            "shadow-md",
            "shadow-slate-500",
            "cursor-pointer",
            "group-hover:scale-110",
            "transition-transform",
            "duration-300",
            "ease-in-out"
        );

        const imageTypeCallback = (imgType) => {

            switch (imgType) {
                case "2d":
                    interiorImage.src = each["2dImage"];
                    break;

                case "isometric":
                    interiorImage.src = each["isometricImage"];
                    break;

                default:
                    return null;
            }

            interiorImageWrapper.classList.remove("hidden");
            interiorImageWrapper.classList.add("block");
        };

        interiorListItemImg.addEventListener("click", () => {
            imageTypeCallback("2d");
        });

        interiorListItemImgWrapper.appendChild(interiorListItemImg);

        // 2D Badge
        const p2DBadge = document.createElement("div");

        p2DBadge.classList.add(
            "absolute",
            "bottom-3",
            "left-3",
            "bg-white",
            "text-black",
            "backdrop-blur-sm",
            "px-2.5",
            "py-1",
            "rounded-sm",
            "text-xs",
            "font-semibold",
            "inline-flex",
            "items-center",
            "gap-1",
            "uppercase",
            "shadow-md"
        );

        const p2DBadgeText = document.createElement("span");
        p2DBadgeText.textContent = "2d";

        p2DBadge.appendChild(p2DBadgeText);

        // Type Badge
        const typeBadge = document.createElement("div");

        typeBadge.classList.add(
            "absolute",
            "bottom-3",
            "right-3",
            "bg-white",
            "text-black",
            "backdrop-blur-sm",
            "px-2.5",
            "py-1",
            "rounded-sm",
            "text-xs",
            "font-semibold",
            "inline-flex",
            "items-center",
            "gap-1",
            "uppercase",
            "shadow-md"
        );

        const typeBadgeIcon = document.createElement("i");
        typeBadgeIcon.classList.add("fa-solid", "fa-bed");

        const typeBadgeText = document.createElement("span");
        typeBadgeText.textContent = each.bhk;

        typeBadge.appendChild(typeBadgeIcon);
        typeBadge.appendChild(typeBadgeText);

        // Orientation Badge
        const orientationBadge = document.createElement("div");

        orientationBadge.classList.add(
            "absolute",
            "top-3",
            "right-3",
            "bg-white",
            "text-black",
            "backdrop-blur-sm",
            "px-2.5",
            "py-1",
            "rounded-sm",
            "text-xs",
            "font-semibold",
            "inline-flex",
            "items-center",
            "gap-1",
            "uppercase",
            "shadow-md"
        );

        const orientationBadgeIcon = document.createElement("i");
        orientationBadgeIcon.classList.add("fas", "fa-compass");

        const orientationBadgeText = document.createElement("span");
        orientationBadgeText.textContent = each.orientation;

        orientationBadge.appendChild(orientationBadgeIcon);
        orientationBadge.appendChild(orientationBadgeText);

        // Area Badge
        const areaBadge = document.createElement("div");

        areaBadge.classList.add(
            "absolute",
            "top-3",
            "left-3",
            "bg-white",
            "text-black",
            "backdrop-blur-sm",
            "px-2.5",
            "py-1",
            "rounded-sm",
            "text-xs",
            "font-semibold",
            "inline-flex",
            "items-center",
            "gap-1",
            "uppercase",
            "shadow-md"
        );

        const areaBadgeIcon = document.createElement("i");
        areaBadgeIcon.classList.add("fas", "fa-ruler-combined");

        const areaBadgeText = document.createElement("span");
        areaBadgeText.textContent = `${each.size} ${each.unit}`;

        areaBadge.appendChild(areaBadgeIcon);
        areaBadge.appendChild(areaBadgeText);

        interiorListItemImgWrapper.appendChild(typeBadge);
        interiorListItemImgWrapper.appendChild(orientationBadge);
        interiorListItemImgWrapper.appendChild(areaBadge);
        interiorListItemImgWrapper.appendChild(p2DBadge);

        // Details Wrapper
        const interiorListItemDetailsWrapper = document.createElement("div");

        interiorListItemDetailsWrapper.classList.add(
            "p-3",
            "flex",
            "flex-col",
            "justify-evenly",
            "bg-[#1F2229]"
        );

        const btnsWrapper = document.createElement("div");

        btnsWrapper.classList.add(
            "grid",
            "grid-cols-2",
            "gap-2"
        );

        // Balcony Button
        const balconyViewBtn = document.createElement("button");

        const balconyViewBtnIcon = document.createElement("i");
        balconyViewBtnIcon.classList.add("fa-solid", "fa-mountain-sun");

        balconyViewBtn.append(balconyViewBtnIcon);

        if (each.balconyView === "") {

            balconyViewBtn.classList.add(
                "select-none",
                "text-center",
                "cursor-pointer",
                "bg-gray-700/80",
                "hover:bg-gray-600",
                "text-white",
                "px-4",
                "py-2",
                "rounded-lg",
                "transition-all",
                "duration-300",
                "border",
                "border-gray-600/30",
                "group-hover:shadow-md",
                "group-hover:shadow-gray-500/20",
                "text-xs",
                "font-medium"
            );

            balconyViewBtn.append(" ", "No Balcony View");

            }else {

                balconyViewBtn.classList.add(
                    "select-none",
                    "text-center",
                    "cursor-pointer",
                    "bg-[#F7AA47]/90",
                    "hover:bg-[#F7AA47]",
                    "text-white",
                    "px-4",
                    "py-2",
                    "rounded-lg",
                    "transition-all",
                    "duration-300",
                    "border",
                    "border-[#F7AA47]/30",
                    "group-hover:shadow-md",
                    "group-hover:shadow-[#F7AA47]/20",
                    "text-xs",
                    "font-medium"
                );

                balconyViewBtn.append(" ", "Balcony View");

                balconyViewBtn.addEventListener("click", () => {

                    sectionHistory.push("virtualTour");

                    leftPanel.classList.add("hidden");
                    leftPanel.classList.remove("block");

                    virtualTourLink.src = each.balconyView;

                    logoWrapper.classList.remove("hidden");
                    logoWrapper.classList.add("flex");

                    features.classList.add('translate-x-full');

                    commonBtnsWrapper.classList.add("flex");

                    themeToggleContainer.classList.remove('inline-flex');
                    themeToggleContainer.classList.add('hidden');

                    bgAudioWrapper.classList.remove("block");
                    bgAudioWrapper.classList.add("hidden");

                    liveBtnWrapper.classList.remove("block");
                    liveBtnWrapper.classList.add("hidden");

                    interior.classList.add('hidden');

                    virtualTour.classList.add("block");
                    virtualTour.classList.remove("hidden");

                    clubhousesDropdown.classList.add("hidden");
                    clubhousesDropdown.classList.remove("block");
                });
            }

        // Virtual Tour Button
        const virtualTourBtn = document.createElement("button");

        const virtualTourBtnIcon = document.createElement("i");

        virtualTourBtn.append(virtualTourBtnIcon);

        if (each.virtualTour === "") {

            virtualTourBtn.classList.add(
                "select-none",
                "text-center",
                "cursor-pointer",
                "bg-gray-700/80",
                "hover:bg-gray-600",
                "text-white",
                "px-4",
                "py-2",
                "rounded-lg",
                "transition-all",
                "duration-300",
                "border",
                "border-gray-600/30",
                "group-hover:shadow-md",
                "group-hover:shadow-gray-500/20",
                "text-xs",
                "font-medium"
            );

            virtualTourBtnIcon.classList.add(
                "fa-solid",
                "fa-video-slash"
            );

            virtualTourBtn.append(" ", "No Virtual Tour");

        } else {

            virtualTourBtn.classList.add(
                "select-none",
                "text-center",
                "cursor-pointer",
                "bg-[#7A2E43]",
                "hover:bg-[#8d3650]",
                "text-white",
                "px-4",
                "py-2",
                "rounded-lg",
                "transition-all",
                "duration-300",
                "border",
                "border-[#6F2E48]/30",
                "group-hover:shadow-lg",
                "group-hover:shadow-[#ff4d88]/30",
                "text-xs",
                "font-medium",
                "animate-pulse",
                "hover:scale-105"
            );

            virtualTourBtnIcon.classList.add(
                "fa-solid",
                "fa-video"
            );

            virtualTourBtn.append(" ", "Virtual Tour");

            virtualTourBtn.addEventListener("click", () => {

                sectionHistory.push("virtualTour");

                leftPanel.classList.add("hidden");
                leftPanel.classList.remove("block");

                virtualTourLink.src = each.virtualTour;

                logoWrapper.classList.remove("hidden");
                logoWrapper.classList.add("flex");

                features.classList.add('translate-x-full');

                commonBtnsWrapper.classList.add("flex");

                themeToggleContainer.classList.remove('inline-flex');
                themeToggleContainer.classList.add('hidden');

                bgAudioWrapper.classList.remove("block");
                bgAudioWrapper.classList.add("hidden");

                liveBtnWrapper.classList.remove("block");
                liveBtnWrapper.classList.add("hidden");

                interior.classList.add('hidden');

                virtualTour.classList.add("block");
                virtualTour.classList.remove("hidden");

                clubhousesDropdown.classList.add("hidden");
                clubhousesDropdown.classList.remove("block");
            });
        }

        // Isometric Button
        const isometricBtn = document.createElement("button");

        isometricBtn.classList.add(
            "select-none",
            "text-center",
            "cursor-pointer",
            "bg-[#a55b44]/90",
            "hover:bg-[#a55b44]",
            "border-[#a55b44]/30",
            "text-white",
            "px-4",
            "py-2",
            "rounded-lg",
            "transition-all",
            "duration-300",
            "border",
            "group-hover:shadow-md",
            "group-hover:shadow-[#a55b44]/20",
            "text-xs",
            "font-medium"
        );

        const isometricBtnIcon = document.createElement("i");
        isometricBtnIcon.classList.add("fa-solid", "fa-cubes");

        isometricBtn.append(isometricBtnIcon);
        isometricBtn.append(" ", "Isometric");

        isometricBtn.addEventListener("click", () => {
            imageTypeCallback("isometric");
        });

        // View Image Button
        const image2DBtn = document.createElement("button");

        image2DBtn.classList.add(
            "select-none",
            "text-center",
            "cursor-pointer",
            "bg-[#a27165]/90",
            "hover:bg-[#a27165]",
            "border-[#a27165]/30",
            "text-white",
            "px-4",
            "py-2",
            "rounded-lg",
            "transition-all",
            "duration-300",
            "border",
            "border-[#a27165]/30",
            "group-hover:shadow-md",
            "group-hover:shadow-[#a27165]/20",
            "text-xs",
            "font-medium"
        );

        const image2DBtnIcon = document.createElement("i");
        image2DBtnIcon.classList.add("fa-solid", "fa-eye");

        image2DBtn.append(image2DBtnIcon);
        image2DBtn.append(" ", "View Image");

        image2DBtn.addEventListener("click", () => {
            imageTypeCallback("2d");
        });

        btnsWrapper.appendChild(isometricBtn);
        btnsWrapper.appendChild(image2DBtn);
        btnsWrapper.appendChild(balconyViewBtn);
        btnsWrapper.appendChild(virtualTourBtn);

        interiorListItemDetailsWrapper.appendChild(btnsWrapper);

        interiorListItem.appendChild(interiorListItemImgWrapper);
        interiorListItem.appendChild(interiorListItemDetailsWrapper);

        return interiorListItem;
    };

    // Desktop only centering
    if (window.innerWidth >= 1024 && virtualTourCards.length === 2) {

        // Left empty space
        const leftSpacer = document.createElement("li");
        leftSpacer.classList.add("hidden", "lg:block");

        // Right empty space
        const rightSpacer = document.createElement("li");
        rightSpacer.classList.add("hidden", "lg:block");

        virtualTourList.appendChild(leftSpacer);

        virtualTourCards.forEach(each => {
            virtualTourList.appendChild(createCard(each));
        });

        virtualTourList.appendChild(rightSpacer);

    } else {

        virtualTourCards.forEach(each => {
            virtualTourList.appendChild(createCard(each));
        });
    }

    // Bottom row
    normalCards.forEach(each => {
        normalInteriorsList.appendChild(createCard(each));
    });

    console.log("ALL DATA", data);
    console.log("VT CARDS", virtualTourCards);
    console.log("NORMAL CARDS", normalCards);
};

const updateFilteredData = (svg) => {
    const filteredApartments = filteredData();
    resetSVGFill(svg);
    
    filteredApartments.forEach(each => {
        const id = `#${each.flatId} rect, #${each.flatId} circle, #${each.flatId} path, #${each.flatId} polyline, #${each.flatId} polygon`;
        const units = svg.selectAll(id);

        units.on("click", function () {
            sectionHistory.push("unitPlans");
            console.log("section history:", sectionHistory);
            leftPanel.classList.add("hidden");
            leftPanel.classList.remove("block");
            features.classList.add('translate-x-full');
            bgAudioBtn.classList.add("hidden");
            bgAudioBtn.classList.remove("block");
            unitId = d3.select(this.parentNode).attr("id");
            unitPlanFlatNumberLabel.textContent = `Flat: ${unitId.split('_')[1]}`;
            unitPlanFloorNumberLabel.textContent = `Floor: ${unitId.split('_')[3]}`;
            // console.log("660", unitId);
            // unitPlanBtnsWrapper.classList.remove("hidden");
            // unitPlanBtnsWrapper.classList.add("block");
            window.history.replaceState({}, "", `${window.location.pathname}?unitId=${unitId}`);
            const apartmentData = getFilteredApartmentById(unitId);
            unitPlanFlatOrientLabel.textContent = `${apartmentData.orientation}`;
            unitPlanFlatSizeLabel.textContent = `${apartmentData.size} ${apartmentData.unit}`;
            // console.log("759", towerId, unitId, apartmentData);
            unitPlanImg.src = apartmentData["2dImage"];
            webverseFilterBtn.classList.remove('inline-flex');
            webverseFilterBtn.classList.add('hidden');
            webverseFilters.classList.remove("block");
            webverseFilters.classList.add("hidden");
            themeToggleContainer.classList.remove('inline-flex');
            themeToggleContainer.classList.add('hidden');
            webverseBlock.classList.add('hidden');
            unitPlans.classList.remove('hidden');
            unitPlans.classList.add('block');
            liveBtnWrapper.classList.remove("block");
            liveBtnWrapper.classList.add("hidden");
            clubhousesDropdown.classList.remove("block");
            clubhousesDropdown.classList.add("hidden");
            renderSpecifications(apartmentData);

            if (apartmentData.virtualTour !== "") {
                unitPlanVirtualTourLink.classList.remove("hidden");
                unitPlanVirtualTourLink.classList.add("inline-flex");

                unitPlanVirtualTourLink.addEventListener("click", () => {
                    sectionHistory.push("virtualTour");
                    console.log("section history:", sectionHistory);
                    // unitPlanBtnsWrapper.classList.add("hidden");
                    // unitPlanBtnsWrapper.classList.remove("block");
                    commonBtnsWrapper.classList.add("flex");
                    // logoWrapper.classList.add("hidden");
                    themeToggleContainer.classList.remove('inline-flex');
                    themeToggleContainer.classList.add('hidden');
                    bgAudioWrapper.classList.remove("block");
                    bgAudioWrapper.classList.add("hidden");
                    liveBtnWrapper.classList.remove("block");
                    liveBtnWrapper.classList.add("hidden");
                    unitPlans.classList.add('hidden');
                    unitPlans.classList.remove('block');
                    virtualTourLink.src = each.virtualTour;
                    
                    features.classList.add('translate-x-full');
                    logoWrapper.classList.add("block");
                    amenities.classList.add('hidden');
                    virtualTour.classList.add("block");
                    virtualTour.classList.remove("hidden");
                    clubhousesDropdown.classList.add("hidden");
                    clubhousesDropdown.classList.remove("block");
                });

            } else {
                unitPlanVirtualTourLink.classList.add("hidden");
                unitPlanVirtualTourLink.classList.remove("inline-flex");
            };
        });

        units.style("cursor", "pointer")
            .style("fill", `rgba(0,255,0,0.5)`)
            .style('stroke-width', '1px')
            .style('stroke', 'rgba(255,255,255,1)');

    });

    selectedFloors.forEach(each => {
        const id = `#${each} rect, #${each} circle, #${each} path, #${each} polyline, #${each} polygon`;
        const floors = svg.selectAll(id);

        floors.on('click', function () {
            sectionHistory.push("floorPlans");
            // console.log("section history:", sectionHistory);
            //createTour(floorPlansSteps);
            clubhousesDropdown.classList.remove("block");
            clubhousesDropdown.classList.add("hidden");
            leftPanel.classList.add("hidden");
            leftPanel.classList.remove("block");
            features.classList.add('translate-x-full');
            bgAudioBtn.classList.add("hidden");
            bgAudioBtn.classList.remove("block");
            webverseFilterBtn.classList.remove("inline-flex");
            webverseFilterBtn.classList.add("hidden");
            webverseFilters.classList.remove("block");
            webverseFilters.classList.add("hidden");
            themeToggleContainer.classList.remove("inline-flex");
            themeToggleContainer.classList.add("hidden");
            const floorId = d3.select(this.parentNode).attr("id");
            updateFloorPlanLabel(floorId.replace("Floor_", "Floor: "));
            floorPlan = +floorId.replace("Floor_", "");
            // console.log("668", floorPlan);
            updateFloorPlanImg();
            webverseBlock.classList.add('hidden');
            floorPlans.classList.remove('hidden');
            floorPlans.classList.add('block');
        });

        floors.style("cursor", "pointer")
            .style("fill", `rgba(0,255,0,0.5)`)
            .style('stroke-width', '1px')
            .style('stroke', 'rgba(255,255,255,1)');
    });
};

const getFilteredApartmentById = (id) => unitsData.find(each => each.flatId === id);

function highlight() {
    d3.select(this)
        .transition()
        .duration(300)
        .style("cursor", "pointer")
        .style("fill", "rgba(0,255,255,0.30)");
};

function unhighlight() {
    d3.select(this)
        .transition()
        .duration(300)
        .style("cursor", "pointer")
        .style("fill", "transparent");
};

function styleBlockSvgElements () {
    blockSVG.selectAll('rect, circle, polygon, polyline, path')
        .attr('fill', 'transparent')
        // .on("mouseover", highlight)
        // .on("mouseout", unhighlight)
        // .on("touchstart", highlight)
        // .on("touchend", unhighlight);
};

const fetchBlockSVGContent = async (url) => {
    try {

        isBlockEventListenersAdded = true;

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        };

        const svgContent = await response.text();
        const cleanedSVG = removeXMLDeclaration(svgContent);

        blockSvg.innerHTML = cleanedSVG;

        blockSVG = d3.select("#blockSvg svg");

        blockSVG.attr('preserveAspectRatio', 'xMidYMid slice')
           .attr('width', '100%')
           .attr('height', '100%');

        styleBlockSvgElements();

        if (selectedFacings.size > 0 || selectedFloors.size > 0 || selectedTypes.size > 0 || selectedUnits.size > 0 )  {
            updateFilteredData(blockSVG);
        };

    } catch (error) {
        console.error("Error loading SVG:", error.message);
    }
}; // Fetch SVG Content 

let layoutSVG;

const layoutSvgElementsSelection = (name) => {
    return layoutSVG.selectAll(`g[id^='${name}']`).selectAll('rect, path, polygon, circle, polyline');
};

const renderWebverseFilterOptions = () => {
    const orientationsEl = document.querySelector(".orientations");
    const floorsEl = document.querySelector(".floors");
    const typesEl = document.querySelector(".types");
    const unitsEl = document.querySelector(".units");

    while (orientationsEl.firstChild) {
        orientationsEl.removeChild(orientationsEl.firstChild);
    };

    while (floorsEl.firstChild) {
        floorsEl.removeChild(floorsEl.firstChild);
    };

    while (typesEl.firstChild) {
        typesEl.removeChild(typesEl.firstChild);
    };

    while (unitsEl.firstChild) {
        unitsEl.removeChild(unitsEl.firstChild);
    };

    towerData?.orientations.map(each => {
        const orientationEl = document.createElement("li");
        orientationEl.classList.add("select-none", "text-sm", "cursor-pointer", "capitalize", "text-white", "px-3", "py-1", "rounded-full", "border", "border-2",  "bg-[rgba(255,255,255,0.1)]", "border-[rgba(255,255,255,0.2)]", "transition-colors", "duration-700", "ease-in-out", "delay-150");
        orientationEl.setAttribute("data-type", each);
        orientationEl.textContent = each;
        orientationsEl.appendChild(orientationEl);
    });

    towerData?.floors.map(({ label, id }) => {
        const floorEl = document.createElement("li");
        floorEl.classList.add("select-none", "cursor-pointer", "capitalize", "text-white", "border", "border-2", "bg-[rgba(255,255,255,0.1)]", "border-[rgba(255,255,255,0.2)]", "transition-colors", "duration-700", "ease-in-out", "delay-150", "p-1", "rounded-full", "text-sm", "h-10", "w-10", "flex", "flex-col", "justify-center", "items-center");
        floorEl.setAttribute("data-type", id);
        floorEl.textContent = label;
        floorsEl.appendChild(floorEl);
    });

    towerData?.types.map(each => {
        const typeEl = document.createElement("li");
        typeEl.classList.add("select-none", "cursor-pointer", "uppercase", "text-white", "border", "border-2", "bg-[rgba(255,255,255,0.1)]", "border-[rgba(255,255,255,0.2)]", "transition-colors", "duration-700", "ease-in-out", "delay-150", "px-3", "py-1", "rounded-full", "text-sm");
        typeEl.setAttribute("data-type", each);
        typeEl.textContent = each;
        typesEl.appendChild(typeEl);
    });

    towerData?.units.map(each => {
        const unitEl = document.createElement("li");
        unitEl.classList.add("select-none", "cursor-pointer", "text-white", "border", "border-2", "bg-[rgba(255,255,255,0.1)]", "border-[rgba(255,255,255,0.2)]", "transition-colors", "duration-700", "ease-in-out", "delay-150", "px-3", "py-1", "rounded-full", "flex", "flex-col", "justify-center", "items-center", "text-sm");
        unitEl.setAttribute("data-type", each);
        unitEl.textContent = each;
        unitsEl.appendChild(unitEl);
    });

    const orientations = document.querySelectorAll('.orientations li'); // Orientations
    const floors = document.querySelectorAll('.floors li'); // Floors
    const types = document.querySelectorAll('.types li'); // Types
    const units = document.querySelectorAll('.units li'); // Units

    toggleSelection(floors, selectedFloors); // Floor Toggle Selection
    toggleSelection(units, selectedUnits, true); // Units Toggle Selection   
    toggleSelection(orientations, selectedFacings); // Orientations Toggle Selection 
    toggleSelection(types, selectedTypes); // Types Toggle Selection    
};

function reset() {

    if (blockSVG) {
        resetSVGFill(blockSVG);
        styleBlockSvgElements();
    };

    resetToggleSelection(document.querySelectorAll(".orientations li"));
    resetToggleSelection(document.querySelectorAll(".floors li"));
    resetToggleSelection(document.querySelectorAll(".types li"));
    resetToggleSelection(document.querySelectorAll(".units li"));
    selectedFacings.clear();
    selectedFloors.clear();
    selectedTypes.clear();
    selectedUnits.clear();
};

// applyFiltersBtn.addEventListener('click', () => {
//     if (selectedFacings.size > 0 || selectedFloors.size > 0 || selectedTypes.size > 0 || selectedUnits.size > 0 )  {
//         updateFilteredData(blockSVG);
//     } else {
//         resetSVGFill(blockSVG);
//     };
// });

resetFiltersBtn.addEventListener('click', reset); // Reset Filters Event Listener

const fetchLayoutSVGContent = async (url) => {
    isLayoutEventListenersAdded = true;

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
    };

    const svgContent = await response.text();
    const cleanedSVG = removeXMLDeclaration(svgContent);

    layoutSvg.innerHTML = cleanedSVG;

    layoutSVG = d3.select("#layoutSvg svg");

    layoutSVG.attr('preserveAspectRatio', 'xMidYMid slice')
        .attr('width', '100%')
        .attr('height', '100%');

    layoutSVG.selectAll('rect, circle, polygon, polyline, path')
        .style('stroke-width', '1px')
        .style('stroke', 'rgba(255,255,255,1)')
        .style('fill', 'transparent');

    const blockElements = layoutSvgElementsSelection("Block_");

    blockElements.on("mouseover", highlight)
                  .on("mouseout", unhighlight)
                  .on("touchstart", highlight)
                  .on("touchend", unhighlight);

    blockElements.on("click", function() {
        sectionHistory.push("webverseBlock");
        // console.log("Section History:", sectionHistory);
        //createTour(webverseSteps)
        selectedFacings.clear();
        selectedFloors.clear();
        selectedTypes.clear();
        selectedUnits.clear();

        clubhousesDropdown.classList.remove("block");
        clubhousesDropdown.classList.add("hidden");

        liveBtnWrapper.classList.remove("block");
        liveBtnWrapper.classList.add("hidden");

        bgAudioIcon.classList.remove('fa-volume-high');
        bgAudioIcon.classList.add('fa-volume-xmark');

        loaderWrapper.classList.remove('hidden');
        loaderWrapper.classList.add('block');

        webverseFilters.classList.remove('-translate-x-full');

        themeToggleInput.checked = true;
        document.getElementById("themeSwitch").classList.remove("dark");
        timeOfDay = "night";

        towerId = d3.select(this.parentNode).attr("id");
        unitPlanTowerNumberLabel.textContent = `${towerId.replace("_", " ")}`;

        webverseTowerLabel.textContent = `Block:${towerId.replace("Block_", "")}`;

        unitsData = data?.flats.filter(each => each.towerId === towerId);

        window.history.replaceState({}, "", `${window.location.pathname}?blockId=${towerId}`);

        webverse.classList.add("hidden");
        webverse.classList.remove("block");

        webverseBlock.classList.remove('hidden');
        webverseBlock.classList.add('block');

        webverseFilterBtn.classList.remove('hidden');
        webverseFilterBtn.classList.add('inline-flex');

        webverseFilters.classList.remove("hidden");
        webverseFilters.classList.add("block");

        themeToggleContainer.classList.add('inline-flex');
        themeToggleContainer.classList.remove('hidden');

        features.classList.add('translate-x-full');

        featuresList.forEach(feature => {
            const featureType = feature.getAttribute('data-type');

            feature.querySelector('div').classList.remove('from-[#dc0073]', 'to-[#f5b700]', 'bg-gradient-to-br');

            if (featureType === 'webverse') {
                feature.querySelector('div').classList.add('from-[#dc0073]', 'to-[#f5b700]', 'bg-gradient-to-br');
            };
        });

        // console.log("before", BLOCK_CURRENT_FRAME, BLOCK_DEGREE, BLOCK_DEGREE_INTERVALS);

        towerData = data?.towers.find(each => each.towerId === towerId);
        // console.log("towerData:", towerData);
        // console.log("Raw degreeIntervals:", towerData?.degreeIntervals);
        // console.log("totalFrames:", towerData?.totalFrames);

        preloadImages(towerData?.totalFrames, towerData?.dayFrames, towerData?.nightFrames);

        bgAudioSource.src = towerData?.audio?.src;
        bgAudioSource.type = towerData?.audio?.type;
        bgAudio.load();

        document.getElementById("tower").textContent = `${towerId.replace("_", " ")}`;

        renderWebverseFilterOptions();
        renderFloorsOptions(towerData?.floors);

        BLOCK_CURRENT_FRAME = towerData?.currentFrame;
        BLOCK_DEGREE = 360 / towerData?.totalFrames;

        BLOCK_DEGREE_INTERVALS = towerData.degreeIntervals.map(each => each * BLOCK_DEGREE);

        // console.log("AFTER VALUES:");
        // console.log("BLOCK_CURRENT_FRAME:", BLOCK_CURRENT_FRAME);
        // console.log("BLOCK_DEGREE:", BLOCK_DEGREE);
        // console.log("BLOCK_DEGREE_INTERVALS:", BLOCK_DEGREE_INTERVALS);

        updateBlockImage();
        updateBlockSVG();
        updateLayoutImage();
    });  
    
    const clubhouse = layoutSVG.selectAll("g[id^='Clubhouse'] rect, g[id^='Clubhouse'] path, g[id^='Clubhouse'] polygon, g[id^='Clubhouse'] circle");
    clubhouse.style("fill", "transparent");

    function clubhouseHighlight () {
        d3.select(this)
            .transition()
            .duration(300)
            .style("cursor", "pointer")
            .style("fill", `rgba(0,255,255,0.30)`)
            .style("stroke", "#ffffff")
            .style("stroke-width", "3px");
    };

    function clubhouseUnhighlight () {
        d3.select(this)
            .transition()
            .duration(300)
            .style("cursor", "pointer")
            .style("fill", 'transparent')
            .style("stroke", "transparent")
            .style("stroke-width", "0");
    };

    clubhouse.on('mouseover', clubhouseHighlight);
    clubhouse.on('mouseout', clubhouseUnhighlight);
    clubhouse.on('touchstart', clubhouseHighlight);
    clubhouse.on('touchend', clubhouseUnhighlight);

    clubhouse.on('click', function () {
          sectionHistory.push("clubhouse");
        //   console.log("Section History:", sectionHistory);
          themeToggleContainer.classList.remove('inline-flex');
          themeToggleContainer.classList.add('hidden');
          bgAudioWrapper.classList.remove("block");
          bgAudioWrapper.classList.add("hidden");
          liveBtnWrapper.classList.remove("block");
          liveBtnWrapper.classList.add("hidden");
          clubhouseEl.classList.remove('hidden');
          clubhouseEl.classList.add('block');
          webverse.classList.add('hidden');
          webverseBlock.classList.add('hidden');
          floorPlans.classList.add('hidden');
          clubhouseFloorPlans.classList.add('hidden');
          unitPlans.classList.add('hidden');
          amenities.classList.add('hidden');
          about.classList.add('hidden');
          exterior.classList.add('hidden');
          googlemap.classList.add('hidden');
          gallery.classList.add('hidden');
          brochure.classList.add('hidden');
          leftPanel.classList.add("hidden");
          leftPanel.classList.remove("block");
    });
};

let clubhouseLevelsSVG = d3.select("#clubhouseSvg svg");

clubhouseLevelsSVG.attr('preserveAspectRatio', 'xMidYMid slice')
    .attr('width', '100%')
    .attr('height', '100%');

clubhouseLevelsSVG.selectAll('rect, circle, polygon, polyline, path')
    .style('stroke-width', '1px')
    .style('stroke', 'rgba(255,255,255,1)')
    .style('fill', 'transparent');

const clubhouseLevelsSVGElements = clubhouseLevelsSVG.selectAll(`g[id^='Floor_']`).selectAll('rect, path, polygon, circle, polyline'); 

clubhouseLevelsSVGElements.on("mouseover", function() {
    d3.select(this)
        .transition()   
        .duration(300)
        .style("cursor", "pointer")
        .style("fill", "rgba(0,255,255,0.30)");
});

clubhouseLevelsSVGElements.on("mouseout", function() {
    d3.select(this)
        .transition()   
        .duration(300)
        .style("cursor", "pointer")
        .style("fill", "transparent");
});

const updateClubhouseLevelId = (i) => window.history.replaceState({}, "", `${window.location.pathname}?clubhouseLevel=${clubhouseFloorPlansData[i].id}`);

clubhouseLevelsSVGElements.on("click", function() {
    themeToggleContainer.classList.remove('inline-flex');
    themeToggleContainer.classList.add('hidden');
    bgAudioWrapper.classList.remove("block");
    bgAudioWrapper.classList.add("hidden");
    liveBtnWrapper.classList.remove("block");
    liveBtnWrapper.classList.add("hidden");
    sectionHistory.push("clubhouseFloorPlans");
    // console.log("Section History:", sectionHistory);
    const id = d3.select(this.parentNode).attr("id");
    clubhouseFloorPlan = clubhouseFloorPlansData.findIndex(obj => obj.id === id);
    // console.log("Clicked ID:", id, "Index:", clubhouseFloorPlan);
    updateClubhouseLevelId(clubhouseFloorPlan);
    updateClubhouseFloorPlanImg();
    updateClubhouseFloorPlanLabel();
    clubhouseFloorPlans.classList.remove('hidden');
    clubhouseFloorPlans.classList.add('block');
    clubhouseEl.classList.add('hidden');
    webverse.classList.add('hidden');
    webverseBlock.classList.add('hidden');
    floorPlans.classList.add('hidden');
    clubhouseEl.classList.add('hidden');
    unitPlans.classList.add('hidden');
    amenities.classList.add('hidden');
    about.classList.add('hidden');
    exterior.classList.add('hidden');
    googlemap.classList.add('hidden');
    gallery.classList.add('hidden');
    brochure.classList.add('hidden');
});

const blockShouldStopAtInterval = (frame) => {    
    const degree = frame * BLOCK_DEGREE; 
    return BLOCK_DEGREE_INTERVALS.includes(degree);
};

const layoutShouldStopAtInterval = (frame) => {    
    const degree = frame * LAYOUT_DEGREE; 
    return LAYOUT_DEGREE_INTERVALS.includes(degree);
};

const removeBlockSVG = () => blockSvg.innerHTML = ""; // Remove Block SVG
const removeLayoutSVG = () => layoutSvg.innerHTML = ""; // Remove Layout SVG

const stopBlockRotation = (BLOCK_CURRENT_FRAME, interval) => {
    if (blockShouldStopAtInterval(BLOCK_CURRENT_FRAME)) {
        IS_SET_INTERVAL_RUNNING = false;
        clearInterval(interval);
        updateBlockSVG();
        updateFilteredData(blockSVG);
    };
};

const stopLayoutRotation = (LAYOUT_CURRENT_FRAME, interval) => {
    if (layoutShouldStopAtInterval(LAYOUT_CURRENT_FRAME)) {
        IS_SET_INTERVAL_RUNNING = false;
        clearInterval(interval);
        updateLayoutSVG();
    };
};

const blockLeftMovement = () => {
    features.classList.add('translate-x-full');
    removeBlockSVG();
    if (IS_SET_INTERVAL_RUNNING) return;
    const minFrameValue = Math.min(...BLOCK_DEGREE_INTERVALS) / 10;
    const prevInterval = setInterval(() => {

        removeBlockSVG();
        IS_SET_INTERVAL_RUNNING = true;

        if (BLOCK_CURRENT_FRAME > 1) { 
            BLOCK_CURRENT_FRAME--;
        } else if (BLOCK_CURRENT_FRAME * 10 === (Math.max(...BLOCK_DEGREE_INTERVALS) / 10)) {
            BLOCK_CURRENT_FRAME = minFrameValue - 1;
        } else if (BLOCK_CURRENT_FRAME === 1) { 
            BLOCK_CURRENT_FRAME = BLOCK_TOTAL_FRAMES;
        };

        //blockUpdateVideo();
        updateBlockImage();
        stopBlockRotation(BLOCK_CURRENT_FRAME, prevInterval);

    }, BLOCK_FRAME_UPDATE_INTERVAL);

}; // Left Movement

const blockRightMovement = () => {
    features.classList.add('translate-x-full');
    removeBlockSVG();
    if (IS_SET_INTERVAL_RUNNING) return;
    const maxFrameValue = Math.max(...BLOCK_DEGREE_INTERVALS) / 10;

    const nextInterval = setInterval(() => {

        removeBlockSVG();
        IS_SET_INTERVAL_RUNNING = true;

        if (BLOCK_CURRENT_FRAME < BLOCK_TOTAL_FRAMES) {
            BLOCK_CURRENT_FRAME++;
        } else if (BLOCK_CURRENT_FRAME * 10 === maxFrameValue && BLOCK_CURRENT_FRAME !== BLOCK_TOTAL_FRAMES) { 
            BLOCK_CURRENT_FRAME = maxFrameValue + 1;
        } else if (BLOCK_CURRENT_FRAME === BLOCK_TOTAL_FRAMES) {
            BLOCK_CURRENT_FRAME = 1;
        };

        //blockUpdateVideo();
        updateBlockImage();
        stopBlockRotation(BLOCK_CURRENT_FRAME, nextInterval);

    }, BLOCK_FRAME_UPDATE_INTERVAL);
}; // Right Movement

webversePrevBtn.addEventListener('click', blockLeftMovement); // Webverse Previous Button Event Listener
webverseNextBtn.addEventListener('click', blockRightMovement); // Webverse Next Button Event Listener

// -------------------- LAYOUT SECTION --------------------
const layoutLeftMovement = () => {
    features.classList.add('translate-x-full');
    removeLayoutSVG();
    if (IS_SET_INTERVAL_RUNNING) return;
    const minFrameValue = Math.min(...LAYOUT_DEGREE_INTERVALS) / 10;
    const prevInterval = setInterval(() => {

        removeLayoutSVG();
        IS_SET_INTERVAL_RUNNING = true;

        if (LAYOUT_CURRENT_FRAME > 1) { 
            LAYOUT_CURRENT_FRAME--;
        } else if (LAYOUT_CURRENT_FRAME * 10 === (Math.max(...LAYOUT_DEGREE_INTERVALS) / 10)) {
            LAYOUT_CURRENT_FRAME = minFrameValue - 1;
        } else if (LAYOUT_CURRENT_FRAME === 1) { 
            LAYOUT_CURRENT_FRAME = LAYOUT_TOTAL_FRAMES;
        };

        updateLayoutImage();
        stopLayoutRotation(LAYOUT_CURRENT_FRAME, prevInterval);

    }, LAYOUT_FRAME_UPDATE_INTERVAL);

}; // Left Movement

const layoutRightMovement = () => {
    features.classList.add('translate-x-full');
    removeLayoutSVG();
    if (IS_SET_INTERVAL_RUNNING) return;
    const maxFrameValue = Math.max(...LAYOUT_DEGREE_INTERVALS) / 10;

    const nextInterval = setInterval(() => {

        removeLayoutSVG();
        IS_SET_INTERVAL_RUNNING = true;

        if (LAYOUT_CURRENT_FRAME < LAYOUT_TOTAL_FRAMES) {
            LAYOUT_CURRENT_FRAME++;
        } else if (LAYOUT_CURRENT_FRAME * 10 === maxFrameValue && LAYOUT_CURRENT_FRAME !== LAYOUT_TOTAL_FRAMES) { 
            LAYOUT_CURRENT_FRAME = maxFrameValue + 1;
        } else if (LAYOUT_CURRENT_FRAME === LAYOUT_TOTAL_FRAMES) {
            LAYOUT_CURRENT_FRAME = 1;
        };

        updateLayoutImage();
        stopLayoutRotation(LAYOUT_CURRENT_FRAME, nextInterval);

    }, LAYOUT_FRAME_UPDATE_INTERVAL);
}; // Right Movement

layoutPrevBtn.addEventListener('click', layoutLeftMovement); // Webverse Previous Button Event Listener
layoutNextBtn.addEventListener('click', layoutRightMovement); // Webverse Next Button Event Listener

// -------------------- FEATURES SECTION --------------------
featurePanelBtn.addEventListener('click', () => {
    features.classList.toggle('translate-x-full');
});

featurePanelCloseBtn.addEventListener('click', () => {
    features.classList.add('translate-x-full');
});

featuresList.forEach((feature) => {
    feature.addEventListener('click', () => {
        const featureType = feature.getAttribute('data-type');
        console.log("Clicked feature:", featureType);

        if (featureType !== null) {
            sectionHistory.push(featureType);
        };

        // tabs.forEach(tab => {
        //     const textSpan = tab.querySelector(".tab-text");

        //     const isActive = tab === featureType;

        //     // Toggle background & text color
        //     tab.classList.toggle("bg-white", isActive);
        //     tab.classList.toggle("text-black", isActive);
        //     tab.classList.toggle("text-white", !isActive);

        //     // Toggle sizing (icon-only vs full tab)
        //     tab.classList.toggle("px-2", isActive);
        //     tab.classList.toggle("lg:px-4", isActive);
        //     tab.classList.toggle("h-8", !isActive);
        //     tab.classList.toggle("w-8", !isActive);
        //     tab.classList.toggle("lg:h-10", !isActive);
        //     tab.classList.toggle("lg:w-10", !isActive);

        //     // Toggle label visibility
        //     if (textSpan) {
        //         textSpan.classList.toggle("hidden", !isActive);
        //     };

        // });

        // console.log("Section History:", sectionHistory);

        const featureWrapper = feature.querySelector("div");

        if (
            featureWrapper.classList.contains('from-blue-600') &&
            featureWrapper.classList.contains('to-violet-600') &&
            featureWrapper.classList.contains('bg-gradient-to-br')
        ) {
            features.classList.add('translate-x-full');
            return;
        };

        if (blockSVG) {
            resetSVGFill(blockSVG);
        };

        featuresList.forEach(item => {
            item.querySelector('div').classList.remove('from-[#dc0073]', 'to-[#f5b700]', 'bg-gradient-to-br');
        });

        feature.querySelector('div').classList.add('from-[#dc0073]', 'to-[#f5b700]', 'bg-gradient-to-br');

        featuresCondition(featureType);
    });
});

featuresPanelList.forEach((featureItem) => {
  featureItem.addEventListener("click", () => {
      const featureType = featureItem.querySelector("div").getAttribute('data-type');
      sectionHistory.push(featureType);
    //   console.log("Section History:", sectionHistory);
        
      featuresCondition(featureType);

      featuresList.forEach(item => {
          item.querySelector('div').classList.remove('from-[#6F2E48]', 'to-[#F7AA47]', 'bg-gradient-to-br');

          if (item.getAttribute('data-type') === featureType) {
              item.querySelector('div').classList.add('from-[#6F2E48]', 'to-[#F7AA47]', 'bg-gradient-to-br');
          };
      });
  });
});


function setActiveTab(activeTab) {
    
    featuresList.forEach(item => {
        item.querySelector('div').classList.remove('from-[#6F2E48]', 'to-[#F7AA47]', 'bg-gradient-to-br');

        if (item.getAttribute('data-type') === activeTab.getAttribute("data-type")) {
            item.querySelector('div').classList.add('from-[#6F2E48]', 'to-[#F7AA47]', 'bg-gradient-to-br');
        };
    });
    
    tabs.forEach(tab => {
        const textSpan = tab.querySelector(".tab-text");

        const isActive = tab === activeTab;

        // Toggle background & text color
        tab.classList.toggle("bg-white", isActive);
        tab.classList.toggle("text-black", isActive);
        tab.classList.toggle("text-white", !isActive);

        // Toggle sizing (icon-only vs full tab)
        tab.classList.toggle("px-2", isActive);
        tab.classList.toggle("lg:px-4", isActive);
        tab.classList.toggle("h-8", !isActive);
        tab.classList.toggle("w-8", !isActive);
        tab.classList.toggle("lg:h-10", !isActive);
        tab.classList.toggle("lg:w-10", !isActive);

        // Toggle label visibility
        if (textSpan) {
            textSpan.classList.toggle("hidden", !isActive);
        };

    });
}

const tabsCondition = (tab) => {
    // console.log("2326:", tab.dataset.type);
    sectionHistory.push(tab.dataset.type);
    // console.log("Section History:", sectionHistory);
    switch (tab.dataset.type) {
        case "webverse":
            // ✅ preload + render
            preloadImages(data?.layout?.totalFrames, data?.layout?.dayFrames, data?.layout?.nightFrames);
            updateLayoutImage();

            clubhousesDropdown.classList.add("hidden");
            clubhousesDropdown.classList.remove("block");

            // ✅ HARD RESET webverseBlock-only UI (prevents bleeding/overflow)
            webverseBlock.classList.add("hidden");
            webverseBlock.classList.remove("block");

            webverseFilters.classList.add("hidden");
            webverseFilters.classList.remove("block");           // ✅ important
            webverseFilters.classList.add("-translate-x-full");  // ✅ important (reset slide state)
            webverseFilters.classList.remove("-translate-x-0");  // ✅ optional safety if you ever use it

            webverseFilterBtn.classList.add("hidden");           // ✅ important
            webverseFilterBtn.classList.remove("inline-flex");   // ✅ important

            // ✅ show webverse layout section
            home.classList.add("hidden");
            webverse.classList.add("block");
            webverse.classList.remove("hidden");

            // ✅ hide everything else
            interior.classList.add("hidden");
            floorPlans.classList.add("hidden");
            unitPlans.classList.add("hidden");
            amenities.classList.add("hidden");
            virtualTour.classList.add("hidden");
            about.classList.add("hidden");
            exterior.classList.add("hidden");
            googlemap.classList.add("hidden");
            gallery.classList.add("hidden");
            brochure.classList.add("hidden");
            clubhouseEl.classList.add("hidden");
            clubhouseFloorPlans.classList.add("hidden");

            // ✅ common header/buttons state
            logoWrapper.classList.add("block");
            logoWrapper.classList.remove("hidden");
            commonBtnsWrapper.classList.remove("hidden");
            commonBtnsWrapper.classList.add("flex");

            // ✅ theme toggle visible in webverse
            themeToggleContainer.classList.add("inline-flex");
            themeToggleContainer.classList.remove("hidden");

            // ✅ live button visible in webverse
            liveBtnWrapper.classList.add("block");
            liveBtnWrapper.classList.remove("hidden");
            break;
        case "interior":
            clubhousesDropdown.classList.add("hidden");
            clubhousesDropdown.classList.remove("block"); 

            // ✅ show interior
            interior.classList.add("block");
            interior.classList.remove("hidden");

            // ✅ hide webverse + webverseBlock
            webverse.classList.add("hidden");
            home.classList.add("hidden");

            webverseBlock.classList.add("hidden");
            webverseBlock.classList.remove("block");              // ✅ important (prevents bleed)

            // ✅ HARD RESET webverseBlock-only UI (prevents bleeding/overflow)
            webverseFilters.classList.add("hidden");
            webverseFilters.classList.remove("block");            // ✅ important
            webverseFilters.classList.add("-translate-x-full");   // ✅ important (reset slide state)
            webverseFilters.classList.remove("-translate-x-0");   // ✅ optional safety if used anywhere

            webverseFilterBtn.classList.add("hidden");
            webverseFilterBtn.classList.remove("inline-flex");    // ✅ important (you had this reversed)

            // ✅ hide the rest
            floorPlans.classList.add("hidden");
            unitPlans.classList.add("hidden");
            amenities.classList.add("hidden");
            virtualTour.classList.add("hidden");
            about.classList.add("hidden");
            exterior.classList.add("hidden");
            googlemap.classList.add("hidden");
            gallery.classList.add("hidden");
            brochure.classList.add("hidden");
            clubhouseEl.classList.add("hidden");
            clubhouseFloorPlans.classList.add("hidden");

            // ✅ theme/audio off in interior
            themeToggleContainer.classList.add("hidden");
            themeToggleContainer.classList.remove("inline-flex");

            bgAudio.pause();
            bgAudio.currentTime = 0;
            bgAudioBtn.classList.add("hidden");
            bgAudioBtn.classList.remove("block");

            // ✅ live btn hidden in interior
            liveBtnWrapper.classList.add("hidden");
            liveBtnWrapper.classList.remove("block");

            // ✅ common header/buttons on
            logoWrapper.classList.add("block");
            logoWrapper.classList.remove("hidden");
            commonBtnsWrapper.classList.remove("hidden");
            commonBtnsWrapper.classList.add("flex");
            break;
        case "exterior":
            clubhousesDropdown.classList.add("hidden");
            clubhousesDropdown.classList.remove("block"); 

            // ✅ show exterior
            exterior.classList.add("flex");
            exterior.classList.remove("hidden");

            // ✅ hide webverse + home
            webverse.classList.add("hidden");
            home.classList.add("hidden");

            // ✅ hide webverseBlock properly
            webverseBlock.classList.add("hidden");
            webverseBlock.classList.remove("block");

            // ✅ HARD RESET webverseBlock-only UI (prevents bleed)
            webverseFilters.classList.add("hidden");
            webverseFilters.classList.remove("block");
            webverseFilters.classList.add("-translate-x-full");
            webverseFilters.classList.remove("-translate-x-0");

            webverseFilterBtn.classList.add("hidden");
            webverseFilterBtn.classList.remove("inline-flex");

            // ✅ hide remaining sections
            interior.classList.add("hidden");
            floorPlans.classList.add("hidden");
            unitPlans.classList.add("hidden");
            amenities.classList.add("hidden");
            virtualTour.classList.add("hidden");
            about.classList.add("hidden");
            googlemap.classList.add("hidden");
            gallery.classList.add("hidden");
            brochure.classList.add("hidden");
            clubhouseEl.classList.add("hidden");
            clubhouseFloorPlans.classList.add("hidden");

            // ✅ disable theme toggle for exterior
            themeToggleContainer.classList.add("hidden");
            themeToggleContainer.classList.remove("inline-flex");

            // ✅ stop background audio
            bgAudio.pause();
            bgAudio.currentTime = 0;
            bgAudioBtn.classList.add("hidden");
            bgAudioBtn.classList.remove("block");

            // ✅ hide live button
            liveBtnWrapper.classList.add("hidden");
            liveBtnWrapper.classList.remove("block");

            // ✅ header + common buttons visible
            logoWrapper.classList.add("block");
            logoWrapper.classList.remove("hidden");

            commonBtnsWrapper.classList.remove("hidden");
            commonBtnsWrapper.classList.add("flex");
            homeBtn.classList.remove("hidden");
            homeBtn.classList.add("flex");
            backBtn.classList.remove("hidden");
            backBtn.classList.add("flex");
            spimLogo.classList.add("hidden");
            spimLogo.classList.remove("inline-flex");
            features.classList.add("translate-x-full");

            break;
        case "googlemap":

            clubhousesDropdown.classList.add("hidden");
            clubhousesDropdown.classList.remove("block");

            // ✅ show map
            googlemap.classList.add("block");
            googlemap.classList.remove("hidden");

            ensureMap();
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    if (map) map.invalidateSize(true);
                });
            });

            // ✅ hide webverseBlock properly (prevents bleed)
            webverseBlock.classList.add("hidden");
            webverseBlock.classList.remove("block");

            // ✅ reset webverse filters completely (this is important)
            webverseFilters.classList.add("hidden");
            webverseFilters.classList.remove("block");
            webverseFilters.classList.add("-translate-x-full");
            webverseFilters.classList.remove("-translate-x-0");

            webverseFilterBtn.classList.add("hidden");
            webverseFilterBtn.classList.remove("inline-flex");

            // ✅ hide other sections
            home.classList.add("hidden");
            webverse.classList.add("hidden");
            interior.classList.add("hidden");
            floorPlans.classList.add("hidden");
            unitPlans.classList.add("hidden");
            amenities.classList.add("hidden");
            virtualTour.classList.add("hidden");
            about.classList.add("hidden");
            exterior.classList.add("hidden");
            gallery.classList.add("hidden");
            brochure.classList.add("hidden");
            clubhouseEl.classList.add("hidden");
            clubhouseFloorPlans.classList.add("hidden");

            // ✅ hide theme toggle
            themeToggleContainer.classList.add("hidden");
            themeToggleContainer.classList.remove("inline-flex");

            // ✅ stop audio
            bgAudio.pause();
            bgAudio.currentTime = 0;
            bgAudioBtn.classList.add("hidden");
            bgAudioBtn.classList.remove("block");

            // ✅ hide live button (only once)
            liveBtnWrapper.classList.add("hidden");
            liveBtnWrapper.classList.remove("block");

            // ✅ keep header/common buttons
            logoWrapper.classList.add("block");
            logoWrapper.classList.remove("hidden");

            commonBtnsWrapper.classList.remove("hidden");
            commonBtnsWrapper.classList.add("flex");

            break;

        
        case "zoneIq":
            // ✅ hide webverseBlock properly (remove block too)
            webverseBlock.classList.add("hidden");
            webverseBlock.classList.remove("block");

            clubhousesDropdown.classList.add("hidden");
            clubhousesDropdown.classList.remove("block");

            // ✅ hide all other sections
            home.classList.add("hidden");
            webverse.classList.add("hidden");
            interior.classList.add("hidden");
            floorPlans.classList.add("hidden");
            unitPlans.classList.add("hidden");
            amenities.classList.add("hidden");
            about.classList.add("hidden");
            exterior.classList.add("hidden");
            googlemap.classList.add("hidden");
            gallery.classList.add("hidden");
            brochure.classList.add("hidden");
            clubhouseEl.classList.add("hidden");
            clubhouseFloorPlans.classList.add("hidden");

            // ✅ reset webverseFilters completely (MOST IMPORTANT)
            webverseFilters.classList.add("hidden");
            webverseFilters.classList.remove("block");
            webverseFilters.classList.add("-translate-x-full");
            webverseFilters.classList.remove("-translate-x-0");

            webverseFilterBtn.classList.add("hidden");
            webverseFilterBtn.classList.remove("inline-flex");

            // ✅ close the features side panel so it doesn't sit on top
            features.classList.add("translate-x-full");

            // ✅ hide theme toggle
            themeToggleContainer.classList.add("hidden");
            themeToggleContainer.classList.remove("inline-flex");

            // ✅ stop audio
            bgAudio.pause();
            bgAudio.currentTime = 0;
            bgAudioBtn.classList.add("hidden");
            bgAudioBtn.classList.remove("block");

            // ✅ hide live button
            liveBtnWrapper.classList.add("hidden");
            liveBtnWrapper.classList.remove("block");

            // ✅ show virtualTour section
            virtualTourLink.src =
                "https://hookbot.in/viewer/index.php?code=63dc7ed1010d3c3b8269faf0ba7491d4";

            virtualTour.classList.remove("hidden");
            virtualTour.classList.add("block");

            // ✅ keep header/common buttons
            commonBtnsWrapper.classList.remove("hidden");
            commonBtnsWrapper.classList.add("flex");
            break;

        default:
            return null;
    };
};

tabs.forEach((tab) => {
  tab.addEventListener("click", (e) => {
    e.preventDefault();

    setActiveTab(tab);   // highlights active tab
    tabsCondition(tab);  // switches sections based on data-type
  });
});

const featuresCondition = (featureType) => {
    switch (featureType) {
       case 'home':
            sectionHistory = [];
            sectionHistory.push("home");

            bgAudio.pause();
            bgAudio.currentTime = 0;

            reset();
            resetBrowserUrl();
            renderWebverseFilterOptions();

            clubhousesDropdown.classList.add("hidden");
            clubhousesDropdown.classList.remove("block");

            home.classList.remove('hidden');
            home.classList.add('block');

            webverseFilterBtn.classList.add('hidden');
            webverseFilterBtn.classList.remove('inline-flex');

            themeToggleContainer.classList.remove('inline-flex');
            themeToggleContainer.classList.add('hidden');

            features.classList.add('translate-x-full');

            bgAudioBtn.classList.add("hidden");
            bgAudioBtn.classList.remove("block");

            webverseFilters.classList.add('hidden');
            webverseFilters.classList.remove('block');
            webverseFilters.classList.add('-translate-x-full');
            webverseFilters.classList.remove('-translate-x-0'); // safety

            leftPanel.classList.add("hidden");
            leftPanel.classList.remove("block");

            spimLogo.classList.add("inline-flex");
            spimLogo.classList.remove("hidden");

            bgAudioWrapper.classList.remove("block");
            bgAudioWrapper.classList.add("hidden");

            liveBtnWrapper.classList.remove("block");
            liveBtnWrapper.classList.add("hidden");

            homeBtn.classList.remove("flex");
            homeBtn.classList.add("hidden");

            backBtn.classList.remove("flex");
            backBtn.classList.add("hidden");

            clubhouseEl.classList.add('hidden');
            clubhouseEl.classList.remove('block');
            clubhouseEl.classList.remove('flex');

            webverse.classList.add('hidden');
            webverse.classList.remove('block');
            webverse.classList.remove('flex');

            webverseBlock.classList.add('hidden');
            webverseBlock.classList.remove('block');
            webverseBlock.classList.remove('flex');

            floorPlans.classList.add("hidden");
            floorPlans.classList.remove("block");
            floorPlans.classList.remove("flex");

            clubhouseFloorPlans.classList.add('hidden');
            clubhouseFloorPlans.classList.remove('block');
            clubhouseFloorPlans.classList.remove('flex');

            unitPlans.classList.add('hidden');
            unitPlans.classList.remove('block');
            unitPlans.classList.remove('flex');

            amenities.classList.add('hidden');
            amenities.classList.remove('block');

            about.classList.add('hidden');
            about.classList.remove('block');
            about.classList.remove('flex');

            interior.classList.add('hidden');
            interior.classList.remove('block');

            exterior.classList.add('hidden');
            exterior.classList.remove('block');
            exterior.classList.remove('flex');

            googlemap.classList.add('hidden');
            googlemap.classList.remove('block');
            googlemap.classList.remove('flex');

            gallery.classList.add('hidden');
            gallery.classList.remove('block');
            gallery.classList.remove('flex');

            brochure.classList.add('hidden');
            brochure.classList.remove('block');
            brochure.classList.remove('flex');

            virtualTour.classList.add("hidden");
            virtualTour.classList.remove("block");

            break;
        case 'webverse':   
            preloadImages(data?.layout?.totalFrames, data?.layout?.dayFrames, data?.layout?.nightFrames);
            updateLayoutImage();
            //createTour(layoutSteps);
            themeToggleInput.checked = true;
            document.getElementById("themeSwitch").classList.remove("dark");
            timeOfDay = 'night';  
            toggleSwitch.classList.remove("on");
            toggleSwitch.classList.contains('on') ? blockSvg.classList.add('hidden') : blockSvg.classList.remove('hidden');
            themeToggleContainer.classList.add('inline-flex');
            themeToggleContainer.classList.remove('hidden'); 
            bgAudioSource.src = data?.layout?.audio?.src;
            bgAudioSource.type = data?.layout?.audio?.type;
            bgAudioIcon.classList.remove('fa-volume-high');
            bgAudioIcon.classList.add('fa-volume-xmark');
            bgAudio.load();
            resetBrowserUrl();
            clubhousesDropdown.classList.add("hidden");
            clubhousesDropdown.classList.remove("block");
            virtualTour.classList.remove("block");
            virtualTour.classList.add("hidden");
            // unitPlanBtnsWrapper.classList.add("hidden");
            webverse.classList.remove('hidden');
            webverse.classList.add('block');
            webverseFilterBtn.classList.remove('inline-flex');
            webverseFilterBtn.classList.add('hidden');
            themeToggleContainer.classList.remove('hidden');
            themeToggleContainer.classList.add('inline-flex');
            features.classList.add('translate-x-full');
            bgAudioBtn.classList.remove("hidden");
            bgAudioBtn.classList.add("block");
            preloadImages(data?.layout?.totalFrames, data?.layout?.dayFrames, data?.layout?.nightFrames);
            updateLayoutImage();
            webverseFilters.classList.remove('block');
            webverseFilters.classList.add('hidden');
            leftPanel.classList.remove("hidden");
            leftPanel.classList.add("block");
            spimLogo.classList.add("hidden");
            spimLogo.classList.remove("inline-flex");
            bgAudioWrapper.classList.add("block");
            bgAudioWrapper.classList.remove("hidden");
            liveBtnWrapper.classList.add("block");
            liveBtnWrapper.classList.remove("hidden");
            homeBtn.classList.remove("hidden");
            homeBtn.classList.add("flex");
            backBtn.classList.remove("hidden");
            backBtn.classList.add("flex");
            clubhouseEl.classList.add('hidden');
            home.classList.add('hidden');
            webverseBlock.classList.add('hidden');
            interior.classList.add('hidden');
            floorPlans.classList.add("hidden");
            clubhouseFloorPlans.classList.add('hidden');
            unitPlans.classList.add('hidden');
            amenities.classList.add('hidden');
            about.classList.add('hidden');
            exterior.classList.add('hidden');
            googlemap.classList.add('hidden');
            gallery.classList.add('hidden');
            brochure.classList.add('hidden');
            webverseBlock.classList.add('hidden');
            break;
        case 'webverseBlock':
            //createTour(webverseSteps);
            themeToggleInput.checked = true;
            document.getElementById("themeSwitch").classList.remove("dark");
            timeOfDay = 'night';  
            toggleSwitch.classList.remove("on");
            toggleSwitch.classList.contains('on') ? blockSvg.classList.add('hidden') : blockSvg.classList.remove('hidden');
            themeToggleContainer.classList.add('inline-flex');
            themeToggleContainer.classList.remove('hidden');
            bgAudioSource.src = towerData?.audio?.src;
            bgAudioSource.type = towerData?.audio?.type;
            bgAudioIcon.classList.remove('fa-volume-high');
            bgAudioIcon.classList.add('fa-volume-xmark');
            bgAudio.load();
            reset();
            resetBrowserUrl();
            clubhousesDropdown.classList.add("hidden");
            clubhousesDropdown.classList.remove("block");
            virtualTour.classList.remove("block");
            virtualTour.classList.add("hidden");
            //unitPlanBtnsWrapper.classList.add("hidden");
            webverseBlock.classList.remove('hidden');
            webverseBlock.classList.add('block');
            webverseFilterBtn.classList.add('inline-flex');
            webverseFilterBtn.classList.remove('hidden');
            themeToggleContainer.classList.add('inline-flex');
            themeToggleContainer.classList.remove('hidden');
            features.classList.add('translate-x-full');
            preloadImages(towerData?.totalFrames, towerData?.dayFrames, towerData?.nightFrames);
            updateBlockImage();
            updateBlockSVG();
            renderWebverseFilterOptions();
            bgAudioBtn.classList.remove("hidden");
            bgAudioBtn.classList.add("block");
            webverseFilters.classList.remove('hidden');
            webverseFilters.classList.add('block');
            webverseFilters.classList.remove('-translate-x-full');
            leftPanel.classList.remove("hidden");
            leftPanel.classList.add("block");
            spimLogo.classList.add("hidden");
            spimLogo.classList.remove("inline-flex");
            bgAudioWrapper.classList.add("block");
            bgAudioWrapper.classList.remove("hidden");
            liveBtnWrapper.classList.remove("block");
            liveBtnWrapper.classList.add("hidden");
            homeBtn.classList.remove("hidden");
            homeBtn.classList.add("flex");
            backBtn.classList.remove("hidden");
            backBtn.classList.add("flex");
            clubhouseEl.classList.add('hidden');
            home.classList.add('hidden');
            webverse.classList.add('hidden');
            interior.classList.add('hidden');
            floorPlans.classList.add("hidden");
            clubhouseFloorPlans.classList.add('hidden');
            unitPlans.classList.add('hidden');
            amenities.classList.add('hidden');
            about.classList.add('hidden');
            exterior.classList.add('hidden');
            googlemap.classList.add('hidden');
            gallery.classList.add('hidden');
            brochure.classList.add('hidden');
            break;
        case 'interior':
            //createTour(interiorSteps);
            bgAudio.pause();
            bgAudio.currentTime = 0;
            reset();
            resetBrowserUrl();
            renderWebverseFilterOptions();
            //unitPlanBtnsWrapper.classList.add("hidden");

            clubhousesDropdown.classList.add("hidden");
            clubhousesDropdown.classList.remove("block");

            webverseBlock.classList.add('hidden');
            webverseBlock.classList.remove('block');

            interior.classList.remove('hidden');
            interior.classList.add('block');

            webverseFilterBtn.classList.add('hidden');
            webverseFilterBtn.classList.remove('inline-flex');

            themeToggleContainer.classList.remove('inline-flex');
            themeToggleContainer.classList.add('hidden');

            features.classList.add('translate-x-full');

            bgAudioBtn.classList.add("hidden");
            bgAudioBtn.classList.remove("block");

            webverseFilters.classList.add('hidden');
            webverseFilters.classList.remove('block');
            webverseFilters.classList.add('-translate-x-full');

            virtualTour.classList.remove("block");
            virtualTour.classList.add("hidden");

            leftPanel.classList.remove("hidden");
            leftPanel.classList.add("block");

            spimLogo.classList.add("hidden");
            spimLogo.classList.remove("inline-flex");

            bgAudioWrapper.classList.add("block");
            bgAudioWrapper.classList.remove("hidden");

            liveBtnWrapper.classList.add("hidden");
            liveBtnWrapper.classList.remove("block");

            homeBtn.classList.remove("hidden");
            homeBtn.classList.add("flex");

            backBtn.classList.remove("hidden");
            backBtn.classList.add("flex");

            clubhouseEl.classList.add('hidden');
            home.classList.add('hidden');
            webverse.classList.add('hidden');
            webverse.classList.add('hidden');

            floorPlans.classList.add("hidden");
            clubhouseFloorPlans.classList.add('hidden');
            unitPlans.classList.add('hidden');
            amenities.classList.add('hidden');
            about.classList.add('hidden');
            exterior.classList.add('hidden');
            googlemap.classList.add('hidden');
            gallery.classList.add('hidden');
            brochure.classList.add('hidden');
            break;
        case 'floorPlans':
            //createTour(floorPlansSteps);
            bgAudio.pause();
            bgAudio.currentTime = 0;
            resetBrowserUrl();

            clubhousesDropdown.classList.add("hidden");
            clubhousesDropdown.classList.remove("block");

            webverseBlock.classList.add('hidden');
            webverseBlock.classList.remove('block');

            virtualTour.classList.remove("block");
            virtualTour.classList.add("hidden");

            floorPlans.classList.remove('hidden');
            floorPlans.classList.add('block');

            // unitPlanBtnsWrapper.classList.add("hidden");
            floorPlans.classList.remove('hidden');
            floorPlans.classList.add('block');

            webverseFilterBtn.classList.remove('inline-flex');
            webverseFilterBtn.classList.add('hidden');

            themeToggleContainer.classList.remove('inline-flex');
            themeToggleContainer.classList.add('hidden');

            features.classList.add('translate-x-full');

            bgAudioBtn.classList.add("hidden");
            bgAudioBtn.classList.remove("block");

            updateFloorPlanLabel(`Floor: ${floorPlan+1}`);

            webverseFilters.classList.remove('block');
            webverseFilters.classList.add('hidden');

            leftPanel.classList.add("hidden");
            leftPanel.classList.remove("block");

            spimLogo.classList.add("hidden");
            spimLogo.classList.remove("inline-flex");

            bgAudioWrapper.classList.add("block");
            bgAudioWrapper.classList.remove("hidden");

            liveBtnWrapper.classList.remove("block");
            liveBtnWrapper.classList.add("hidden");

            homeBtn.classList.remove("hidden");
            homeBtn.classList.add("flex");

            backBtn.classList.remove("hidden");
            backBtn.classList.add("flex");

            clubhouseEl.classList.add('hidden');
            home.classList.add('hidden');
            webverse.classList.add('hidden');
            webverse.classList.add('hidden');

            interior.classList.add('hidden');
            unitPlans.classList.add('hidden');
            amenities.classList.add('hidden');
            about.classList.add('hidden');
            exterior.classList.add('hidden');
            googlemap.classList.add('hidden');
            gallery.classList.add('hidden');
            brochure.classList.add('hidden');
            break;
        case 'unitPlans':
            bgAudio.pause();
            bgAudio.currentTime = 0;
            resetBrowserUrl();

            clubhousesDropdown.classList.add("hidden");
            clubhousesDropdown.classList.remove("block");

            unitPlans.classList.remove('hidden');
            unitPlans.classList.add('block');

            webverseBlock.classList.add('hidden');
            webverseBlock.classList.remove('block');

            virtualTour.classList.remove("block");
            virtualTour.classList.add("hidden");

            floorPlans.classList.add('hidden');
            floorPlans.classList.remove('block');

            webverseFilterBtn.classList.remove('inline-flex');
            webverseFilterBtn.classList.add('hidden');

            themeToggleContainer.classList.remove('inline-flex');
            themeToggleContainer.classList.add('hidden');

            features.classList.add('translate-x-full');

            bgAudioBtn.classList.add("hidden");
            bgAudioBtn.classList.remove("block");

            webverseFilters.classList.remove('block');
            webverseFilters.classList.add('hidden');

            leftPanel.classList.add("hidden");
            leftPanel.classList.remove("block");

            spimLogo.classList.add("hidden");
            spimLogo.classList.remove("inline-flex");

            bgAudioWrapper.classList.add("block");
            bgAudioWrapper.classList.remove("hidden");

            liveBtnWrapper.classList.remove("block");
            liveBtnWrapper.classList.add("hidden");

            homeBtn.classList.remove("hidden");
            homeBtn.classList.add("flex");

            backBtn.classList.remove("hidden");
            backBtn.classList.add("flex");

            clubhouseEl.classList.add('hidden');
            home.classList.add('hidden');
            webverse.classList.add('hidden');
            interior.classList.add('hidden');
            amenities.classList.add('hidden');
            about.classList.add('hidden');
            exterior.classList.add('hidden');
            googlemap.classList.add('hidden');
            gallery.classList.add('hidden');
            brochure.classList.add('hidden');
            break;
        case 'amenities':
            destroyTour();
            bgAudio.pause();
            bgAudio.currentTime = 0;
            resetBrowserUrl();

            clubhousesDropdown.classList.remove("hidden");
            clubhousesDropdown.classList.add("block");

            webverseBlock.classList.add('hidden');
            webverseBlock.classList.remove('block');

            // unitPlanBtnsWrapper.classList.add("hidden");
            amenities.classList.remove('hidden');
            amenities.classList.add('block');

            webverseFilterBtn.classList.remove('inline-flex');
            webverseFilterBtn.classList.add('hidden');

            themeToggleContainer.classList.remove('inline-flex');
            themeToggleContainer.classList.add('hidden');

            features.classList.add('translate-x-full');

            bgAudioBtn.classList.add("hidden");
            bgAudioBtn.classList.remove("block");

            webverseFilters.classList.remove('block');
            webverseFilters.classList.add('hidden');

            virtualTour.classList.remove("block");
            virtualTour.classList.add("hidden");

            leftPanel.classList.add("hidden");
            leftPanel.classList.remove("block");

            spimLogo.classList.add("hidden");
            spimLogo.classList.remove("inline-flex");

            bgAudioWrapper.classList.add("block");
            bgAudioWrapper.classList.remove("hidden");

            liveBtnWrapper.classList.remove("block");
            liveBtnWrapper.classList.add("hidden");

            homeBtn.classList.remove("hidden");
            homeBtn.classList.add("flex");

            backBtn.classList.remove("hidden");
            backBtn.classList.add("flex");

            clubhouseEl.classList.add('hidden');
            home.classList.add('hidden');
            webverse.classList.add('hidden');
            webverse.classList.add('hidden');

            interior.classList.add('hidden');
            floorPlans.classList.add('hidden');
            clubhouseFloorPlans.classList.add('hidden');
            unitPlans.classList.add('hidden');
            about.classList.add('hidden');
            exterior.classList.add('hidden');
            googlemap.classList.add('hidden');
            gallery.classList.add('hidden');
            brochure.classList.add('hidden');
            break;
        case "zoneIq":
            webverseBlock.classList.add("hidden");
            webverseBlock.classList.remove("block");

            clubhousesDropdown.classList.add("hidden");
            clubhousesDropdown.classList.remove("block");

            home.classList.add("hidden");
            webverse.classList.add("hidden");
            interior.classList.add("hidden");
            floorPlans.classList.add("hidden");
            unitPlans.classList.add("hidden");
            amenities.classList.add("hidden");
            about.classList.add("hidden");
            exterior.classList.add("hidden");
            googlemap.classList.add("hidden");
            gallery.classList.add("hidden");
            brochure.classList.add("hidden");
            clubhouseEl.classList.add("hidden");
            clubhouseFloorPlans.classList.add("hidden");

            webverseFilters.classList.add("hidden");
            webverseFilters.classList.remove("block");
            webverseFilters.classList.add("-translate-x-full");
            webverseFilters.classList.remove("-translate-x-0");

            webverseFilterBtn.classList.add("hidden");
            webverseFilterBtn.classList.remove("inline-flex");

            features.classList.add("translate-x-full");

            themeToggleContainer.classList.add("hidden");
            themeToggleContainer.classList.remove("inline-flex");

            bgAudio.pause();
            bgAudio.currentTime = 0;
            bgAudioBtn.classList.add("hidden");
            bgAudioBtn.classList.remove("block");

            liveBtnWrapper.classList.add("hidden");
            liveBtnWrapper.classList.remove("block");

            virtualTourLink.src = "https://hookbot.in/viewer/index.php?code=63dc7ed1010d3c3b8269faf0ba7491d4";

            virtualTour.classList.remove("hidden");
            virtualTour.classList.add("block");

            commonBtnsWrapper.classList.remove("hidden");
            commonBtnsWrapper.classList.add("flex");

            homeBtn.classList.remove("hidden");
            homeBtn.classList.add("flex");
            backBtn.classList.remove("hidden");
            backBtn.classList.add("flex");

            spimLogo.classList.add("hidden");   
            spimLogo.classList.remove("inline-flex");

            features.classList.add("translate-x-full");

            break;
        case 'about':
            destroyTour();
            bgAudio.pause();
            bgAudio.currentTime = 0;
            resetBrowserUrl();
            virtualTour.classList.remove("block");
            virtualTour.classList.add("hidden");
            // unitPlanBtnsWrapper.classList.add("hidden");
            clubhousesDropdown.classList.add("hidden");
            clubhousesDropdown.classList.remove("block");
            about.classList.remove('hidden');
            about.classList.add('block');
            webverseFilterBtn.classList.remove('inline-flex');
            webverseFilterBtn.classList.add('hidden');
            themeToggleContainer.classList.remove('inline-flex');
            themeToggleContainer.classList.add('hidden');
            features.classList.add('translate-x-full');
            bgAudioBtn.classList.add("hidden");
            bgAudioBtn.classList.remove("block");
            webverseFilters.classList.remove('block');
            webverseFilters.classList.add('hidden');
            leftPanel.classList.add("hidden");
            leftPanel.classList.remove("block");
            spimLogo.classList.add("hidden");
            spimLogo.classList.remove("inline-flex");
            bgAudioWrapper.classList.add("block");
            bgAudioWrapper.classList.remove("hidden");
            liveBtnWrapper.classList.remove("block");
            liveBtnWrapper.classList.add("hidden");
            homeBtn.classList.remove("hidden");
            homeBtn.classList.add("flex");
            backBtn.classList.remove("hidden");
            backBtn.classList.add("flex");
            clubhouseEl.classList.add('hidden');
            home.classList.add('hidden');
            webverse.classList.add('hidden');
            webverseBlock.classList.add('hidden');
            interior.classList.add('hidden');
            floorPlans.classList.add('hidden');
            clubhouseFloorPlans.classList.add('hidden');
            unitPlans.classList.add('hidden');
            amenities.classList.add('hidden');
            exterior.classList.add('hidden');
            googlemap.classList.add('hidden');
            gallery.classList.add('hidden');
            brochure.classList.add('hidden');
            break;
        case 'exterior':
            destroyTour();
            bgAudio.pause();
            bgAudio.currentTime = 0;
            resetBrowserUrl();

            clubhousesDropdown.classList.add("hidden");
            clubhousesDropdown.classList.remove("block");

            webverseBlock.classList.add('hidden');
            webverseBlock.classList.remove('block');

            virtualTour.classList.remove("block");
            virtualTour.classList.add("hidden");

            // unitPlanBtnsWrapper.classList.add("hidden");

            exterior.classList.remove('hidden');
            exterior.classList.add('flex');

            webverseFilterBtn.classList.remove('inline-flex');
            webverseFilterBtn.classList.add('hidden');

            themeToggleContainer.classList.remove('inline-flex');
            themeToggleContainer.classList.add('hidden');

            features.classList.add('translate-x-full');

            bgAudioBtn.classList.add("hidden");
            bgAudioBtn.classList.remove("block");

            webverseFilters.classList.remove('block');
            webverseFilters.classList.add('hidden');

            leftPanel.classList.remove("hidden");
            leftPanel.classList.add("block");

            spimLogo.classList.add("hidden");
            spimLogo.classList.remove("inline-flex");

            bgAudioWrapper.classList.add("block");
            bgAudioWrapper.classList.remove("hidden");

            liveBtnWrapper.classList.remove("block");
            liveBtnWrapper.classList.add("hidden");

            homeBtn.classList.remove("hidden");
            homeBtn.classList.add("flex");

            backBtn.classList.remove("hidden");
            backBtn.classList.add("flex");

            clubhouseEl.classList.add('hidden');
            home.classList.add('hidden');

            webverse.classList.add('hidden');
            webverse.classList.add('hidden');

            interior.classList.add('hidden');
            floorPlans.classList.add('hidden');
            clubhouseFloorPlans.classList.add('hidden');
            unitPlans.classList.add('hidden');
            amenities.classList.add('hidden');
            about.classList.add('hidden');
            googlemap.classList.add('hidden');
            gallery.classList.add('hidden');
            brochure.classList.add('hidden');
            homeBtn.classList.remove("hidden");
            homeBtn.classList.add("flex");
            backBtn.classList.remove("hidden");
            backBtn.classList.add("flex");
            spimLogo.classList.add("hidden");
            spimLogo.classList.remove("inline-flex");
            features.classList.add("translate-x-full");
            break;
        case 'googlemap':
            //createTour(mapsSteps);
            bgAudio.pause();
            bgAudio.currentTime = 0;
            resetBrowserUrl();
            virtualTour.classList.remove("block");
            virtualTour.classList.add("hidden");
            // unitPlanBtnsWrapper.classList.add("hidden");
            googlemap.classList.remove('hidden');
            googlemap.classList.add('block');
            ensureMap();
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    if (map) {
                        map.invalidateSize(true);
                    }
                });
            });

            clubhousesDropdown.classList.add("hidden");
            clubhousesDropdown.classList.remove("block");

            webverseFilterBtn.classList.remove('inline-flex');
            webverseFilterBtn.classList.add('hidden');
            themeToggleContainer.classList.remove('inline-flex');
            themeToggleContainer.classList.add('hidden');
            features.classList.add('translate-x-full');
            bgAudioBtn.classList.add("hidden");
            bgAudioBtn.classList.remove("block");
            webverseFilters.classList.remove('block');
            webverseFilters.classList.add('hidden');
            leftPanel.classList.remove("hidden");
            leftPanel.classList.add("block");
            spimLogo.classList.add("hidden");
            spimLogo.classList.remove("inline-flex");
            bgAudioWrapper.classList.add("block");
            bgAudioWrapper.classList.remove("hidden");
            liveBtnWrapper.classList.remove("block");
            liveBtnWrapper.classList.add("hidden");
            homeBtn.classList.remove("hidden");
            homeBtn.classList.add("flex");
            backBtn.classList.remove("hidden");
            backBtn.classList.add("flex");
            clubhouseEl.classList.add('hidden');
            home.classList.add('hidden');
            webverse.classList.add('hidden');
            webverse.classList.add('hidden');
            interior.classList.add('hidden');
            floorPlans.classList.add('hidden');
            clubhouseFloorPlans.classList.add('hidden');
            unitPlans.classList.add('hidden');
            amenities.classList.add('hidden');
            about.classList.add('hidden');
            exterior.classList.add('hidden');
            gallery.classList.add('hidden');
            brochure.classList.add('hidden');
            break;
        case 'gallery':
            destroyTour();
            bgAudio.pause();
            bgAudio.currentTime = 0;
            resetBrowserUrl();

            clubhousesDropdown.classList.add("hidden");
            clubhousesDropdown.classList.remove("block");

            webverseBlock.classList.add('hidden');
            webverseBlock.classList.remove('block');

            virtualTour.classList.remove("block");
            virtualTour.classList.add("hidden");

            // unitPlanBtnsWrapper.classList.add("hidden");

            gallery.classList.remove('hidden');
            gallery.classList.add('block');

            webverseFilterBtn.classList.remove('inline-flex');
            webverseFilterBtn.classList.add('hidden');

            themeToggleContainer.classList.remove('inline-flex');
            themeToggleContainer.classList.add('hidden');

            features.classList.add('translate-x-full');

            bgAudioBtn.classList.add("hidden");
            bgAudioBtn.classList.remove("block");

            webverseFilters.classList.remove('block');
            webverseFilters.classList.add('hidden');

            leftPanel.classList.add("hidden");
            leftPanel.classList.remove("block");

            spimLogo.classList.add("hidden");
            spimLogo.classList.remove("inline-flex");

            bgAudioWrapper.classList.add("block");
            bgAudioWrapper.classList.remove("hidden");

            liveBtnWrapper.classList.remove("block");
            liveBtnWrapper.classList.add("hidden");

            homeBtn.classList.remove("hidden");
            homeBtn.classList.add("flex");

            backBtn.classList.remove("hidden");
            backBtn.classList.add("flex");

            clubhouseEl.classList.add('hidden');
            home.classList.add('hidden');

            webverse.classList.add('hidden');
            webverse.classList.add('hidden');

            interior.classList.add('hidden');
            floorPlans.classList.add('hidden');
            clubhouseFloorPlans.classList.add('hidden');
            unitPlans.classList.add('hidden');
            amenities.classList.add('hidden');
            about.classList.add('hidden');
            exterior.classList.add('hidden');
            googlemap.classList.add('hidden');
            brochure.classList.add('hidden');

            break;
        case 'brochure': 
            destroyTour();
            bgAudio.pause();
            bgAudio.currentTime = 0;
            resetBrowserUrl();

            clubhousesDropdown.classList.add("hidden");
            clubhousesDropdown.classList.remove("block");

            webverseBlock.classList.add('hidden');
            webverseBlock.classList.remove('block');

            virtualTour.classList.remove("block");
            virtualTour.classList.add("hidden");

            // unitPlanBtnsWrapper.classList.add("hidden");

            brochure.classList.remove('hidden');
            brochure.classList.add('block');

            webverseFilterBtn.classList.remove('inline-flex');
            webverseFilterBtn.classList.add('hidden');

            themeToggleContainer.classList.remove('inline-flex');
            themeToggleContainer.classList.add('hidden');

            features.classList.add('translate-x-full');

            bgAudioBtn.classList.add("hidden"); 
            bgAudioBtn.classList.remove("block");

            webverseFilters.classList.remove('block');
            webverseFilters.classList.add('hidden');

            leftPanel.classList.add("hidden");
            leftPanel.classList.remove("block");

            spimLogo.classList.add("hidden");
            spimLogo.classList.remove("inline-flex");

            bgAudioWrapper.classList.add("block");
            bgAudioWrapper.classList.remove("hidden");

            liveBtnWrapper.classList.remove("block");
            liveBtnWrapper.classList.add("hidden");

            homeBtn.classList.remove("hidden");
            homeBtn.classList.add("flex");

            backBtn.classList.remove("hidden");
            backBtn.classList.add("flex");

            clubhouseEl.classList.add('hidden');
            home.classList.add('hidden');

            webverse.classList.add('hidden');
            webverse.classList.add('hidden');

            interior.classList.add('hidden');
            floorPlans.classList.add('hidden');
            clubhouseFloorPlans.classList.add('hidden');
            unitPlans.classList.add('hidden');
            amenities.classList.add('hidden');
            about.classList.add('hidden');
            exterior.classList.add('hidden');
            googlemap.classList.add('hidden');
            gallery.classList.add('hidden');

            break;
        case 'clubhouse':
            destroyTour();
            bgAudio.pause();
            bgAudio.currentTime = 0;
            resetBrowserUrl();
            clubhousesDropdown.classList.add("hidden");
            clubhousesDropdown.classList.remove("block");
            virtualTour.classList.remove("block");
            virtualTour.classList.add("hidden");
            // unitPlanBtnsWrapper.classList.add("hidden");
            webverseFilterBtn.classList.remove('inline-flex');
            webverseFilterBtn.classList.add('hidden');
            themeToggleContainer.classList.remove('inline-flex');
            themeToggleContainer.classList.add('hidden');
            features.classList.add('translate-x-full');
            webverseFilters.classList.remove('block');
            webverseFilters.classList.add('hidden');
            leftPanel.classList.add("hidden");
            leftPanel.classList.remove("block");
            spimLogo.classList.add("hidden");
            spimLogo.classList.remove("inline-flex");
            bgAudioWrapper.classList.remove("block");
            bgAudioWrapper.classList.add("hidden");
            liveBtnWrapper.classList.remove("block");
            liveBtnWrapper.classList.add("hidden");
            homeBtn.classList.remove("hidden");
            homeBtn.classList.add("flex");
            backBtn.classList.remove("hidden");
            backBtn.classList.add("flex");
            clubhouseEl.classList.add('block');
            clubhouseEl.classList.remove('hidden');
            home.classList.add('hidden');
            webverse.classList.add('hidden');
            webverseBlock.classList.add('hidden');
            interior.classList.add('hidden');
            floorPlans.classList.add('hidden');
            clubhouseFloorPlans.classList.add('hidden');
            unitPlans.classList.add('hidden');
            amenities.classList.add('hidden');
            exterior.classList.add('hidden');
            googlemap.classList.add('hidden');
            gallery.classList.add('hidden');
            brochure.classList.add('hidden');
            about.classList.add('hidden');
            break;
        case 'clubhouseFloorPlans':
            destroyTour();
            bgAudio.pause();
            bgAudio.currentTime = 0;
            resetBrowserUrl();
            clubhousesDropdown.classList.add("hidden");
            clubhousesDropdown.classList.remove("block");
            virtualTour.classList.remove("block");
            virtualTour.classList.add("hidden");
            // unitPlanBtnsWrapper.classList.add("hidden");
            webverseFilterBtn.classList.remove('inline-flex');
            webverseFilterBtn.classList.add('hidden');
            themeToggleContainer.classList.remove('inline-flex');
            themeToggleContainer.classList.add('hidden');
            features.classList.add('translate-x-full');
            bgAudioBtn.classList.add("hidden");
            bgAudioBtn.classList.remove("block");
            webverseFilters.classList.remove('block');
            webverseFilters.classList.add('hidden');
            leftPanel.classList.add("hidden");
            leftPanel.classList.remove("block");
            spimLogo.classList.add("hidden");
            spimLogo.classList.remove("inline-flex");
            bgAudioWrapper.classList.add("block");
            bgAudioWrapper.classList.remove("hidden");
            liveBtnWrapper.classList.remove("block");
            liveBtnWrapper.classList.add("hidden");
            homeBtn.classList.remove("hidden");
            homeBtn.classList.add("flex");
            backBtn.classList.remove("hidden");
            backBtn.classList.add("flex");
            clubhouseEl.classList.add('hidden');
            home.classList.add('hidden');
            webverse.classList.add('hidden');
            webverseBlock.classList.add('hidden');
            interior.classList.add('hidden');
            floorPlans.classList.add('hidden');
            clubhouseFloorPlans.classList.add('block');
            clubhouseFloorPlans.classList.remove('hidden');
            unitPlans.classList.add('hidden');
            amenities.classList.add('hidden');
            exterior.classList.add('hidden');
            googlemap.classList.add('hidden');
            gallery.classList.add('hidden');
            brochure.classList.add('hidden');
            about.classList.remove('hidden');
            break;
        case "clubRoyal":
            webverseBlock.classList.add("hidden");
            webverseBlock.classList.remove("block");

            clubhousesDropdown.classList.add("hidden");
            clubhousesDropdown.classList.remove("block");

            home.classList.add("hidden");
            webverse.classList.add("hidden");
            interior.classList.add("hidden");
            floorPlans.classList.add("hidden");
            unitPlans.classList.add("hidden");
            amenities.classList.add("hidden");
            about.classList.add("hidden");
            exterior.classList.add("hidden");
            googlemap.classList.add("hidden");
            gallery.classList.add("hidden");
            brochure.classList.add("hidden");
            clubhouseEl.classList.add("hidden");
            clubhouseFloorPlans.classList.add("hidden");

            webverseFilters.classList.add("hidden");
            webverseFilters.classList.remove("block");
            webverseFilters.classList.add("-translate-x-full");
            webverseFilters.classList.remove("-translate-x-0");

            webverseFilterBtn.classList.add("hidden");
            webverseFilterBtn.classList.remove("inline-flex");

            features.classList.add("translate-x-full");

            themeToggleContainer.classList.add("hidden");
            themeToggleContainer.classList.remove("inline-flex");

            bgAudio.pause();
            bgAudio.currentTime = 0;
            bgAudioBtn.classList.add("hidden");
            bgAudioBtn.classList.remove("block");

            liveBtnWrapper.classList.add("hidden");
            liveBtnWrapper.classList.remove("block");

            virtualTourLink.src = "https://hookbot.in/viewer/index.php?code=74db120f0a8e5646ef5a30154e9f6deb";

            virtualTour.classList.remove("hidden");
            virtualTour.classList.add("block");

            commonBtnsWrapper.classList.remove("hidden");
            commonBtnsWrapper.classList.add("flex");

            homeBtn.classList.remove("hidden");
            homeBtn.classList.add("flex");
            backBtn.classList.remove("hidden");
            backBtn.classList.add("flex");

            spimLogo.classList.add("hidden");   
            spimLogo.classList.remove("inline-flex");

            features.classList.add("translate-x-full");
            break; 
        case "clubPavilion":
            webverseBlock.classList.add("hidden");
            webverseBlock.classList.remove("block");

            clubhousesDropdown.classList.add("hidden");
            clubhousesDropdown.classList.remove("block");

            home.classList.add("hidden");
            webverse.classList.add("hidden");
            interior.classList.add("hidden");
            floorPlans.classList.add("hidden");
            unitPlans.classList.add("hidden");
            amenities.classList.add("hidden");
            about.classList.add("hidden");
            exterior.classList.add("hidden");
            googlemap.classList.add("hidden");
            gallery.classList.add("hidden");
            brochure.classList.add("hidden");
            clubhouseEl.classList.add("hidden");
            clubhouseFloorPlans.classList.add("hidden");

            webverseFilters.classList.add("hidden");
            webverseFilters.classList.remove("block");
            webverseFilters.classList.add("-translate-x-full");
            webverseFilters.classList.remove("-translate-x-0");

            webverseFilterBtn.classList.add("hidden");
            webverseFilterBtn.classList.remove("inline-flex");

            features.classList.add("translate-x-full");

            themeToggleContainer.classList.add("hidden");
            themeToggleContainer.classList.remove("inline-flex");

            bgAudio.pause();
            bgAudio.currentTime = 0;
            bgAudioBtn.classList.add("hidden");
            bgAudioBtn.classList.remove("block");

            liveBtnWrapper.classList.add("hidden");
            liveBtnWrapper.classList.remove("block");

            virtualTourLink.src = "https://hookbot.in/viewer/index.php?code=3b8a614226a953a8cd9526fca6fe9ba5";

            virtualTour.classList.remove("hidden");
            virtualTour.classList.add("block");

            commonBtnsWrapper.classList.remove("hidden");
            commonBtnsWrapper.classList.add("flex");

            homeBtn.classList.remove("hidden");
            homeBtn.classList.add("flex");
            backBtn.classList.remove("hidden");
            backBtn.classList.add("flex");

            spimLogo.classList.add("hidden");   
            spimLogo.classList.remove("inline-flex");

            features.classList.add("translate-x-full");
            break;  
        case "instagram":
            features.classList.add("translate-x-full");
            window.open("https://www.instagram.com/nikhilaconstructionsdevelopers?igsh=ODQxN2toaWs4cGp2&utm_source=qr", "_blank");
            break;

        case "youtube":
            features.classList.add("translate-x-full");
            window.open("https://youtube.com/@nikhilaconstructionsdevelopers?si=vpHqu7bokdfdRMlX", "_blank");
            break;
    };
};

// -------------------- MAP SECTION --------------------
// --- CONFIGURATION ---
// Exact Project Pin Location (West Winds) - ENTRANCE/ROAD SIDE
const LAYOUT_POS = { lat: 17.436129232332338, lng: 78.18818137054834 };

// RADIUS CONFIG (Blue Theme)
const RADIUS_CONFIG = [
    { km: 5,  color: 'rgba(0,128,255,1)', fill: 'rgba(0,128,255,0.18)', label: '5 KM',  class: 'text-radius-5' },
    { km: 10, color: 'rgba(0,180,255,1)', fill: 'rgba(0,180,255,0.15)', label: '10 KM', class: 'text-radius-10' },
    { km: 20, color: 'rgba(0,225,255,1)', fill: 'rgba(0,225,255,0.13)', label: '20 KM', class: 'text-radius-20' },
    { km: 40, color: 'rgba(0,105,255,1)', fill: 'rgba(0,105,255,0.10)', label: '40 KM', class: 'text-radius-40' }
];

// Gradient Colors
const CAT_GRADIENTS = {
    education: 'linear-gradient(135deg, #FF9900, #FF5500)', 
    hospital: 'linear-gradient(135deg, #FF4D4D, #C70000)', 
    workplace: 'linear-gradient(135deg, #00E5FF, #008CB8)', 
    convention: 'linear-gradient(135deg, #A3E635, #4D7C0F)', 
    park: 'linear-gradient(135deg, #A78BFA, #7C3AED)', 
    bank: 'linear-gradient(135deg, #94A3B8, #475569)', 
    supermarket: 'linear-gradient(135deg, #FCD34D, #B45309)'  
};

// SVG Icons
const ICONS = {
    education: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="18" height="18"><path d="M12 3L1 9l11 6 9-4.91V17h2V9L12 3zM5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82z"/></svg>',
    hospital: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="18" height="18"><path d="M19 3H5c-1.1 0-1.99.9-1.99 2L3 19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-1 11h-4v4h-4v-4H6v-4h4V6h4v4h4v4z"/></svg>',
    malls: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="18" height="18"><path d="M20 6h-4V4c0-1.11-.89-2-2-2h-4c-1.11 0-2 .89-2 2v2H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-6 0h-4V4h4v2z"/></svg>',
    convention: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="18" height="18"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>',
    entertainment: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="18" height="18"><path d="M12 2c-4.42 0-8 .5-8 4v10c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4zm5.66 2.99H6.34C6.89 4.46 8.31 4 12 4s5.11.46 5.66.99zm.34 2L17 12H7l-1-5.01h12zM6 14c0-.55.45-1 1-1s1 .45 1 1-.45 1-1 1-1-.45-1-1zm12 0c0-.55.45-1 1-1s1 .45 1 1-.45 1-1 1-1-.45-1-1z"/></svg>',
};

const CATEGORIES = {
    education: { label: "Education", icon: ICONS.education },
    hospital: { label: "Hospital", icon: ICONS.hospital },
    malls: { label: "Malls", icon: ICONS.malls },
    convention: { label: "Convention", icon: ICONS.convention },
    entertainment: { label: "Entertainment", icon: ICONS.entertainment },
};

// --- DATA ---
const markersData = [
    {
        title: "Indus International School",
        lat: 17.450540050895533, 
        lng: 78.17871842504304,
        img: "/assets/markers_images/indus_international_school.jpg",
        category: "education"
    },
    {
        title: "Avinya International School",
        lat: 17.438426556014793, 
        lng: 78.17597693421676,
        img: "/assets/markers_images/avinya_international_school.jpg",
        category: "education",
    },
    {
        title: "The Quantium School",
        lat: 17.429373172696536, 
        lng: 78.19171425606218,
        img: "/assets/markers_images/the_quantium_school.jpg",
        category: "education",
    },
    {
        title: "Acumen International School",
        lat: 17.454952688363132, 
        lng: 78.196557094022,
        img: "/assets/markers_images/acumen_international_school.jpg",
        category: "education",
    },
    {
        title: "Meru International School",
        lat: 17.47089513902315, 
        lng: 78.2617306032822,
        img: "/assets/markers_images/meru_international_school.jpg",
        category: "education",
    },
     {
        title: "The Gaudium School",
        lat: 17.486471914376743, 
        lng: 78.24486884250243,
        img: "/assets/markers_images/the_gaudium_school.jpg",
        category: "education",
    },
    {
        title: "Samashti International School",
        lat: 17.45357313196139, 
        lng: 78.25023477985984, 
        img: "/assets/markers_images/samashti_international_school.png",
        category: "education",
    },
    {
        title: "Prachin Global School",
        lat: 17.469087129239636, 
        lng: 78.18106742776462,
        img: "/assets/markers_images/prachin_global_school.jpg",
        category: "education",
    },
    {
        title: "DELHI PUBLIC SCHOOL",
        lat: 17.448423977483834, 
        lng: 78.24082487059196,
        img: "/assets/markers_images/delhi_public_school.jpg",
        category: "education",
    },
    {
        title: "DAV BDL Public School",
        lat: 17.46790086193772, 
        lng: 78.16511199428601,
        img: "/assets/markers_images/DAV_BDL_Public_School.jpg",
        category: "education",
    },
{
        title: "Kidshine Global School",
        lat: 17.42927590235642, 
        lng: 78.19412890391112,
        img: "/assets/markers_images/Kidshine_Global_School.jpg",
        category: "education",
    },
    {
        title: "Rockwell International School",
        lat: 17.38675094813484, 
        lng: 78.33469270782955,
        img: "/assets/markers_images/Rockwell_International_School.jpg",
        category: "education",
    },
    {
        title: "Birla Open Minds International School",
        lat: 17.434259972638205, 
        lng: 78.2687282367861,
        img: "/assets/markers_images/Birla_Open_Minds_International_School.jpg",
        category: "education",
    },
    {
        title: "Sloka The Global School kokapet",
        lat: 17.384952429051854, 
        lng: 78.3371042514631,
        img: "/assets/markers_images/Sloka_The_Global_School.jpg",
        category: "education",
    },
    {
        title: "Candiidus International School",
        lat: 17.53512616539899, 
        lng:  78.23690025412834,
        img: "/assets/markers_images//Candiidus_International_School.png",
        category: "education",
    },
     {
        title: "The Global Edge School",
        lat: 17.391760829561584, 
        lng: 78.34171493866299,
        img: "/assets/markers_images/The_Global_Edge_School.jpg",
        category: "education",
    },
    {
        title: "Green Gables International School",
        lat: 17.423485586764897, 
        lng: 78.26885838020678,
        img: "/assets/markers_images/Green_Gables_International_School.jpg",
        category: "education",
    },
    {
        title: "Sadhana Infinity International School",
        lat: 17.475423130676845, 
        lng: 78.30271449959713,
        img: "/assets/markers_images/Sadhana_Infinity_International_School.jpg",
        category: "education",
    },
    {
        title: "SATTVA Academy",
        lat: 17.405624857507945, 
        lng: 78.2858993283564,
        img: "/assets/markers_images/SATTVA_Academy.jpg",
        category: "education",
    },
    {
        title: "Glendale International School",
        lat: 17.432977010126315, 
        lng: 78.29852149632063,
        img: "/assets/markers_images/Glendale_International_School.jpg",
        category: "education",
    },
    {
        title: "CGR Academy",
        lat: 17.495450592342387, 
        lng: 78.22769051371205,
        img: "/assets/markers_images/CGR_Academy.png",
        category: "education",
    },
    {
        title: "Freedom Hospitals",
        lat: 17.387983104549768,  
        lng: 78.32786135254398,
        img: "/assets/markers_images/Freedom_Hospitals.jpg",
        category: "hospital",
    },
    {
        title: "Lalitha Hospital",
        lat: 17.453805466461617, 
        lng: 78.13739802272086,
        img: "/assets/markers_images/Lalitha_Hospital.jpg",
        category: "hospital",
    },
    {
        title: "Gayatri Hospital",
        lat: 17.454298600755084, 
        lng: 78.13773908932005,
        img: "/assets/markers_images/Gayatri_Hospital.jpg",
        category: "hospital",
    },
    {
        title: "Svaraaj Hospitals",
        lat: 17.453985177276387, 
        lng: 78.13668300421928,
        img: "/assets/markers_images/Svaraaj_Hospital.jpg",
        category: "hospital",
    },
    {
        title: "Bharath Multi-Speciality Clinic",
        lat: 17.43325973085256, 
        lng: 78.18739531679063,
        img: "/assets/markers_images/Bharath_Multi_Speciality_Clinic.jpg",
        category: "hospital",
    },
    {
        title: "Medicover Hospitals",
        lat: 17.41282992309623, 
        lng: 78.33576240182146,
        img: "/assets/markers_images/Medicover_Hospitals.jpg",
        category: "hospital",
    },
    {
        title: "Airaavata Hospitals",
        lat: 17.46997369285665, 
        lng: 78.28948356087486,
        img: "/assets/markers_images/Airaavata_Multispeciality_Hospital.jpg",
        category: "hospital",
    },
    {
        title: "Continental Hospitals",
        lat: 17.41749704746946, 
        lng: 78.33945441850679,
        img: "/assets/markers_images/Continental_Hospitals.jpg",
        category: "hospital",
    },
{
        title: "Apollo Hospitals",
        lat: 17.41672765414676, 
        lng: 78.35520468499219,
        img: "/assets/markers_images/Apollo_Hospitals.jpg",
        category: "hospital",
    },
    {
        title: "Rainbow Hospitals",
        lat: 17.41887553457532, 
        lng: 78.353945289201,
        img: "/assets/markers_images/Rainbow_Hospitals.png",
        category: "hospital",
    },
    {
        title: "Star Hospitals",
        lat: 17.419407972507816, 
        lng: 78.35402903961831,
        img: "/assets/markers_images/Star_Hospitals.jpg",
        category: "hospital",
    },
    {
        title: "Citizens Hospitals",
        lat: 17.470398547677615, 
        lng: 78.31105863738534,
        img: "/assets/markers_images/Citizens_Hospitals.jpg",
        category: "hospital",
    },
    {
        title: "Yashoda Hospitals (Upcoming) ",
        lat: 17.402152709507487, 
        lng: 78.35203284033994,
        img: "/assets/markers_images/Yashoda_Hospitals.jpg",
        category: "hospital",
    },
     {
        title: "Kokapet One",
        lat: 17.38538868323935, 
        lng: 78.3303399204239,
        img: "/assets/markers_images/Kokapet_One.jpg",
        category: "malls",
    },
    {
        title: "Aparna Neo",
        lat: 17.46682998218494, 
        lng: 78.31011530502798,
        img: "/assets/markers_images/Aparna_Neo_Mall.jpg",
        category: "malls",
    },
    {
        title: "Allu Cinemas",
        lat: 17.38961802642539, 
        lng: 78.34388371266522,
        img: "/assets/markers_images/Allu_Cinemas.jpg",
        category: "malls",
    },
    {
        title: "Miraj Cinemas",
        lat: 17.38414632188372, 
        lng: 78.36003288047702,
        img: "/assets/markers_images/Miraj_Cinemas.jpg",
        category: "malls",
    },
    {
        title: "Gandipet Landscape Park",
        lat: 17.381643165403748, 
        lng: 78.31666333905973,
        img: "/assets/markers_images/Gandipet_Landscape_Park.jpg",
        category: "entertainment",
    },
    {
        title: "Experium Eco-Park",
        lat: 17.379671930716718, 
        lng: 78.19087205765015,
        img: "/assets/markers_images/Experium_Eco_Park.jpg",
        category: "entertainment",
    },
    {
        title: "Ocean Park",
        lat: 17.389341650733208, 
        lng: 78.32910532534629,
        img: "/assets/markers_images/Ocean_Park.png",
        category: "entertainment",
    },
    {
        title: "Daisy dale farm park & Resort",
        lat: 17.449177347819084, 
        lng: 78.17173443790497,
        img: "/assets/markers_images/Daisy_dale_farm_park_Resort.jpg",
        category: "entertainment",
    },
   {
        title: "One Golf",
        lat: 17.414388458973896, 
        lng: 78.32903283073384,
        img: "/assets/markers_images/One_Golf.jpg",
        category: "entertainment",
    },
    {
        title: "Thrive Sports Hub",
        lat: 17.418727383604246, 
        lng: 78.22900129193529,
        img: "/assets/markers_images/Thrive_Sports_Hub.jpg",
        category: "entertainment",
    },
     {
        title: "FNF ARENA",
        lat: 17.416534649314837, 
        lng: 78.2501031223829,
        img: "/assets/markers_images/FNF_ARENA.jpg",
        category: "entertainment",
    },
    {
        title: "Aarya Convention",
        lat: 17.41854405791115, 
        lng: 78.24627271420076,
        img: "/assets/markers_images/Aarya_Convention.jpg",
        category: "convention",
    },
    {
        title: "Zen Convention",
        lat: 17.40870864029674, 
        lng: 78.28692060877121,
        img: "/assets/markers_images/Zen_Convention.jpg",
        category: "convention",
    },
    {
        title: "Fiesta Convention",
        lat: 17.401224414474918, 
        lng: 78.28658662289486,
        img: "/assets/markers_images/Fiesta_Convention.jpg",
        category: "convention",
    },
    {
        title: "Savaaya Convention",
        lat: 17.386212884344065, 
        lng: 78.31793701271457,
        img: "/assets/markers_images/Savaaya_Convention.jpg",
        category: "convention",
    },
    {
        title: "Neo Convention",
        lat: 17.409559214933857, 
        lng: 78.27022244950346,
        img: "/assets/markers_images/Neo_Convention.jpg",
        category: "convention",
    },
    {
        title: "K Convention",
        lat: 17.418808107611476, 
        lng: 78.24340305026368,
        img: "/assets/markers_images/K_Convention.jpg",
        category: "convention",
    },
    {
        title: "Raaga Convention",
        lat: 17.412439950288874, 
        lng: 78.2479109716403,
        img: "/assets/markers_images/Raaga_Convention.png",
        category: "convention",
    }
]; 


// --- STATE ---
let leafletMarkers = [];
let radiusCircles = {};
let currentSelectedMarker = null;
let state = {
    selectedCategories: new Set(), 
    selectedRadiuses: new Set()
};

// --- HELPER: Math for Distance ---
function haversineMeters(a, b) {
    const R = 6371000; 
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLng = (b.lng - a.lng) * Math.PI / 180;
    const s = Math.sin(dLat/2)**2 + Math.cos(a.lat*Math.PI/180)*Math.cos(b.lat*Math.PI/180)*Math.sin(dLng/2)**2;
    return 2 * R * Math.asin(Math.sqrt(s));
};

// Ensure popup is fully closed
function closeAnyPopup() {
    map.closePopup();

    if (currentSelectedMarker && currentSelectedMarker.getElement()) {
        currentSelectedMarker = null;
    };
};

function initMap() {
    // 1️⃣ Create map
    map = L.map('map', { 
        zoomControl: false, 
        attributionControl: false 
    }).setView([LAYOUT_POS.lat, LAYOUT_POS.lng], 16);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { 
        maxZoom: 19 
    }).addTo(map);

    // 2️⃣ Layout overlay bounds
    const layoutImageBounds = [
        [17.434561111111112, 78.18731666666667],  // southWest
        [17.43705277777778, 78.18842777777778]    // northEast
    ];

    L.imageOverlay("./assets/ncd_map_layout.webp", layoutImageBounds, { 
        opacity: 1
    }).addTo(map);

    // 3️⃣ Project marker icon
    const layoutIcon = L.icon({ 
        iconUrl: './assets/markers/education.png', 
        iconSize: [50, 50], 
        iconAnchor: [25, 50], 
        popupAnchor: [0, -50] 
    });

    // 4️⃣ Create project marker
    const projectMarker = L.marker(LAYOUT_POS, { icon: layoutIcon }).addTo(map);

    // 🔹 IMPORTANT: store globally
    projectMarkerRef = projectMarker;

    // 5️⃣ Create popup DOM
    const popupNode = document.createElement('div');
    popupNode.className = "relative w-[190px] p-5 rounded-xl bg-gradient-to-b from-gray-800 via-gray-900 to-black border border-white/20 shadow-[0_15px_40px_rgba(0,0,0,0.8)] flex flex-col items-center";

    popupNode.innerHTML = `
        <div id="close-project-btn" class="cursor-pointer absolute -top-3 -right-3 w-7 h-7 bg-[#ff5f5f] hover:bg-[#ff4444] rounded-full flex items-center justify-center text-white shadow-lg border-2 border-gray-900 transition-transform hover:scale-110">
            <i class="fa-solid fa-xmark text-xs font-bold"></i>
        </div>
        <div class="mb-3">
            <img src="assets/logo.webp" class="w-12 h-12 object-contain drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]" alt="Royal Pavilion Logo">
        </div>
        <div class="text-center">
            <p class="text-[8px] text-gray-400 font-bold tracking-[0.2em] uppercase mb-1">NCD</p>
            <h1 class="text-lg text-white font-bold tracking-wider leading-tight drop-shadow-md">Royal Pavilion</h1>
        </div>
    `;

    // 6️⃣ Close button logic
    const closeBtn = popupNode.querySelector('#close-project-btn');

    closeBtn.addEventListener('click', (e) => {
        L.DomEvent.stop(e);
        projectMarker.closePopup();
    });

    // 7️⃣ Bind popup (correct offset)
    projectMarker.bindPopup(popupNode, {
        closeButton: false,
        autoClose: false,
        closeOnClick: false,
        offset: [0, -46],  // 🔥 fixed alignment (above pin)
        className: 'custom-popup-clean'
    }).openPopup();

    // 8️⃣ Map click closes everything
    map.on("click", () => {
        if (projectMarkerRef) projectMarkerRef.closePopup();
        closeAnyPopup();
    });
}

function initUI() {
    const rContainer = document.getElementById('radiusContainer');
    rContainer.innerHTML = '';

    RADIUS_CONFIG.forEach(opt => {
        const div = document.createElement('div');

        div.innerHTML = `
            <label class="flex items-center gap-2 cursor-pointer group">
                <input type="checkbox" class="custom-checkbox" value="${opt.km}" style="color: ${opt.color}">
                <span class="text-sm font-medium text-gray-300 group-hover:text-white transition" style="text-shadow: 0 0 10px ${opt.color}">${opt.label}</span>
            </label>
        `;

        div.querySelector('input').addEventListener('change', (e) => {
            if(e.target.checked) state.selectedRadiuses.add(opt.km);
            else state.selectedRadiuses.delete(opt.km);
            updateRadiusCircles();
            applyFilters();
        });

        rContainer.appendChild(div);
    });

    const cList = document.getElementById('categoryList');
    cList.innerHTML = '';

    Object.keys(CATEGORIES).forEach(key => {
        const cat = CATEGORIES[key];
        const li = document.createElement('li');

        li.innerHTML = `
            <label class="flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-white/5 transition">
                <input type="checkbox" class="custom-checkbox text-radius-5" value="${key}" ${state.selectedCategories.has(key)?'checked':''}>
                <div class="text-gray-300">${cat.icon}</div>
                <span class="text-sm text-gray-200">${cat.label}</span>
            </label>
        `;

        li.querySelector('input').addEventListener('change', (e) => {
            if(e.target.checked) state.selectedCategories.add(key);
            else state.selectedCategories.delete(key);
            applyFilters();
        });

        cList.appendChild(li);
    });

    document.getElementById('btnShowAll').addEventListener('click', () => {
        Object.keys(CATEGORIES).forEach(k => state.selectedCategories.add(k));
        document.querySelectorAll('#categoryList input').forEach(i => i.checked = true);
        applyFilters();
    }); 
    
    // Hide All: Clear Logic
    document.getElementById('btnHideAll').addEventListener('click', () => {
        state.selectedCategories.clear();
        document.querySelectorAll('#categoryList input').forEach(i => i.checked = false);
        closeAnyPopup(); 
        applyFilters();
    });

    // Reset All: Clear Logic
    document.getElementById('btnReset').addEventListener('click', () => {
        state.selectedCategories.clear();
        state.selectedRadiuses.clear();
        document.querySelectorAll('input[type="checkbox"]').forEach(i => i.checked = false);
        closeAnyPopup();
        updateRadiusCircles();
        applyFilters();
    });

    const toggleDrawer = () => {
        document.getElementById('filtersDrawer').classList.toggle('-translate-x-full');
    };

    document.getElementById('mapFilterBtn').addEventListener('click', toggleDrawer);
    document.getElementById('mapFilterCloseBtn').addEventListener('click', toggleDrawer);
};

// --- MAP LOGIC ---
function renderMarkers() {
    markersData.forEach(d => {
        const iconSvg = CATEGORIES[d.category]?.icon || '';
        const gradient = CAT_GRADIENTS[d.category] || 'linear-gradient(135deg, #777, #444)';
        
        const customIcon = L.divIcon({
            className: 'bg-transparent',
            html: `
                <div class="marker-pin" style="background: ${gradient}">
                    <div class="marker-icon-svg text-white drop-shadow-md">
                        ${iconSvg}
                    </div>
                </div>
            `,
            iconSize: [44, 44], iconAnchor: [22, 44], popupAnchor: [0, -50]
        });

        const m = L.marker([d.lat, d.lng], { icon: customIcon, title: d.title });
        m.data = d;

        m.on('click', () => {
            handleMarkerClick(m);
        });

        leafletMarkers.push(m);
    });
};

function applyFilters() {
    const listEl = document.getElementById('markersList');
    listEl.innerHTML = '';
    let count = 0;

    leafletMarkers.forEach(m => {
        const d = m.data;
        const dist = haversineMeters(LAYOUT_POS, d) / 1000;
        
        let catMatch = state.selectedCategories.has(d.category);
        let radMatch = true;

        if(state.selectedRadiuses.size > 0) {
            const maxRad = Math.max(...Array.from(state.selectedRadiuses));
            radMatch = dist <= maxRad;
        };

        if(catMatch && radMatch) {
            m.addTo(map);
            count++;
            
            const li = document.createElement('li');
            li.className = "flex justify-between items-center p-3 rounded-lg bg-white/5 border border-transparent hover:bg-white/10 hover:border-neon-green cursor-pointer transition-all duration-200 group";
            
            li.innerHTML = `
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-gray-300 group-hover:text-white group-hover:bg-neon-green/20 transition">
                        ${CATEGORIES[d.category].icon}
                    </div>
                    <div class="flex flex-col">
                        <span class="text-sm font-medium text-white truncate max-w-[140px]">${d.title}</span>
                        <span class="text-[10px] text-gray-400 font-mono">${dist.toFixed(1)} km</span>
                    </div>
                </div>
                <div class="text-gray-500 group-hover:text-neon-green transition">
                    <i class="fa-solid fa-chevron-right text-xs"></i>
                </div>
            `;

            li.onclick = () => {
                handleMarkerClick(m);
            };

            listEl.appendChild(li);
        } else {
            map.removeLayer(m);

            if(m.getPopup() && m.getPopup().isOpen()) {
                map.closePopup();
            };
        };
    });

    document.getElementById('countDisplay').innerText = count;
    document.getElementById('filtersCount').innerText = count;
};

function updateRadiusCircles() {
    Object.values(radiusCircles).forEach(c => map.removeLayer(c));
    radiusCircles = {};
    
    RADIUS_CONFIG.forEach(opt => {
        if (state.selectedRadiuses.has(opt.km)) {
            radiusCircles[opt.km] = L.circle(LAYOUT_POS, {
                radius: opt.km * 1000, 
                color: opt.color,        
                fillColor: opt.fill,     
                fillOpacity: 1,          
                weight: 2, 
                dashArray: '5,5'
            }).addTo(map);
        };
    });
};

// --- CLICK & POPUP LOGIC ---
function handleMarkerClick(marker) {
    if (projectMarkerRef) projectMarkerRef.closePopup();
    const start = L.latLng(LAYOUT_POS);
    const end = marker.getLatLng();
    
    currentSelectedMarker = marker;

    // ZOOM EFFECT
    map.fitBounds(L.latLngBounds(start, end), { 
        padding: [150, 150],
        maxZoom: 15,
        animate: true,
        duration: 1.0
    });

    // SHOW POPUP
    showPopup(marker);
};

function showPopup(marker) {
    const d = marker.data;
    let dist = (haversineMeters(LAYOUT_POS, d)/1000).toFixed(1);
    let time = Math.round((dist / 40) * 60);

    const infoBlock = d.info ? 
        `<div class="mt-2 pt-2 border-t border-white/10 text-[9px] text-gray-400 text-left leading-relaxed">
            ${d.info}
         </div>` : '';

    const html = `
        <div class="relative w-[220px] drop-shadow-2xl font-sans group">
            <div class="relative z-10 bg-[#0f172a] text-white rounded-lg overflow-hidden border border-white/10">
                <div class="h-24 w-full overflow-hidden relative">
                    <img src="${d.img}" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110">
                    <div class="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
                    <h3 class="absolute bottom-2 left-2 font-bold text-sm leading-tight pr-2 drop-shadow-md">${d.title}</h3>
                </div>
                <div class="p-3 text-center">
                    <div class="flex items-center justify-center gap-3 text-xs text-gray-300 bg-white/10 rounded py-1.5 border border-white/5">
                        <div class="flex flex-col">
                            <span class="font-bold text-white text-sm">${dist} km</span>
                            <span class="text-[10px] uppercase opacity-70">Distance</span>
                        </div>
                        <div class="w-[1px] h-6 bg-white/20"></div>
                        <div class="flex flex-col">
                            <span class="font-bold text-white text-sm">${time} mins</span>
                            <span class="text-[10px] uppercase opacity-70">Time</span>
                        </div>
                    </div>
                    ${infoBlock}
                </div>
            </div>
            <div class="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-[#0f172a] rotate-45 border-r border-b border-white/10 z-0"></div>
        </div>
    `;
    
    // Open popup slightly above the marker pin
    L.popup({
  offset: [0, -46],          // push popup above the pin
  className: 'bg-transparent shadow-none border-0',
  closeButton: false,
  autoClose: true,
  closeOnClick: true
}).setLatLng(marker.getLatLng()).setContent(html).openOn(map);
};

// --- INIT ---
// window.addEventListener('load', function () {
//     initMap();
//     initUI();
//     renderMarkers();
//     applyFilters();
// });

function ensureMap() {
    if (mapInitialized) {
        // if already created, just refresh sizing when tab opens
        requestAnimationFrame(() => {
            map.invalidateSize(true);
        });
        return;
    }

    initMap();
    initUI();
    renderMarkers();
    applyFilters();

    mapInitialized = true;

    // make sure size is computed after it becomes visible
    requestAnimationFrame(() => {
        map.invalidateSize(true);
    });
}

// -------------------- GALLERY SECTION --------------------
const updateGalleryImage = () => {
    galleryImage.src = data?.gallery[CURRENT_INDEX].url;
    galleryItemLabel.textContent = data?.gallery[CURRENT_INDEX].label;
}; // Update Gallery Image

galleryPrevBtn.addEventListener("click", () => {
    if (CURRENT_INDEX > 0) {
        CURRENT_INDEX--;
        updateGalleryImage();
    };
}); // Gallery Previous Button Event Listener

galleryNextBtn.addEventListener("click", () => {
        if (CURRENT_INDEX < data?.gallery.length-1) {
        CURRENT_INDEX++;
        updateGalleryImage();
    };
}); // Gallery Next Button Event Listener

galleryExpand.addEventListener('click', () => {
    galleryItemsListWrapper.classList.remove('hidden');
    galleryItemsListWrapper.classList.add('block');
});

galleryCollapse.addEventListener('click', () => {
    galleryItemsListWrapper.classList.remove('block');
    galleryItemsListWrapper.classList.add('hidden');
});

// -------------------- FULL & EXIT SCREEN SECTION --------------------
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
}; // Toggle Full Screen Function

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
}; // Toggle Exit Screen Function

fullScreenBtn.addEventListener("click", toggleFullScreen); // Toggle Full Screen Event Listener
fullScreenBtn.addEventListener("touchstart", toggleFullScreen); // Toggle Full Screen Event Listener
exitScreenBtn.addEventListener("click", toggleExitScreen); // Toggle Exit Screen Event Listener
exitScreenBtn.addEventListener("touchstart", toggleExitScreen); // Toggle Exit Screen Event Listener

// -------------------- COMMON BUTTONS SECTION --------------------
const baseUrl = window.location.href; // Base URL

async function shareBrochure() {
    if (navigator.share) {
        try {
            await navigator.share({
                title: `${data?.title}`,
                text: `${data?.title} Brochure`,
                url: `${baseUrl}${data?.brochure}`
            });
            // console.log('Content shared successfully');
        } catch (err) {
            console.error('Error sharing:', err);
        };
    } else {
        alert('Web Share API not supported in this browser.');
    };
}; // Share Brochure

async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        alert('Copied to clipboard!');
    } catch (err) {
        console.error('Failed to copy:', err);
        alert('Could not copy the link. Please try manually.');
    };
}; // Copy To Clipboard

const homeBtnCallback = () => {
    sectionHistory = [];
    sectionHistory.push('home');
    // console.log("Secition History:", sectionHistory);

    backBtn.classList.remove('flex');
    backBtn.classList.add('hidden');

    bgAudioBtn.classList.remove("hidden");
    bgAudioBtn.classList.add("block");

    features.classList.add('translate-x-full');

    bgAudioIcon.classList.remove('fa-volume-high');
    bgAudioIcon.classList.add('fa-volume-xmark');

    preloadImages(data?.layout?.totalFrames, data?.layout?.dayFrames, data?.layout?.nightFrames);

    themeToggleInput.checked = true;
    document.getElementById("themeSwitch").classList.remove("dark");
    timeOfDay = 'night';

    bgAudioSource.src = data?.layout?.audio?.src;
    bgAudioSource.type = data?.layout?.audio?.type;

    bgAudio.load();

    VIEW_TYPE = "spin view";
    SVG_TYPE = "apartments";

    orientationEl.classList.remove('hidden');
    orientationEl.classList.add('flex');
    typeEl.classList.remove('hidden');
    typeEl.classList.add('flex');
    unitEl.classList.remove('hidden');
    unitEl.classList.add('flex');

    svgTypesList.forEach(item => {
        item.classList.remove('!bg-[#DC0073]');
    });

    svgTypesList.forEach(type => {
        if (type.getAttribute('data-type') === 'apartments') {
            type.classList.add('!bg-[#DC0073]', 'transition-colors',  'duration-700', 'ease-in-out', 'delay-100');
        };
    });

    viewTypesList.forEach(item => {
        item.classList.remove('!bg-[#DC0073]');
    });

    viewTypesList.forEach(view => {
        if (view.getAttribute('data-type') === 'spin view') {
            view.classList.add('!bg-[#DC0073]', 'transition-colors',  'duration-700', 'ease-in-out', 'delay-100');
        };
    });

    toggleSwitch.classList.remove("on");
    toggleSwitch.classList.contains('on') ? blockSvg.classList.add('hidden') : blockSvg.classList.remove('hidden');

    reset();
    updateLayoutImage();
    updateBlockImage();
    resetBrowserUrl();
    removeBlockSVG();

    fetchBlockSVGContent(towerData?.flatWiseSvgs[BLOCK_CURRENT_FRAME * BLOCK_DEGREE]);
    home.classList.remove('hidden');
    home.classList.add('block');

    webverseFilterBtn.classList.remove('inline-flex');
    webverseFilterBtn.classList.add('hidden');

    webverseFilters.classList.add("hidden");
    webverseFilters.classList.remove("block");

    themeToggleContainer.classList.remove('inline-flex');
    themeToggleContainer.classList.add('hidden');

    featuresList.forEach(item => {
        item.querySelector('div').classList.remove('from-[#6F2E48]', 'to-[#F7AA47]', 'bg-gradient-to-br');

        if (item.getAttribute('data-type') === 'home') {
            item.querySelector('div').classList.add('from-[#6F2E48]', 'to-[#F7AA47]', 'bg-gradient-to-br');
        };
    });

    leftPanel.classList.add("hidden");
    leftPanel.classList.remove("block");
    spimLogo.classList.add("inline-flex");
    spimLogo.classList.remove("hidden");
    liveBtnWrapper.classList.remove("block");
    liveBtnWrapper.classList.add("hidden");
    bgAudioWrapper.classList.remove("block");
    bgAudioWrapper.classList.add("hidden");
    homeBtn.classList.remove("flex");
    homeBtn.classList.add("hidden");
    clubhouseEl.classList.add('hidden');
    clubhouseEl.classList.remove('block');
    blockSvg.classList.add('block');
    blockSvg.classList.remove('hidden');
    // hideOverlay.classList.add('block');
    // hideOverlay.classList.remove('hidden');
    svgTypes.classList.add('block');
    svgTypes.classList.remove('hidden');
    webverse.classList.add('hidden');
    // unitPlanBtnsWrapper.classList.add('hidden');
    webverseBlock.classList.add('hidden');
    interior.classList.add('hidden');
    floorPlans.classList.add('hidden');
    clubhouseFloorPlans.classList.add('hidden');
    amenities.classList.add('hidden');
    about.classList.add('hidden');
    exterior.classList.add('hidden');
    googlemap.classList.add('hidden');
    gallery.classList.add('hidden');
    brochure.classList.add('hidden');
    unitPlans.classList.add('hidden');
    backBtn.classList.add('hidden');
    // contact.classList.add('hidden');
};

homeBtn.addEventListener('click', homeBtnCallback); // Home Button Event Listener
unitPlansHomeBtn.addEventListener('click', homeBtnCallback); // Unit Plan Home Button Event Listener

shareBrochureBtn.addEventListener('click', shareBrochure); // Share Brochure Event Listener

function updateAudioIcon() {
    if (bgAudio.muted) {
        bgAudioIcon.classList.remove('fa-volume-high');
        bgAudioIcon.classList.add('fa-volume-xmark');
    } else {
        bgAudioIcon.classList.remove('fa-volume-xmark');
        bgAudioIcon.classList.add('fa-volume-high');
    };
}; // Update Audio Icon Function

bgAudioBtn.addEventListener('click', () => {
    bgAudio.load();
    bgAudio.play(); // Explicitly play after user interaction
    bgAudio.muted = !bgAudio.muted;
    updateAudioIcon();
}); // Background Audio Button Event Listener

themeToggleInput.addEventListener('click', (e) => {
    timeOfDay = e.target.checked ? 'night' : 'day';
    //blockUpdateVideo();
    updateBlockImage();
    updateLayoutImage();
}); // Theme Toggle Input Event Listener

// ---------- Floor Plans Section ----------
const updateFloorPlanLabel = (label) => {
    floorNumberLabel.textContent = label;
}; // Update Floor Plan Label Function

const fetchFloorSVGContent = async (url) => {
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
    };

    const svgContent = await response.text();
    const cleanedSVG = removeXMLDeclaration(svgContent);
    floorSvg.innerHTML = cleanedSVG;

    const floorSVG = d3.select("#floorSvg svg");

    floorSVG.selectAll('g')
        .filter(function () {
            const id = d3.select(this).attr('id');
            return id && /^Flat_.*_Floor_.*$/.test(id);
        })
        .style('stroke-width', '1px') // Might not affect <g> directly
        .style('stroke', 'rgba(255,255,255,1)')
        .style('fill', 'transparent')
        .on('mouseover', highlight)
        .on('mouseout', unhighlight)
        .on("touchstart", highlight)
        .on("touchend", unhighlight)
        .on('click', function () {
            sectionHistory.push('unitPlans');
            // console.log("Section History:", sectionHistory);
            unitId = d3.select(this).attr("id");
            unitPlanTowerNumberLabel.textContent = `${towerId.replace("_", " ")}`;
            unitPlanFloorNumberLabel.textContent = `Floor: ${unitId.split('_')[3]}`;
            unitPlanFlatNumberLabel.textContent = `Flat: ${unitId.split('_')[1]}`;
            console.log('flatId', unitId);
            // unitPlanBtnsWrapper.classList.remove("hidden");
            // unitPlanBtnsWrapper.classList.add("block");
            window.history.replaceState({}, "", `${window.location.pathname}?unitId=${unitId}`);
            const apartmentData = getFilteredApartmentById(unitId);
            unitPlanFlatOrientLabel.textContent = `${apartmentData.orientation}`;
            unitPlanFlatSizeLabel.textContent = `${apartmentData.size} ${apartmentData.unit}`;
            // console.log("2498", towerId, unitId, apartmentData);
            renderSpecifications(apartmentData);
            unitPlanImg.src = apartmentData["2dImage"];
            webverseFilterBtn.classList.remove('inline-flex');
            webverseFilterBtn.classList.add('hidden');
            webverseFilters.classList.remove("block");
            webverseFilters.classList.add("hidden");
            themeToggleContainer.classList.remove('inline-flex');
            themeToggleContainer.classList.add('hidden');
            webverse.classList.add('hidden');
            clubhouseFloorPlans.classList.add('hidden');
            floorPlans.classList.add('hidden');
            floorPlans.classList.remove('block');
            unitPlans.classList.remove('hidden', 'opacity-0');
            unitPlans.classList.add('block', 'opacity-100');
            clubhousesDropdown.classList.remove("block");
            clubhousesDropdown.classList.add("hidden");
        });

};

const updateFloorPlanImg = () => {
    const floorData = data?.floors?.filter(each => each.towerId === towerId).find(each => each.floorId === `Floor_${floorPlan}`);
    floorPlanImg.src = floorData?.["2dImage"];
    floorPlanImg.classList.remove('opacity-100');
    floorPlanImg.classList.add('opacity-0');

    setTimeout(() => {
        floorPlanImg.classList.remove('opacity-0');
        floorPlanImg.classList.add('opacity-100')
    }, 800);

    const svg2D = floorData?.["2dSvg"];
    fetchFloorSVGContent(svg2D);
}; // Update Floor Plan Image Function

const updateApartmentPlanImg = () => {
    unitPlanImg.src = ``;
    unitPlanImg.classList.remove('opacity-100');
    unitPlanImg.classList.add('opacity-0');

    setTimeout(() => {
        unitPlanImg.classList.remove('opacity-0');
        unitPlanImg.classList.add('opacity-100')
    }, 800);
};
        
floorPrevBtn.addEventListener('click', () => {
    if (floorPlan > 0) {
        floorPlan--;
        updateFloorPlanImg();
        updateFloorPlanLabel(`Floor: ${floorPlan+1}`);
    };
}); // Floor Plan Previous Button Event Listener

floorNextBtn.addEventListener('click', () => {
    if (floorPlan < MAX_FLOORS) {
        floorPlan++;
        updateFloorPlanImg();
        updateFloorPlanLabel(`Floor: ${floorPlan+1}`);
    };
}); // Floor Plan Next Button Event Listener

// ---------- Unit Plan Section ----------
const updateUnitPlanImg = (url) => unitPlanImg.src = url; // Update Unit Plan Image Function

unitPlanBtnsList.forEach(eachBtn => {
    eachBtn.addEventListener("click", () => {
        const apartmentData = getFilteredApartmentById(unitId);
        // console.log("eachBtn", apartmentData);
        const url =  eachBtn.getAttribute("data-type") === "2d" ? apartmentData["2dImage"] : apartmentData["isometricImage"];
        // console.log("url", url);
        updateUnitPlanImg(url);

        unitPlanBtnsList.forEach(item => {
            item.classList.remove('bg-gradient-to-br','from-[rgb(2,62,101)]','to-[rgb(62,122,161)]',
                                  'hover:from-[rgb(1,50,85)]','hover:to-[rgb(52,110,150)]',
                                  'opacity-100','ring-1','ring-white/40','border','border-white/40',
                                  'shadow-[inset_0_1px_0_rgba(255,255,255,0.28),inset_0_-8px_14px_rgba(0,0,0,0.18),0_10px_22px_rgba(0,0,0,0.35)]');
        });

        eachBtn.classList.add('bg-gradient-to-br','from-[#F7AA47]','to-[#6F2E48]',
                              'hover:from-[#6F2E48]','hover:to-[#F7AA47]',
                              'text-white','opacity-100','ring-1','ring-white/40','border','border-white/40',
                              'shadow-[inset_0_1px_0_rgba(255,255,255,0.28),inset_0_-8px_14px_rgba(0,0,0,0.18),0_10px_22px_rgba(0,0,0,0.35)]');
    });
});

const renderAmenities = (data) => { 

    while(document.getElementById("amenitiesList").firstChild ) { 
        document.getElementById("amenitiesList").removeChild(document.getElementById("amenitiesList").firstChild);
    }; 

    data.forEach(each => {
        const amenityListItem = document.createElement("li");
        amenityListItem.classList.add("flex", "flex-col", "bg-black/90", "rounded-2xl", "overflow-hidden", "group", "transition-all", "duration-300", "border", "border-[#D4A373]", "border-[#D4A373]/80", "hover:border-[#D4A373]", "shadow-md", "hover:shadow-lg", "transform", "hover:-translate-y-1");

        const amenityImageWrapper = document.createElement("div");
        amenityImageWrapper.classList.add("relative", "h-54", "overflow-hidden");

        const amenityImage = document.createElement("img");
        amenityImage.src = each.img;
        amenityImage.alt = each.title;
        amenityImage.loading = "eager";
        amenityImage.classList.add("select-none", "w-full", "h-full", "object-cover", "group-hover:scale-105", "transition-transform", "duration-300", "ease-in-out");

        const amenityBadge = document.createElement("span");
        amenityBadge.classList.add("select-none", "capitalize", "inline-flex", "items-center", "gap-2", "absolute", "top-3", "left-3", "bg-[#F0F0F0]", "text-black", "backdrop-blur-sm", "px-2.5", "py-1", "rounded-full", "text-sm", "font-semibold", "shadow-md");

        const amenityIcon = document.createElement("i");
        amenityIcon.classList.add(...each.icon);

        amenityBadge.appendChild(amenityIcon);
        amenityBadge.append(" ", each.category);  

        amenityImageWrapper.appendChild(amenityImage);
        amenityImageWrapper.appendChild(amenityBadge);

        const amenityContentWrapper = document.createElement("div");
        amenityContentWrapper.classList.add("flex", "flex-col", "justify-between", "flex-1", "p-4");

        const amenityTitle = document.createElement("h3");
        amenityTitle.classList.add("text-xl", "font-semibold", "text-gray-900", "mb-2", "select-none", "line-clamp-2", "text-white");
        amenityTitle.textContent = each.title;

        const amenityDescription = document.createElement("p");
        amenityDescription.classList.add("text-slate-300", "text-sm", "mb-4", "select-none", "line-clamp-3");
        amenityDescription.textContent = each.description;

        const amenityVirtualTourWrapper= document.createElement("div");
        amenityVirtualTourWrapper.classList.add("mt-auto", "self-center");

        const amenityVirtualTourBtn = document.createElement("button");

        const amenityVirtualTourIcon = document.createElement("i");
        
        amenityVirtualTourBtn.appendChild(amenityVirtualTourIcon);

        if (each.virtualTour === "") {
            amenityVirtualTourIcon.classList.add("fas", "fa-video-slash");
            amenityVirtualTourBtn.classList.add("select-none", "inline-flex", "items-center", "gap-2", "cursor-pointer", "bg-gray-600", "hover:bg-gray-700", "text-sm", "text-white", "px-3.5", "py-1.5", "rounded-full", "transition-colors", "duration-300", "flex", "items-center", "space-x-2", "border", "border-gray-600/30", "group-hover:shadow-md", "group-hover:shadow-gray-500/20");
            amenityVirtualTourBtn.append("", "No Virtual Tour");
        } else {
            amenityVirtualTourIcon.classList.add("fas", "fa-video");
            amenityVirtualTourBtn.classList.add("select-none", "inline-flex", "items-center", "gap-2", "cursor-pointer", "bg-[#6F2E48]/90", "hover:bg-[#6F2E48]/80", "text-sm", "text-white", "px-3.5", "py-1.5", "rounded-full", "transition-colors", "duration-300", "flex", "items-center", "space-x-2", "border", "border-white/30", "group-hover:shadow-md", "group-hover:shadow-[#6F2E48]/20");
            amenityVirtualTourBtn.append("", "Virtual Tour");

            amenityVirtualTourBtn.addEventListener("click", () => {
                virtualTourLink.src = each.virtualTour;
                features.classList.add('translate-x-full');
                commonBtnsWrapper.classList.add("hidden");
                logoWrapper.classList.add("hidden");
                amenities.classList.add('hidden');
                virtualTour.classList.add("block");
                virtualTour.classList.remove("hidden");
                clubhousesDropdown.classList.add("hidden");
                clubhousesDropdown.classList.remove("block");
            });
        };

        amenityVirtualTourWrapper.appendChild(amenityVirtualTourBtn);

        amenityContentWrapper.appendChild(amenityTitle);
        amenityContentWrapper.appendChild(amenityDescription);
        amenityContentWrapper.appendChild(amenityVirtualTourWrapper);

        amenityListItem.appendChild(amenityImageWrapper);
        amenityListItem.appendChild(amenityContentWrapper);

        document.getElementById("amenitiesList").appendChild(amenityListItem);
    });
};

clubhouseVirtualTour.addEventListener("click", () => {
    sectionHistory.push("clubhouseFloorPlans");
    virtualTourLink.src = "https://hookbot.in/viewer/index.php?code=3b8a614226a953a8cd9526fca6fe9ba5";
    features.classList.add('translate-x-full');
    commonBtnsWrapper.classList.add("flex");
    // logoWrapper.classList.add("hidden");
    themeToggleContainer.classList.remove('inline-flex');
    themeToggleContainer.classList.add('hidden');
    bgAudioWrapper.classList.remove("block");
    bgAudioWrapper.classList.add("hidden");
    liveBtnWrapper.classList.remove("block");
    liveBtnWrapper.classList.add("hidden");
    exterior.classList.add('hidden');
    virtualTour.classList.add("block");
    virtualTour.classList.remove("hidden");
    clubhouseEl.classList.remove("block");
    clubhouseEl.classList.add("hidden");
    clubhousesDropdown.classList.add("hidden");
    clubhousesDropdown.classList.remove("block");
});

exteriorVirtualTourBtn.addEventListener("click", () => {
    sectionHistory.push("exterior");
    virtualTourLink.src = "https://hookbot.in/viewer/index.php?code=45fbc6d3e05ebd93369ce542e8f2322d";
    features.classList.add('translate-x-full');
    commonBtnsWrapper.classList.add("flex");
    // logoWrapper.classList.add("hidden");
    themeToggleContainer.classList.remove('inline-flex');
    themeToggleContainer.classList.add('hidden');
    bgAudioWrapper.classList.remove("block");
    bgAudioWrapper.classList.add("hidden");
    liveBtnWrapper.classList.remove("block");
    liveBtnWrapper.classList.add("hidden");
    exterior.classList.add('hidden');
    virtualTour.classList.add("block");
    virtualTour.classList.remove("hidden");
    clubhousesDropdown.classList.add("hidden");
    clubhousesDropdown.classList.remove("block");
});

const renderSpecifications = (apartmentData) => {
  specificationsList.replaceChildren();
  
  apartmentData?.specifications?.forEach(spec => {
    const li = document.createElement("li");
    li.className = "cursor-pointer flex justify-between items-center py-2.5 px-4 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors group";
    li.innerHTML = `<span class="text-xs text-gray-300 font-medium group-hover:text-white transition-colors uppercase">${spec.name}</span><span class="text-xs text-[#BE9B42] font-mono font-bold">${spec.dimensions}</span>`;
    specificationsList.appendChild(li);
  });
};

const toggleSpecificationsPanel = () => {
    specificationsPanel.classList.toggle('translate-x-full');
};

specificationsPanelOpenBtn.addEventListener("click", toggleSpecificationsPanel);
specificationsPanelCloseBtn.addEventListener("click", toggleSpecificationsPanel);

const renderFloorsOptions = (options) => {

    while(floorsOptions.firstChild ) { 
        floorsOptions.removeChild(floorsOptions.firstChild);
    }; 

    options.forEach((_, index) => {
        const floorOption = document.createElement("li");
        floorOption.classList.add("h-8", "w-8", "w-full", "cursor-pointer", "rounded-md", "text-xs", "font-semibold", "flex", "items-center", "justify-center", "transition-all", "duration-200", "border", "select-none", "bg-white/5", "text-gray-400", "border-white/10", "hover:bg-white/20", "hover:text-white", "hover:border-white/30");
        floorOption.textContent = `${index+1}`;

        floorOption.addEventListener("click", () => {
            floorPlan = index;
            updateFloorPlanImg();
            updateFloorPlanLabel(`Floor: ${floorPlan+1}`);
        });

        floorsOptions.appendChild(floorOption);
    });
};

const floorNumberLabelBtn = document.getElementById("floorNumberLabelBtn");
const floorOptionsInfo = document.getElementById("floorOptionsInfo");
const totalFloorsCount = document.getElementById("totalFloorsCount");

floorNumberLabelBtn.addEventListener("click", (e) => {
    e.stopPropagation(); 

    floorOptionsInfo.classList.toggle("!visible");
    floorOptionsInfo.classList.toggle("!opacity-100");
    floorOptionsInfo.classList.toggle("!translate-y-0");
});

window.addEventListener("load", async () => {
    try {
        const response = await fetch('./js/data.json');
        data = await response.json();

        preloadImages(data?.layout?.totalFrames, data?.layout?.dayFrames, data?.layout?.nightFrames);

        bgAudioSource.src = data?.layout?.audio?.src;
        bgAudioSource.type = data?.layout?.audio?.type;

        LAYOUT_CURRENT_FRAME = data?.layout?.currentFrame;
        LAYOUT_TOTAL_FRAMES = data?.layout?.totalFrames;    
        LAYOUT_DEGREE = 360 / LAYOUT_TOTAL_FRAMES;
        LAYOUT_DEGREE_INTERVALS = data?.layout?.degreeIntervals.map(each => each * LAYOUT_DEGREE);

        if (LAYOUT_CURRENT_FRAME && LAYOUT_TOTAL_FRAMES && LAYOUT_DEGREE && LAYOUT_DEGREE_INTERVALS && LAYOUT_DEGREE_INTERVALS.length > 0) {
            layoutControls.classList.remove("hidden");
            layoutControls.classList.remove("block");
        };

        towerId = data?.towers[0].towerId;
        unitPlanTowerNumberLabel.textContent = `${towerId.replace("_", " ")}`;
        webverseTowerLabel.textContent = `Block:${towerId.replace("Block_", "")}`;
        towerData= data?.towers.find(each => each.towerId === towerId);
        unitsData = data?.flats.filter(each => each.towerId === towerId);
        BLOCK_DEGREE_INTERVALS = towerData.degreeIntervals.map(each => each * BLOCK_DEGREE);

        MAX_FLOORS = data?.floors.filter(each => each.towerId === towerId).length - 1;
        totalFloorsCount.textContent = `${towerData?.floors.length}`;

        renderFloorsOptions(towerData?.floors);

        // if (CURRENT_INDEX && BLOCK_DEGREE_INTERVALS && BLOCK_DEGREE_INTERVALS.includes(CURRENT_INDEX * BLOCK_DEGREE)) {
        //     fetchBlockSVGContent(towerData?.flatWiseSvgs[BLOCK_CURRENT_FRAME * BLOCK_DEGREE]);
        // };

        fetchLayoutSVGContent(data?.layout?.svgs[LAYOUT_CURRENT_FRAME * LAYOUT_DEGREE]);

        updateGalleryImage();

        data?.gallery.map((each, index) => {
            const galleryItem = document.createElement("li");
            galleryItem.classList.add("group",  "select-none", 'border-box', 'aspect-16/9', 'rounded-md', 'cursor-pointer');

            const imgItem = document.createElement("img");
            imgItem.classList.add("rounded-md");

            imgItem.classList.add("group-hover:scale-105", "transition-all", "duration-300", "ease-in-out");
            
            imgItem.src = each.url;
            imgItem.alt = each.label;

            imgItem.addEventListener("click", () => {
                if (CURRENT_INDEX !== index) {
                    CURRENT_INDEX = index;
                    updateGalleryImage();
                };
            });

            galleryItem.appendChild(imgItem);
            galleryItemsList.appendChild(galleryItem);
        }); // Gallery List Items3

        updateFloorPlanImg();

        galleryItemLabel.textContent = data?.gallery[CURRENT_INDEX].label;
        document.getElementById("brochureDoc").src = data?.brochure;
        updateLayoutImage();
        updateBlockImage();
        //blockUpdateVideo();
        filteredAmenities = data?.amenities;
        renderAmenities(filteredAmenities);
        renderInteriorsList(data?.variants);
        clubhouseFloorPlan = 0;
        updateClubhouseFloorPlanImg();
        updateClubhouseFloorPlanLabel();

    } catch (error) {   
        console.error('Error loading JSON:', error);
    }; 
});

const aboutCopyReraBtn = document.getElementById('aboutCopyReraBtn');
const aboutReraNumberSpan = document.getElementById('aboutReraNumber');

if (aboutCopyReraBtn && aboutReraNumberSpan) {
    aboutCopyReraBtn.addEventListener('click', async () => {
        const reraText = aboutReraNumberSpan.textContent.trim();
        const original = aboutCopyReraBtn.innerHTML;
        try {
            await navigator.clipboard.writeText(reraText);
            // Optional: Provide user feedback
            aboutCopyReraBtn.innerHTML = 'Copied!';
            setTimeout(() => {
                aboutCopyReraBtn.innerHTML = original;
            }, 1500);
        } catch (err) {
            // Optional: Feedback in case of error
            aboutCopyReraBtn.innerHTML = 'Failed!';
            setTimeout(() => {
                aboutCopyReraBtn.innerHTML = original;
            }, 1500);
        }
    });
};

const arr = [];

for (let i = 1; i<=120; i++) {
    arr.push(`assets/day_frames/block_d/ncd_royal_pavilion_day_${i}.webp`);
    // arr.push({        
    //     "id": `Villa_${i}`,
    //     "area": 0,
    //     "units": "Cents",
    //     "type": "",
    //     "orientation": "",
    //     "image": "",
    //     "svg": ""})
    console.log(arr);
};

document.addEventListener('DOMContentLoaded', function() {
    const floorPlanWrapper = document.getElementById('floorPlanWrapper');
    const unitPlanImg = document.getElementById('unitPlanImg');
    const interiorImage = document.getElementById('interiorImage');

    const options = {
        minScale: 1,
        maxScale: 2,
        bounds: false,  
        boundsPadding: 0.1,
        canvas: true   
    };

    const floorPlanWrapperInstance = panzoom(floorPlanWrapper, options);
    const unitPlanImgInstance = panzoom(unitPlanImg, options);
    const interiorImageInstance = panzoom(interiorImage, options);

    floorPlanWrapper.addEventListener('wheel', floorPlanWrapperInstance.zoomWithWheel, { passive: false });
    unitPlanImg.addEventListener('wheel', unitPlanImgInstance.zoomWithWheel, { passive: false });
    interiorImage.addEventListener('wheel', interiorImageInstance.zoomWithWheel, { passive: false });
});