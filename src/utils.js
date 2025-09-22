export function linearInterpolate(start, end, t) {
  return start + (end - start) * t;
}

export function linearInterpolate3(start, end, t) {
  return [
    linearInterpolate(start[0], end[0], t),
    linearInterpolate(start[1], end[1], t),
    linearInterpolate(start[2], end[2], t),
  ];
}
