/* An On / Off switch on a card or sheet: the label, then a small state box (green On, dark Off), so a card with three
   switches is not three gold buttons (review of 2026.11.20-3: "three yellow On switches" on the Lumber Camp). The
   text still reads "Sell timber · On" for the tests and screen readers: the dot is only hidden. on: true lights the
   box, false darkens it, null shows a choice of two (Keep for towers · Normal or Lots) in copper. */
export function setSwitch(b, label, state, on) {
  const sig = label + '|' + (typeof state === 'string' ? state : state.dataset.key) + '|' + on; // state: words, or a picture with its key
  if (b.dataset.sw === sig) return b;
  b.dataset.sw = sig;
  b.classList.add('switch');
  b.classList.toggle('on', on === true);
  b.setAttribute('aria-pressed', String(on === true));
  const pip = document.createElement('span'), dot = document.createElement('span');
  pip.className = 'pip' + (on === null ? ' pick' : on ? ' lit' : '');
  dot.className = 'sep'; dot.textContent = ' · ';
  pip.append(dot, state);
  b.replaceChildren(label, pip);
  return b;
}
