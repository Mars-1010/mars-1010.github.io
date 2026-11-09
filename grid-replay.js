const get = (id) => document.getElementById('grid-' + id);
const player = get('player');
const loading = get('loading');
const intervalMs = 2500;
const numberFormat = new Intl.NumberFormat('en-AU', { maximumFractionDigits: 1 });
const timeFormat = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'UTC',
});
const dateFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
});

try {
  const response = await fetch(new URL('assets/coursework/grid-replay-sample.json', import.meta.url));
  if (!response.ok) throw new Error('Replay sample unavailable');
  setupReplay(await response.json());
  player.hidden = false;
} catch (error) {
  loading.textContent = 'The replay could not load. The screenshot below shows the original dashboard in use.';
  loading.hidden = false;
  console.error(error);
}

function setupReplay({ timestamps, facilities, outline }) {
  const dates = timestamps.map((value) => new Date(value));
  const times = dates.map((date) => timeFormat.format(date));
  const displayDate = dateFormat.format(dates[0]);
  const last = dates.length - 1;
  const scales = {
    power: Math.max(...facilities.flatMap((facility) => facility.power)),
    emissions: Math.max(...facilities.flatMap((facility) => facility.emissions)),
  };
  const play = get('play');
  const slider = get('step');
  const modeButtons = [...player.querySelectorAll('[data-metric]')];
  let metric = 'power';
  let step = 0;
  let selected = facilities.find((facility) => facility.id === 'ERARING') ?? facilities[0];
  let timer = null;

  get('outline').setAttribute('d', outline);
  get('chart-start').textContent = times[0];
  get('chart-end').textContent = times[last] + ' UTC';
  slider.max = last;

  const markers = facilities.map((facility) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'grid-marker';
    button.title = facility.name;
    button.setAttribute('aria-label', facility.name);
    button.style.left = (facility.point[0] / 560) * 100 + '%';
    button.style.top = (facility.point[1] / 490) * 100 + '%';
    button.append(document.createElement('span'));
    button.addEventListener('click', () => {
      selected = facility;
      render();
    });
    get('map').append(button);
    return button;
  });

  function render() {
    player.dataset.metric = metric;
    for (const button of modeButtons) {
      button.setAttribute('aria-pressed', String(button.dataset.metric === metric));
    }
    for (const [index, facility] of facilities.entries()) {
      const marker = markers[index];
      const value = facility[metric][step];
      const diameter = Math.max(8, 30 * Math.sqrt(value / scales[metric]));
      marker.style.setProperty('--dot-size', diameter + 'px');
      marker.toggleAttribute('data-zero', value === 0);
      marker.setAttribute('aria-pressed', String(facility === selected));
    }

    get('name').textContent = selected.name;
    get('location').textContent = selected.fuel + ' · ' + selected.region;
    get('power').textContent = numberFormat.format(selected.power[step]) + ' MW';
    get('emissions').textContent = numberFormat.format(selected.emissions[step]) + ' tCO₂';

    const series = selected[metric];
    const max = Math.max(1, ...series);
    const points = series.map((value, index) => [5 + (260 * index / last), 68 - (58 * value / max)]);
    get('chart-line').setAttribute('d', 'M' + points.map((point) => point.join(',')).join('L'));
    get('chart-dot').setAttribute('cx', points[step][0]);
    get('chart-dot').setAttribute('cy', points[step][1]);
    get('chart-caption').textContent = metric === 'power' ? 'Generation over the hour' : 'Emissions over the hour';

    const time = times[step] + ' UTC · ' + displayDate;
    get('time').dateTime = timestamps[step];
    get('time').textContent = time;
    get('progress').textContent = (step + 1) + ' / ' + dates.length;
    slider.value = step;
    slider.setAttribute('aria-valuetext', time);
  }

  function stop(message) {
    clearInterval(timer);
    timer = null;
    play.textContent = step === last ? 'Replay again' : 'Play replay';
    get('playback-status').textContent = message;
  }

  function start(restart = false) {
    clearInterval(timer);
    if (restart || step === last) step = 0;
    render();
    play.textContent = 'Pause';
    get('playback-status').textContent = 'Playing';
    timer = setInterval(() => {
      if (step === last) {
        stop('Replay complete');
        return;
      }
      step += 1;
      render();
    }, intervalMs);
  }

  play.addEventListener('click', () => {
    if (timer !== null) stop('Paused');
    else start();
  });

  slider.addEventListener('input', () => {
    step = Number(slider.value);
    stop('Paused at selected reading');
    render();
  });

  for (const button of modeButtons) {
    button.addEventListener('click', () => {
      metric = button.dataset.metric;
      render();
    });
  }

  document.querySelector('.grid-replay-entry').addEventListener('click', () => start(true));

  render();
}
