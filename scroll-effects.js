/**
 * Scroll Effects — Scroll Progress Bar
 *
 * - GSAP / ScrollTrigger reveal animations were removed for performance:
 *   all sections are rendered immediately with no entrance animation.
 * - Safe onDOMReady handler handles execution whether DOM is loading or already ready.
 */

(function () {
  'use strict';

  function onDOMReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  onDOMReady(function () {
    /* -----------------------------------------------------------------------
       1. Scroll Progress Bar (GPU-Accelerated & rAF-Throttled)
    ----------------------------------------------------------------------- */
    var progressBar = document.getElementById('scrollProgressBar');
    if (progressBar) {
      var maxScroll = 1;
      var ticking = false;

      var updateMaxScroll = function () {
        maxScroll = (document.documentElement.scrollHeight - window.innerHeight) || 1;
      };

      var renderProgress = function () {
        ticking = false;
        var scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
        var ratio = Math.min(1, Math.max(0, scrollTop / maxScroll));
        progressBar.style.transform = 'scaleX(' + ratio.toFixed(4) + ')';
      };

      var onScroll = function () {
        if (!ticking) {
          ticking = true;
          requestAnimationFrame(renderProgress);
        }
      };

      updateMaxScroll();
      renderProgress();
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', function () {
        updateMaxScroll();
        onScroll();
      }, { passive: true });
    }
  });
})();
