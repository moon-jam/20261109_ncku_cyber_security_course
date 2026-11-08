(() => {
  "use strict";

  const video = document.getElementById("php2shell-video");
  if (!video) return;

  let active = null;
  let frame = 0;

  function syncPlayback() {
    const slide = video.closest(".bespoke-marp-slide");
    const nextActive = Boolean(slide?.classList.contains("bespoke-marp-active"));
    if (nextActive === active) return;

    active = nextActive;
    if (active) {
      video.play().catch(() => {
        // Browsers may require a user gesture for unmuted playback.
      });
      return;
    }

    video.pause();
    video.currentTime = 0;
  }

  function scheduleSync() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(syncPlayback);
  }

  new MutationObserver(scheduleSync).observe(document.documentElement, {
    subtree: true,
    attributes: true,
    attributeFilter: ["class"],
  });

  window.addEventListener("pageshow", scheduleSync);
  scheduleSync();
})();
