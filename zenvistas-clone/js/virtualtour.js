const virtualTourLink = document.getElementById("virtualTourLink");
const backBtn = document.getElementById("backBtn");

backBtn.addEventListener("click", () => {
    history.back();
});

const queryString = window.location.search;
let urlParams = new URLSearchParams(queryString);
let villaId = urlParams.get('villaId');
let levelId = urlParams.get('levelId');

window.addEventListener("load", async () => {
    try {
        const response = await fetch('./js/data.json');
        const data = await response.json();
        const villaData = data.find(each => each.id === villaId);
        const levelData = villaData?.plans.find(plan => plan.level === levelId);

        console.log('Villa Data:', villaData);
        console.log('Level Data:', levelData);

        if (levelId) {
            if (levelData.virtualTour !== "") virtualTourLink.src = levelData.virtualTour;
            console.log('Level Data:');
        } else {
            console.log('Villa Data:');
            if (villaData.virtualTour) virtualTourLink.src = villaData.virtualTour;
        };

    } catch (error) {
        console.error('Error loading JSON:', error);
    };
}); 