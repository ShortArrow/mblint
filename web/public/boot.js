try {
  const root = document.documentElement;
  const theme = localStorage.getItem("mblint-theme");
  root.dataset.theme =
    theme === "light" || theme === "dark" ? theme : matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  root.dataset.labels = localStorage.getItem("mblint-labels") === "on" ? "on" : "off";
  root.dataset.left = localStorage.getItem("mblint-left") === "off" ? "off" : "on";
  root.dataset.report = localStorage.getItem("mblint-report") === "off" ? "off" : "on";
  for (const side of ["left", "right"]) {
    const width = Number(localStorage.getItem(`mblint-${side}-width`));
    if (width >= 180 && width <= 480) root.style.setProperty(`--${side}-w`, `${width}px`);
  }
} catch {}
