var TREND_INTERVAL_MS = 50;
var TREND_FROZEN = false;

$(document).ready(function() {
  const $canvas = $('#trend');
  const canvas = $canvas[0];
  const ctx = canvas.getContext('2d');
  
  const height = 300;
  const plotLeft = 55;
  const plotTop = 10;
  const plotBottom = height - 10;
  const plotHeight = plotBottom - plotTop;
  const pixelsPerTick = 1;
  let width = canvas.getBoundingClientRect().width || 1050;
  let plotRight = Math.max(plotLeft + 1, width - 110);
  let dotX = plotRight - 3;
  let gridOffset = 0;
  let trendTimer = null;
  let showMV = true;
  let showSP = true;
  let showOUT = true;
  const traceValues = { mv: 50, sp: 50, out: 0 };
  
  let mvHistory = [];
  let spHistory = [];
  let outHistory = [];

  function resizeCanvas() {
    const nextWidth = Math.max(1, document.documentElement.clientWidth);
    canvas.style.width = nextWidth + 'px';
    const nextPlotRight = Math.max(plotLeft + 1, nextWidth - 110);
    const oldPlotWidth = plotRight - plotLeft;
    const nextPlotWidth = nextPlotRight - plotLeft;
    const scale = oldPlotWidth > 0 ? nextPlotWidth / oldPlotWidth : 1;

    if (Math.abs(nextWidth - width) > 0.5) {
      $.each([mvHistory, spHistory, outHistory], function(i, history) {
        $.each(history, function(j, pt) {
          pt.x = plotLeft + (pt.x - plotLeft) * scale;
        });
      });
    }

    width = nextWidth;
    plotRight = nextPlotRight;
    dotX = plotRight - 3;

    const pixelRatio = window.devicePixelRatio || 1;
    const bitmapWidth = Math.round(width * pixelRatio);
    const bitmapHeight = Math.round(height * pixelRatio);
    if (canvas.width !== bitmapWidth || canvas.height !== bitmapHeight) {
      canvas.width = bitmapWidth;
      canvas.height = bitmapHeight;
    }
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  }

  function renderTrend(advance = true) {
    if (advance && !TREND_FROZEN) {
      traceValues.mv = typeof MV !== 'undefined' ? MV : 50;
      traceValues.sp = typeof SP !== 'undefined' ? SP : 50;
      traceValues.out = typeof OUT !== 'undefined' ? OUT : 0;

      $.each([mvHistory, spHistory, outHistory], function(i, history) {
        $.each(history, function(j, pt) {
          pt.x -= pixelsPerTick;
        });
      });

      const fiveSecondGridSpacing = (5000 / TREND_INTERVAL_MS) * pixelsPerTick;
      gridOffset = (gridOffset - pixelsPerTick + fiveSecondGridSpacing) % fiveSecondGridSpacing;

      mvHistory.push({ x: dotX, y: plotBottom - (traceValues.mv / 100) * plotHeight });
      spHistory.push({ x: dotX, y: plotBottom - (traceValues.sp / 100) * plotHeight });
      outHistory.push({ x: dotX, y: plotBottom - (traceValues.out / 100) * plotHeight });

      mvHistory = $.grep(mvHistory, function(pt) { return pt.x >= plotLeft; });
      spHistory = $.grep(spHistory, function(pt) { return pt.x >= plotLeft; });
      outHistory = $.grep(outHistory, function(pt) { return pt.x >= plotLeft; });
    }

    const mvY = plotBottom - (traceValues.mv / 100) * plotHeight;
    const spY = plotBottom - (traceValues.sp / 100) * plotHeight;
    const outY = plotBottom - (traceValues.out / 100) * plotHeight;
    const fiveSecondGridSpacing = (5000 / TREND_INTERVAL_MS) * pixelsPerTick;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    ctx.save();
    ctx.beginPath();
    ctx.rect(plotLeft, plotTop, plotRight - plotLeft, plotHeight);
    ctx.clip();

    // Draw grid lines before traces so the plots remain visible on top.
    ctx.lineWidth = 1;
    ctx.beginPath();
    [100, 75, 50, 25, 0].forEach(function(value) {
      const y = plotBottom - (value / 100) * plotHeight;
      ctx.moveTo(plotLeft, y);
      ctx.lineTo(plotRight, y);
    });
    for (let x = plotLeft + gridOffset; x <= plotRight; x += fiveSecondGridSpacing) {
      ctx.moveTo(x, plotTop);
      ctx.lineTo(x, plotBottom);
    }
    ctx.strokeStyle = '#ccc';
    ctx.stroke();
    
    // Draw trail
    if (showMV && mvHistory.length > 1) {
      ctx.beginPath();
      ctx.moveTo(mvHistory[0].x, mvHistory[0].y);
      $.each(mvHistory.slice(1), function(i, pt) {
        ctx.lineTo(pt.x, pt.y);
      });
      ctx.strokeStyle = '#00f';
      ctx.stroke();
    }

    if (showSP && spHistory.length > 1) {
      ctx.beginPath();
      ctx.moveTo(spHistory[0].x, spHistory[0].y);
      $.each(spHistory.slice(1), function(i, pt) {
        ctx.lineTo(pt.x, pt.y);
      });
      ctx.strokeStyle = '#f00';
      ctx.stroke();
    }

    if (showOUT && outHistory.length > 1) {
      ctx.beginPath();
      ctx.moveTo(outHistory[0].x, outHistory[0].y);
      $.each(outHistory.slice(1), function(i, pt) {
        ctx.lineTo(pt.x, pt.y);
      });
      ctx.strokeStyle = '#0a0';
      ctx.stroke();
    }

    [
      { visible: showMV, y: mvY, color: '#00f' },
      { visible: showSP, y: spY, color: '#f00' },
      { visible: showOUT, y: outY, color: '#0a0' }
    ].forEach(function(trace) {
      if (!trace.visible) return;
      ctx.beginPath();
      ctx.arc(dotX, trace.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = trace.color;
      ctx.fill();
    });

    ctx.restore();

    ctx.font = '12px sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#333';
    [100, 75, 50, 25, 0].forEach(function(value) {
      const y = plotBottom - (value / 100) * plotHeight;
      ctx.fillText(value + '%', plotLeft - 8, y);
    });

    const legendItems = [];
    if (showMV) legendItems.push({ label: 'MV', color: '#00f' });
    if (showSP) legendItems.push({ label: 'SP', color: '#f00' });
    if (showOUT) legendItems.push({ label: 'OUT', color: '#0a0' });
    const legendX = plotRight + 16;
    const legendY = height / 2 - 24;
    ctx.textAlign = 'left';
    legendItems.forEach(function(item, index) {
      const y = legendY + index * 24;
      ctx.beginPath();
      ctx.moveTo(legendX, y);
      ctx.lineTo(legendX + 18, y);
      ctx.strokeStyle = item.color;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = '#333';
      ctx.fillText(item.label, legendX + 25, y);
    });
  }

  function startTrendTimer() {
    if (trendTimer !== null) clearInterval(trendTimer);
    trendTimer = setInterval(function() {
      renderTrend();
    }, TREND_INTERVAL_MS);
  }

  $('#trend-options-toggle').on('click', function() {
    const options = document.getElementById('trend-options');
    options.hidden = !options.hidden;
    $(this).attr('aria-expanded', !options.hidden);
  });

  $('#trend-interval').on('change', function() {
    const requestedInterval = Number(this.value);
    if (!Number.isFinite(requestedInterval)) {
      this.value = TREND_INTERVAL_MS;
      return;
    }

    TREND_INTERVAL_MS = Math.max(10, Math.min(1000, Math.round(requestedInterval / 10) * 10));
    this.value = TREND_INTERVAL_MS;
    const spacing = (5000 / TREND_INTERVAL_MS) * pixelsPerTick;
    gridOffset %= spacing;
    if (!TREND_FROZEN) startTrendTimer();
    renderTrend(false);
  });

  $('#trend-show-mv').on('change', function() {
    showMV = this.checked;
    renderTrend(false);
  });

  $('#trend-show-sp').on('change', function() {
    showSP = this.checked;
    renderTrend(false);
  });

  $('#trend-show-out').on('change', function() {
    showOUT = this.checked;
    renderTrend(false);
  });

  $('#trend-freeze').on('click', function() {
    TREND_FROZEN = !TREND_FROZEN;
    $(this)
      .attr('aria-pressed', TREND_FROZEN)
      .attr('aria-label', TREND_FROZEN ? 'Resume trend' : 'Freeze trend')
      .attr('title', TREND_FROZEN ? 'Resume trend' : 'Freeze trend')
      .find('i')
      .toggleClass('bi-pause-fill', !TREND_FROZEN)
      .toggleClass('bi-play-fill', TREND_FROZEN);
    $(this).find('.visually-hidden').text(TREND_FROZEN ? 'Resume trend' : 'Freeze trend');

    if (TREND_FROZEN) {
      clearInterval(trendTimer);
      trendTimer = null;
    } else {
      startTrendTimer();
    }
    renderTrend(false);
  });

  resizeCanvas();
  window.addEventListener('resize', function() {
    resizeCanvas();
    renderTrend(false);
  });
  renderTrend(false);
  startTrendTimer();
});