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
const features =  document.getElementById('features'); // Features
const featuresList = document.querySelectorAll('.features li'); // Features List
const featurePanelBtn = document.getElementById('featurePanelBtn'); // Features Panel Button
const featurePanelCloseBtn = document.getElementById('featurePanelCloseBtn'); // Features Panel Close Button
const backBtn = document.getElementById("backBtn"); // Back Button
const dropdownToggle = document.getElementById('dropdownToggle');
const arrowIcon = document.getElementById("arrowIcon");
const dropdownMenu = document.getElementById('dropdownMenu');
const dropdownMenuItems = document.querySelectorAll('#dropdownMenu li');
const dropdownToggleLabel = dropdownToggle.querySelector('span');

const galleryImgs = [
    {
      "label": "Type 1",
      "url": "assets/gallery/type_1.webp",
      "type": "type_1"
    },
    {
      "label": "Type 2",
      "url": "assets/gallery/type_2.webp",
      "type": "type_2"
    },
    {
      "label": "Type 3",
      "url": "assets/gallery/type_3.webp",
      "type": "type_3"
    },
    {
      "label": "Pillar 1",
      "url": "assets/gallery/pillar_1.webp",
      "type": "amenities"
    },
    {
      "label": "Pillar 2",
      "url": "assets/gallery/pillar_2.webp",
      "type": "amenities"
    },
    {
      "label": "Pillar 3 Seam Living",
      "url": "assets/gallery/pillar_3_seam_living.webp",
      "type": "amenities"
    },
    {
      "label": "Pillar 4 Home Gen",
      "url": "assets/gallery/pillar_4_home_gen.webp",
      "type": "amenities"
    },
    {
      "label": "Pillar 5 Proption",
      "url": "assets/gallery/pillar_5_proption.webp",
      "type": "amenities"
    },
    {
      "label": "Study Space",
      "url": "assets/gallery/study_space.webp",
      "type": "amenities"
    },
    {
      "label": "Pool",
      "url": "assets/gallery/pool.webp",
      "type": "amenities"
    },
    {
      "label": "Hall",
      "url": "assets/gallery/hall.webp",
      "type": "amenities"
    },
    {
      "label": "Gym",
      "url": "assets/gallery/gym.webp",
      "type": "amenities"
    },
    {
      "label": "Clubhouse Top View",
      "url": "assets/gallery/clubhouse_top_view.webp",
      "type": "amenities"
    },
    {
      "label": "Boardroom",
      "url": "assets/gallery/boardroom.webp",
      "type": "amenities"
    },
    {
      "label": "Billards",
      "url": "assets/gallery/billards.webp",
      "type": "amenities"
    },
    {
      "label": "Zen Garden",
      "url": "assets/gallery/zen_garden.webp",
      "type": "amenities"
    },
    {
      "label": "Working Pod",
      "url": "assets/gallery/working_pod.webp",
      "type": "amenities"
    },
    {
      "label": "Swing Park",
      "url": "assets/gallery/swing_park.webp",
      "type": "amenities"
    },
    {
      "label": "Multipurpose Court",
      "url": "assets/gallery/multipurpose_court.webp",
      "type": "amenities"
    },
    {
      "label": "Lawn",
      "url": "assets/gallery/lawn.webp",
      "type": "amenities"
    },
    {
      "label": "Jogging Park",
      "url": "assets/gallery/jogging_park.webp",
      "type": "jogging_park"
    },
    {
      "label": "Cricket Pitch",
      "url": "assets/gallery/cricket_pitch.webp",
      "type": "amenities"
    },
    {
      "label": "Children Area",
      "url": "assets/gallery/childern_area.webp",
      "type": "amenities"
    },
    {
      "label": "Central Vistas",
      "url": "assets/gallery/central_vistas.webp",
      "type": "amenities"
    }
];

let dataType = "amenities";

let filteredGalleryImgs = galleryImgs.filter(img => img.type === dataType);

const toggleDropdown = () => {
    dropdownMenu.classList.toggle("hidden");
    arrowIcon.classList.toggle("rotate-180");
};

dropdownToggle.addEventListener('click', toggleDropdown);

dropdownMenuItems.forEach(item => {
    item.addEventListener("click", () => {
        dataType= item.getAttribute("data-type");

        dropdownToggleLabel.textContent = dataType === "amenities" ? "Amenities" : `Type ${dataType.split("_")[1]}`;

        toggleDropdown();
        console.log(dataType)
        filteredGalleryImgs = galleryImgs.filter(img => img.type === dataType);
        console.log(filteredGalleryImgs);
        updateGalleryImage();
        renderGalleryItems();
    });
});

backBtn.addEventListener("click", () => {
    history.back();
});

let CURRENT_INDEX = 0; // Gallery Current Index

// -------------------- FULL & EXIT SCREEN --------------------
const main = document.body; // Main
const fullScreenBtn = document.getElementById('fullScreenBtn'); // Full Screen Button
const exitScreenBtn = document.getElementById('exitScreenBtn'); // Exit Screen Button
const screenLabel  = document.getElementById("screenLabel");

featurePanelBtn.addEventListener('click', () => {
    features.classList.toggle('translate-x-full');
}); // Features Panel Button Event Listener

featurePanelCloseBtn.addEventListener('click', () => {
    features.classList.add('translate-x-full');
}); // Features Panel Close Button Event Listener

backBtn.addEventListener("click", () => {
    window.history.back();
});

// -------------------- GALLERY SECTION --------------------
const updateGalleryImage = () => {
    galleryImage.classList.remove('opacity-100');
    galleryImage.classList.add('opacity-0');
    galleryItemLabel.classList.remove('opacity-100');
    galleryItemLabel.classList.add('opacity-0');

    setTimeout(() => {
        galleryImage.src = filteredGalleryImgs[CURRENT_INDEX]?.url;
        galleryItemLabel.textContent = filteredGalleryImgs[CURRENT_INDEX]?.label;

        galleryImage.classList.remove('opacity-0');
        galleryImage.classList.add('opacity-100');
        galleryItemLabel.classList.remove('opacity-0');
        galleryItemLabel.classList.add('opacity-100');
    }, 500); 
}; // Update Gallery Image

galleryPrevBtn.addEventListener("click", () => {
    if (CURRENT_INDEX > 0) {
        CURRENT_INDEX--;
        updateGalleryImage();
    };
}); // Gallery Previous Button Event Listener

galleryNextBtn.addEventListener("click", () => {
        if (CURRENT_INDEX < filteredGalleryImgs.length-1) {
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

const renderGalleryItems = () => {
    while (galleryItemsList.firstChild) {
        galleryItemsList.removeChild(galleryItemsList.firstChild);
    };

    filteredGalleryImgs.map((each, index) => {

        const galleryItem = document.createElement("li");
        galleryItem.classList.add("group",  "select-none", 'border-box', 'w-[200px]', 'aspect-16/9', 'rounded-md', 'cursor-pointer');

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
    });
};

window.addEventListener("load", () => {
    updateGalleryImage();
    renderGalleryItems();

    console.log('filter', filteredGalleryImgs);
});