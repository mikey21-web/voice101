const interiorsPanelCloseBtn = document.getElementById("interiorsPanelCloseBtn");
const interiorsPanel = document.getElementById("interiorsPanel");
const interiorsList = document.getElementById("interiorsList");
const interiorsPanelOpenBtn = document.getElementById("interiorsPanelOpenBtn");

const main = document.body;
const fullScreenBtn = document.getElementById('fullScreenBtn');
const exitScreenBtn = document.getElementById('exitScreenBtn');

const shareButton = document.getElementById('shareButton');
const buttonGroup = document.getElementById('buttonGroup');

const infoModel = document.getElementById("infoModel");
const infoModalOpenBtn = document.getElementById("infoModalOpenBtn");
const infoModalCloseBtn = document.getElementById("infoModalCloseBtn");

const northVariantsEl = document.getElementById("northVariants");
const southVariantsEl = document.getElementById("southVariants");

const features = document.getElementById('features');
const featuresList = document.querySelectorAll('.features li');
const featurePanelBtn = document.getElementById('featurePanelBtn');
const featurePanelCloseBtn = document.getElementById('featurePanelCloseBtn');

const interiors = [
  {
    "id": "Villa_1",
    "plotAreaInCents": 5.61,
    "landUds": 8.75,
    "superBuildUpArea": 5031.47,
    "units": "sq.ft",
    "type": "type_1",
    "bhkType": "4bhk",
    "orientation": "north",
    "image": "./assets/frontview/5.6_north.webp",
    "virtualTour": "https://hookbot.in/viewer/index.php?code=335f5352088d7d9bf74191e006d8e24c",
  },
    {
    "id": "Villa_22",
    "plotAreaInCents": 7.03,
    "landUds": 10.96,
    "superBuildUpArea": 5905.95,
    "units": "sq.ft",
    "type": "type_2",
    "bhkType": "4bhk",
    "orientation": "north",
    "image": "./assets/frontview/7.0_north.webp",
    "virtualTour": "https://hookbot.in/viewer/index.php?code=555d6702c950ecb729a966504af0a635",
  },
];

const northVariants = [
  { id: 'Villa_1', variant: '5031.47', icon: true },
  { id: 'Villa_6', variant: '4679.54', icon: true },
  { id: 'Villa_8', variant: '4150.59', icon: true },
  { id: 'Villa_10', variant: '3972.49' },
  { id: 'Villa_22', variant: '5905.95' },
  { id: 'Villa_29', variant: '5205.3' },
  { id: 'Villa_30', variant: '5929.41' },
  { id: 'Villa_38', variant: '9796.33' },
  { id: 'Villa_38', variant: '10110.93' },
  { id: 'Villa_40', variant: '8325.71' },
  { id: 'Villa_46', variant: '3791.2' },
  { id: 'Villa_21', variant: '8325.71' },
];

const southVariants = [
  { id: 'Villa_11', variant: '4773.39' },
  { id: 'Villa_31', variant: '5929.41' },
  { id: 'Villa_37', variant: '8293.71' },
  { id: 'Villa_47', variant: '6448.77' },
];

featurePanelBtn.addEventListener('click', () => {
    features.classList.toggle('translate-x-full');
});

featurePanelCloseBtn.addEventListener('click', () => {
    features.classList.add('translate-x-full');
});

shareButton.addEventListener('click', (e) => {
  e.stopPropagation();
  buttonGroup.classList.toggle('opacity-0');
  buttonGroup.classList.toggle('pointer-events-none');
  buttonGroup.classList.toggle('opacity-100');
  buttonGroup.classList.toggle('pointer-events-auto');
});

document.addEventListener('click', (e) => {
  if (!shareButton.contains(e.target) && !buttonGroup.contains(e.target)) {
    buttonGroup.classList.add('opacity-0', 'pointer-events-none');
    buttonGroup.classList.remove('opacity-100', 'pointer-events-auto');
  }
});

infoModalOpenBtn.addEventListener("click", () => {
  infoModel.classList.add("flex");
  infoModel.classList.remove("hidden");
});

infoModalCloseBtn.addEventListener("click", () => {
  infoModel.classList.remove("flex");
  infoModel.classList.add("hidden");
});

const toggleFullScreen = () => {
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

const toggleInteriorsPanel = () => {
  interiorsPanel.classList.toggle('translate-x-full');
};

interiorsPanelOpenBtn.addEventListener("click", toggleInteriorsPanel);
interiorsPanelCloseBtn.addEventListener("click", toggleInteriorsPanel);

const renderInteriors = () => {
  while (interiorsList.firstChild) {
    interiorsList.removeChild(interiorsList.firstChild);
  };
  interiors.forEach(({ id, image, plotAreaInCents, units, bhkType, orientation }) => {
    const interiorsListItem = document.createElement("li");
    interiorsListItem.classList.add("cursor-pointer", "flex", "gap-3", "border", "border-white/20", "hover:border-2", "hover:border-white/50", "hover:transition-all", "hover:duration-300", "hover:ease-in-out", "shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-18px_40px_rgba(0,0,0,0.35),0_12px_36px_rgba(0,0,0,0.35)]", "backdrop-blur-[12px]", "p-2", "rounded-2xl");
    const interiorsListImg = document.createElement("img");
    interiorsListImg.classList.add("h-16", "w-16", "object-cover", "rounded-lg");
    interiorsListImg.src = image;
    interiorsListImg.alt = `${plotAreaInCents}`;
    const interiorDetails = document.createElement("div");
    interiorDetails.classList.add("flex", "flex-col", "justify-around");
    const interiorAreaInnerWrapper = document.createElement("div");
    interiorAreaInnerWrapper.classList.add("flex", "gap-1");
    const interiorArea = document.createElement("h1");
    interiorArea.textContent = `${plotAreaInCents}`
    interiorArea.classList.add("font-bold", "text-lg", "xl:text-2xl", "text-white");
    const interiorUnits = document.createElement("h1");
    interiorUnits.textContent = "Cents"
    interiorUnits.classList.add("font-base", "capitalize", "xl:font-semibold", "text-xs", "text-gray-300", "mt-2", "xl:mt-3");
    interiorAreaInnerWrapper.appendChild(interiorArea);
    interiorAreaInnerWrapper.appendChild(interiorUnits);
    const interiorDetailsInnerWrapper = document.createElement("div");
    interiorDetailsInnerWrapper.classList.add("flex", "items-center");
    interiorDetails.appendChild(interiorAreaInnerWrapper);
    interiorDetails.appendChild(interiorDetailsInnerWrapper);
    const interiorType = document.createElement("h1");
    interiorType.textContent = `${bhkType}`;
    interiorType.classList.add("border-r-2", "uppercase", "border-white", "pr-2", "text-white", "text-xs", "xl:text-sm");
    const interiorOrientation = document.createElement("h1");
    interiorOrientation.textContent = `${orientation}`;
    interiorOrientation.classList.add("px-2", "capitalize", "text-white", "text-xs", "xl:text-sm");
    interiorDetailsInnerWrapper.appendChild(interiorType);
    interiorDetailsInnerWrapper.appendChild(interiorOrientation);
    interiorsListItem.appendChild(interiorsListImg);
    interiorsListItem.appendChild(interiorDetails);
    interiorsListItem.addEventListener("click", () => {
      window.location.href = `./virtualtour.html?villaId=${id}`;
    });
    interiorsList.appendChild(interiorsListItem);
  });
};

const renderVariants = (parent, items) => {
  items.forEach((item) => {
      const variantListItem = document.createElement("li");
      variantListItem.classList.add("cursor-pointer", "border-1", "border-white/50", "px-3", "py-0.5", "rounded-full", "text-white", "text-xs", "xl:text-sm", "font-semibold", "inline-flex", "items-center", "gap-1");
      if (item.icon) {
        const icon  = document.createElement('i');
        icon.classList.add("fa-solid", "fa-video", "mt-0.5", "mr-0.5");
        variantListItem.appendChild(icon);
      };
      variantListItem.appendChild(document.createTextNode(item.variant));
      variantListItem.addEventListener("click", () => {
        if (item.icon) {
          window.location.href = `./virtualtour.html?villaId=${item.id}`;
        } else {
          window.location.href = `./villa.html?villaId=${item.id}`;
        }
      });
      parent.appendChild(variantListItem);
  });
};

renderVariants(northVariantsEl, northVariants);
renderVariants(southVariantsEl, southVariants);

window.addEventListener("load", () => {
  renderInteriors();
});
