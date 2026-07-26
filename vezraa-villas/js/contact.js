const features = document.getElementById('features');
const featurePanelBtn = document.getElementById('featurePanelBtn');
const featurePanelCloseBtn = document.getElementById('featurePanelCloseBtn');
const backBtn = document.getElementById("backBtn"); // Back Button
const main = document.documentElement; // Standardized to documentElement for fullscreen
const fullScreenBtn = document.getElementById('fullScreenBtn');
const exitScreenBtn = document.getElementById('exitScreenBtn');

backBtn.addEventListener("click", () => {
    window.history.back();
});

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

if (featurePanelBtn) {
    featurePanelBtn.addEventListener('click', () => features.classList.remove('translate-x-full'));
}
if (featurePanelCloseBtn) {
    featurePanelCloseBtn.addEventListener('click', () => features.classList.add('translate-x-full'));
}