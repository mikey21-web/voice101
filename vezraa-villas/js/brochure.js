const tabs = document.querySelectorAll(".tab-btn"); // Tabs
const main = document.body; // Main
const fullScreenBtn = document.getElementById('fullScreenBtn'); // Full Screen Button
const exitScreenBtn = document.getElementById('exitScreenBtn'); // Exit Screen Button
const screenLabel = document.getElementById("screenLabel");
const features = document.getElementById('features'); // Features
const featuresList = document.querySelectorAll('.features li'); // Features List
const featurePanelBtn = document.getElementById('featurePanelBtn'); // Features Panel Button
const featurePanelCloseBtn = document.getElementById('featurePanelCloseBtn'); // Features Panel Close Button
const backBtn = document.getElementById("backBtn"); // Back Button

featurePanelBtn.addEventListener('click', () => {
    features.classList.toggle('translate-x-full');
});
featurePanelCloseBtn.addEventListener('click', () => {
    features.classList.add('translate-x-full');
});

backBtn.addEventListener("click", () => {
    window.history.back();
});

async function shareBrochure() {
    const shareData = {
        title: "Vezraa",
        text: "Check out the Vezraa!",
        url: document.getElementById('brochureDoc').src 
    };
    if (navigator.share) {
        try {
            await navigator.share(shareData);
            console.log('Brochure shared successfully');
        } catch (err) {
            console.error('Error sharing:', err);
        }
    } else {
        alert('Web Share is not supported in this browser. You can manually copy the link.');
    }
}
document.getElementById('shareBrochureBtn').addEventListener('click', shareBrochure);

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

}); // Tabs Event Listener

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